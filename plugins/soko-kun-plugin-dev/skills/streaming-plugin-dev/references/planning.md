# Planning and naming

Criteria document: https://github.com/AllegroMoltoV/plugin-soko-kun/blob/main/docs/design/review-criteria.md

## Requirements file

Write the requirements before writing code, so that the author can review the plan and later sessions can resume from it. Start from [../templates/INIT.md](../templates/INIT.md). Include:

- Background and purpose
- Decisions, each marked as final, provisional, or undecided. For provisional and undecided ones, state who decides, on what condition, and when
- Facts you checked, with their sources
- Open questions, each with options and a recommended answer with reasons. With a recommendation for every question, the author can often answer "all as recommended"
- The phases that do not start OBS Studio and the phases that do (see [local-verification.md](local-verification.md))
- Completion criteria, including the release and the listing on Plugin Soko-kun

## Order of work

Put the checks whose results can change the rest of the plan first. Examples from past plugins: whether a browser source can reload CSS without a visible gap, whether the bundled libcurl supports a WebSocket connection, whether a rendering approach compiles on OpenGL, and whether a short recording can verify the encoder settings used for streaming. If such a check fails, rewrite the later stages before building them.

Have the plan challenged once by a reviewer without the conversation's context, such as a subagent that receives only the plan file. In past plugins this found real failure causes before implementation: `obs_data` dropping string arrays, the scene collection being saved before the exit event, the template not releasing `v` tags, and the lack of a public API to apply output settings.

## Choosing the plugin type

- A filter receives the image of the source it is attached to and can process it. An input source cannot read the layers below it in the scene. Effects that change what is below, such as mosaic or blur over part of the screen, must be filters.
- An input source, on the other hand, gets OBS's per-item visibility hotkeys and show and hide transitions for free.
- There is no public API to draw only in the preview. Filter output and `obs_add_main_render_callback` both appear in the stream and the recording.

## Scope and safety

- Do not copy the name, UI text, CSS, images, or design of a product you used as a reference. Use only the kinds of settings as a reference, and find selectors and structure by inspecting the target yourself.
- Keep things that are outside the plugin's responsibility, such as OBS's own settings, out of the tests and the README.
- If the plugin does not communicate over the network, make "sends nothing over the network" a completion criterion. Check it by confirming that the Windows DLL does not import `ws2_32`, `winhttp`, or `Qt6Network`.
- If the plugin communicates, state in the README and in the settings dialog where data goes, what is sent, the fees the user pays to the third-party service, and that the user is responsible for their own account with that service (`user-data-handling`).
- Let the user enter secrets such as API keys in a masked field, and store them encrypted with the operating system's protection, such as DPAPI on Windows. During development, keep a test key in a temporary file outside the repository and delete it after testing. Check for leaks by counting occurrences of the key in logs and files without printing the key.
- Enforce safety limits in code, not in prompts. For example: run a moderation check before sending content to an AI service, do not send when the check cannot run, and let the plugin delete only what it created itself.
- For features that cost money while running, add an automatic stop after a set time, so that a plugin left running overnight does not keep charging the user.
- Choose a license compatible with libobs, which is GPL-2.0-or-later, and with every dependency (`license-compatibility`).

## Feedback from the author

When the author reports several issues in a row, record each one first. After the reports stop, order the fixes by their dependencies. Before changing code for a report, propose the options and let the author choose. Leave room to change requirements for a better experience when the author's trial shows a problem.

## Naming

- Do not put "OBS" in the plugin's display name. The OBS Forums Resource and IP Policy asks resources not to use OBS in their names: https://obsproject.com/forum/threads/forum-resource-and-ip-policy.178569/ . The same policy asks new projects to avoid the `obs-` prefix in repository names where possible. Plugin Soko-kun recommends the same (`plugin-name`).
- Check that the name is not taken: `gh search repos <name>`, `gh api repos/<owner>/<name>`, and `search_plugins` on Plugin Soko-kun. `search_plugins` returns only listed plugins, so when it returns nothing, run a control search with a word you know is listed to confirm that the search works.
- Avoid names close to the words of a product you used as a reference, and names that suggest a different kind of plugin. For example, a plugin that highlights the speaker on screen should not be named as if it processed audio.
- Use a display name that works for your users' languages, such as `Japanese name / English name`. In `buildspec.json`, `name` decides the module file name, the install folder name, and the release file names, and `displayName` is shown to users.
- To change the display name later, change only the locale files. Keep internal IDs and settings keys unchanged, so that existing scenes keep working.
- Renaming the repository later requires replacing the old name in the sources, configuring the build again (delete `CMakeCache.txt`, which holds old paths), renaming the GitHub repository, and renaming the local folder. Rename the local folder after closing the Claude Code session that works in it, and give the next session a short handoff note.
- If the plugin was made mostly with AI, check the current AI disclosure rules of each place where you plan to publish it. OBS Forums requires a disclosure and may reject resources written entirely or mostly by AI. Plugin Soko-kun does not change listing decisions based on AI use.
