#!/usr/bin/env python3
"""App Store premium ad screenshots — real screenshots + team spec.

Team consensus applied:
- Dark-gradient premium background (Navy→Purple/Teal)
- Multi-radial blob overlay
- Over-the-phone headline (overlay)
- Dual drop shadow + glass highlight on phone
- Side floating cards + sparkle stars + glow halo
- 2x supersample → LANCZOS downscale
- Copywriter best picks: Set C (hero), A (feature), B (closer)
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
from pathlib import Path
import math

W_OUT, H_OUT = 1290, 2796
SS = 2
W, H = W_OUT * SS, H_OUT * SS

BASE = Path(__file__).parent
OUT = BASE / 'screenshots'
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
    """Radial gradient blob (alpha fades from color alpha to 0)."""
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
    """Draw text with subtle shadow."""
    # Make a text layer
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, 'RGBA')
    # Shadow
    text_center(d, (xy[0] + shadow_off[0] * SS, xy[1] + shadow_off[1] * SS),
                text, fnt, fill=shadow)
    shadow_layer = layer.filter(ImageFilter.GaussianBlur(blur * SS))
    canvas.alpha_composite(shadow_layer)
    # Main text
    d2 = ImageDraw.Draw(canvas, 'RGBA')
    text_center(d2, xy, text, fnt, fill=fill)


def phone_frame(mockup, radius=50):
    """Wrap mockup with bezel + glass highlight + dual drop shadow.
    Returns RGBA of same extent as mockup (bezel adds outer padding)."""
    mw, mh = mockup.size
    bezel = 12 * SS
    corner_r = radius * SS
    w = mw + bezel * 2
    h = mh + bezel * 2
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(out, 'RGBA')
    # Bezel dark
    d.rounded_rectangle([0, 0, w, h],
                        radius=corner_r + bezel, fill=(20, 22, 28, 255))
    # Inner screen (paste mockup with rounded corners)
    mask = Image.new('L', (mw, mh), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, mw, mh], radius=corner_r, fill=255)
    out.paste(mockup, (bezel, bezel), mask)
    # Notch island
    island_w = int(140 * SS)
    island_h = int(34 * SS)
    island_x = bezel + (mw - island_w) // 2
    island_y = bezel + int(22 * SS)
    d.rounded_rectangle(
        [island_x, island_y, island_x + island_w, island_y + island_h],
        radius=island_h // 2, fill=(10, 10, 14, 255))
    # Glass highlight — subtle diagonal gradient on top third
    gh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(gh, 'RGBA')
    for i in range(int(h * 0.35)):
        alpha = int(40 * (1 - i / (h * 0.35)))
        gdraw.line([(0, i), (w, i)], fill=(255, 255, 255, alpha))
    # Mask to inner screen area only
    screen_mask = Image.new('L', (w, h), 0)
    smd = ImageDraw.Draw(screen_mask)
    smd.rounded_rectangle([bezel, bezel, bezel + mw, bezel + mh],
                          radius=corner_r, fill=255)
    gh.putalpha(ImageChops.multiply(gh.split()[3], screen_mask))
    out.alpha_composite(gh)
    return out


def place_tilted_phone(canvas, mockup, angle_deg, cx, cy, target_h,
                       shadow_intensity=1.0):
    """Rotate phone with dual drop shadow, place at (cx, cy) center."""
    framed = phone_frame(mockup)
    fw, fh = framed.size
    scale = target_h / fh
    new_size = (int(fw * scale), int(fh * scale))
    framed = framed.resize(new_size, Image.LANCZOS)
    rot = framed.rotate(angle_deg, resample=Image.BICUBIC, expand=True)
    rw, rh = rot.size
    px = int(cx - rw / 2)
    py = int(cy - rh / 2)

    # Dual shadow (soft ambient + harder contact)
    alpha = rot.split()[3]
    # Soft ambient shadow: bigger blur, lower alpha
    amb = Image.new('RGBA', rot.size, (0, 0, 0, 0))
    amb.putalpha(alpha.filter(ImageFilter.GaussianBlur(48 * SS)))
    amb_black = Image.new('RGBA', rot.size, (0, 0, 0, 0))
    amb_black.paste((0, 0, 0, int(140 * shadow_intensity)),
                    mask=amb.split()[3])
    canvas.alpha_composite(amb_black, (px + int(10 * SS), py + int(40 * SS)))

    # Harder contact shadow: smaller blur, slightly less opacity
    ctc = Image.new('RGBA', rot.size, (0, 0, 0, 0))
    ctc.putalpha(alpha.filter(ImageFilter.GaussianBlur(18 * SS)))
    ctc_black = Image.new('RGBA', rot.size, (0, 0, 0, 0))
    ctc_black.paste((0, 0, 0, int(110 * shadow_intensity)),
                    mask=ctc.split()[3])
    canvas.alpha_composite(ctc_black, (px + int(4 * SS), py + int(16 * SS)))

    # Phone itself
    canvas.alpha_composite(rot, (px, py))
    return (px, py, rw, rh)


def sparkle(d, cx, cy, size, color=(255, 255, 255, 220)):
    """Draw a 4-ray sparkle."""
    s = size * SS
    # Vertical
    d.polygon([(cx, cy - s), (cx + s // 5, cy), (cx, cy + s),
               (cx - s // 5, cy)], fill=color)
    # Horizontal
    d.polygon([(cx - s, cy), (cx, cy - s // 5), (cx + s, cy),
               (cx, cy + s // 5)], fill=color)


def rounded_pill(d, box, fill, radius=None):
    x1, y1, x2, y2 = box
    r = radius or (y2 - y1) // 2
    d.rounded_rectangle([x1, y1, x2, y2], radius=r, fill=fill)


# ────────────────────────── Mockup reproductions ──────────────────────────

def draw_popup_mockup():
    """Re-create v1.0.0 popup (dark, right/0/보통/70%/forest, 1 pin)."""
    pw, ph = 390, 844
    scale = 2.2
    w, h = int(pw * scale * SS), int(ph * scale * SS)
    img = Image.new('RGBA', (w, h), (14, 20, 34, 255))
    d = ImageDraw.Draw(img, 'RGBA')

    # Header strip
    head_h = int(140 * scale * SS / 2.2)
    # Title centered
    text_center(d, (w // 2, int(36 * scale * SS / 2.2)),
                'WebScrollMap', font(22, 'heavy'), fill='#fff')
    # Blue check badge top-right
    cr = int(38 * scale * SS / 2.2)
    cx_ = w - int(52 * scale * SS / 2.2)
    cy_ = int(52 * scale * SS / 2.2)
    d.ellipse([cx_ - cr, cy_ - cr, cx_ + cr, cy_ + cr],
              fill=(82, 164, 255, 255))
    sw = max(4, int(5 * scale * SS / 2.2))
    d.line([(cx_ - cr // 2, cy_ + cr // 6), (cx_ - cr // 8, cy_ + cr // 2),
            (cx_ + cr // 2, cy_ - cr // 3)], fill='#fff', width=sw)

    # Title row
    meta_fnt = font(20, 'heavy')
    d.text((int(30 * scale * SS / 2.2), int(108 * scale * SS / 2.2)),
           'WebScrollMap', font=meta_fnt, fill='#fff')
    sub_fnt = font(14, 'regular')
    d.text((int(30 * scale * SS / 2.2), int(140 * scale * SS / 2.2)),
           '56 anchors · 1 pin', font=sub_fnt, fill=(135, 148, 172, 255))

    def section_label(ty, text):
        d.text((int(30 * scale * SS / 2.2), ty),
               text, font=font(13, 'regular'), fill=(130, 142, 166, 255))

    def seg_bar(y, items, active_idx, height=None):
        height = height or int(54 * scale * SS / 2.2)
        pad = int(30 * scale * SS / 2.2)
        bar_x = pad
        bar_w = w - pad * 2
        d.rounded_rectangle([bar_x, y, bar_x + bar_w, y + height],
                            radius=height // 3, fill=(28, 36, 56, 255))
        seg_w = bar_w / len(items)
        for i, item in enumerate(items):
            sx = bar_x + int(i * seg_w)
            ex = bar_x + int((i + 1) * seg_w)
            if i == active_idx:
                d.rounded_rectangle([sx + 4, y + 4, ex - 4, y + height - 4],
                                    radius=height // 3,
                                    fill=(106, 175, 255, 255))
                color = '#fff'
            else:
                color = (215, 222, 240, 255)
            fnt = font(16, 'heavy' if i == active_idx else 'regular')
            text_center(d, ((sx + ex) // 2, y + height // 2
                            - int(13 * scale * SS / 2.2)),
                        item, fnt, fill=color)

    # 켜기
    ty = int(200 * scale * SS / 2.2)
    d.text((int(30 * scale * SS / 2.2), ty),
           '켜기', font=font(18, 'heavy'), fill='#fff')
    tog_w = int(70 * scale * SS / 2.2)
    tog_h = int(36 * scale * SS / 2.2)
    tog_x = w - int(30 * scale * SS / 2.2) - tog_w
    tog_y = ty - int(6 * scale * SS / 2.2)
    d.rounded_rectangle([tog_x, tog_y, tog_x + tog_w, tog_y + tog_h],
                        radius=tog_h // 2, fill=(106, 175, 255, 255))
    knob_r = tog_h // 2 - 3
    knob_cx = tog_x + tog_w - knob_r - 4
    knob_cy = tog_y + tog_h // 2
    d.ellipse([knob_cx - knob_r, knob_cy - knob_r,
               knob_cx + knob_r, knob_cy + knob_r], fill='#fff')

    # 위치
    ty += int(70 * scale * SS / 2.2)
    section_label(ty, '위치')
    seg_bar(ty + int(30 * scale * SS / 2.2), ['왼쪽', '오른쪽'], 1)

    # 여백
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '여백')
    seg_bar(ty + int(30 * scale * SS / 2.2),
            ['0', '8', '16', '24', '32'], 0)

    # 바 두께
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '바 두께')
    seg_bar(ty + int(30 * scale * SS / 2.2),
            ['얇게', '보통', '두껍게'], 1)

    # 투명도
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '메모장 투명도')
    seg_bar(ty + int(30 * scale * SS / 2.2),
            ['40%', '70%', '100%'], 1)

    # 테마
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '테마')
    colors = [
        (249, 115, 22),
        (251, 113, 133),
        (56, 189, 248),
        (74, 222, 128),   # forest active
        (148, 163, 184),
    ]
    pad = int(30 * scale * SS / 2.2)
    bar_w = w - pad * 2
    cy_ = ty + int(30 * scale * SS / 2.2) + int(28 * scale * SS / 2.2)
    each_w = bar_w / 5
    for i, col in enumerate(colors):
        cx = pad + int(each_w * (i + 0.5))
        dot_r = int(14 * scale * SS / 2.2)
        if i == 3:
            sel_r = dot_r + int(14 * scale * SS / 2.2)
            d.ellipse([cx - sel_r, cy_ - sel_r, cx + sel_r, cy_ + sel_r],
                      outline=(106, 175, 255, 255),
                      width=max(3, int(3 * scale * SS / 2.2)))
        d.ellipse([cx - dot_r, cy_ - dot_r, cx + dot_r, cy_ + dot_r],
                  fill=col)

    # 핀
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '핀')
    pry = ty + int(30 * scale * SS / 2.2)
    pdr = int(10 * scale * SS / 2.2)
    px = pad + pdr + 8
    d.ellipse([px - pdr, pry + int(18 * scale * SS / 2.2) - pdr,
               px + pdr, pry + int(18 * scale * SS / 2.2) + pdr],
              fill=(249, 115, 22, 255))
    d.text((px + int(24 * scale * SS / 2.2),
            pry + int(6 * scale * SS / 2.2)),
           '#1 · 웹 검색결과', font=font(16, 'regular'), fill='#fff')
    d.text((w - pad - int(20 * scale * SS / 2.2), pry + 2),
           '×', font=font(22, 'heavy'), fill=(180, 195, 220, 255))

    # 핀 비우기
    bty = pry + int(70 * scale * SS / 2.2)
    d.rounded_rectangle(
        [pad, bty, w - pad, bty + int(50 * scale * SS / 2.2)],
        radius=int(12 * scale * SS / 2.2),
        outline=(70, 90, 120, 255),
        width=max(2, int(2 * scale * SS / 2.2)))
    text_center(d, (w // 2, bty + int(14 * scale * SS / 2.2)),
                '핀 비우기', font(16, 'regular'),
                fill=(215, 225, 245, 255))

    fty = h - int(46 * scale * SS / 2.2)
    text_center(d, (w // 2, fty), 'v1.0.0',
                font(13, 'regular'), fill=(110, 122, 146, 255))

    return img


def draw_main_mockup():
    """Main.html app info page (dark)."""
    pw, ph = 390, 844
    scale = 2.2
    w, h = int(pw * scale * SS), int(ph * scale * SS)
    img = Image.new('RGBA', (w, h), (12, 16, 28, 255))
    d = ImageDraw.Draw(img, 'RGBA')

    # App icon
    icon_size = int(120 * scale * SS / 2.2)
    ix = (w - icon_size) // 2
    iy = int(60 * scale * SS / 2.2)
    icon_grad = gradient((icon_size, icon_size),
                         (251, 146, 60), (249, 115, 22), angle=135)
    mask = Image.new('L', (icon_size, icon_size), 0)
    mask_d = ImageDraw.Draw(mask)
    mask_d.rounded_rectangle([0, 0, icon_size, icon_size],
                             radius=icon_size // 4, fill=255)
    icon_rgba = icon_grad.copy()
    icon_rgba.putalpha(mask)
    img.alpha_composite(icon_rgba, (ix, iy))
    # Icon glyph (horiz lines + bar)
    cd = ImageDraw.Draw(img, 'RGBA')
    icon_pad = int(22 * scale * SS / 2.2)
    line_y = iy + int(28 * scale * SS / 2.2)
    for ln_w in [0.7, 0.55, 0.4]:
        cd.rounded_rectangle(
            [ix + icon_pad, line_y,
             ix + icon_pad + int((icon_size - icon_pad * 2) * ln_w * 0.6),
             line_y + int(6 * scale * SS / 2.2)],
            radius=2, fill='#fff')
        line_y += int(14 * scale * SS / 2.2)
    cd.rounded_rectangle(
        [ix + icon_size - icon_pad - int(6 * scale * SS / 2.2),
         iy + int(24 * scale * SS / 2.2),
         ix + icon_size - icon_pad,
         iy + icon_size - int(24 * scale * SS / 2.2)],
        radius=int(3 * scale * SS / 2.2), fill='#fff')

    # App name
    tty = iy + icon_size + int(20 * scale * SS / 2.2)
    text_center(d, (w // 2, tty), 'WebScrollMap',
                font(34, 'heavy'), fill='#fff')
    text_center(d, (w // 2, tty + int(56 * scale * SS / 2.2)),
                '긴 웹페이지를 지도처럼 탐색',
                font(16, 'regular'), fill=(180, 195, 215, 255))

    # Step cards
    step_y = tty + int(110 * scale * SS / 2.2)
    step_w = w - int(40 * scale * SS / 2.2)
    step_h = int(85 * scale * SS / 2.2)
    step_x = int(20 * scale * SS / 2.2)
    step_gap = int(12 * scale * SS / 2.2)
    steps = [
        ('1', 'Safari 확장 켜기', '설정 → Safari → 확장'),
        ('2', '모든 웹사이트 허용', '"모든 웹사이트" → "허용"'),
        ('3', '긴 페이지에서 사용', '바가 자동으로 나타남'),
    ]
    for i, (num, title, sub) in enumerate(steps):
        sy = step_y + i * (step_h + step_gap)
        d.rounded_rectangle([step_x, sy, step_x + step_w, sy + step_h],
                            radius=int(14 * scale * SS / 2.2),
                            fill=(24, 32, 50, 255))
        d.rounded_rectangle([step_x, sy, step_x + int(5 * scale * SS / 2.2),
                             sy + step_h],
                            radius=int(3 * scale * SS / 2.2),
                            fill=(249, 115, 22, 255))
        cr = int(18 * scale * SS / 2.2)
        cx = step_x + int(34 * scale * SS / 2.2)
        cy = sy + step_h // 2
        d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr],
                  fill=(249, 115, 22, 255))
        text_center(d, (cx, cy - int(13 * scale * SS / 2.2)),
                    num, font(18, 'heavy'), fill='#fff')
        d.text((cx + int(34 * scale * SS / 2.2),
                sy + int(18 * scale * SS / 2.2)),
               title, font=font(16, 'heavy'), fill='#fff')
        d.text((cx + int(34 * scale * SS / 2.2),
                sy + int(44 * scale * SS / 2.2)),
               sub, font=font(12, 'regular'), fill=(170, 185, 210, 255))

    # Features section
    fy = step_y + 3 * (step_h + step_gap) + int(16 * scale * SS / 2.2)
    d.text((int(30 * scale * SS / 2.2), fy),
           '주요 기능', font=font(16, 'heavy'), fill='#fff')

    feats = [
        ((56, 164, 255), '탭 · 드래그', '바 탭 점프, 드래그 스크럽'),
        ((249, 115, 22), 'Pin Drop', '0.5초 눌러 화면 저장'),
        ((74, 222, 128), '플로팅 메모장', '드래그 이동, 탭 복귀'),
        ((168, 85, 247), '커스텀 검색', '더블탭 · 발광 마커'),
    ]
    fly = fy + int(32 * scale * SS / 2.2)
    item_h = int(55 * scale * SS / 2.2)
    for i, (col, t, s) in enumerate(feats):
        iy_ = fly + i * (item_h + int(8 * scale * SS / 2.2))
        isz = int(36 * scale * SS / 2.2)
        ix_ = int(30 * scale * SS / 2.2)
        d.rounded_rectangle([ix_, iy_, ix_ + isz, iy_ + isz],
                            radius=int(8 * scale * SS / 2.2), fill=col)
        d.text((ix_ + isz + int(14 * scale * SS / 2.2),
                iy_ + int(2 * scale * SS / 2.2)),
               t, font=font(15, 'heavy'), fill='#fff')
        d.text((ix_ + isz + int(14 * scale * SS / 2.2),
                iy_ + int(22 * scale * SS / 2.2)),
               s, font=font(12, 'regular'), fill=(170, 185, 210, 255))

    return img


def _load_real(name, target_phone_w_pts=390):
    """Load user's real screenshot and resize to iPhone-like width for mockup frame."""
    src = SOURCE / name
    raw = Image.open(src).convert('RGBA')
    rw, rh = raw.size
    scale = 2.2
    target_w = int(target_phone_w_pts * scale * SS / 2.2)
    target_h = int(target_w * rh / rw)
    return raw.resize((target_w, target_h), Image.LANCZOS)


