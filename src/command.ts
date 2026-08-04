import type { ActionInputs } from "./types.js";

const MANIFEST_OPERATIONS = new Set([
  "apply",
  "create",
  "update",
  "diff",
  "validate",
]);
const DRY_RUN_OPERATIONS = new Set(["apply", "create", "update", "delete"]);

export function buildXcshArguments(
  inputs: ActionInputs,
  manifestFiles: string[],
  resultFile: string,
): string[] {
  validateCommandInputs(inputs, manifestFiles);
  const arguments_: string[] = [inputs.operation];

  if (
    (inputs.operation === "get" || inputs.operation === "delete") &&
    manifestFiles.length === 0
  ) {
    arguments_.push(inputs.resourceKind as string);
    if (inputs.resourceName) arguments_.push(inputs.resourceName);
  } else if (inputs.operation === "export") {
    if (inputs.exportAll) arguments_.push("--all");
    else {
      arguments_.push(inputs.resourceKind as string);
      if (inputs.resourceName) arguments_.push(inputs.resourceName);
    }
  }

  if (inputs.operation !== "export") {
    for (const file of manifestFiles) arguments_.push("-f", file);
    if (inputs.recursive) arguments_.push("-R");
  }
  if (inputs.namespace) arguments_.push("-n", inputs.namespace);
  arguments_.push("-o", inputs.outputFormat);
  if (inputs.dryRun) arguments_.push("--dry-run", inputs.dryRun);
  arguments_.push("--result-file", resultFile);
  if (inputs.operation === "export" && inputs.exportFile)
    arguments_.push("-f", inputs.exportFile);
  return arguments_;
}

export function validateCommandInputs(
  inputs: ActionInputs,
  manifestFiles: string[],
): void {
  const hasFiles = manifestFiles.length > 0;
  if (MANIFEST_OPERATIONS.has(inputs.operation) && !hasFiles) {
    throw new Error(
      `${inputs.operation} requires at least one manifest from files or manifest`,
    );
  }
  if (inputs.operation === "get" && !hasFiles && !inputs.resourceKind) {
    throw new Error("get requires manifests or resource-kind");
  }
  if (inputs.operation === "delete" && !hasFiles) {
    if (!inputs.resourceKind || !inputs.resourceName)
      throw new Error(
        "delete requires manifests or both resource-kind and resource-name",
      );
  }
  if (hasFiles && (inputs.resourceKind || inputs.resourceName)) {
    throw new Error(
      "resource-kind and resource-name cannot be combined with manifest files",
    );
  }
  if (inputs.operation === "export") {
    if (hasFiles) throw new Error("export does not accept manifest files");
    if (inputs.exportAll === Boolean(inputs.resourceKind)) {
      throw new Error("export requires exactly one of all or resource-kind");
    }
    if (inputs.resourceName && !inputs.resourceKind)
      throw new Error("resource-name requires resource-kind");
  } else if (inputs.exportAll || inputs.exportFile) {
    throw new Error("all and export-file are only valid for export");
  }
  if (inputs.dryRun && !DRY_RUN_OPERATIONS.has(inputs.operation)) {
    throw new Error(`dry-run is not valid for ${inputs.operation}`);
  }
}
