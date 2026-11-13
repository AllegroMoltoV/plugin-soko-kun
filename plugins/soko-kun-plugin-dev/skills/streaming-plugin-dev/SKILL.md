---
name: streaming-plugin-dev
description: Build an OBS Studio plugin with Claude Code and get it listed on Plugin Soko-kun (配信プラグイン倉庫くん, https://soko-kun.allegromoltov.jp). Use when the user wants to create, scaffold, test, release, or publish an OBS Studio plugin (filter, source, dock, transition, or output), set up obs-plugintemplate, add headless render tests to CI, release with build provenance attestations and immutable releases, or submit a plugin to Plugin Soko-kun or fix a submission it refused.
---

# Building an OBS Studio plugin and listing it on Plugin Soko-kun

This skill walks through the stages of building an OBS Studio plugin with Claude Code, from the first requirements to a listing on Plugin Soko-kun. The knowledge comes from building ten published OBS plugins with Claude Code. Each stage lists what to do, what tends to go wrong, and when the stage is done. Details live in `references/`, and reusable files live in `templates/`.

Plugin Soko-kun checks every release against its review criteria. The single source of truth for the criteria is:

https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md

The document is in Japanese and organizes criteria into sections by kind: listing conditions (`掲載の条件`), takeover signals (`乗っ取りの兆候`), review criteria (`審査の基準`), and recommendations (`推奨`). This skill names a criterion by its ID, such as `attestation`, and does not restate it. Read the criterion in that document when you need its exact wording, because the document can change after this skill was written.

## Rules that apply to every stage

### Ask the author before writing to anything outside the working tree

Get the author's explicit approval in the conversation before each of these operations, and run them only after the approval:

- Creating a GitHub repository, or making a private repository public
- `git push` to any branch, and pushing tags
- Disabling or changing a branch ruleset, even temporarily
- Creating, publishing, or deleting a GitHub release, and deleting tags or release assets
- Changing repository settings, such as turning on immutable releases
- Registering the plugin on Plugin Soko-kun with `submit_plugin` (the default `submit` mode)

Claude Code's auto mode classifier blocks several of these operations, such as creating a public repository, disabling a ruleset, deleting tags, and `gh release create`. Do not look for a way around the block. Explain the operation, wait for the author's approval, and then run it. Keep local commands out of the same shell command as the external operation, so that a block does not also stop the local work.

Read-only operations need no approval: `gh api` GET requests, `gh run list`, `gh release view`, `get_plugin`, `search_plugins`, `list_my_plugins`, and `submit_plugin` in `check` mode.

### Separate the work that runs OBS Studio from the work that does not

Running OBS Studio occupies the author's desktop. The plugin install folder is shared with the author's own OBS and with other sessions. Split every plan into phases that do not start OBS and phases that do, and confirm with the author before each phase that starts OBS. Never move keyboard focus to OBS while the author is using the computer. See [references/local-verification.md](references/local-verification.md).

### Do not put private information into the repository

Before the repository becomes public, keep these out of every commit in its history, not only out of the latest commit: local absolute paths, user names, API keys, stream keys, exported OBS profiles (they contain the stream key), personal device names, and other people's identifiers such as channel names or video IDs. Removing a file in a new commit leaves it readable in the history. If something private was committed, rewrite the history before the first push to a public repository, and get the author's approval for the rewrite.

### Do not guess the cause of a failure

When a build, a test, or CI fails for a reason you cannot explain, do not try fixes one after another. Collect evidence first: logs, the exact command, and for render tests the images that the test compared. Ask the author to look at images when only a person can judge them. Before you change code for a bug report from the author, propose the options and let the author choose.

## Stages

| Stage | Reference | Starts OBS |
| --- | --- | --- |
| 1. Plan the plugin and choose its name | [planning.md](references/planning.md) | No |
| 2. Scaffold the repository from obs-plugintemplate | [scaffold.md](references/scaffold.md) | No |
| 3. Implement | [obs-api-pitfalls.md](references/obs-api-pitfalls.md) | No |
| 4. Verify in OBS Studio on Windows | [local-verification.md](references/local-verification.md) | Yes |
| 5. Test in CI on Windows, macOS, and Linux | [ci-tests.md](references/ci-tests.md) | No (CI runs it) |
| 6. Release with attestations | [release.md](references/release.md) | Only to test the release files |
| 7. List on Plugin Soko-kun and check the listing | [soko-kun.md](references/soko-kun.md) | No |

Read the reference file of the stage you are in. Each stage below states its completion criteria. Do not start the next stage until the author agrees that the current stage is complete.

### 1. Plan

Write the requirements to a file in the repository before writing code, for example `.prompts/INIT.md`. Start from [templates/INIT.md](templates/INIT.md). Put the checks whose results can change the rest of the plan first, such as whether the chosen rendering approach works on all three operating systems. Choose the plugin type: a filter can process the layers below it, while an input source cannot read them. Choose a name without "OBS" in the display name and without the `obs-` prefix in a new repository name (`plugin-name`).

Done when:

- The requirements file lists the background, decisions (final, provisional, undecided), checked facts with sources, open questions with a recommended answer for each, the OBS and non-OBS phases, and completion criteria that include the listing on Plugin Soko-kun
- The author has answered the open questions
- The name is checked against GitHub and Plugin Soko-kun for duplicates

### 2. Scaffold

Create the repository from obs-plugintemplate and apply the fixes for its known problems. The template's release workflow does not create a release for a tag such as `v1.0.0`, and the CI still shows success. See [references/scaffold.md](references/scaffold.md) for the full list.

Done when:

- `buildspec.json` has the plugin's own `name`, `displayName`, `version` (start at `1.0.0` for the first public release), `author`, `website`, `email`, and `bundleId`
- The tag check in `push.yaml` accepts an optional `v` prefix
- A local build succeeds without installing into the shared OBS plugin folder
- The first pull request passes the template's CI on all three operating systems

### 3. Implement

Write the plugin. Read [references/obs-api-pitfalls.md](references/obs-api-pitfalls.md) before writing effects, settings, docks, or network code. Effects must compile on both Direct3D 11 and OpenGL. OBS skips an effect that fails to compile without an error dialog, so testing only on Windows Direct3D misses the failure.

Done when:

- Unit tests run in CI, and the CI log shows that they ran
- The code builds without warnings on all three operating systems, because CI treats warnings as errors
- If the plugin sends anything over the network, the README states where it goes, what it contains, and who pays for it (`user-data-handling`)

### 4. Verify in OBS Studio

Load the build into a separate, portable OBS Studio and check the behavior with automation that does not take focus. Ask the author only about how the plugin feels to use. The local verification steps in this skill are for Windows only. On macOS and Linux, rely on the headless render tests of stage 5, and on the author's own manual testing.

Done when:

- Automated checks confirm installation, settings, boundary values, error display, and saved settings after a restart
- You have looked at the rendered output yourself before asking the author to try the plugin
- The author has tried the plugin with a short guide that states the purpose and the flow of use, and has reported how it feels

### 5. Test in CI

Add a headless render test that loads the plugin into libobs without the OBS frontend and reads back pixels on Windows (Direct3D 11 on WARP), Ubuntu (Mesa llvmpipe under Xvfb), and macOS (OpenGL). Start from the files in [templates/](templates/) and read [references/ci-tests.md](references/ci-tests.md). This covers `ci-scenario-tests` for video plugins.

Done when:

- The render test passes on all three operating systems
- Removing the fix or feature under test makes the test fail, and restoring it makes the test pass
- Actions in every workflow, including the ones copied from the template, are pinned to full commit SHAs (`ci-hardening`). Do this before the first release that will be listed, because later workflow changes hold the next release for an administrator
- The format checks pass locally with the same tool versions as CI, so the CI format check does not fail (see [references/scaffold.md](references/scaffold.md))

### 6. Release

Release from a public repository. Change the release workflow so that every release file gets a build provenance attestation, turn on immutable releases, and publish a new release. See [references/release.md](references/release.md).

Done when:

- `gh api repos/<owner>/<repo>/releases/latest --jq .immutable` prints `true`
- `gh attestation verify <file> --repo <owner>/<repo>` passes for every downloaded release file
- The release has no `.exe` or `.msi` file (`distribution-format`)
- The zip from the release works in a portable OBS

### 7. List on Plugin Soko-kun

Run `submit_plugin` in `check` mode, fix what it reports, register the plugin with the author's approval, and check the state with `list_my_plugins` 15 minutes or more after each release. See [references/soko-kun.md](references/soko-kun.md).

Done when:

- `get_plugin` returns the plugin with `listed` status
- `list_my_plugins` shows no blocker that waits for the author (`waitsFor: "author"`), and the author has seen the review findings

## Templates

| File | Purpose |
| --- | --- |
| [templates/INIT.md](templates/INIT.md) | Requirements file for stage 1 |
| [templates/render-test.yaml](templates/render-test.yaml) | GitHub Actions workflow for the headless render test on three operating systems |
| [templates/render-tests.cmake](templates/render-tests.cmake) | CMake fragment that builds the render test and registers it with CTest on Windows |
| [templates/tests/obs-test-env.hpp](templates/tests/obs-test-env.hpp) | Starts libobs without the frontend and loads the plugin |
| [templates/tests/render-fixture.hpp](templates/tests/render-fixture.hpp) | Test input source, frame waiting, and pixel readback |
| [templates/tests/render-test.cpp](templates/tests/render-test.cpp) | Minimal render test with one scenario to replace with the plugin's own checks |

The templates do not contain files from obs-plugintemplate. They expect a repository created from the template, because the workflow calls the template's `build-plugin` action.
