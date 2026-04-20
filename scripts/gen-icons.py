#!/usr/bin/env python3
"""Generate WebScrollMap icons (placeholder, MZ 톤).
- App Store: 1024x1024 PNG (Assets.xcassets/AppIcon.appiconset/)
- Web extension: 128/64/48/32/16 PNG (extension/icons/)
- Large icon: 256x256 (Assets.xcassets/LargeIcon.imageset/)
"""
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APPICON_DIR = ROOT / "native/WebScrollMap/WebScrollMap/Assets.xcassets/AppIcon.appiconset"
LARGEICON_DIR = ROOT / "native/WebScrollMap/WebScrollMap/Assets.xcassets/LargeIcon.imageset"
WEBEXT_ICONS = ROOT / "extension/icons"

BG = (15, 23, 42)        # slate-900
TRACK = (30, 41, 59)     # slate-800
H1 = (226, 232, 240)     # slate-200
H2 = (148, 163, 184)     # slate-400
ACCENT = (96, 165, 250)  # blue-400


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG + (255,))
    d = ImageDraw.Draw(img)

    # 둥근 사각형 배경 (iOS는 자동 마스킹하지만 웹 확장용으론 필요)
    r = int(size * 0.22)
    # 그냥 사각형 — iOS가 알아서 마스킹, 웹은 square OK

    # 미니맵 세로 트랙 (우측 1/4)
    track_w = max(2, int(size * 0.10))
    track_x = int(size * 0.72)
    d.rectangle([track_x, int(size * 0.15), track_x + track_w, int(size * 0.85)], fill=TRACK)

    # 앵커 마커들 (h1/h2 혼합, 지도의 "섹션" 느낌)
    n = 7
    for i in range(n):
        y = int(size * (0.18 + i * 0.09))
        # 중심부 가로 바 (텍스트 섹션 스타일) — MZ 타이포그래피 블록
        bar_h = max(2, int(size * 0.025))
        if i % 3 == 0:  # H1
            bar_x = int(size * 0.15)
            bar_w = int(size * 0.50)
            d.rectangle([bar_x, y, bar_x + bar_w, y + bar_h * 2], fill=H1)
        elif i % 3 == 1:  # H2
            bar_x = int(size * 0.22)
            bar_w = int(size * 0.38)
            d.rectangle([bar_x, y, bar_x + bar_w, y + bar_h], fill=H2)
        else:  # media
            bar_x = int(size * 0.30)
            bar_w = int(size * 0.30)
            d.rectangle([bar_x, y, bar_x + bar_w, y + bar_h], fill=ACCENT)

        # 트랙 위 대응 점
        dot_y = y + bar_h // 2
        dot_r = max(2, int(size * 0.012))
        d.ellipse(
            [track_x - dot_r, dot_y - dot_r, track_x + track_w + dot_r, dot_y + dot_r],
            fill=ACCENT,
        )

    # Viewport indicator — accent 글로우 박스
    vp_y0 = int(size * 0.38)
    vp_y1 = int(size * 0.62)
    d.rectangle(
        [track_x - int(size * 0.02), vp_y0, track_x + track_w + int(size * 0.02), vp_y1],
        outline=ACCENT,
        width=max(1, int(size * 0.012)),
    )

    return img


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print(f"  wrote {path.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")


def main():
    print("Generating icons...")

    # App Store 1024x1024
    base = make_icon(1024)
    save(base, APPICON_DIR / "icon-1024.png")
    # dark variant — 이미 dark 톤이라 동일 사용
    save(base, APPICON_DIR / "icon-1024-dark.png")
    # tinted variant — 회색조
    tinted = Image.new("RGBA", (1024, 1024), (40, 40, 40, 255))
    d = ImageDraw.Draw(tinted)
    # simpler mono version
    for i in range(7):
        y = int(1024 * (0.18 + i * 0.09))
        d.rectangle([150, y, 600, y + 25], fill=(200, 200, 200))
    save(tinted, APPICON_DIR / "icon-1024-tinted.png")

    # LargeIcon 256x256
    save(make_icon(256), LARGEICON_DIR / "icon-256.png")

    # Web extension icons
    for size in (16, 32, 48, 64, 128):
        save(make_icon(size), WEBEXT_ICONS / f"icon-{size}.png")

    # Update Contents.json to reference the filenames
    contents_appicon = """{
  "images" : [
    {
      "filename" : "icon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    },
    {
      "appearances" : [{"appearance" : "luminosity", "value" : "dark"}],
      "filename" : "icon-1024-dark.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    },
    {
      "appearances" : [{"appearance" : "luminosity", "value" : "tinted"}],
      "filename" : "icon-1024-tinted.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {"author" : "xcode", "version" : 1}
}
"""
    (APPICON_DIR / "Contents.json").write_text(contents_appicon)
    print("  updated AppIcon Contents.json")

    contents_large = """{
  "images" : [
    {"filename" : "icon-256.png", "idiom" : "universal", "scale" : "1x"},
    {"idiom" : "universal", "scale" : "2x"},
    {"idiom" : "universal", "scale" : "3x"}
  ],
  "info" : {"author" : "xcode", "version" : 1}
}
"""
    (LARGEICON_DIR / "Contents.json").write_text(contents_large)
    print("  updated LargeIcon Contents.json")

    print("Done.")


if __name__ == "__main__":
    main()
