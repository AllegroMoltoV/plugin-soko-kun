# Render test and post-build install for a plugin created from obs-plugintemplate.
# Append this fragment to the end of the root CMakeLists.txt, after set_target_properties_plugin().
# The render test sources are tests/render-test.cpp, tests/render-fixture.hpp, and tests/obs-test-env.hpp.

# Versions of the OBS sources and the prebuilt dependencies. They must match dependencies.obs-studio.version and
# dependencies.prebuilt.version in buildspec.json, because the folders under .deps are named after them.
set(RENDER_TEST_OBS_VERSION "31.1.1" CACHE STRING "OBS Studio version in buildspec.json")
set(RENDER_TEST_DEPS_VERSION "2025-07-11" CACHE STRING "Prebuilt obs-deps version in buildspec.json")

# Scenario names that tests/render-test.cpp accepts. Keep this list equal to SCENARIOS in render-test.yaml.
set(RENDER_TEST_SCENARIOS filter-output)

# The render test is always built on Windows. On macOS and Linux, the CI workflow (render-test.yaml) turns it on.
option(ENABLE_RENDER_TESTS "Build the render test on macOS and Linux" OFF)
if(WIN32 OR ENABLE_RENDER_TESTS)
  add_executable(render-test tests/render-test.cpp)
  target_compile_features(render-test PRIVATE cxx_std_17)
  target_link_libraries(render-test PRIVATE OBS::libobs)
  add_dependencies(render-test ${CMAKE_PROJECT_NAME})
  if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    find_package(X11 REQUIRED)
    target_link_libraries(render-test PRIVATE X11::X11)
  endif()
endif()

if(WIN32)
  enable_testing()

  # Registers every scenario for Direct3D 11 and OpenGL. Build the graphics modules from the OBS build tree first:
  # cmake --build .deps/obs-studio-<version>/build_x64 --config Release --target libobs-d3d11 libobs-opengl
  # CI builds only libobs-d3d11 and runs the d3d11 tests (ctest -R d3d11).
  set(_obs_source "${CMAKE_CURRENT_SOURCE_DIR}/.deps/obs-studio-${RENDER_TEST_OBS_VERSION}")
  set(_graphics_d3d11 "${_obs_source}/build_x64/libobs-d3d11/Release/libobs-d3d11.dll")
  set(_graphics_opengl "${_obs_source}/build_x64/libobs-opengl/Release/libobs-opengl.dll")
  foreach(_backend IN ITEMS d3d11 opengl)
    foreach(_scenario IN LISTS RENDER_TEST_SCENARIOS)
      set(_test_name render-${_backend}-${_scenario})
      add_test(
        NAME ${_test_name}
        COMMAND
          render-test "$<TARGET_FILE:${CMAKE_PROJECT_NAME}>" "${CMAKE_CURRENT_SOURCE_DIR}/data"
          "${_graphics_${_backend}}" "${_obs_source}/libobs/data" ${_scenario}
      )
      # libobs and its dependencies are loaded from .deps
      set_tests_properties(
        ${_test_name}
        PROPERTIES
          ENVIRONMENT_MODIFICATION
            "PATH=path_list_prepend:${CMAKE_CURRENT_SOURCE_DIR}/.deps/bin/64bit;PATH=path_list_prepend:${CMAKE_CURRENT_SOURCE_DIR}/.deps/obs-deps-${RENDER_TEST_DEPS_VERSION}-x64/bin"
      )
    endforeach()
  endforeach()
endif()

# Runs cmake --install after each build on Windows. The install folder %ProgramData%\obs-studio\plugins is shared
# with the user's own OBS and with other sessions, so this is off by default. Install into a portable OBS instead.
option(ENABLE_POST_BUILD_INSTALL "Run cmake --install after build" OFF)
if(WIN32 AND ENABLE_POST_BUILD_INSTALL)
  add_custom_command(
    TARGET ${CMAKE_PROJECT_NAME}
    POST_BUILD
    COMMAND "${CMAKE_COMMAND}" --install "${CMAKE_BINARY_DIR}" --config "$<CONFIG>"
    COMMENT "Installing OBS plugin (cmake --install)"
    VERBATIM
  )
endif()
