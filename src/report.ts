import type { Operation, ResourceOperationReport } from "./types.js";

export function parseReport(
  text: string,
  expectedOperation: Operation,
): ResourceOperationReport {
  const value = JSON.parse(text) as unknown;
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.operation !== expectedOperation
  ) {
    throw new Error("xcsh returned an incompatible aggregate report");
  }
  if (
    typeof value.success !== "boolean" ||
    !isRecord(value.counts) ||
    !Array.isArray(value.results)
  ) {
    throw new Error("xcsh returned a malformed aggregate report");
  }
  for (const field of ["total", "succeeded", "failed"] as const) {
    if (
      !Number.isSafeInteger(value.counts[field]) ||
      (value.counts[field] as number) < 0
    ) {
      throw new Error(`xcsh report count ${field} is invalid`);
    }
  }
  for (const item of value.results) {
    if (
      !isRecord(item) ||
      !Number.isSafeInteger(item.index) ||
      typeof item.status !== "string"
    ) {
      throw new Error("xcsh report contains an invalid result item");
    }
  }
  return value as unknown as ResourceOperationReport;
}

export function reportHasChanges(report: ResourceOperationReport): boolean {
  return report.results.some((result) => {
    if (
      ["created", "updated", "deleted", "new", "different"].includes(
        result.status,
      )
    )
      return true;
    if (result.status === "dry-run")
      return (
        result.action !== undefined || result.diff?.hasDifferences === true
      );
    return result.isNew === true || result.diff?.hasDifferences === true;
  });
}

export function count(report: ResourceOperationReport, status: string): number {
  return report.counts[status] ?? 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
