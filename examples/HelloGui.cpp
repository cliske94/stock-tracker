// Simple SDL2 GUI example that opens a window and displays "Hello, World!"
#include <SDL2/SDL.h>
#include <SDL2/SDL_ttf.h>
#include <iostream>
#include <string>

int main(int argc, char** argv) {
    const char* text = "Hello, World!";
    if (SDL_Init(SDL_INIT_VIDEO) != 0) {
        std::cerr << "SDL_Init Error: " << SDL_GetError() << std::endl;
        return 1;
    }

    if (TTF_Init() != 0) {
        std::cerr << "TTF_Init Error: " << TTF_GetError() << std::endl;
        SDL_Quit();
        return 1;
    }

    SDL_Window* win = SDL_CreateWindow("Hello GUI", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, 480, 160, SDL_WINDOW_SHOWN);
    if (!win) {
        std::cerr << "SDL_CreateWindow Error: " << SDL_GetError() << std::endl;
        TTF_Quit();
        SDL_Quit();
        return 1;
    }

    SDL_Renderer* ren = SDL_CreateRenderer(win, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    if (!ren) {
        std::cerr << "SDL_CreateRenderer Error: " << SDL_GetError() << std::endl;
        SDL_DestroyWindow(win);
        TTF_Quit();
        SDL_Quit();
        return 1;
    }

    // Try a common system font; adjust path if needed on your system
    const char* font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
    TTF_Font* font = TTF_OpenFont(font_path, 32);
    if (!font) {
        std::cerr << "TTF_OpenFont Error: " << TTF_GetError() << std::endl;
        SDL_DestroyRenderer(ren);
        SDL_DestroyWindow(win);
        TTF_Quit();
        SDL_Quit();
        return 1;
    }

    SDL_Color color = {255, 255, 255, 255};
    SDL_Surface* surf = TTF_RenderUTF8_Blended(font, text, color);
    if (!surf) {
        std::cerr << "TTF_RenderUTF8_Blended Error: " << TTF_GetError() << std::endl;
        TTF_CloseFont(font);
        SDL_DestroyRenderer(ren);
        SDL_DestroyWindow(win);
        TTF_Quit();
        SDL_Quit();
        return 1;
    }

    SDL_Texture* tex = SDL_CreateTextureFromSurface(ren, surf);
    int texW = surf->w;
    int texH = surf->h;
    SDL_FreeSurface(surf);

    bool running = true;
    SDL_Event e;

    while (running) {
        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_QUIT) running = false;
            if (e.type == SDL_KEYDOWN) {
                if (e.key.keysym.sym == SDLK_ESCAPE) running = false;
            }
        }

        SDL_SetRenderDrawColor(ren, 0, 0, 0, 255);
        SDL_RenderClear(ren);

        // center the text
        int w, h;
        SDL_GetWindowSize(win, &w, &h);
        SDL_Rect dst;
        dst.w = texW;
        dst.h = texH;
        dst.x = (w - texW) / 2;
        dst.y = (h - texH) / 2;

        SDL_RenderCopy(ren, tex, NULL, &dst);
        SDL_RenderPresent(ren);
        SDL_Delay(16);
    }

    SDL_DestroyTexture(tex);
    TTF_CloseFont(font);
    SDL_DestroyRenderer(ren);
    SDL_DestroyWindow(win);
    TTF_Quit();
    SDL_Quit();
    return 0;
}
