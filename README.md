# xcsh Action

Run deterministic F5 Distributed Cloud manifest operations in GitHub Actions. The Action installs a pinned, SHA-256-verified `xcsh` executable and runs `apply`, `create`, `update`, `get`, `delete`, `diff`, `export`, or `validate` directly. These commands are ordinary programmatic API operations: they do not start an AI assistant and do not consume an LLM turn.

## Apply committed manifests

```yaml
name: Apply XC manifests

on:
  push:
    branches: [main]
    paths:
      - "manifests/**"

permissions:
  contents: read

jobs:
  apply:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Apply manifests
        id: xcsh
        uses: f5-sales-demo/xcsh-action@v1
        with:
          operation: apply
          files: |
            manifests/**/*.json
            manifests/**/*.yaml
            manifests/**/*.yml
          recursive: true
          api-url: ${{ secrets.XCSH_API_URL }}
          api-token: ${{ secrets.XCSH_API_TOKEN }}
          namespace: ${{ vars.XCSH_NAMESPACE }}
      - name: Show result
        env:
          CHANGED: ${{ steps.xcsh.outputs.changed }}
          RESULT_FILE: ${{ steps.xcsh.outputs.result-file }}
        run: echo "changed=${CHANGED} report=${RESULT_FILE}"
```

Use a credential-free `validate` job for pull requests, and reserve authenticated mutation for trusted branches. Complete examples are in [examples/pr-validate.yml](examples/pr-validate.yml) and [examples/apply-on-main.yml](examples/apply-on-main.yml).

## Operations

| Operation  | Inputs                                                      | Behavior                                                                            |
| ---------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apply`    | `files` or `manifest`                                       | Creates missing resources, updates changed resources, preserves identical resources |
| `create`   | `files` or `manifest`                                       | Creates resources and fails when a target already exists                            |
| `update`   | `files` or `manifest`                                       | Updates resources and fails when a target does not exist                            |
| `get`      | manifests, or `resource-kind` with optional `resource-name` | Reads or lists live resources                                                       |
| `delete`   | manifests, or `resource-kind` plus `resource-name`          | Deletes resources without an interactive confirmation                               |
| `diff`     | `files` or `manifest`                                       | Compares desired and live resources without mutation                                |
| `export`   | `resource-kind`, or `all: true`                             | Writes reusable manifests from live resources                                       |
| `validate` | `files` or `manifest`                                       | Validates locally and requires no XC credentials                                    |

The `files` input is newline-delimited. It accepts JSON/YAML files, directories, and include globs. Set `recursive: true` for recursive directory reads. Use `manifest` for inline JSON/YAML; the Action deliberately does not pipe workflow data to a shell or to stdin.

## Authentication

Authenticated operations use only the direct xcsh environment contract:

- `api-url` becomes `XCSH_API_URL`.
- `api-token` is masked and becomes `XCSH_API_TOKEN`.
- `namespace` becomes both the `-n` override and `XCSH_NAMESPACE`.

The same environment variables may be set on the step instead of using inputs. `validate` is fully local. See [docs/security.md](docs/security.md) before adding credentials to a workflow.

## Version and integrity policy

Every Action release pins a tested xcsh release in [xcsh.lock.json](xcsh.lock.json). The Action verifies the downloaded release archive against GitHub's immutable release digest, verifies the extracted executable against the separately published executable digest, and verifies the executable again on every tool-cache hit. A missing or mismatched digest fails closed.

`xcsh-version: locked` is the default. An exact override such as `v20.4.0` is allowed; the Action resolves both digests from the GitHub release API. Moving values such as `latest` are rejected. Pass `github-token: ${{ github.token }}` when an override might encounter unauthenticated API rate limits.

## Outputs

The Action always requests xcsh's stable aggregate JSON report. Important outputs are:

- `result` and `result-file`: report JSON and its on-disk path.
- `total`, `succeeded`, and `failed`: aggregate counts.
- `created`, `updated`, `unchanged`, `deleted`, `dry-run`, `new`, `different`, and `identical`: status counts.
- `changed`: `true` for mutations or detected differences.
- `xcsh-version` and `xcsh-path`: verified tool provenance.

The step fails when xcsh reports an error. `diff` reports differences through `changed` and the `different`/`new` outputs instead of treating a difference as an execution failure.

## kubectl parity

The command design follows the useful file-oriented behavior of `kubectl apply`, `create`, `replace`, `get`, `delete`, and `diff`, adapted to the F5 Distributed Cloud resource model. Kubernetes-only mechanisms such as Kustomize, label selectors, pruning, server-side apply field ownership, and cluster contexts are not emulated. The detailed comparison and source links are in [docs/kubectl-parity.md](docs/kubectl-parity.md).

## Supported runners

- Linux x64 and arm64
- macOS x64 and arm64
- Windows x64

## Development

Use Node.js 24 or newer.

```console
npm ci
npm run verify
```

`dist/index.js` is committed because GitHub runs the bundled Action entry point. Pull requests must include a bundle regenerated from the same source.
