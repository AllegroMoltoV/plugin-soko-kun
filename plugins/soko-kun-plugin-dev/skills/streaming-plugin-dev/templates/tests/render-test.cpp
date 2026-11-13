// Minimal render test for a video filter plugin.
// It renders a test source, adds the plugin's filter, renders again, and checks the output.
// Replace kFilterId, the settings, and the checks with the plugin's own. Add a scenario for each behavior to protect,
// and register its name in render-tests.cmake and render-test.yaml.
//
// Usage: render-test <plugin module> <plugin data folder> <graphics module> <libobs data folder> <scenario>
// Exit code: 0 when all checks pass, 1 when a check fails, 2 when the test cannot start.

#include "render-fixture.hpp"

#include <cstdlib>
#include <cstring>
#include <functional>

namespace {

using namespace render_test;

// The id the plugin passes to obs_register_source for its filter
constexpr const char *kFilterId = "my_plugin_filter";

constexpr uint32_t kCanvasWidth = 64;
constexpr uint32_t kCanvasHeight = 48;

// Checks that the filter keeps the size of its input and changes at least one pixel.
// Replace this with checks of the filter's actual properties, such as "pixels outside the region are unchanged".
// Compare with tolerances: Direct3D 11 on WARP, Mesa, and the Apple renderer round slightly differently.
void scenario_filter_output(Checker &c)
{
	const SourceSpec spec = {kCanvasWidth, kCanvasHeight, paint_gradient};
	obs_source_t *source = create_test_source(spec);
	obs_data_t *settings = obs_data_create();
	// Set the filter's settings here, for example: obs_data_set_int(settings, "strength", 50);
	obs_source_t *filter = obs_source_create(kFilterId, "filter", settings, nullptr);
	obs_data_release(settings);

	Image warmup, reference, out;
	if (!source || !filter) {
		c.expect(false, "failed to create the test source or the filter");
	} else if (!render(source, warmup) || !render(source, reference)) {
		// On macOS, the first image read back in a process can keep earlier content in its top rows.
		// The first render is discarded for that reason.
		c.expect(false, "failed to render the reference");
	} else {
		save_image("filter-output-reference", reference);
		obs_source_filter_add(source, filter);
		// Settings reach the filter in video_tick, so wait a few frames before rendering
		c.expect(wait_frames(4), "frames did not advance");
		if (!render(source, out)) {
			c.expect(false, "failed to render the filtered output");
		} else {
			save_image("filter-output", out);
			c.expect(out.width == reference.width && out.height == reference.height,
				 "output size differs from the input size");
			bool changed = false;
			for (size_t i = 0; i < out.rgba.size() && i < reference.rgba.size(); ++i) {
				if (std::abs(out.rgba[i] - reference.rgba[i]) > 1) {
					changed = true;
					break;
				}
			}
			// An effect that fails to compile on one graphics API leaves the output unchanged or empty
			c.expect(changed, "the filter did not change any pixel");
		}
	}
	obs_source_release(filter);
	obs_source_release(source);
}

struct Scenario {
	const char *name;
	std::function<void(Checker &)> run;
};

const Scenario scenarios[] = {
	{"filter-output", scenario_filter_output},
};

} // namespace

int main(int argc, char **argv)
{
	if (argc != 6) {
		std::cerr << "usage: render-test <plugin> <plugin data> <graphics module> <libobs data> <scenario>\n";
		return 2;
	}
	const Scenario *scenario = nullptr;
	for (const Scenario &s : scenarios) {
		if (std::strcmp(argv[5], s.name) == 0) {
			scenario = &s;
		}
	}
	if (!scenario) {
		std::cerr << "unknown scenario: " << argv[5] << '\n';
		return 2;
	}
	if (!obs_test::start(argv[3], argv[4], kCanvasWidth, kCanvasHeight)) {
		return 2;
	}
	register_test_source();
	int result = 2;
	if (obs_test::load_plugin(argv[1], argv[2])) {
		Checker checker;
		scenario->run(checker);
		result = checker.failures == 0 ? 0 : 1;
		if (result != 0) {
			std::cerr << checker.failures << " check(s) failed in " << scenario->name << '\n';
		} else {
			std::cout << "PASS " << scenario->name << '\n';
		}
	}
	obs_shutdown();
	return result;
}
