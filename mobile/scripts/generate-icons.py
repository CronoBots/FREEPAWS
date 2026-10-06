"""Génère les icônes et le splash de l'app à partir du logo FreePaws.

Usage : python3 scripts/generate-icons.py ../FreePaws.png
Remplacer le logo source par une version HD (≥ 1024 px, idéalement SVG exporté)
avant la publication sur les stores, puis relancer ce script.
"""
import sys

import numpy as np
from PIL import Image

CREAM = (250, 241, 231, 255)
source = sys.argv[1] if len(sys.argv) > 1 else "../FreePaws.png"

img = Image.open(source).convert("RGB")
# Le logo actuel a une ligne parasite sur la dernière colonne : on rogne 2 % de chaque bord.
w, h = img.size
m = max(2, round(min(w, h) * 0.02))
img = img.crop((m, m, w - m, h - m))

pixels = np.asarray(img).astype(np.float32)
lum = pixels.mean(axis=2)
paper = np.percentile(lum, 90) - 12
ink = np.percentile(lum, 1)
alpha = np.clip((paper - lum) / (paper - ink), 0, 1)
ink_color = pixels[alpha > 0.9].mean(axis=0).astype(np.uint8)

rgba = np.zeros((*alpha.shape, 4), dtype=np.uint8)
rgba[..., :3] = ink_color
rgba[..., 3] = (alpha * 255).astype(np.uint8)
logo = Image.fromarray(rgba, "RGBA")
logo = logo.crop(logo.getbbox())


def place(size, ratio, background=None, art=logo):
    scale = size * ratio / max(art.size)
    resized = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


white = np.asarray(logo).copy()
white[..., :3] = 255
monochrome = Image.fromarray(white, "RGBA")

place(1024, 0.78, CREAM).convert("RGB").save("assets/icon.png")
place(1024, 0.60).save("assets/android-icon-foreground.png")
Image.new("RGB", (1024, 1024), CREAM[:3]).save("assets/android-icon-background.png")
place(1024, 0.60, art=monochrome).save("assets/android-icon-monochrome.png")
place(1024, 0.92).save("assets/splash-icon.png")
place(512, 0.92).save("assets/logo.png")
place(48, 0.9, CREAM).save("assets/favicon.png")
print("Icônes générées, couleur d'encre", tuple(int(c) for c in ink_color), "cadre", logo.size)
