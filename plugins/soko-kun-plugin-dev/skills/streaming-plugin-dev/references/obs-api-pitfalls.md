# Implementation pitfalls

Criteria document: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md

These problems appeared in published plugins. Most of them do not show up as errors: OBS keeps running, and the feature silently does nothing or does the wrong thing.

## Effects and rendering

- Write type conversions in effect files in constructor form, such as `float(x)`. A C-style cast such as `(float)x` compiles in HLSL and fails in GLSL with `error C7503`. OBS then skips drawing without an error dialog, so the plugin works on Windows Direct3D 11 and draws nothing on macOS and Linux. Testing only on Direct3D 11 does not find it. The headless render test in [ci-tests.md](ci-tests.md) runs OpenGL on all three operating systems and catches it.
- On Direct3D 11, `Sample` inside a loop whose count is decided at run time fails with `X3511`. Read textures in such loops with `SampleLevel`.
- There is no public API to draw only in the preview. Anything a filter draws appears in the stream and the recording.

## Settings and properties

- When the plugin changes its own settings, call `obs_source_update_properties` afterwards. Without it, an open properties dialog keeps showing the old values.
- `obs_data` silently drops arrays of strings. Store such lists in another form.
- The folder returned by `obs_module_config_path()` is not created automatically. Create it before writing.
- Private settings of a source are copied when the user duplicates the source. Keep this in mind for values that must differ between sources.
- Write values with spaces in locale `.ini` files in double quotes. OBS interprets `\n` and `\"` in them.
- Use the same terms as OBS Studio's own translation for the same things. Get OBS's own strings with `obs_frontend_get_locale_string` instead of translating them again.
- To change a display name later, change only the locale files and keep IDs and settings keys.

## Docks and frontend

- Register docks with `obs_frontend_add_dock_by_id()` in the `OBS_FRONTEND_EVENT_FINISHED_LOADING` event. The API hides the dock right after adding it, so restore the saved layout by applying `BasicWindow/DockState` again.
- A dock that contains an obs-browser panel must close the browser when the user closes the dock with its × button. The dock receives the close as `QEvent::User + QEvent::Close`. If the browser stays open, a later `executeJavaScript` call crashes OBS. This happened with a dock detached from the main window.
- OBS shuts down in this order: it saves the scene collection, then sends `OBS_FRONTEND_EVENT_SCENE_COLLECTION_CLEANUP`, then `OBS_FRONTEND_EVENT_EXIT`. Cleanup placed in the exit event runs after the save, so changes made there are not saved.
- OBS hotkeys fire even while the user types in another application. Do not suggest single-key hotkeys such as Space.
- There is no public API that applies changed output settings of a profile. The public API can apply only resolution and frame rate, with `obs_frontend_reset_video()`.

## Browser sources

- Changing the `css` setting of a browser source recreates the page, and the source disappears for about 0.6 to 1.4 seconds. Changing only the width and height does not recreate it. Show immediate feedback in a preview inside the plugin's own dock, and apply the setting to the source once, after a short pause following the user's last change.

## Threads, errors, and networking

- Do not let C++ exceptions leave a thread. An exception that escapes crashes OBS. Return errors as values.
- Do not allocate memory in audio callbacks.
- The libcurl bundled with OBS on Windows (8.12.1, Schannel) applies the connect timeout to a TLS renegotiation that happens in the middle of a response. Set the connect timeout to the same length as the whole-request timeout, or long responses fail with a timeout.

## Logging

- Log enough to find the cause of a failure (`diagnostic-logging`).
- During development, add log lines with a fixed prefix, such as `[snapshot]`, and have verification scripts compare them. Lower logs that repeat every frame to the debug level before release.

## Dependencies and licenses

- Pin every dependency to a version and a hash. For CMake `FetchContent`, give `URL_HASH`. The template's `buildspec.json` already pins OBS and its prebuilt dependencies by hash (`dependency-pinning`).
- Put the license text of every bundled dependency in `data/licenses/`, and list the dependencies and their licenses in the README (`license-notices`).
- GitHub's automatic source archives do not include dependencies fetched at build time. If the license requires you to provide their source, publish a source archive that includes them.
- For third-party models or binaries in the release files, write the upstream URL, version, hash, and license in the README or a document (`third-party-provenance`).

## Warnings

The template's CI treats warnings as errors, and GCC and Clang warn about things MSVC accepts. Push to a pull request often enough that the macOS and Ubuntu jobs see the code early.

## Criteria without examples in this skill

The plugins this skill is based on have no worked examples for the following criteria. Read them in the criteria document and decide with the author whether to adopt them: `build-hardening`, `resource-raii`, `manifest-consistency`, `cpu-compatibility`, `dll-footprint`, `security-policy`, `crash-report-privacy`, `hermetic-build`, `contribution-compliance`, `reuse-compliance`, `windows-code-signing`, `macos-code-signing`, `user-verification-guide`. Of these, only `build-hardening` is a review criterion; the rest are recommendations that do not affect listing.
