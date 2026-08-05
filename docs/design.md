# Design and prior art

The Action is intentionally a small installer and process adapter around xcsh's deterministic resource CLI. It does not reproduce resource CRUD logic, authenticate an AI provider, or translate manifests through a model.

## Comparable Actions reviewed

- [Azure/setup-kubectl](https://github.com/Azure/setup-kubectl) demonstrates platform-specific kubectl installation for later workflow steps.
- [hashicorp/setup-terraform](https://github.com/hashicorp/setup-terraform) demonstrates a versioned CLI setup Action with a committed JavaScript bundle.
- [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv) demonstrates a cross-platform installer, tool caching, and integrity-aware release resolution.
- [helm/kind-action](https://github.com/helm/kind-action) demonstrates invoking a Kubernetes-oriented CLI safely from a JavaScript Action.

The xcsh Action differs by pinning both archive and standalone-executable digests. It verifies the archive before extraction and the executable before every run, including cache hits.

## Execution flow

```text
workflow inputs
    |
    +-- resolve files/globs/inline manifest
    +-- validate operation-specific inputs
    |
xcsh.lock.json or exact release metadata
    |
    +-- select platform asset
    +-- verify archive SHA-256
    +-- extract and verify executable SHA-256
    +-- cache verified executable
    |
spawn xcsh with shell: false
    |
    +-- stream normal CLI output
    +-- parse aggregate result JSON
    +-- publish outputs and job summary
```

The result report is the contract between xcsh and the Action. Resource behavior remains covered in the upstream `f5-sales-demo/xcsh` repository; this repository tests platform resolution, digest enforcement, argument construction, process isolation, report parsing, and the bundled Action entry point.
