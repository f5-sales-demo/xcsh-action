# kubectl file-operation parity

`xcsh` applies F5 Distributed Cloud resource manifests; it is not a Kubernetes client. The Action adopts kubectl's useful non-interactive, file-oriented workflow while keeping XC authentication and API semantics explicit. Every operation below executes programmatically without an LLM turn.

| kubectl behavior                                                                                                                    | xcsh Action behavior                                                                   | Important difference                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`kubectl apply -f`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/) creates or patches declared objects     | `operation: apply` creates, updates, or preserves each XC manifest                     | Client-side desired/live comparison; no field manager, server-side apply, prune, or Kustomize   |
| [`kubectl create -f`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/) creates declared objects              | `operation: create` fails if a resource already exists                                 | XC resource kinds and API paths replace Kubernetes discovery                                    |
| [`kubectl replace -f`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_replace/) replaces existing objects           | `operation: update` fails if a resource is missing                                     | Named `update` to match the XC API's update operation; no `--force` delete/recreate mode        |
| [`kubectl get -f`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_get/) or `get TYPE NAME` reads objects            | `operation: get` accepts manifests or `resource-kind` with an optional `resource-name` | No selectors, watches, custom columns, or Kubernetes API groups                                 |
| [`kubectl delete -f`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_delete/) or `delete TYPE NAME` deletes objects | `operation: delete` accepts either identity form and never prompts                     | No grace period, cascade policy, force deletion, selectors, or wait flag                        |
| [`kubectl diff -f`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_diff/) compares desired and live state           | `operation: diff` reports `new`, `different`, or `identical` and sets `changed`        | A difference is a successful report, not exit code 1; use the Action outputs for workflow gates |
| `kubectl ... --dry-run=client` validates locally                                                                                    | `dry-run: client` calculates create, update, or delete without mutation                | Server-side dry-run is not available                                                            |
| `kubectl get -o yaml` can be adapted as an export                                                                                   | `operation: export` emits reusable XC manifests                                        | `export` removes live-only fields and has no direct kubectl command equivalent                  |

## Common file behavior

- `files` may contain repeated JSON/YAML paths, directories, and include globs.
- JSON arrays and multi-document YAML files may contain multiple resource manifests.
- `recursive: true` maps to the intent of kubectl's recursive `-R` file traversal.
- `namespace` overrides manifest namespaces like `kubectl -n`, but it is an XC namespace—not a Kubernetes namespace.
- `manifest` supplies inline JSON/YAML without shell interpolation or stdin piping.
- Unlike kubectl, the Action does not fetch `-f` URLs or accept `-` as a file entry; commit the manifest or use `manifest` so workflow input remains explicit.
- Batch manifests are prevalidated before network operations, preventing a partially executed batch when one manifest is invalid.

## Authentication model

kubectl normally selects credentials and a cluster through kubeconfig contexts. xcsh uses the direct CI environment contract instead:

```text
XCSH_API_URL
XCSH_API_TOKEN
XCSH_NAMESPACE
```

No kubeconfig or Kubernetes context is read, and no AI provider credential is required.

## Intentionally unsupported kubectl features

- Kustomize (`-k`) and generators
- Label/field selectors and bulk selector deletion
- Pruning and apply-set tracking
- Server-side apply, field managers, and conflict forcing
- Server-side dry-run
- Kubernetes discovery, kubeconfig contexts, impersonation, and watches
- Delete grace periods, cascading policies, and force deletion

These exclusions avoid implying Kubernetes semantics that the F5 Distributed Cloud API does not provide.
