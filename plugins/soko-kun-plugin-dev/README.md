# Soko-kun Plugin Dev

A Claude Code plugin with one skill, `streaming-plugin-dev`, for building an OBS Studio plugin and listing it on [Plugin Soko-kun](https://soko-kun.allegromoltov.jp/?lang=en), a free, unofficial catalog of OBS Studio plugins.

## What the skill does

The skill guides Claude Code through each stage of building an OBS Studio plugin, from the first requirements to a listing on Plugin Soko-kun. It collects what the author learned from building ten published OBS Studio plugins with Claude Code.

- Planning: requirements, the plugin type (filter, source, dock, transition, or output), and the name
- Scaffolding from the official [obs-plugintemplate](https://github.com/obsproject/obs-plugintemplate)
- Common pitfalls in the OBS API
- Verification in a local OBS and headless render tests in GitHub Actions on Windows, Linux, and macOS
- Releases with build provenance attestations and immutable releases
- Submitting the plugin to Plugin Soko-kun and fixing what its checks report

The skill follows the [listing conditions and review criteria](https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md) of Plugin Soko-kun. Before planning, it tells the author that a listed plugin is free to download and that anyone can use its code commercially under the conditions of its license.

The skill asks the author for approval before each operation that writes outside the working tree, such as creating a repository, pushing, changing a ruleset, publishing a release, or registering the plugin.

## Install

```sh
claude plugin marketplace add AllegroMoltoV/plugin-soko-kun
claude plugin install soko-kun-plugin-dev@plugin-soko-kun
```

You can also ask Claude Code to read https://soko-kun.allegromoltov.jp and build and publish an OBS Studio plugin. The site explains how to install this plugin.

## Network access

The plugin contains only instructions and template files. It runs no code of its own. When Claude Code follows the skill, it may access these services:

| Service | Purpose |
| --- | --- |
| GitHub (github.com, api.github.com) through `git` and `gh` | Creating the plugin repository, pushing, running GitHub Actions, publishing releases, and reading the official template and the review criteria |
| Plugin Soko-kun MCP server (https://soko-kun.allegromoltov.jp/mcp) | Checking the repository against the listing conditions and submitting the plugin, after the author signs in with GitHub |
| The obsproject repositories on GitHub (obs-plugintemplate, obs-studio, obs-deps) | Downloading the template, the OBS Studio source, and its prebuilt dependencies for builds and tests, as the official template does |
| obsproject.com | Reading the OBS Forums Resource and IP Policy, which the skill cites for naming |

The plugin collects no personal data and sends nothing to the author of this plugin.

## License

MIT. See the [LICENSE](https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/LICENSE) of the repository.
