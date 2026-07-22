# Release Process

## Between Releases

Merge changes through pull requests and keep the committed `dist/` bundle in
sync with `src/`. Run `npm run all` after changing the action, and commit any
resulting `dist/` changes with the source changes that produced them.

Use semantic versioning for the action's public contract. Backward-compatible
fixes and features remain available through the current moving major tag, while
breaking changes require a new major version.

## Time to Release

The [`Release setup-sprocket`](./.github/workflows/release.yml) workflow creates
releases from `main`.

1. Confirm that the release commit is on `main` and that its required checks
   pass.
2. Choose a semantic version in the form `vMAJOR.MINOR.PATCH`, e.g., `v1.2.0`.
   Released versions are immutable and cannot be reused.
3. Open **Actions**, select **Release setup-sprocket**, choose **Run workflow**,
   enter the version, and run the workflow from `main`.

The workflow installs dependencies, runs the complete project checks, rebuilds
the action, and verifies that the committed `dist/` bundle matches the rebuild.
It then creates a GitHub release with generated notes and an immutable version
tag before updating the moving major tag. For example, releasing `v1.2.0`
creates `v1.2.0` and moves `v1` to the same commit.

If the workflow creates the GitHub release but fails while updating the moving
major tag, do not delete or recreate the immutable version tag. Point the major
tag at the release commit and push it:

```bash
git fetch origin --tags
git tag --force v1 v1.2.0
git push --force origin refs/tags/v1
```

Replace `v1` and `v1.2.0` with the applicable major and release versions.

## Post-Release

- [ ] Confirm that the GitHub release contains the intended generated notes.
- [ ] Confirm that the immutable version tag and moving major tag resolve to the
      same commit.
- [ ] Run a workflow that installs Sprocket with both the immutable tag and the
      moving major tag.
- [ ] Announce breaking changes and required migration steps for a new major
      release.
