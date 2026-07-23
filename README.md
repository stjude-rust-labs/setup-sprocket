<img style="margin: 0px" alt="Setup Sprocket repository header" src="./assets/repo-header.png" />
<hr />

<p align="center">
  <a href="https://github.com/stjude-rust-labs/setup-sprocket/actions/workflows/ci.yml">
    <img alt="CI status" src="https://github.com/stjude-rust-labs/setup-sprocket/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/stjude-rust-labs/setup-sprocket/releases/latest">
    <img alt="Latest release" src="https://img.shields.io/github/v/release/stjude-rust-labs/setup-sprocket" />
  </a>
  <a href="https://github.com/stjude-rust-labs/setup-sprocket#license">
    <img alt="License: MIT or Apache-2.0" src="https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue" />
  </a>
</p>

<p align="center">
  Install and cache Sprocket releases in GitHub Actions across Linux, macOS, and Windows, with version selection and SHA-256 verification.
  <br />
  <br />
  <a href="https://github.com/stjude-rust-labs/setup-sprocket/issues/new?assignees=&title=Descriptive%20Title&labels=enhancement">Request Feature</a>
  ·
  <a href="https://github.com/stjude-rust-labs/setup-sprocket/issues/new?assignees=&title=Descriptive%20Title&labels=bug">Report Bug</a>
  ·
  ⭐ Consider starring the repo! ⭐
</p>

## Usage

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: stjude-rust-labs/setup-sprocket@v1
    with:
      version: '0.27.0'
      github-token: ${{ github.token }}
  - run: sprocket --version
```

`version` defaults to `latest`. Exact versions may include or omit the leading
`v`. The action supports Sprocket `v0.8.0` and newer because earlier releases do
not contain binary assets.

The optional `github-token` authenticates release API requests and avoids the
lower unauthenticated rate limit. The workflow's `${{ github.token }}` needs
only `contents: read`.

The `installed-version` output contains the normalized version:

```yaml
- uses: stjude-rust-labs/setup-sprocket@v1
  id: sprocket
- run: echo "${{ steps.sprocket.outputs.installed-version }}"
```

## Platforms

The action understands Linux, macOS, and Windows runners on `X64` and `ARM64`.
Installation succeeds only when the selected Sprocket release publishes the
matching asset.

The action fails rather than building from source, selecting another version, or
changing installation methods.

## Artifact verification

The action verifies the SHA-256 digest returned by GitHub's Releases API when
the selected asset includes one. Some older Sprocket assets have a null digest;
the action warns and relies on GitHub's HTTPS transport integrity for those
releases.

## Pinning

`@v1` receives backward-compatible action fixes. Pin a full action commit SHA
when your supply-chain policy requires immutable workflow dependencies. Pin the
Sprocket `version` input for reproducible tool behavior.

## License

This project is available under either the Apache License 2.0 or the MIT
License, at your option.
