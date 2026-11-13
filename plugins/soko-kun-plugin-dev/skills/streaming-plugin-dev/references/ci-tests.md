# Tests in CI

Criteria document: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md

The review criterion `ci-scenario-tests` asks for tests that exercise the plugin the way users use it, not only a build. CI is also the only place where a Windows-only author can check macOS and Linux. This file describes two kinds of tests that past plugins used: a headless render test, and a test that loads the release files into the official OBS Studio.

## Headless render test

The render test starts libobs without the OBS frontend, loads the plugin module, creates a source and the plugin's filter, renders into a `gs_texrender`, and reads the pixels back through a stage surface. It runs on GitHub-hosted runners without a GPU:

| OS | Graphics module | Renderer on the runner |
| --- | --- | --- |
| Windows | `libobs-d3d11` | Direct3D 11 on WARP, the software adapter of DXGI |
| Ubuntu | `libobs-opengl` | Mesa llvmpipe under `xvfb-run` |
| macOS | `libobs-opengl` | Apple Software Renderer, OpenGL 4.1 |

Because macOS and Ubuntu run OpenGL, the test catches effect code that compiles only in HLSL (see [obs-api-pitfalls.md](obs-api-pitfalls.md)).

### Files to start from

| Template | Copy to | What to change |
| --- | --- | --- |
| [render-test.yaml](../templates/render-test.yaml) | `.github/workflows/render-test.yaml` | `PLUGIN_NAME`, `OBS_VERSION`, `SCENARIOS` |
| [render-tests.cmake](../templates/render-tests.cmake) | Append to the root `CMakeLists.txt` | The scenario list, and the versions if `buildspec.json` differs |
| [tests/obs-test-env.hpp](../templates/tests/obs-test-env.hpp) | `tests/obs-test-env.hpp` | Nothing |
| [tests/render-fixture.hpp](../templates/tests/render-fixture.hpp) | `tests/render-fixture.hpp` | Nothing at first |
| [tests/render-test.cpp](../templates/tests/render-test.cpp) | `tests/render-test.cpp` | `kFilterId` and the scenarios |

Add `!/tests` to `.gitignore` (see [scaffold.md](scaffold.md)). The workflow calls the template's `.github/actions/build-plugin` action, so it works only in a repository created from obs-plugintemplate. Keep `OBS_VERSION` and the dependency version in the CMake fragment equal to the versions in `buildspec.json`; the paths under `.deps` contain them.

### Pitfalls of headless rendering

- On OpenGL, rendering from the test thread before the OBS graphics thread has advanced its first frames can produce an empty image. `obs_test::start` waits until two frames have been rendered.
- A settings change reaches the source in the next `video_tick`. Wait for frames after `obs_source_update` before rendering, as `render_test::wait_frames` does.
- On macOS, the first image read back in a process can keep a few rows of earlier content at the top. Render once and discard the result before the images you compare.
- On macOS, the test executable needs `DYLD_FRAMEWORK_PATH` (for `libobs.framework` in `.deps/Frameworks`) and `DYLD_LIBRARY_PATH` (for the FFmpeg and other libraries of obs-deps). It took four CI runs to find this; the workflow template already sets both.
- The graphics modules are not dependencies of the plugin, so the plugin build does not build them. Build them from the OBS build tree under `.deps`, as the workflow does (`--target libobs-d3d11` on Windows, `--target libobs-opengl` on macOS). On Ubuntu, the workflow uses `libobs-opengl.so` and `/usr/share/obs/libobs` from the `obs-studio` package, which the template's Ubuntu setup installs from the `ppa:obsproject/obs-studio` PPA. That package follows the PPA's current OBS release, not the version in `buildspec.json`.
- Rasterization differs slightly between renderers. Check properties of the output, such as "pixels outside the region are unchanged" or "each cell has one color within a tolerance", instead of comparing images exactly.

### Making failures diagnosable

- When a render test fails for a reason you cannot explain, do not guess. Write the compared images as artifacts (the templates write BMP files when `RENDER_TEST_OUTPUT_DIR` is set, and the workflow uploads them), and ask the author to look at a small, chosen set of them.
- After adding a check, confirm that it works: remove the fix or the feature it tests and see the test fail, then restore it and see it pass.

## Loading the release files into the official OBS

Some plugins also run a CI job that tests the packaged plugin in the official OBS Studio on a fresh runner:

1. Download the official OBS Studio zip and verify its hash.
2. Install the release zip into the normal plugin location, together with a probe module that checks the plugin and writes results to a file.
3. Start OBS more than once: the first run checks pixels or behavior, and the second run checks that the settings were saved. Optionally install the previous release first and then update it.
4. Check that the release files contain no test modules or development files. On Ubuntu, check that `ldd` reports no `not found` for the plugin.

This is the way to test docks and audio plugins in CI, which the render test does not cover. The plugins this skill is based on did not test dock UI in CI.

## Waiting for CI

- Pass the full commit SHA to `gh run list --commit`. A short SHA matches nothing, and a wait loop with it can spin for 30 minutes.
- Give every wait a time limit. When a run looks stuck, check its state with `gh run view` instead of waiting longer.
- A pull request that changes only `*.md` files does not trigger the template's build workflow.
