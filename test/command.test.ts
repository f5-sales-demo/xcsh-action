import assert from "node:assert/strict";
import test from "node:test";
import { buildXcshArguments } from "../src/command.js";
import type { ActionInputs } from "../src/types.js";

function inputs(overrides: Partial<ActionInputs> = {}): ActionInputs {
  return {
    operation: "apply",
    fileEntries: [],
    recursive: false,
    outputFormat: "table",
    exportAll: false,
    workingDirectory: "/workspace",
    version: "locked",
    ...overrides,
  };
}

test("builds repeated file arguments without interpreting shell characters", () => {
  const suspicious = "/workspace/$(touch should-not-exist).yaml";
  assert.deepEqual(
    buildXcshArguments(
      inputs(),
      ["/workspace/a.yaml", suspicious],
      "/tmp/result.json",
    ),
    [
      "apply",
      "-f",
      "/workspace/a.yaml",
      "-f",
      suspicious,
      "-o",
      "table",
      "--result-file",
      "/tmp/result.json",
    ],
  );
});

test("builds a targeted delete dry-run", () => {
  assert.deepEqual(
    buildXcshArguments(
      inputs({
        operation: "delete",
        resourceKind: "http_loadbalancer",
        resourceName: "example-load-balancer",
        namespace: "example-namespace",
        dryRun: "client",
      }),
      [],
      "/tmp/result.json",
    ),
    [
      "delete",
      "http_loadbalancer",
      "example-load-balancer",
      "-n",
      "example-namespace",
      "-o",
      "table",
      "--dry-run",
      "client",
      "--result-file",
      "/tmp/result.json",
    ],
  );
});

test("builds export all with a manifest output file", () => {
  assert.deepEqual(
    buildXcshArguments(
      inputs({
        operation: "export",
        exportAll: true,
        outputFormat: "yaml",
        exportFile: "export.yaml",
      }),
      [],
      "/tmp/result.json",
    ),
    [
      "export",
      "--all",
      "-o",
      "yaml",
      "--result-file",
      "/tmp/result.json",
      "-f",
      "export.yaml",
    ],
  );
});

test("builds a resource-kind get that lists resources", () => {
  assert.deepEqual(
    buildXcshArguments(
      inputs({ operation: "get", resourceKind: "origin_pool" }),
      [],
      "/tmp/result.json",
    ),
    ["get", "origin_pool", "-o", "table", "--result-file", "/tmp/result.json"],
  );
});

test("rejects missing manifests and invalid operation-specific inputs", () => {
  assert.throws(
    () => buildXcshArguments(inputs(), [], "/tmp/result.json"),
    /requires at least one manifest/u,
  );
  assert.throws(
    () =>
      buildXcshArguments(
        inputs({ operation: "diff", dryRun: "client" }),
        ["a.yaml"],
        "/tmp/result.json",
      ),
    /dry-run is not valid/u,
  );
  assert.throws(
    () =>
      buildXcshArguments(
        inputs({
          operation: "export",
          exportAll: true,
          resourceKind: "origin_pool",
        }),
        [],
        "r",
      ),
    /exactly one/u,
  );
});
