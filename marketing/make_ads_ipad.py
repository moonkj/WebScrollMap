#!/usr/bin/env python3
"""App Store iPad premium ad screenshots — real iPad screenshots + same team spec.

Target: 2048 × 2732 (iPad Pro 12.9" landscape? no — portrait).
Apple accepts 2048×2732 portrait or 2732×2048 landscape.
We use portrait (taller) for consistency with iPhone version.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
from pathlib import Path
import math

# iPad Pro 12.9" portrait
W_OUT, H_OUT = 2048, 2732
SS = 2
W, H = W_OUT * SS, H_OUT * SS

BASE = Path(__file__).parent
OUT = BASE / 'screenshots_ipad'
SOURCE = BASE / 'source'
OUT.mkdir(parents=True, exist_ok=True)

FONT_PATH = '/System/Library/Fonts/AppleSDGothicNeo.ttc'


def font(size, weight='heavy'):
    idx = {'heavy': 9, 'bold': 4, 'regular': 0, 'thin': 1}.get(weight, 0)
    return ImageFont.truetype(FONT_PATH, size * SS, index=idx)


def gradient(size, c1, c2, angle=0):
    w, h = size
    diag = int(math.hypot(w, h)) + 4
    grad = Image.new('RGB', (diag, diag), c1)
    draw = ImageDraw.Draw(grad)
    for i in range(diag):
        t = i / max(1, diag - 1)
        r = int(c1[0] * (1 - t) + c2[0] * t)
        g = int(c1[1] * (1 - t) + c2[1] * t)
        b = int(c1[2] * (1 - t) + c2[2] * t)
        draw.line([(0, i), (diag, i)], fill=(r, g, b))
    grad = grad.rotate(angle, resample=Image.BICUBIC)
    cx, cy = diag // 2, diag // 2
    out = grad.crop((cx - w // 2, cy - h // 2, cx - w // 2 + w,
                     cy - h // 2 + h))
    return out.convert('RGBA')


def radial_blob(size, center, radius, color):
    w, h = size
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, 'RGBA')
    cx, cy = center
    cr, cg, cb, ca = color
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
              fill=(cr, cg, cb, ca))
    img = img.filter(ImageFilter.GaussianBlur(radius=radius // 3))
    return img


def text_center(draw, xy, text, fnt, fill='#fff'):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    tw = bbox[2] - bbox[0]
    draw.text((xy[0] - tw // 2, xy[1]), text, font=fnt, fill=fill)


def text_shadow_center(canvas, xy, text, fnt, fill='#fff',
                       shadow=(0, 0, 0, 80), shadow_off=(0, 3), blur=6):
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, 'RGBA')
    text_center(d, (xy[0] + shadow_off[0] * SS, xy[1] + shadow_off[1] * SS),
                text, fnt, fill=shadow)
    shadow_layer = layer.filter(ImageFilter.GaussianBlur(blur * SS))
    canvas.alpha_composite(shadow_layer)
    d2 = ImageDraw.Draw(canvas, 'RGBA')
    text_center(d2, xy, text, fnt, fill=fill)


def tablet_frame(mockup, radius=40):
    """Wrap iPad mockup with bezel + glass highlight. iPad has symmetric bezels."""
    mw, mh = mockup.size
    bezel = 24 * SS  # iPad bezel is thicker
    corner_r = radius * SS
    w = mw + bezel * 2
    h = mh + bezel * 2
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(out, 'RGBA')
    d.rounded_rectangle([0, 0, w, h],
                        radius=corner_r + bezel, fill=(22, 24, 30, 255))
    mask = Image.new('L', (mw, mh), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, mw, mh], radius=corner_r, fill=255)
    out.paste(mockup, (bezel, bezel), mask)
    # iPad has no notch — just a thin camera dot
    cam_r = int(5 * SS)
    cam_cx = bezel + mw // 2
    cam_cy = bezel // 2
    d.ellipse([cam_cx - cam_r, cam_cy - cam_r,
               cam_cx + cam_r, cam_cy + cam_r], fill=(14, 14, 18, 255))
    # Glass highlight — subtle top third
    gh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(gh, 'RGBA')
    for i in range(int(h * 0.3)):
        alpha = int(30 * (1 - i / (h * 0.3)))
        gdraw.line([(0, i), (w, i)], fill=(255, 255, 255, alpha))
    screen_mask = Image.new('L', (w, h), 0)
    smd = ImageDraw.Draw(screen_mask)
    smd.rounded_rectangle([bezel, bezel, bezel + mw, bezel + mh],
                          radius=corner_r, fill=255)
    gh.putalpha(ImageChops.multiply(gh.split()[3], screen_mask))
    out.alpha_composite(gh)
    return out


def place_tilted_tablet(canvas, mockup, angle_deg, cx, cy, target_h,
                        shadow_intensity=1.0):
    framed = tablet_frame(mockup)
    fw, fh = framed.size
    scale = target_h / fh
    new_size = (int(fw * scale), int(fh * scale))
    framed = framed.resize(new_size, Image.LANCZOS)
    rot = framed.rotate(angle_deg, resample=Image.BICUBIC, expand=True)
    rw, rh = rot.size
    px = int(cx - rw / 2)
    py = int(cy - rh / 2)

    # Dual shadow
    alpha = rot.split()[3]
    amb = Image.new('RGBA', rot.size, (0, 0, 0, 0))
    amb.putalpha(alpha.filter(ImageFilter.GaussianBlur(56 * SS)))
    amb_black = Image.new('RGBA', rot.size, (0, 0, 0, 0))
    amb_black.paste((0, 0, 0, int(140 * shadow_intensity)),
                    mask=amb.split()[3])
    canvas.alpha_composite(amb_black, (px + int(12 * SS), py + int(48 * SS)))

    ctc = Image.new('RGBA', rot.size, (0, 0, 0, 0))
    ctc.putalpha(alpha.filter(ImageFilter.GaussianBlur(22 * SS)))
    ctc_black = Image.new('RGBA', rot.size, (0, 0, 0, 0))
    ctc_black.paste((0, 0, 0, int(110 * shadow_intensity)),
                    mask=ctc.split()[3])
    canvas.alpha_composite(ctc_black, (px + int(4 * SS), py + int(18 * SS)))

    canvas.alpha_composite(rot, (px, py))


def sparkle(d, cx, cy, size, color=(255, 255, 255, 220)):
    s = size * SS
    d.polygon([(cx, cy - s), (cx + s // 5, cy), (cx, cy + s),
               (cx - s // 5, cy)], fill=color)
    d.polygon([(cx - s, cy), (cx, cy - s // 5), (cx + s, cy),
               (cx, cy + s // 5)], fill=color)


def rounded_pill(d, box, fill, radius=None):
    x1, y1, x2, y2 = box
    r = radius or (y2 - y1) // 2
    d.rounded_rectangle([x1, y1, x2, y2], radius=r, fill=fill)


def _load_real(name):
    """Load iPad screenshot (vertical)."""
    raw = Image.open(SOURCE / name).convert('RGBA')
    return raw


def premium_background(c1, c2, angle, blob_specs):
    base = gradient((W, H), c1, c2, angle=angle)
    for (bx_pct, by_pct, radius, color) in blob_specs:
        bx = int(W * bx_pct)
        by = int(H * by_pct)
        blob = radial_blob((W, H), (bx, by), radius * SS, color)
        base.alpha_composite(blob)
    return base


# ────────────────────────── Compositions ──────────────────────────

def compose_hero():
    canvas = premium_background(
        (15, 23, 50), (75, 24, 120), angle=155,
        blob_specs=[
            (0.15, 0.20, 700, (255, 128, 64, 80)),
            (0.85, 0.35, 800, (200, 100, 255, 70)),
            (0.50, 0.85, 900, (120, 80, 255, 60)),
        ])

    text_shadow_center(canvas, (W // 2, 140 * SS),
                       '길게 읽지 마세요', font(130, 'heavy'), fill='#fff')
    text_shadow_center(canvas, (W // 2, 320 * SS),
                       '지도처럼 탐색하세요', font(130, 'heavy'), fill='#fff')
    d = ImageDraw.Draw(canvas, 'RGBA')
    text_center(d, (W // 2, 540 * SS),
                '뉴스, 블로그, 기술문서 한 번에 파악',
                font(52, 'regular'), fill=(255, 255, 255, 230))

    real = _load_real('ipad_search.png')
    place_tilted_tablet(canvas, real, angle_deg=5,
                        cx=W // 2, cy=1800 * SS,
                        target_h=1900 * SS)

    sd = ImageDraw.Draw(canvas, 'RGBA')
    sparkle(sd, 250 * SS, 700 * SS, 28, color=(255, 220, 180, 230))
    sparkle(sd, W - 280 * SS, 600 * SS, 22, color=(220, 200, 255, 230))
    sparkle(sd, 320 * SS, 820 * SS, 14, color=(255, 255, 255, 200))
    sparkle(sd, W - 350 * SS, 780 * SS, 18, color=(255, 220, 180, 200))

    bxy = (600 * SS, 2580 * SS, W - 600 * SS, 2680 * SS)
    rounded_pill(sd, bxy, fill=(12, 18, 34, 220))
    text_center(sd, (W // 2, 2598 * SS),
                '무료로 써보기', font(44, 'heavy'), fill='#fff')

    return canvas


def compose_feature():
    canvas = premium_background(
        (12, 40, 60), (20, 90, 140), angle=140,
        blob_specs=[
            (0.20, 0.25, 750, (64, 180, 255, 90)),
            (0.85, 0.50, 850, (100, 220, 240, 70)),
            (0.40, 0.90, 900, (60, 120, 255, 60)),
        ])

    text_shadow_center(canvas, (W // 2, 140 * SS),
                       '핀 꽂고', font(150, 'heavy'), fill='#fff')
    text_shadow_center(canvas, (W // 2, 340 * SS),
                       '한 번에 돌아온다', font(140, 'heavy'), fill='#fff')
    d = ImageDraw.Draw(canvas, 'RGBA')
    text_center(d, (W // 2, 560 * SS),
                '북마크한 부분을 원클릭으로 복귀',
                font(54, 'regular'), fill=(255, 255, 255, 235))

    real = _load_real('ipad_popup.png')
    place_tilted_tablet(canvas, real, angle_deg=-7,
                        cx=W // 2, cy=1810 * SS,
                        target_h=1900 * SS)

    sd = ImageDraw.Draw(canvas, 'RGBA')
    sparkle(sd, 220 * SS, 700 * SS, 28, color=(180, 240, 255, 230))
    sparkle(sd, W - 250 * SS, 700 * SS, 22, color=(255, 255, 255, 220))
    sparkle(sd, W - 350 * SS, 820 * SS, 14, color=(180, 240, 255, 180))
    sparkle(sd, 300 * SS, 820 * SS, 16, color=(180, 240, 255, 200))

    bxy = (540 * SS, 2580 * SS, W - 540 * SS, 2680 * SS)
    rounded_pill(sd, bxy, fill=(10, 20, 40, 220))
    text_center(sd, (W // 2, 2598 * SS),
                '최대 5개 핀 · 원터치 복귀', font(44, 'heavy'), fill='#fff')

    return canvas


def compose_closer():
    canvas = premium_background(
        (10, 45, 32), (5, 100, 70), angle=135,
        blob_specs=[
            (0.25, 0.20, 700, (80, 220, 150, 80)),
            (0.82, 0.40, 800, (70, 200, 180, 70)),
            (0.50, 0.90, 850, (40, 160, 120, 60)),
        ])

    text_shadow_center(canvas, (W // 2, 140 * SS),
                       '사고 나면', font(150, 'heavy'), fill='#fff')
    text_shadow_center(canvas, (W // 2, 340 * SS),
                       '영원히 내 것', font(150, 'heavy'), fill='#fff')
    d = ImageDraw.Draw(canvas, 'RGBA')
    text_center(d, (W // 2, 560 * SS),
                '한 번의 결제로 프라이버시 지키며 쓰기',
                font(50, 'regular'), fill=(255, 255, 255, 235))

    real = _load_real('ipad_main.png')
    place_tilted_tablet(canvas, real, angle_deg=-6,
                        cx=W // 2, cy=1810 * SS,
                        target_h=1900 * SS)

    sd = ImageDraw.Draw(canvas, 'RGBA')
    sparkle(sd, 230 * SS, 700 * SS, 28, color=(200, 255, 220, 230))
    sparkle(sd, W - 280 * SS, 620 * SS, 22, color=(255, 255, 255, 220))
    sparkle(sd, 320 * SS, 820 * SS, 15, color=(180, 255, 200, 200))
    sparkle(sd, W - 360 * SS, 800 * SS, 18, color=(200, 255, 220, 180))

    bxy = (480 * SS, 2580 * SS, W - 480 * SS, 2680 * SS)
    rounded_pill(sd, bxy, fill=(8, 22, 18, 220))
    text_center(sd, (W // 2, 2598 * SS),
                '한 번 구매 · 구독·인앱 없음', font(40, 'heavy'), fill='#fff')

    return canvas


def finalize(canvas, name):
    out = canvas.resize((W_OUT, H_OUT), Image.LANCZOS)
    bg = Image.new('RGB', (W_OUT, H_OUT), (255, 255, 255))
    bg.paste(out, (0, 0), out)
    bg.save(OUT / name, 'PNG', optimize=True)
    print(f'{name} saved ({(OUT / name).stat().st_size // 1024} KB)')


if __name__ == '__main__':
    finalize(compose_hero(), '01_hero.png')
    finalize(compose_feature(), '02_pin.png')
    finalize(compose_closer(), '03_privacy.png')
    print(f'Saved to: {OUT}')
