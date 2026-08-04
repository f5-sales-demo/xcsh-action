# Security model

## Keep untrusted changes credential-free

Run `validate` on `pull_request` events without XC credentials. Run `apply`, `create`, `update`, or `delete` only after code reaches a protected branch or an explicitly approved deployment environment. Do not expose XC secrets through `pull_request_target`, workflows checked out from forks, command-line arguments, or manifest files.

Grant the workflow only `contents: read` unless another step has a documented need for more. Environment protection rules are recommended for mutation jobs.

## Tool integrity

The default xcsh version and every platform digest are committed in `xcsh.lock.json`. Before execution, the Action:

1. downloads an exact immutable release asset over HTTPS;
2. verifies the compressed archive or Windows executable SHA-256;
3. verifies the extracted executable against the separately published executable SHA-256; and
4. re-verifies every executable returned from the runner tool cache.

An exact version override resolves the same digests through the GitHub release API. Missing, duplicate, malformed, or mismatched release metadata stops the step.

## Process isolation

xcsh is spawned directly with `shell: false`. Manifest paths and other inputs are individual process arguments, so shell metacharacters are never evaluated. Inline manifests are written as data to a runner temporary file.

The Action masks `api-token` and `github-token`. It does not include credentials in result JSON, step summaries, cache keys, or command arguments. xcsh receives XC credentials only through `XCSH_API_URL`, `XCSH_API_TOKEN`, and `XCSH_NAMESPACE`.

## Delete behavior

`delete` is intentionally non-interactive for automation. Protect delete workflows with branch restrictions, environments, least-privilege XC API tokens, and an explicit manifest or resource identity. Use `dry-run: client` before enabling mutation when introducing a new deletion workflow.
