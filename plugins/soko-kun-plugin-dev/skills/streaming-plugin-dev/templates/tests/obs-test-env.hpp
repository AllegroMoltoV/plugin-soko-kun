#pragma once

// Starts libobs without the OBS frontend so that tests can render.
// Pass the graphics module for the platform: Direct3D 11 or OpenGL on Windows, OpenGL with X11 and EGL on Linux,
// and OpenGL on macOS.

#include <obs.h>
#if defined(__linux__)
#include <obs-nix-platform.h>
#include <X11/Xlib.h>
#endif

#include <chrono>
#include <cstdint>
#include <iostream>
#include <string>
#include <thread>

namespace obs_test {

// Returns true on success. On failure, it has already called obs_shutdown and returns false.
inline bool start(const char *graphics_module, const char *core_data, uint32_t width, uint32_t height)
{
#if defined(__linux__)
	// OpenGL on Linux needs an X11 display and EGL. In CI, the display comes from xvfb-run.
	Display *display = XOpenDisplay(nullptr);
	if (!display) {
		std::cerr << "failed to open X display\n";
		return false;
	}
	obs_set_nix_platform(OBS_NIX_PLATFORM_X11_EGL);
	obs_set_nix_platform_display(display);
#endif
	if (!obs_startup("en-US", nullptr, nullptr)) {
		std::cerr << "failed to start OBS\n";
		return false;
	}
	// obs_add_data_path is deprecated, but without the frontend there is no other way to make libobs find its
	// default effects.
#ifdef _MSC_VER
#pragma warning(push)
#pragma warning(disable : 4996)
#else
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#endif
	std::string core_data_path = core_data;
	core_data_path += '/';
	obs_add_data_path(core_data_path.c_str());
#ifdef _MSC_VER
#pragma warning(pop)
#else
#pragma GCC diagnostic pop
#endif
	obs_video_info video = {};
	video.graphics_module = graphics_module;
	video.fps_num = 60;
	video.fps_den = 1;
	video.base_width = width;
	video.base_height = height;
	video.output_width = width;
	video.output_height = height;
	video.output_format = VIDEO_FORMAT_RGBA;
	if (obs_reset_video(&video) != OBS_VIDEO_SUCCESS) {
		std::cerr << "failed to initialize OBS video\n";
		obs_shutdown();
		return false;
	}
	// With OpenGL, rendering from the test thread before the OBS graphics thread has advanced its first frame can
	// leave the whole output empty. Return only after the graphics thread has rendered two frames.
	const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
	while (obs_get_total_frames() < 2) {
		if (std::chrono::steady_clock::now() > deadline) {
			std::cerr << "OBS graphics thread did not start rendering within five seconds\n";
			obs_shutdown();
			return false;
		}
		std::this_thread::sleep_for(std::chrono::milliseconds(5));
	}
	return true;
}

// Loads and initializes the plugin module. Returns false on failure.
inline bool load_plugin(const char *plugin_path, const char *module_data)
{
	obs_module_t *module = nullptr;
	if (obs_open_module(&module, plugin_path, module_data) != MODULE_SUCCESS || !obs_init_module(module)) {
		std::cerr << "failed to load plugin module\n";
		return false;
	}
	return true;
}

} // namespace obs_test
