#pragma once

// Shared parts of the render test: a test input source with known pixels, waiting for frames, reading a source's
// output back to memory, and writing images for visual checks.

#include "obs-test-env.hpp"

#include <obs.h>

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <functional>
#include <iostream>
#include <string>
#include <thread>
#include <vector>

namespace render_test {

constexpr const char *kTestSourceId = "render_test_source";

// Pixels of a rendered output. Colors are premultiplied by alpha, as the source output is.
struct Image {
	uint32_t width = 0;
	uint32_t height = 0;
	std::vector<uint8_t> rgba;

	const uint8_t *at(uint32_t x, uint32_t y) const { return &rgba[(static_cast<size_t>(y) * width + x) * 4]; }
};

// Fills the test source. Write colors without premultiplying them by alpha.
using Painter = std::function<void(std::vector<uint8_t> &pixels, uint32_t width, uint32_t height)>;

struct SourceSpec {
	uint32_t width = 64;
	uint32_t height = 48;
	Painter paint;
};

// The spec of the next test source to create. obs_source_create gives the create callback no way to receive it.
inline SourceSpec next_spec;

struct TestSource {
	gs_texture_t *texture = nullptr;
	uint32_t width = 0;
	uint32_t height = 0;
};

inline void register_test_source()
{
	obs_source_info info = {};
	info.id = kTestSourceId;
	info.type = OBS_SOURCE_TYPE_INPUT;
	info.output_flags = OBS_SOURCE_VIDEO;
	info.get_name = [](void *) {
		return "Render test source";
	};
	info.create = [](obs_data_t *, obs_source_t *) -> void * {
		auto *source = new TestSource;
		source->width = next_spec.width;
		source->height = next_spec.height;
		std::vector<uint8_t> pixels(static_cast<size_t>(source->width) * source->height * 4, 0);
		if (next_spec.paint) {
			next_spec.paint(pixels, source->width, source->height);
		}
		const uint8_t *data = pixels.data();
		obs_enter_graphics();
		source->texture = gs_texture_create(source->width, source->height, GS_RGBA, 1, &data, 0);
		obs_leave_graphics();
		if (!source->texture) {
			delete source;
			return nullptr;
		}
		return source;
	};
	info.destroy = [](void *data) {
		auto *source = static_cast<TestSource *>(data);
		obs_enter_graphics();
		gs_texture_destroy(source->texture);
		obs_leave_graphics();
		delete source;
	};
	info.get_width = [](void *data) {
		return static_cast<TestSource *>(data)->width;
	};
	info.get_height = [](void *data) {
		return static_cast<TestSource *>(data)->height;
	};
	info.video_render = [](void *data, gs_effect_t *effect) {
		auto *source = static_cast<TestSource *>(data);
		gs_effect_set_texture(gs_effect_get_param_by_name(effect, "image"), source->texture);
		gs_draw_sprite(source->texture, 0, source->width, source->height);
	};
	obs_register_source(&info);
}

inline obs_source_t *create_test_source(const SourceSpec &spec, const char *name = "source")
{
	next_spec = spec;
	return obs_source_create(kTestSourceId, name, nullptr, nullptr);
}

// An opaque gradient whose color changes with x and y.
inline void paint_gradient(std::vector<uint8_t> &pixels, uint32_t width, uint32_t height)
{
	for (uint32_t y = 0; y < height; ++y) {
		for (uint32_t x = 0; x < width; ++x) {
			uint8_t *p = &pixels[(static_cast<size_t>(y) * width + x) * 4];
			p[0] = static_cast<uint8_t>((x * 255) / std::max<uint32_t>(1, width - 1));
			p[1] = static_cast<uint8_t>((y * 255) / std::max<uint32_t>(1, height - 1));
			p[2] = static_cast<uint8_t>(((x + y) * 7) % 256);
			p[3] = 255;
		}
	}
}

// Waits until the OBS graphics thread advances count frames. Settings changes take effect in the next video_tick.
inline bool wait_frames(uint64_t count)
{
	const uint64_t target = obs_get_total_frames() + count;
	const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
	while (obs_get_total_frames() < target) {
		if (std::chrono::steady_clock::now() > deadline) {
			std::cerr << "OBS graphics thread did not advance within five seconds\n";
			return false;
		}
		std::this_thread::sleep_for(std::chrono::milliseconds(2));
	}
	return true;
}

// Reads the output of a source at the source's size. The output is written as is, without blending.
inline bool render(obs_source_t *source, Image &image)
{
	bool ok = false;
	obs_enter_graphics();
	image.width = obs_source_get_width(source);
	image.height = obs_source_get_height(source);
	gs_texrender_t *output = gs_texrender_create(GS_RGBA, GS_ZS_NONE);
	gs_stagesurf_t *staging = gs_stagesurface_create(image.width, image.height, GS_RGBA);
	if (output && staging && gs_texrender_begin(output, image.width, image.height)) {
		vec4 clear = {};
		gs_clear(GS_CLEAR_COLOR, &clear, 0.0f, 0);
		gs_ortho(0.0f, static_cast<float>(image.width), 0.0f, static_cast<float>(image.height), -100.0f,
			 100.0f);
		gs_blend_state_push();
		gs_blend_function(GS_BLEND_ONE, GS_BLEND_ZERO);
		obs_source_video_render(source);
		gs_blend_state_pop();
		gs_texrender_end(output);
		gs_stage_texture(staging, gs_texrender_get_texture(output));
		uint8_t *mapped = nullptr;
		uint32_t stride = 0;
		if (gs_stagesurface_map(staging, &mapped, &stride)) {
			image.rgba.resize(static_cast<size_t>(image.width) * image.height * 4);
			for (uint32_t y = 0; y < image.height; ++y) {
				std::copy(mapped + static_cast<size_t>(y) * stride,
					  mapped + static_cast<size_t>(y) * stride + image.width * 4,
					  image.rgba.begin() + static_cast<size_t>(y) * image.width * 4);
			}
			gs_stagesurface_unmap(staging);
			ok = true;
		}
	}
	if (!ok) {
		std::cerr << "failed to render the source\n";
	}
	gs_stagesurface_destroy(staging);
	gs_texrender_destroy(output);
	obs_leave_graphics();
	return ok;
}

// Writes a 24-bit BMP over a white background, only when RENDER_TEST_OUTPUT_DIR is set. CI uploads the folder so
// that a person can look at the images when a check fails for a reason the log does not explain.
inline void save_image(const std::string &name, const Image &image)
{
	const char *dir = std::getenv("RENDER_TEST_OUTPUT_DIR");
	if (!dir || image.rgba.empty()) {
		return;
	}
	const std::string path = std::string(dir) + "/" + name + ".bmp";
	const uint32_t row_size = (image.width * 3 + 3) & ~3u;
	const uint32_t data_size = row_size * image.height;
	uint8_t header[54] = {'B', 'M'};
	const auto put32 = [&header](size_t offset, uint32_t value) {
		for (int i = 0; i < 4; ++i) {
			header[offset + i] = static_cast<uint8_t>(value >> (8 * i));
		}
	};
	put32(2, 54 + data_size);
	put32(10, 54);
	put32(14, 40);
	put32(18, image.width);
	put32(22, image.height);
	header[26] = 1;
	header[28] = 24;
	put32(34, data_size);
	std::ofstream file(path, std::ios::binary);
	file.write(reinterpret_cast<const char *>(header), sizeof(header));
	std::vector<uint8_t> row(row_size, 0);
	// BMP stores rows from the bottom, and each pixel as B, G, R. Colors are premultiplied, so adding
	// (255 - alpha) composites them over white.
	for (uint32_t y = image.height; y-- > 0;) {
		for (uint32_t x = 0; x < image.width; ++x) {
			const uint8_t *p = image.at(x, y);
			for (int c = 0; c < 3; ++c) {
				row[x * 3 + (2 - c)] = static_cast<uint8_t>(std::min(255, p[c] + (255 - p[3])));
			}
		}
		file.write(reinterpret_cast<const char *>(row.data()), row.size());
	}
	std::cout << (file ? "saved " : "failed to save ") << path << '\n';
}

// Counts failed checks. Prints only the first messages so that a log with many failures stays readable.
struct Checker {
	int failures = 0;
	int printed = 0;

	void expect(bool condition, const std::string &message)
	{
		if (!condition) {
			if (printed < 20) {
				std::cerr << message << '\n';
				++printed;
			}
			++failures;
		}
	}
};

} // namespace render_test
