# Setup Sprocket

`stjude-rust-labs/setup-sprocket` installs a prebuilt
[Sprocket](https://github.com/stjude-rust-labs/sprocket) release and adds the
`sprocket` executable to `PATH`.

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
matching asset. Release asset sets can differ; for example, `v0.28.0` does not
contain a macOS Intel asset.

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
