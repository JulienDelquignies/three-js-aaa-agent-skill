// Remplaçant minimal de SDL2_gfx (rotozoom) pour la compilation WebAssembly : le moteur n'appelle que zoomSurface,
// pour l'interface et les images (jamais pendant la simulation sans rendu). Mise à l'échelle par SDL_BlitScaled.
#pragma once
#include <SDL2/SDL.h>
#define SMOOTHING_OFF 0
#define SMOOTHING_ON 1
static inline SDL_Surface *zoomSurface(SDL_Surface *src, double zoomx, double zoomy, int smooth) {
  (void)smooth;
  if (!src) return nullptr;
  int w = (int)(src->w * zoomx + 0.5), h = (int)(src->h * zoomy + 0.5);
  if (w < 1) w = 1;
  if (h < 1) h = 1;
  SDL_Surface *dst = SDL_CreateRGBSurfaceWithFormat(0, w, h, 32, SDL_PIXELFORMAT_RGBA32);
  if (!dst) return nullptr;
  SDL_BlitScaled(src, nullptr, dst, nullptr);
  return dst;
}
