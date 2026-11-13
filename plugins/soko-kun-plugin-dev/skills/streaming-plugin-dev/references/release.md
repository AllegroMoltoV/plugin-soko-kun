# Releases with attestations

Criteria document: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md (listing conditions: `attestation`, `immutable-release`, `distribution-format`)

Plugin Soko-kun lists a release only if it is immutable, every release file has a build provenance attestation made by the repository's release workflow for that tag, and no file is an `.exe` or `.msi` installer. This file describes the workflow changes that met these conditions in published plugins, and the release procedure.

## Release from a public repository

Make the repository public before the release that you want listed. Plugin Soko-kun accepts only public repositories. In addition, GitHub's documentation states that on the GitHub Free, Pro, and Team plans, artifact attestations are available only for public repositories; private and internal repositories need GitHub Enterprise Cloud: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations

Before the repository becomes public, remove private information from the whole history (see "Do not put private information into the repository" in [SKILL.md](../SKILL.md)). Making a repository public is an external operation: get the author's approval first.

## Changes to the template's workflows

These changes were made in one pull request to a published plugin (+30 and -2 lines) and produced immutable releases with an attestation for every file. Apply them to `.github/workflows/push.yaml` and `.github/workflows/build-project.yaml` of a repository created from obs-plugintemplate.

### `push.yaml`, `create-release` job

1. Give the job its own permissions:

   ```yaml
   permissions:
     contents: write
     id-token: write
     attestations: write
   ```

2. In the tag check step, add `?(v)` to the front of both `case` patterns, so that `v1.0.0` and `v1.0.0-rc1` are accepted (see [scaffold.md](scaffold.md)).

3. After the `Generate Checksums` step and before the `Create Release` step, add two steps. The first writes the SHA-256 of every release file to a file outside the workspace:

   ```yaml
   - name: List Release Files
     if: fromJSON(steps.check.outputs.validTag)
     run: |
       shopt -s extglob
       shopt -s nullglob
       cd ${{ github.workspace }}
       files=(@(*.exe|*.zip|*.pkg|*.deb|*.ddeb|*.tar.xz))
       sha256sum "${files[@]}" > ${{ runner.temp }}/release-checksums.txt
   ```

   The pattern matches the files that the template's `Create Release` step uploads (`*.exe`, `*.zip`, `*.pkg`, `*.deb`, `*.ddeb`, `*.tar.xz`).

   The second creates the attestation for all of them, with the action pinned to a full commit SHA:

   ```yaml
   - name: Attest Build Provenance
     if: fromJSON(steps.check.outputs.validTag)
     uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2
     with:
       subject-checksums: ${{ runner.temp }}/release-checksums.txt
   ```

   Keep the file list in step 3 the same as the list of files that the release step uploads. A release file without an attestation fails the `attestation` condition.

### `build-project.yaml`

On the macOS and Ubuntu jobs, the template restores a ccache cache with `actions/cache/restore`. Add `if: github.ref_type != 'tag'` to that step in both jobs, so that tag builds start from a clean state and nothing from an earlier build's cache goes into a release.

### Further hardening

The changes above are what the listed plugins used. The review criterion `ci-hardening` asks for more: minimal `permissions` (the template sets `contents: write` at the top level of `push.yaml`), every action pinned to a full commit SHA (the template uses tags such as `actions/download-artifact@v4`), `persist-credentials: false` on checkout, and Dependabot for actions. The plugins this skill is based on did not apply all of these. Read the criterion and decide with the author. Make these changes while scaffolding, before the first release that will be listed: after listing, each later change to a workflow holds the next release, as the next paragraph explains.

Any change under `.github/workflows/`, `.github/actions/`, or `.github/scripts/` between the listed release and a new release makes Plugin Soko-kun hold the new release for an administrator (`diff-workflow-changed`). This includes the changes above when the plugin is already listed, and Dependabot updates of actions. A held release is not rejected; it waits. To explain the change, open an issue at https://github.com/AllegroMoltoV/plugin-soko-kun/issues . Adding a link or a download from a host other than the repository, `obsproject.com`, and Plugin Soko-kun has the same effect (`diff-external-link`).

## Release files

- After these changes, a release also contains the macOS `.pkg`, the Ubuntu `.deb` and `.ddeb`, and the source `.tar.xz`, in addition to the Windows `.zip`.
- The template's packaging configuration also collects `.exe` files (`'windows-x64;zip|exe'`). The default Windows packaging produced only a zip in the listed plugins. Do not attach an installer: `.exe` and `.msi` files fail `distribution-format`.
- The macOS `.pkg` from the template is not signed or notarized, and Gatekeeper rejected it. If you list only Windows, declare it in `.soko-kun/config.json` with `"os": ["windows"]` (see [soko-kun.md](soko-kun.md)).

## Turn on immutable releases

With the author's approval, turn on immutable releases in the repository settings. Read the setting back with `gh api repos/<owner>/<repo>/immutable-releases`. Only releases published after the setting is on are immutable; earlier releases stay mutable. After turning it on, publish a new version.

Check it after publishing:

```sh
gh api repos/<owner>/<repo>/releases/latest --jq .immutable
gh release view <tag> --repo <owner>/<repo> --json isImmutable,assets
```

In a listed plugin, `isImmutable` was `true` and every asset had a `digest` starting with `sha256:`.

## Release procedure

1. Merge the release changes to `main` and confirm that CI passes on `main`.
2. With the author's approval, create an annotated tag such as `v1.0.0` on that commit and push it.
3. Wait until every job of the tag's workflow run passes.
4. The workflow creates a draft release. Download the Windows zip from the draft and check its contents: the DLL's version and the `data` folder match `main`.
5. Install that zip into a portable OBS and check that the plugin works (see [local-verification.md](local-verification.md)).
6. With the author's approval, publish the release.
7. Download every release file into an empty folder, compare each SHA-256 with the asset's `digest`, and run `gh attestation verify <file> --repo <owner>/<repo>` on each file.
8. Check that `https://github.com/<owner>/<repo>/releases/latest` points to the new release.

Never move or reuse a published tag. To fix a release, publish a new version. With immutable releases, a published release and its tag cannot be changed.

Users can verify downloads with `gh attestation verify` too. Showing them how is a recommendation (`user-verification-guide`).

## When `main` is protected by a ruleset

If `main` is protected by a ruleset that requires one approving review, the author cannot approve their own pull request and cannot merge it. Some authors temporarily disable the ruleset to merge:

1. Get the author's approval for this specific merge.
2. Read the ruleset with `gh api repos/<owner>/<repo>/rulesets/<id>` and keep the output.
3. Set `enforcement` to `disabled`, merge, and set `enforcement` back to `active` right away.
4. Read the ruleset again and compare `name`, `target`, `conditions`, `rules`, and `bypass_actors` with the saved output.

Pushing tags and pushing to a working branch do not need the ruleset disabled. On the GitHub Free plan, rulesets cannot be used for private repositories (the API returns 403).
