# Scaffolding from obs-plugintemplate

Criteria document: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md

Create the repository from https://github.com/obsproject/obs-plugintemplate . The template provides the CMake setup, the build and packaging scripts, and the GitHub Actions workflows for Windows, macOS, and Ubuntu. Its CI builds the release files from source (`ci-source-build`), so keep that path and never attach binaries built by hand. The template has several problems that showed up in almost every plugin built from it. Fix them in the first commits.

## Known problems in the template and their fixes

### The release workflow ignores `v` tags

The tag check in `.github/workflows/push.yaml` accepts only `1.0.0` and `1.0.0-beta1` forms. For a tag such as `v1.0.0`, it marks the tag invalid, skips creating the release, and the workflow still shows success. Nine of the ten plugins this skill is based on hit this, and several authors created releases by hand without noticing.

Add `?(v)` to the front of both patterns in the `case` statement of the tag check, so that `?(v)+([0-9]).+([0-9]).+([0-9])` and `?(v)+([0-9]).+([0-9]).+([0-9])-@(beta|rc)*([0-9])` are accepted. The other release changes are in [release.md](release.md).

### `buildspec.json` keeps the template's values

Replace `name`, `displayName`, `version`, `author`, `website`, `email`, and `platformConfig.macos.bundleId`. `bundleId` is easy to miss and stays `com.example.plugintemplate-for-obs` otherwise. Use a placeholder email address only if you do not want to publish one, because the value ends up in the macOS package.

Start `version` at `1.0.0` for the first public release. One author published `0.2.0` and then had to delete the release and the tag to publish `1.0.0` instead, which is no longer possible once releases are immutable.

### Copying files from another plugin on Windows loses file modes

If you copy the template or another plugin's files on Windows, the executable bit of five scripts (`.github/scripts/build-macos`, `build-ubuntu`, `package-macos`, `package-ubuntu`, and `build-aux/.run-format.zsh`) and the three symbolic links under `build-aux/` (`run-clang-format`, `run-gersemi`, `run-swift-format`) are lost. The macOS and Ubuntu CI then fail with exit code 126.

To reuse files from another repository with their modes, fetch it into your repository and check out paths from it:

```sh
git fetch <source-repo-url> main:refs/src/base
git checkout <commit-sha> -- <path> <path> ...
```

Before committing, compare `git ls-files -s` of the copied paths with the source repository. The mode column must match (`100755` for executables, `120000` for symbolic links).

### Copying `.github` copies workflows that belong to the other plugin

Copying `.github` from another plugin brings its plugin-specific workflows, such as a workflow that downloads an older release of that plugin. These fail on every pull request. Copy only the workflows you need, or start from the template's `.github`.

### Copying `.deps` does not save the OBS build

`CMakeCache.txt` stores absolute paths of the source repository, so a copied `.deps` folder does not skip the OBS build. Copy only the downloaded archives if you want to avoid downloading them again. The first configure takes about two minutes.

### `.gitignore` excludes everything by default

The template's `.gitignore` excludes `/*` and adds back allowed paths with `!/`. Add a `!/` line each time you add a top-level folder such as `docs`, `tests`, `tools`, or `.soko-kun`. Otherwise the folder silently stays out of commits.

### The Windows install prefix breaks the install step

The template sets the Windows install prefix to `$ENV{ALLUSERSPROFILE}/obs-studio/plugins` in `cmake/windows/defaults.cmake`. The environment variable contains backslashes, which become invalid escapes in `cmake_install.cmake` and break `cmake --install`. Convert the value with `file(TO_CMAKE_PATH ...)` before using it as the prefix.

### Do not install into the shared plugin folder on every build

Some plugins add a post-build step that runs `cmake --install` after each build. On Windows that writes into `%ProgramData%\obs-studio\plugins`, which the author's own OBS and other sessions share. If you add such a step, put it behind an option that defaults to `OFF`, for example `ENABLE_POST_BUILD_INSTALL`, as in [../templates/render-tests.cmake](../templates/render-tests.cmake). Configure local builds with the option off and install into a portable OBS instead (see [local-verification.md](local-verification.md)).

### The template's CI does not run unit tests

The template builds and packages but never runs tests. Add the tests yourself:

- On Windows, run `ctest --test-dir <build dir> -C <config> --output-on-failure --no-tests=error` after the build. `--no-tests=error` makes the step fail when no test was registered.
- On macOS, the template's `build-macos` script builds only the plugin target. Build the test targets explicitly before running them.
- After CI passes, open the log and confirm that the tests actually ran. A passing workflow with zero tests looks the same as a passing workflow with tests.

### The format check uses fixed tool versions

The template's format check runs gersemi 0.21.0 and clang-format 19. Use the same versions locally: install gersemi 0.21.0 into a separate virtual environment, and use clang-format 19 (the copy bundled with Visual Studio 19.1.5 matched). With other versions, the check passes locally and fails in CI.

## First pull request

Open a pull request early and let CI build on all three operating systems. GCC and Clang report warnings that MSVC does not, and the template treats warnings as errors. Confirm that the macOS and Ubuntu jobs pass before writing most of the code.
