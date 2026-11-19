# <Plugin name>: requirements

<!--
Requirements file for an OBS Studio plugin. Save it in the plugin repository, for example as .prompts/INIT.md,
and keep it current: replace outdated statements instead of appending corrections.
Keep private information out: no local paths, user names, keys, or other people's identifiers.
-->

## Background

<!-- Who will use the plugin, in which situation, and what is hard for them today. -->

## Purpose

<!-- What the plugin lets users do, in one or two sentences. -->

## Plugin type

<!--
Filter, input source, dock, transition, or output. A filter can process the layers below it; an input source cannot
read them but gets per-item visibility hotkeys and show/hide transitions. Nothing can draw only in the preview.
-->

## Decisions

| Item | Decision | Status | Who decides, on what condition, and when |
| --- | --- | --- | --- |
| Name | <!-- display name and repository name --> | final / provisional / undecided | |
| OBS version to build against | <!-- version in buildspec.json --> | | |
| Operating systems to list | <!-- windows, macos, linux --> | | |
| License | <!-- OSI approved or FSF free, compatible with libobs (GPL-2.0-or-later) and every dependency --> | | |
| Paid model | <!-- free; free on GitHub and sold or supported elsewhere; or some features unlocked by payment (paidFeatures). Paid files without public source are not listed --> | | |
| Paid external services | <!-- none ([]), or the services users subscribe to separately, such as an AI API with their own key (paidServices) --> | | |
| Bundled assets | <!-- none, or each model, sound, font, or image with its origin and license; restrictions on commercial use (restrictedAssets) --> | | |
| Support or store page | <!-- none, or the supportUrl on booth.pm, gumroad.com, itch.io, patreon.com, ko-fi.com, or github.com/sponsors. Write it in the first release --> | | |
| Network communication | <!-- none, or where and what --> | | |

## Checked facts

<!-- Facts the plan relies on, each with how it was checked and a source (URL, command and output summary). -->

| Fact | How it was checked | Source |
| --- | --- | --- |
| | | |

## Functional requirements

### Settings

| Setting | Type | Range | Default |
| --- | --- | --- | --- |
| | | | |

### Behavior

<!-- How the plugin behaves, including edge cases: size changes of the target, zero sizes, translucent input. -->

### Languages

<!-- Locales to ship. Use OBS's own terms for things OBS already names. -->

## Non-functional requirements

<!-- Performance targets, privacy (what is sent, if anything), fees users pay to third-party services. -->

## Open questions

<!-- One subsection per question, each with options and a recommended answer with reasons. -->

### Q1: <question>

- Option A:
- Option B:
- Recommended: A, because

## Work phases

### Phase 1: work that does not start OBS Studio

<!-- Code, unit tests, headless render tests, CI. Put checks whose results can change the plan first. -->

### Phase 2: work that starts OBS Studio

<!--
Verification in a portable OBS. Confirm with the author before starting. List the checks that need window focus,
and run them together at a time when the author does not use the computer.
-->

### Phase 3: release and listing

<!--
Each external operation needs the author's approval: making the repository public, pushing tags, publishing the
release, turning on immutable releases, and registering on Plugin Soko-kun.
-->

## Completion criteria

- [ ] The plugin works in a portable OBS on Windows, checked by automation and by the author's trial
- [ ] Unit tests and the headless render test pass in CI on Windows, macOS, and Linux
- [ ] The release is immutable, every release file has a build provenance attestation, and there is no `.exe` or `.msi`
- [ ] The README states installation, usage, the license, and the use of AI if any
- [ ] `.soko-kun/config.json` declares `paidFeatures`, `paidServices`, `restrictedAssets`, and `supportUrl` if any, matching the README, and the README states the origin and license of each bundled asset
- [ ] The plugin is listed on Plugin Soko-kun, and `list_my_plugins` shows no blocker that waits for the author