def load_real_popup():
    return _load_real('popup.jpg')


def load_real_search():
    return _load_real('search.jpg')


def load_real_main():
    return _load_real('main.jpg')


# ────────────────────────── Background helpers ──────────────────────────

def premium_background(c1, c2, angle, blob_specs):
    """Dark-gradient premium background with multi-radial blobs."""
    base = gradient((W, H), c1, c2, angle=angle)
    for (bx_pct, by_pct, radius, color) in blob_specs:
        bx = int(W * bx_pct)
        by = int(H * by_pct)
        blob = radial_blob((W, H), (bx, by), radius * SS, color)
        base.alpha_composite(blob)
    # Subtle noise (very light)
    return base


# ────────────────────────── Compositions ──────────────────────────

def compose_hero():
    """Hero — IMG_2116 actual Safari screenshot."""
    # Dark-gradient premium: deep navy → vibrant purple
    canvas = premium_background(
        (15, 23, 50), (75, 24, 120), angle=155,
        blob_specs=[
            (0.15, 0.20, 500, (255, 128, 64, 80)),
            (0.85, 0.35, 600, (200, 100, 255, 70)),
            (0.50, 0.85, 700, (120, 80, 255, 60)),
        ])

    # Over-the-phone headline
    text_shadow_center(canvas, (W // 2, 140 * SS),
                       '길게 읽지 마세요', font(95, 'heavy'), fill='#fff')
    text_shadow_center(canvas, (W // 2, 280 * SS),
                       '지도처럼 탐색하세요', font(95, 'heavy'), fill='#fff')
    # Subhead
    d = ImageDraw.Draw(canvas, 'RGBA')
    text_center(d, (W // 2, 460 * SS),
                '뉴스, 블로그, 기술문서 한 번에 파악',
                font(38, 'regular'), fill=(255, 255, 255, 230))

    # Real Gmail search + memo pad screenshot
    real = load_real_search()
    place_tilted_phone(canvas, real, angle_deg=6,
                       cx=W // 2, cy=1850 * SS,
                       target_h=2140 * SS)

    # Sparkles corner
    sd = ImageDraw.Draw(canvas, 'RGBA')
    sparkle(sd, 180 * SS, 620 * SS, 20, color=(255, 220, 180, 230))
    sparkle(sd, W - 200 * SS, 540 * SS, 16, color=(220, 200, 255, 230))
    sparkle(sd, 250 * SS, 740 * SS, 10, color=(255, 255, 255, 200))

    # CTA pill
    bxy = (380 * SS, 2660 * SS, W - 380 * SS, 2750 * SS)
    rounded_pill(sd, bxy, fill=(12, 18, 34, 220))
    text_center(sd, (W // 2, 2676 * SS),
                '무료로 써보기', font(34, 'heavy'), fill='#fff')

    return canvas


def compose_feature():
    """Feature — popup customize."""
    canvas = premium_background(
        (12, 40, 60), (20, 90, 140), angle=140,
        blob_specs=[
            (0.20, 0.25, 550, (64, 180, 255, 90)),
            (0.85, 0.50, 650, (100, 220, 240, 70)),
            (0.40, 0.90, 700, (60, 120, 255, 60)),
        ])

    text_shadow_center(canvas, (W // 2, 140 * SS),
                       '핀 꽂고', font(110, 'heavy'), fill='#fff')
    text_shadow_center(canvas, (W // 2, 300 * SS),
                       '한 번에 돌아온다', font(100, 'heavy'), fill='#fff')
    d = ImageDraw.Draw(canvas, 'RGBA')
    text_center(d, (W // 2, 480 * SS),
                '북마크한 부분을 원클릭으로 복귀',
                font(40, 'regular'), fill=(255, 255, 255, 235))

    # Real popup settings screenshot
    real = load_real_popup()
    place_tilted_phone(canvas, real, angle_deg=-9,
                       cx=W // 2, cy=1860 * SS,
                       target_h=2140 * SS)

    sd = ImageDraw.Draw(canvas, 'RGBA')
    sparkle(sd, 150 * SS, 620 * SS, 18, color=(180, 240, 255, 230))
    sparkle(sd, W - 180 * SS, 620 * SS, 14, color=(255, 255, 255, 220))
    sparkle(sd, W - 250 * SS, 740 * SS, 10, color=(180, 240, 255, 180))

    bxy = (380 * SS, 2660 * SS, W - 380 * SS, 2750 * SS)
    rounded_pill(sd, bxy, fill=(10, 20, 40, 220))
    text_center(sd, (W // 2, 2676 * SS),
                '최대 5개 핀 · 원터치 복귀', font(34, 'heavy'), fill='#fff')

    return canvas


def compose_closer():
    """Closer — Main.html + trust."""
    canvas = premium_background(
        (10, 45, 32), (5, 100, 70), angle=135,
        blob_specs=[
            (0.25, 0.20, 500, (80, 220, 150, 80)),
            (0.82, 0.40, 600, (70, 200, 180, 70)),
            (0.50, 0.90, 650, (40, 160, 120, 60)),
        ])

    text_shadow_center(canvas, (W // 2, 140 * SS),
                       '사고 나면', font(110, 'heavy'), fill='#fff')
    text_shadow_center(canvas, (W // 2, 300 * SS),
                       '영원히 내 것', font(110, 'heavy'), fill='#fff')
    d = ImageDraw.Draw(canvas, 'RGBA')
    text_center(d, (W // 2, 480 * SS),
                '한 번의 결제로 프라이버시 지키며 쓰기',
                font(38, 'regular'), fill=(255, 255, 255, 235))

    # Real Main.html onboarding screenshot
    real = load_real_main()
    place_tilted_phone(canvas, real, angle_deg=-8,
                       cx=W // 2, cy=1860 * SS,
                       target_h=2140 * SS)

    sd = ImageDraw.Draw(canvas, 'RGBA')
    sparkle(sd, 150 * SS, 620 * SS, 20, color=(200, 255, 220, 230))
    sparkle(sd, W - 200 * SS, 560 * SS, 14, color=(255, 255, 255, 220))
    sparkle(sd, 220 * SS, 740 * SS, 11, color=(180, 255, 200, 200))

    bxy = (340 * SS, 2660 * SS, W - 340 * SS, 2750 * SS)
    rounded_pill(sd, bxy, fill=(8, 22, 18, 220))
    text_center(sd, (W // 2, 2676 * SS),
                '한 번 구매 · 구독·인앱 없음', font(32, 'heavy'), fill='#fff')

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
