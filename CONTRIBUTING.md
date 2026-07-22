# Contributing

Install Node.js 24, then run:

```console
npm ci
npm run all
```

Commit changes to `src/` and the regenerated `dist/` bundle together. Pull
requests must pass formatting, linting, type checking, unit tests, bundle
consistency, and the supported-runner integration matrix.

Release maintainers start the `Release setup-sprocket` workflow from `main` with
a new semantic action version such as `v1.0.0`. The workflow rejects an existing
version, runs the complete verification suite, creates the immutable release
tag, and updates the corresponding moving major tag.
