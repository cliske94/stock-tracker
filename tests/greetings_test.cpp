#include "../include/greetings.hpp"
#include <gtest/gtest.h>

TEST(GreetingsTest, HelloDefault) {
    EXPECT_EQ(greetings::hello("World"), "Hello, World!");
}

TEST(GreetingsTest, Sum) {
    EXPECT_EQ(greetings::sum(2,3), 5);
    EXPECT_EQ(greetings::sum(-1,1), 0);
}
