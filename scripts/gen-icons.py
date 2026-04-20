#!/usr/bin/env python3
"""WebScrollMap 아이콘 생성기.

디자인 컨셉:
- 남색 배경 (slate-900 #0F172A)
- 우측에 얇은 미니맵 바 (slate-800 트랙 + 오렌지 뷰포트 indicator + 오렌지 앵커 점)
- 중앙에 H1/H2 스타일 가로바 (텍스트 계층 암시)
- 호스트 앱 Main.html의 다크 톤과 일관성

출력:
- AppIcon: universal-icon-1024@1x.png (Contents.json이 참조하는 기본 파일)
- LargeIcon.imageset/icon-128.png
- Resources/Icon.png (호스트 앱 Main.html에서 표시)
- Web extension icons: extension/icons/icon-16/32/48/64/128.png
"""
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APPICON_DIR = ROOT / "native/WebScrollMap/WebScrollMap/Assets.xcassets/AppIcon.appiconset"
LARGEICON_DIR = ROOT / "native/WebScrollMap/WebScrollMap/Assets.xcassets/LargeIcon.imageset"
RESOURCES_ICON = ROOT / "native/WebScrollMap/WebScrollMap/Resources/Icon.png"
WEBEXT_ICONS = ROOT / "extension/icons"

# Palette — 호스트 앱 Style.css 와 일치시켜 일관성 유지
BG = (15, 23, 42)        # slate-900 — 호스트 앱 --bg
TRACK = (44, 44, 46)     # iOS card
H1 = (226, 232, 240)     # slate-200
H2 = (148, 163, 184)     # slate-400
ACCENT = (249, 115, 22)  # orange-500 (Pro/pin과 일치)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG + (255,))
    d = ImageDraw.Draw(img)

    # 미니맵 세로 트랙 (우측 1/8)
    track_w = max(3, int(size * 0.09))
    track_x = int(size * 0.75)
    track_y0 = int(size * 0.17)
    track_y1 = int(size * 0.83)
    d.rounded_rectangle([track_x, track_y0, track_x + track_w, track_y1],
                        radius=max(2, int(size * 0.015)),
                        fill=TRACK)

    # 앵커 마커 (H1/H2 중앙 가로바 + 트랙 위 점) — 페이지 구조 암시
    n = 7
    for i in range(n):
        y = int(size * (0.18 + i * 0.09))
        bar_h = max(2, int(size * 0.028))

        if i % 3 == 0:  # H1 — 중앙 긴 바
            bar_x = int(size * 0.15)
            bar_w = int(size * 0.50)
            d.rounded_rectangle([bar_x, y, bar_x + bar_w, y + bar_h * 2],
                                radius=max(1, int(size * 0.008)),
                                fill=H1)
        elif i % 3 == 1:  # H2 — 중간 바
            bar_x = int(size * 0.20)
            bar_w = int(size * 0.40)
            d.rounded_rectangle([bar_x, y, bar_x + bar_w, y + bar_h],
                                radius=max(1, int(size * 0.006)),
                                fill=H2)
        else:  # 이미지/미디어 — accent 얇은 바
            bar_x = int(size * 0.28)
            bar_w = int(size * 0.28)
            d.rounded_rectangle([bar_x, y, bar_x + bar_w, y + bar_h],
                                radius=max(1, int(size * 0.006)),
                                fill=ACCENT)

        # 트랙 위 대응 점
        dot_y = y + bar_h // 2
        dot_r = max(2, int(size * 0.013))
        d.ellipse(
            [track_x - dot_r, dot_y - dot_r,
             track_x + track_w + dot_r, dot_y + dot_r],
            fill=ACCENT,
        )

    # Viewport indicator — accent 글로우 박스 (중앙 ~1/4 영역)
    vp_y0 = int(size * 0.40)
    vp_y1 = int(size * 0.60)
    border = max(2, int(size * 0.014))
    d.rounded_rectangle(
        [track_x - int(size * 0.025), vp_y0,
         track_x + track_w + int(size * 0.025), vp_y1],
        radius=max(2, int(size * 0.01)),
        outline=ACCENT,
        width=border,
    )

    return img


def make_tinted_icon(size: int) -> Image.Image:
    """iOS 17+ 틴티드 variant — 모노 화이트/회색 버전."""
    img = Image.new("RGBA", (size, size), (40, 40, 40, 255))
    d = ImageDraw.Draw(img)
    for i in range(7):
        y = int(size * (0.18 + i * 0.09))
        bar_h = max(2, int(size * 0.028))
        bar_x = int(size * 0.15)
        bar_w = int(size * 0.55)
        d.rounded_rectangle([bar_x, y, bar_x + bar_w, y + bar_h * (2 if i % 3 == 0 else 1)],
                            radius=2,
                            fill=(200, 200, 200))
    return img


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    rel = path.relative_to(ROOT)
    print(f"  wrote {rel} ({img.size[0]}x{img.size[1]})")


def write_contents_json():
    # AppIcon.appiconset/Contents.json — 기본 + 다크 + 틴티드 3개 variant
    contents = {
        "images": [
            {
                "idiom": "universal",
                "platform": "ios",
                "size": "1024x1024",
                "filename": "icon-1024.png",
            },
            {
                "appearances": [{"appearance": "luminosity", "value": "dark"}],
                "idiom": "universal",
                "platform": "ios",
                "size": "1024x1024",
                "filename": "icon-1024-dark.png",
            },
            {
                "appearances": [{"appearance": "luminosity", "value": "tinted"}],
                "idiom": "universal",
                "platform": "ios",
                "size": "1024x1024",
                "filename": "icon-1024-tinted.png",
            },
        ],
        "info": {"author": "xcode", "version": 1},
    }
    import json
    (APPICON_DIR / "Contents.json").write_text(json.dumps(contents, indent=2))
    print("  updated AppIcon Contents.json")

    large_contents = {
        "images": [
            {"filename": "icon-256.png", "idiom": "universal", "scale": "1x"},
            {"idiom": "universal", "scale": "2x"},
            {"idiom": "universal", "scale": "3x"},
        ],
        "info": {"author": "xcode", "version": 1},
    }
    (LARGEICON_DIR / "Contents.json").write_text(json.dumps(large_contents, indent=2))
    print("  updated LargeIcon Contents.json")


def clean_old():
    """Xcode converter가 자동 생성한 파일을 청소 (우리 설계로 덮어쓰기 전)."""
    for leftover in [
        APPICON_DIR / "universal-icon-1024@1x.png",
    ]:
        if leftover.exists():
            leftover.unlink()
            print(f"  removed legacy {leftover.relative_to(ROOT)}")


def main():
    print("Generating navy-themed icons...")

    clean_old()

    # App Store 1024x1024 — light (default), dark, tinted
    base = make_icon(1024)
    save(base, APPICON_DIR / "icon-1024.png")
    # dark variant — 현재 디자인이 이미 다크톤이라 동일 사용
    save(base, APPICON_DIR / "icon-1024-dark.png")
    save(make_tinted_icon(1024), APPICON_DIR / "icon-1024-tinted.png")

    # LargeIcon 256 (Xcode Assets 참조)
    save(make_icon(256), LARGEICON_DIR / "icon-256.png")

    # Resources/Icon.png — 호스트 앱 Main.html 참조
    save(make_icon(256), RESOURCES_ICON)

    # Web extension icons
    for size in (16, 32, 48, 64, 128):
        save(make_icon(size), WEBEXT_ICONS / f"icon-{size}.png")

    write_contents_json()
    print("Done.")


if __name__ == "__main__":
    main()
