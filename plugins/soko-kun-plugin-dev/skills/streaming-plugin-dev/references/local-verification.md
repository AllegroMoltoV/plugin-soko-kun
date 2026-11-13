# Verifying in OBS Studio

Criteria document: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md

The steps in this file were developed and used on Windows only. They use Windows paths, PowerShell, and Windows UI Automation. This skill has no tested local steps for macOS or Linux. On those systems, rely on the headless render tests in [ci-tests.md](ci-tests.md), which run on all three operating systems, and on the author's own manual testing.

## Plan the phases

OBS Studio is effectively one instance per computer, and its plugin folder is shared. Running it from an agent can conflict with the author's own OBS and with other Claude Code sessions. Split the work into phases that do not start OBS (code, unit tests, CI) and phases that do, and confirm with the author before starting a phase that runs OBS.

## Do not take focus from the author

Automation that brings OBS to the front sends the author's keystrokes and clicks into OBS. While the author is using the computer, do not use `SetForegroundWindow`, `SetFocus`, mouse clicks, keyboard input, or anything that opens a modal dialog. Use only operations that read: UI Automation property reads, the Chrome DevTools Protocol, files, and logs.

Collect the checks that need focus, ask the author for a time when they will not use the computer, and run those checks together then.

## Use a portable OBS

Verify with a separate, portable OBS instead of the author's installed one:

1. Download the official OBS Studio zip and check its SHA-256 against the published value.
2. Extract it into a new folder, and create an empty file named `portable_mode` in that folder.
3. Start it with `--portable --disable-updater --disable-shutdown-check --multi`.

If a probe module inside OBS writes its results to a file and then closes OBS, you can start OBS with a hidden window and never take focus.

### Install layout

| OBS | Where the plugin goes |
| --- | --- |
| OBS 33, installed on Windows | `%ProgramData%\obs-studio\plugins\<name>\<name>.dll` and `%ProgramData%\obs-studio\plugins\<name>\data\` |
| OBS 33, portable | `plugins\<name>\<name>.dll` and `plugins\<name>\data\`, where `plugins` is next to `bin` and `data` in the portable folder. A portable OBS reads only this layout and does not read `%ProgramData%` |
| OBS 32, portable | The older `obs-plugins\64bit\` layout |

Older releases used `%ProgramData%\obs-studio\plugins\<name>\bin\64bit\`. When both the old and the new layout exist, OBS 33 loads the new one. Tell users of the installed OBS to use `%ProgramData%\obs-studio\plugins` (`install-location`).

## Start and stop OBS

- Start OBS with `Start-Process -PassThru` and record the process ID, so that you stop exactly that process later.
- Stop OBS by closing its window, not by killing the process. Then check the log for `Number of memory leaks: 0` and check that the `crashes` folder has no new report. A killed OBS does not save its settings, so you cannot verify saved settings after a kill.
- After a crash, the next start shows a safe mode prompt, and in safe mode OBS does not load third-party plugins. If a check fails because the plugin did not load, look for this prompt before looking for a bug.
- Write launcher scripts in ASCII. Windows PowerShell 5.1, which `.cmd` files call, fails to parse UTF-8 files without a BOM that contain non-ASCII text. Testing only with PowerShell 7 does not find this.

## When the author's own OBS must be used

If a check needs the author's installed OBS, back up the profile, `user.ini`, `global.ini`, and the scene collection JSON first, record their hashes, and restore and compare them afterwards. Never copy a profile into the portable OBS or into the repository: an exported profile contains the stream key in plain text.

## Tools for automated checks

### obs-websocket

obs-websocket can change settings and start a short recording. A short recording verifies the encoder settings used for streaming without going live. Read the password at run time from `plugin_config/obs-websocket/config.json` in the OBS configuration folder; do not copy it into scripts. Changes to the encoder and the output mode take effect after switching to another profile and back.

### Chrome DevTools Protocol for browser sources and docks

Start OBS with `--remote-debugging-port=<port>`. Then list the pages with `http://127.0.0.1:<port>/json` and read values with `Runtime.evaluate`. Reading does not change what is on screen. Use a different port for each session that runs in parallel.

### UI Automation

UI Automation reads Qt widgets without focus, but it has limits:

- Qt buttons and menus can be pressed with the Invoke pattern, but not always reliably
- Selecting a combo box item works only with the mouse
- File dialogs appear only as a Pane
- The × button of a dock cannot be pressed
- The settings dialog is modal; while it is open, docks cannot be operated

### Layout checks

UI Automation and computed styles do not tell you whether text is clipped or elements overlap. Write a check that compares positions and sizes numerically, and confirm that it fails on an input that you broke on purpose. Tools that render the UI without OBS do not apply OBS's theme margins, and a clipped label was missed that way.

## What to ask the author

Check installation, values, boundary values, error display, and saved settings with automation. Before you ask the author to try the plugin, look at the rendered output and the behavior in OBS yourself.

Ask the author only about how the plugin feels to use. Give a short guide with the purpose, the flow of use, and a place to write impressions for each situation. Do not ask the author to run boundary value tests.

Expect the author's trial to find things automation missed. In past plugins, a person found a crash when closing a detached dock with ×, a source that shifted position after removing a filter, a properties dialog that showed stale values, and usability problems.

## Background

The author of the plugins this skill is based on wrote about delegating OBS verification to Claude Code (in Japanese): https://qiita.com/AllegroMoltoV/items/37646e926b7746f95172
