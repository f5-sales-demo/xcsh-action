# Live CRUD UAT

The live UAT verifies the released Marketplace Action and its installed `xcsh` executable against
one isolated health check in an authorized F5 Distributed Cloud lab namespace. Every operation is a
deterministic CLI/API operation and does not start an AI assistant or consume an LLM turn.

## GitHub environment

Create an environment named `se-uat` and restrict it to protected branches. The workflow also
rejects every ref other than `main` and has no automatic trigger.

Configure these environment values:

| Type     | Name             | Purpose                              |
| -------- | ---------------- | ------------------------------------ |
| Variable | `XCSH_API_URL`   | F5 Distributed Cloud API base URL    |
| Variable | `XCSH_NAMESPACE` | Authorized disposable UAT namespace  |
| Secret   | `XCSH_API_TOKEN` | Token scoped for namespace CRUD      |

The console username and password are not used and must not be stored. Enter the token through the
GitHub CLI's protected prompt rather than placing it on a command line:

```sh
gh secret set XCSH_API_TOKEN --repo f5-sales-demo/xcsh-action --env se-uat
```

## Run the matrix

Dispatch from `main`:

```sh
gh workflow run live-uat.yml \
  --repo f5-sales-demo/xcsh-action \
  --ref main \
  -f mode=full
```

The full matrix validates YAML, JSON, recursive discovery and an inline manifest; exercises locked
and exact xcsh versions; and tests create, get/list, apply, diff, update, export and delete. It also
checks client dry-runs, duplicate-create failure, unchanged and changed apply results, exported
fields and final absence. Live result files remain only on the ephemeral runner and are not uploaded.

The resource identity is always:

```text
healthcheck/xcsh-action-uat-healthcheck
```

`XCSH_NAMESPACE` is only the scope for health-check API calls. The workflow never creates, updates
or deletes the namespace itself, so the existing namespace remains in place after every run.

A full run first proves that identity is absent. Only then does it mark the resource safe for its
always-run cleanup. If the resource already exists, the run fails without deleting it.

## Recovery and credential lifecycle

After confirming that a leftover resource belongs to this UAT, dispatch cleanup-only:

```sh
gh workflow run live-uat.yml \
  --repo f5-sales-demo/xcsh-action \
  --ref main \
  -f mode=cleanup-only
```

Cleanup-only succeeds whether the fixed UAT resource is present or already absent. It never targets
another name or kind. The workflow deliberately does not exercise `export all`, which would enumerate
unrelated namespace resources.

Use a short-lived lab token. Remove the environment secret and revoke or rotate the token after UAT,
especially if the credential has appeared in chat, terminal history or any other non-secret channel.
