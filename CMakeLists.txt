cmake_minimum_required(VERSION 3.14)
project(hello_examples LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Threads REQUIRED)

add_library(greetings STATIC src/greetings.cpp)
target_include_directories(greetings PUBLIC ${CMAKE_SOURCE_DIR}/include)

add_executable(hello_args examples/HelloArgs.cpp)
target_link_libraries(hello_args PRIVATE greetings)

add_executable(sum examples/Sum.cpp)
target_link_libraries(sum PRIVATE greetings)

add_executable(hello_threads examples/HelloThreads.cpp)
target_link_libraries(hello_threads PRIVATE Threads::Threads)

find_package(PkgConfig REQUIRED)
pkg_check_modules(SDL2 REQUIRED sdl2)
pkg_check_modules(SDL2_TTF REQUIRED SDL2_ttf)

find_package(CURL REQUIRED)

add_executable(hello_gui examples/HelloGui.cpp)
target_include_directories(hello_gui PRIVATE ${SDL2_INCLUDE_DIRS} ${SDL2_TTF_INCLUDE_DIRS} ${CMAKE_SOURCE_DIR}/include)
target_link_libraries(hello_gui PRIVATE greetings ${SDL2_LIBRARIES} ${SDL2_TTF_LIBRARIES})
target_compile_options(hello_gui PRIVATE ${SDL2_CFLAGS_OTHER} ${SDL2_TTF_CFLAGS_OTHER})

# Hello world GUI application: SDL2 + TTF + libcurl for fetching top gainers
add_executable(hello_world HelloWorld.cpp)
target_include_directories(hello_world PRIVATE ${SDL2_INCLUDE_DIRS} ${SDL2_TTF_INCLUDE_DIRS} ${CMAKE_SOURCE_DIR}/include)
target_link_libraries(hello_world PRIVATE ${SDL2_LIBRARIES} ${SDL2_TTF_LIBRARIES} CURL::libcurl)
target_compile_options(hello_world PRIVATE ${SDL2_CFLAGS_OTHER} ${SDL2_TTF_CFLAGS_OTHER})

# Optional Qt GUI target: prefer Qt6, fall back to Qt5 if available
find_package(Qt6 COMPONENTS Widgets QUIET)
if (Qt6_FOUND)
  message(STATUS "Building hello_qt with Qt6")
  add_executable(hello_qt examples/HelloQt.cpp)
  set_target_properties(hello_qt PROPERTIES AUTOMOC ON)
  target_link_libraries(hello_qt PRIVATE greetings Qt6::Widgets)
else()
  find_package(Qt5 COMPONENTS Widgets QUIET)
  if (Qt5_FOUND)
    message(STATUS "Building hello_qt with Qt5")
    add_executable(hello_qt examples/HelloQt.cpp)
    set_target_properties(hello_qt PROPERTIES AUTOMOC ON)
    target_link_libraries(hello_qt PRIVATE greetings Qt5::Widgets)
  else()
    message(STATUS "Qt not found; skipping hello_qt target")
  endif()
endif()

include(FetchContent)

# Prefer system-installed GoogleTest (faster / offline-friendly). If not found,
# fall back to downloading via FetchContent.
find_package(GTest QUIET)
if (NOT GTest_FOUND)
  FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG main
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
  )
  FetchContent_MakeAvailable(googletest)
endif()

enable_testing()
## Determine GTest main library target in a portable way
if (TARGET GTest::gtest_main)
  set(GTEST_MAIN_LIB GTest::gtest_main)
elseif (TARGET gtest_main)
  set(GTEST_MAIN_LIB gtest_main)
else()
  message(FATAL_ERROR "GTest main library not found")
endif()

add_executable(greetings_test tests/greetings_test.cpp)
target_link_libraries(greetings_test PRIVATE greetings ${GTEST_MAIN_LIB} Threads::Threads)
add_test(NAME greetings_test COMMAND greetings_test)

add_executable(concurrency_test tests/concurrency_test.cpp)
target_link_libraries(concurrency_test PRIVATE greetings ${GTEST_MAIN_LIB} Threads::Threads)
add_test(NAME concurrency_test COMMAND concurrency_test)

add_executable(bench_threads benchmarks/thread_bench.cpp)
target_link_libraries(bench_threads PRIVATE Threads::Threads greetings)
set_target_properties(bench_threads PROPERTIES EXCLUDE_FROM_ALL TRUE)
