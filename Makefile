# Simple Makefile for HelloWorld
CXX = g++
CXXFLAGS = -std=c++17 -O2 -Wall
SRC = HelloWorld.cpp
TARGET = hello

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(SRC) -o $(TARGET)

run: all
	./$(TARGET)

clean:
	rm -f $(TARGET)
