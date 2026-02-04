
CXX := g++
CXXFLAGS := -std=c++17 -O2 -Wall -fPIC

# Use pkg-config to pull Qt5 flags. Ensure Qt5 development packages are installed.
QT_CFLAGS := $(shell pkg-config --cflags Qt5Widgets 2>/dev/null || true)
QT_LIBS := $(shell pkg-config --libs Qt5Widgets 2>/dev/null || true)

LDFLAGS := -lcurl $(QT_LIBS)

SRCS := main.cpp http_client.cpp watchlist.cpp token_store.cpp
OBJS := $(SRCS:.cpp=.o)

all: stock_ui

stock_ui: $(OBJS)
	$(CXX) $(CXXFLAGS) $(QT_CFLAGS) -o $@ $(OBJS) $(LDFLAGS)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) $(QT_CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) stock_ui
