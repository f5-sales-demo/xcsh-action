import * as core from "@actions/core";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildXcshArguments } from "./command.js";
import { expandManifestFiles } from "./files.js";
import { readActionInputs } from "./inputs.js";
import { installXcsh } from "./installer.js";
import { runExecutable } from "./process.js";
import { count, parseReport, reportHasChanges } from "./report.js";
import { resolveAsset } from "./release.js";
import type { ResourceOperationReport } from "./types.js";

const STATUS_OUTPUTS = [
  "created",
  "updated",
  "unchanged",
  "deleted",
  "dry-run",
  "new",
  "different",
  "identical",
  "valid",
  "found",
  "listed",
  "exported",
  "error",
  "skipped",
] as const;

export async function run(): Promise<void> {
  const inputs = readActionInputs();
  const workingDirectoryMetadata = await stat(inputs.workingDirectory);
  if (!workingDirectoryMetadata.isDirectory()) {
    throw new Error(
      `working-directory is not a directory: ${inputs.workingDirectory}`,
    );
  }

  const inheritedToken = process.env.XCSH_API_TOKEN;
  if (inputs.apiToken) core.setSecret(inputs.apiToken);
  else if (inheritedToken) core.setSecret(inheritedToken);
  if (inputs.githubToken) core.setSecret(inputs.githubToken);

  const runDirectory = await mkdtemp(
    path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "xcsh-action-"),
  );
  const manifestFiles = await expandManifestFiles(
    inputs.fileEntries,
    inputs.workingDirectory,
  );
  if (inputs.inlineManifest !== undefined) {
    const inlineManifestPath = path.join(runDirectory, "inline-manifest.yaml");
    await writeFile(inlineManifestPath, inputs.inlineManifest, "utf8");
    manifestFiles.push(inlineManifestPath);
  }

  const internalResultFile = path.join(runDirectory, "result.json");
  if (inputs.exportFile) {
    inputs.exportFile = path.resolve(
      inputs.workingDirectory,
      inputs.exportFile,
    );
    await mkdir(path.dirname(inputs.exportFile), { recursive: true });
  }
  const arguments_ = buildXcshArguments(
    inputs,
    manifestFiles,
    internalResultFile,
  );
  const asset = await resolveAsset({
    versionInput: inputs.version,
    platform: process.platform,
    architecture: process.arch,
    ...(inputs.githubToken ? { githubToken: inputs.githubToken } : {}),
  });
  const installed = await installXcsh(asset);
  const environment: NodeJS.ProcessEnv = { ...process.env };
  if (inputs.apiUrl) environment.XCSH_API_URL = inputs.apiUrl;
  if (inputs.apiToken) environment.XCSH_API_TOKEN = inputs.apiToken;
  if (inputs.namespace) environment.XCSH_NAMESPACE = inputs.namespace;

  core.info(`Running xcsh ${inputs.operation} without a shell`);
  const processResult = await runExecutable(installed.path, arguments_, {
    cwd: inputs.workingDirectory,
    env: environment,
  });

  let report: ResourceOperationReport;
  try {
    report = parseReport(
      await readFile(internalResultFile, "utf8"),
      inputs.operation,
    );
  } catch (error) {
    throw new Error(
      `xcsh exited with code ${processResult.exitCode.toString()} without a valid result report: ${messageFor(error)}`,
    );
  }

  const publishedResultFile = inputs.resultFile
    ? path.resolve(inputs.workingDirectory, inputs.resultFile)
    : internalResultFile;
  if (publishedResultFile !== internalResultFile) {
    await mkdir(path.dirname(publishedResultFile), { recursive: true });
    await copyFile(internalResultFile, publishedResultFile);
  }
  await publishOutputs(
    report,
    publishedResultFile,
    installed.path,
    installed.version,
  );
  await publishSummary(report, installed.version);

  if (processResult.exitCode !== 0 || !report.success) {
    throw new Error(
      `xcsh ${inputs.operation} failed (${report.counts.failed.toString()} failed)`,
    );
  }
}

async function publishOutputs(
  report: ResourceOperationReport,
  resultFile: string,
  executablePath: string,
  version: string,
): Promise<void> {
  core.setOutput("result", JSON.stringify(report));
  core.setOutput("result-file", resultFile);
  core.setOutput("total", report.counts.total.toString());
  core.setOutput("succeeded", report.counts.succeeded.toString());
  core.setOutput("failed", report.counts.failed.toString());
  core.setOutput("changed", reportHasChanges(report).toString());
  for (const status of STATUS_OUTPUTS)
    core.setOutput(status, count(report, status).toString());
  core.setOutput("xcsh-version", version);
  core.setOutput("xcsh-path", executablePath);
}

async function publishSummary(
  report: ResourceOperationReport,
  version: string,
): Promise<void> {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const statusRows = Object.entries(report.counts)
    .filter(
      ([key, value]) =>
        !["total", "succeeded", "failed"].includes(key) && value > 0,
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, value]) => [status, value.toString()]);
  core.summary
    .addHeading(`xcsh ${report.operation}`, 2)
    .addRaw(`Version: \`${version}\`\n\n`)
    .addTable([
      [
        { data: "Total", header: true },
        { data: "Succeeded", header: true },
        { data: "Failed", header: true },
      ],
      [
        report.counts.total.toString(),
        report.counts.succeeded.toString(),
        report.counts.failed.toString(),
      ],
    ]);
  if (statusRows.length > 0) {
    core.summary.addHeading("Results", 3).addTable([
      [
        { data: "Status", header: true },
        { data: "Count", header: true },
      ],
      ...statusRows,
    ]);
  }
  await core.summary.write();
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
