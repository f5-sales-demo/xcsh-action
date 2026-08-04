export const OPERATIONS = [
  "apply",
  "create",
  "update",
  "get",
  "delete",
  "diff",
  "export",
  "validate",
] as const;

export type Operation = (typeof OPERATIONS)[number];
export type OutputFormat = "json" | "yaml" | "table" | "wide";
export type ArchiveKind = "tar.gz" | "zip" | "executable";

export interface ActionInputs {
  operation: Operation;
  fileEntries: string[];
  inlineManifest?: string;
  recursive: boolean;
  namespace?: string;
  dryRun?: "client";
  outputFormat: OutputFormat;
  resultFile?: string;
  exportFile?: string;
  resourceKind?: string;
  resourceName?: string;
  exportAll: boolean;
  workingDirectory: string;
  version: string;
  githubToken?: string;
  apiUrl?: string;
  apiToken?: string;
}

export interface ResourceOperationItem {
  index: number;
  status: string;
  action?: "create" | "update" | "delete";
  diff?: { hasDifferences?: boolean };
  isNew?: boolean;
  [key: string]: unknown;
}

export interface ResourceOperationReport {
  schemaVersion: 1;
  operation: Operation;
  success: boolean;
  counts: Record<string, number> & {
    total: number;
    succeeded: number;
    failed: number;
  };
  results: ResourceOperationItem[];
}

export interface LockedAsset {
  archiveName: string;
  archiveSha256: string;
  archiveEntryName: string;
  binaryName: string;
  binarySha256: string;
  archiveKind: ArchiveKind;
}

export interface XcshLock {
  schemaVersion: 1;
  repository: "f5-sales-demo/xcsh";
  version: string;
  platforms: Record<string, LockedAsset>;
}

export interface ResolvedAsset extends LockedAsset {
  platformKey: string;
  version: string;
  downloadUrl: string;
}
