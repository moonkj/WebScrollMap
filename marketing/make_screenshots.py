#!/usr/bin/env python3
"""App Store 스크린샷 3장 — iPhone 6.7" (1290×2796) MZ 스타일.

팀 합의 (Architect 채택):
- 4× 수퍼샘플 → LANCZOS downscale (엣지 품질)
- 실제 앱 UI(팝업/긴웹+바/Main.html)을 PIL 픽셀 재현
- 기기 목업 tilt (-12°/+8°/-9°) + GaussianBlur 드롭 섀도
- RGB flatten with white bg (Apple 호환성, 크기 10-15% ↓)
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

# Final output size
W_OUT, H_OUT = 1290, 2796
SS = 2  # supersample factor (2× balance between quality and speed)
W, H = W_OUT * SS, H_OUT * SS

OUT = Path(__file__).parent / 'screenshots'
OUT.mkdir(parents=True, exist_ok=True)
FONT_PATH = '/System/Library/Fonts/AppleSDGothicNeo.ttc'


def font(size, weight='heavy'):
    idx = {'heavy': 9, 'bold': 4, 'regular': 0, 'thin': 1}.get(weight, 0)
    return ImageFont.truetype(FONT_PATH, size * SS, index=idx)


def gradient(size, c1, c2, angle=0):
    """Create a linear gradient with rotation angle (degrees)."""
    import math
    w, h = size
    # Large enough base canvas
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
    # Center-crop to target (exact w×h by resize after crop)
    cx, cy = diag // 2, diag // 2
    out = grad.crop((cx - w // 2, cy - h // 2, cx - w // 2 + w,
                     cy - h // 2 + h))
    return out.convert('RGBA')


def text_center(draw, xy, text, fnt, fill='#fff'):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    tw = bbox[2] - bbox[0]
    draw.text((xy[0] - tw // 2, xy[1]), text, font=fnt, fill=fill)


def draw_popup_mockup():
    """Render the popup settings screen (dark theme). Returns RGBA image."""
    # Popup size — 390 × 844 scaled to our supersample
    pw, ph = 390, 844  # iPhone popup-like proportions
    scale = 2.2  # enlarge for visibility in the mockup
    w, h = int(pw * scale * SS), int(ph * scale * SS)
    img = Image.new('RGBA', (w, h), (15, 20, 34, 255))
    d = ImageDraw.Draw(img, 'RGBA')

    # Header
    head_h = int(130 * scale * SS / 2.2)
    d.rectangle([0, 0, w, head_h], fill=(22, 28, 45, 255))
    # Title centered
    title_fnt = font(22, 'heavy')
    text_center(d, (w // 2, int(35 * scale * SS / 2.2)),
                'WebScrollMap', title_fnt, fill='#fff')
    # Check mark circle (top right)
    cr = int(36 * scale * SS / 2.2)
    cx_ = w - int(50 * scale * SS / 2.2)
    cy_ = int(50 * scale * SS / 2.2)
    d.ellipse([cx_ - cr, cy_ - cr, cx_ + cr, cy_ + cr],
              fill=(82, 164, 255, 255))
    # Check stroke
    sw = max(4, int(5 * scale * SS / 2.2))
    d.line([(cx_ - cr // 2, cy_), (cx_ - cr // 6, cy_ + cr // 2),
            (cx_ + cr // 2, cy_ - cr // 3)], fill='#fff', width=sw)

    # Metadata row
    meta_y = int(135 * scale * SS / 2.2)
    meta_fnt = font(20, 'heavy')
    d.text((int(30 * scale * SS / 2.2), meta_y - int(30 * scale * SS / 2.2)),
           'WebScrollMap', font=meta_fnt, fill='#fff')
    meta_sub_fnt = font(14, 'regular')
    d.text((int(30 * scale * SS / 2.2), meta_y + int(6 * scale * SS / 2.2)),
           '56 anchors · 1 pin', font=meta_sub_fnt, fill=(150, 160, 180, 255))

    # Section builder
    def section_label(ty, text):
        d.text((int(30 * scale * SS / 2.2), ty),
               text, font=font(13, 'regular'), fill=(140, 150, 170, 255))

    def seg_bar(y, items, active_idx, height=None):
        height = height or int(54 * scale * SS / 2.2)
        pad = int(30 * scale * SS / 2.2)
        bar_w = w - pad * 2
        bar_x = pad
        # Background
        d.rounded_rectangle([bar_x, y, bar_x + bar_w, y + height],
                            radius=height // 3, fill=(30, 38, 58, 255))
        # Items
        n = len(items)
        seg_w = bar_w / n
        for i, item in enumerate(items):
            sx = bar_x + int(i * seg_w)
            ex = bar_x + int((i + 1) * seg_w)
            if i == active_idx:
                d.rounded_rectangle([sx + 4, y + 4, ex - 4, y + height - 4],
                                    radius=height // 3, fill=(82, 164, 255, 255))
                color = '#fff'
            else:
                color = (210, 216, 230, 255)
            fnt = font(16, 'heavy' if i == active_idx else 'regular')
            text_center(d, ((sx + ex) // 2, y + height // 2 - int(13 * scale * SS / 2.2)),
                        item, fnt, fill=color)

    # Toggle "켜기"
    ty = int(200 * scale * SS / 2.2)
    d.text((int(30 * scale * SS / 2.2), ty),
           '켜기', font=font(18, 'heavy'), fill='#fff')
    # Toggle switch on right
    tog_w = int(70 * scale * SS / 2.2)
    tog_h = int(36 * scale * SS / 2.2)
    tog_x = w - int(30 * scale * SS / 2.2) - tog_w
    tog_y = ty - int(6 * scale * SS / 2.2)
    d.rounded_rectangle([tog_x, tog_y, tog_x + tog_w, tog_y + tog_h],
                        radius=tog_h // 2, fill=(82, 164, 255, 255))
    knob_r = tog_h // 2 - 3
    knob_cx = tog_x + tog_w - knob_r - 4
    knob_cy = tog_y + tog_h // 2
    d.ellipse([knob_cx - knob_r, knob_cy - knob_r,
               knob_cx + knob_r, knob_cy + knob_r], fill='#fff')

    # 위치
    ty += int(70 * scale * SS / 2.2)
    section_label(ty, '위치')
    seg_bar(ty + int(30 * scale * SS / 2.2), ['왼쪽', '오른쪽'], active_idx=1)

    # 여백
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '여백')
    seg_bar(ty + int(30 * scale * SS / 2.2),
            ['0', '8', '16', '24', '32'], active_idx=0)

    # 바 두께
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '바 두께')
    seg_bar(ty + int(30 * scale * SS / 2.2),
            ['얇게', '보통', '두껍게'], active_idx=1)

    # 메모장 투명도
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '메모장 투명도')
    seg_bar(ty + int(30 * scale * SS / 2.2),
            ['40%', '70%', '100%'], active_idx=1)

    # 테마
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '테마')
    # 5 circles
    colors = [
        (249, 115, 22),    # default orange
        (251, 113, 133),   # sunset
        (56, 189, 248),    # ocean
        (74, 222, 128),    # forest (active)
        (148, 163, 184),   # mono
    ]
    pad = int(30 * scale * SS / 2.2)
    bar_w = w - pad * 2
    cy_ = ty + int(30 * scale * SS / 2.2) + int(28 * scale * SS / 2.2)
    each_w = bar_w / 5
    for i, col in enumerate(colors):
        cx = pad + int(each_w * (i + 0.5))
        dot_r = int(14 * scale * SS / 2.2)
        if i == 3:  # forest active
            sel_r = dot_r + int(14 * scale * SS / 2.2)
            d.ellipse([cx - sel_r, cy_ - sel_r, cx + sel_r, cy_ + sel_r],
                      outline=(82, 164, 255, 255),
                      width=max(3, int(3 * scale * SS / 2.2)))
        d.ellipse([cx - dot_r, cy_ - dot_r, cx + dot_r, cy_ + dot_r],
                  fill=col)

    # 핀
    ty += int(120 * scale * SS / 2.2)
    section_label(ty, '핀')
    pin_row_y = ty + int(30 * scale * SS / 2.2)
    pin_dot_r = int(10 * scale * SS / 2.2)
    px = pad + pin_dot_r + 8
    d.ellipse([px - pin_dot_r, pin_row_y + int(18 * scale * SS / 2.2) - pin_dot_r,
               px + pin_dot_r, pin_row_y + int(18 * scale * SS / 2.2) + pin_dot_r],
              fill=(249, 115, 22, 255))
    d.text((px + int(24 * scale * SS / 2.2),
            pin_row_y + int(6 * scale * SS / 2.2)),
           '#1 · 웹 검색결과', font=font(16, 'regular'), fill='#fff')
    # X on right
    d.text((w - pad - int(20 * scale * SS / 2.2), pin_row_y + 2),
           '×', font=font(22, 'heavy'), fill=(180, 190, 210, 255))

    # 핀 비우기 button
    bty = pin_row_y + int(70 * scale * SS / 2.2)
    d.rounded_rectangle([pad, bty, w - pad, bty + int(50 * scale * SS / 2.2)],
                        radius=int(12 * scale * SS / 2.2),
                        outline=(80, 96, 120, 255),
                        width=max(2, int(2 * scale * SS / 2.2)))
    text_center(d, (w // 2, bty + int(14 * scale * SS / 2.2)),
                '핀 비우기', font(16, 'regular'),
                fill=(210, 220, 240, 255))

    # Footer hint + version
    fty = h - int(50 * scale * SS / 2.2)
    text_center(d, (w // 2, fty), 'v1.0.0',
                font(13, 'regular'), fill=(120, 130, 150, 255))

    return img


def draw_web_mockup():
    """Long article page with minimap bar + pins + memo panel. Returns RGBA."""
    # Wide phone-like proportions
    pw, ph = 390, 844
    scale = 2.2
    w, h = int(pw * scale * SS), int(ph * scale * SS)
    img = Image.new('RGBA', (w, h), (252, 252, 254, 255))
    d = ImageDraw.Draw(img, 'RGBA')

    # Top URL pill (Safari chrome)
    pad = int(18 * scale * SS / 2.2)
    url_h = int(60 * scale * SS / 2.2)
    url_y = int(70 * scale * SS / 2.2)
    url_w = int(200 * scale * SS / 2.2)
    url_x = (w - url_w) // 2
    d.rounded_rectangle([url_x, url_y, url_x + url_w, url_y + url_h],
                        radius=url_h // 2, fill=(232, 234, 240, 255))
    text_center(d, ((url_x + url_w // 2), url_y + int(15 * scale * SS / 2.2)),
                'example.com', font(14, 'regular'), fill=(120, 130, 150, 255))

    # Article body
    cx_start = int(30 * scale * SS / 2.2)
    cx_end = w - int(70 * scale * SS / 2.2)  # leave gutter for bar
    line_y = int(170 * scale * SS / 2.2)
    lines = [
        (1.0, 42, True),  # Title
        (0.0, 30, False),
        (0.88, 22, False), (0.75, 22, False), (0.65, 22, False),
        (0.0, 30, False),
        (0.95, 34, True),  # H2
        (0.85, 22, False), (0.7, 22, False), (0.6, 22, False),
        (0.0, 28, False),
        (0.92, 30, True),  # H3
        (0.8, 22, False), (0.65, 22, False),
        (0.0, 26, False),
        (0.95, 34, True),
        (0.88, 22, False), (0.7, 22, False), (0.55, 22, False),
        (0.0, 26, False),
        (0.92, 30, True),
        (0.85, 22, False), (0.7, 22, False),
        (0.0, 26, False),
        (0.95, 34, True),
        (0.85, 22, False), (0.7, 22, False), (0.6, 22, False),
    ]
    for (intensity, lh, is_heading) in lines:
        scaled_lh = int(lh * scale * SS / 2.2)
        if intensity == 0:
            line_y += scaled_lh
            continue
        lw = int((cx_end - cx_start) * max(0.25, intensity))
        if is_heading:
            color = (20, 25, 35, 255)
            bar_h = int(20 * scale * SS / 2.2)
        else:
            color = (170, 178, 195, 230)
            bar_h = int(14 * scale * SS / 2.2)
        d.rounded_rectangle([cx_start, line_y, cx_start + lw, line_y + bar_h],
                            radius=int(4 * scale * SS / 2.2), fill=color)
        line_y += scaled_lh
        if line_y > h - int(100 * scale * SS / 2.2):
            break

    # Minimap bar (right)
    bar_margin = int(10 * scale * SS / 2.2)
    bar_w = int(10 * scale * SS / 2.2)
    bar_top = int(170 * scale * SS / 2.2)
    bar_bot = h - int(100 * scale * SS / 2.2)
    bar_x = w - bar_margin - bar_w
    # Bar background - light gray
    d.rounded_rectangle([bar_x, bar_top, bar_x + bar_w, bar_bot],
                        radius=bar_w // 2, fill=(0, 0, 0, 22))
    bar_h = bar_bot - bar_top
    # Anchor marks
    for pct, wl, lh in [
        (0.04, 40, 3), (0.08, 26, 2), (0.12, 18, 2),
        (0.18, 40, 3), (0.22, 26, 2), (0.26, 18, 2),
        (0.32, 40, 3), (0.36, 26, 2),
        (0.42, 40, 3), (0.46, 26, 2), (0.50, 18, 2),
        (0.56, 40, 3), (0.60, 26, 2),
        (0.68, 40, 3), (0.72, 26, 2), (0.76, 18, 2),
        (0.82, 40, 3), (0.86, 26, 2),
        (0.92, 40, 3), (0.96, 26, 2),
    ]:
        ay = bar_top + int(bar_h * pct)
        awl = int(wl * scale * SS / 2.2 * 0.6)
        alh = max(2, int(lh * scale * SS / 2.2))
        d.rounded_rectangle([bar_x - awl - 4, ay, bar_x - 4, ay + alh],
                            radius=1, fill=(50, 60, 80, 180))

    # Indicator (pink - ocean indicator translates to light blue tint)
    accent = (56, 189, 248, 230)
    ind_h = int(bar_h * 0.16)
    ind_top = bar_top + int(bar_h * 0.52) - ind_h // 2
    d.rounded_rectangle([bar_x - 1, ind_top, bar_x + bar_w + 1, ind_top + ind_h],
                        radius=(bar_w + 2) // 2, fill=accent)

    # Pins
    for pct in (0.20, 0.44, 0.74):
        py = bar_top + int(bar_h * pct)
        cx = bar_x + bar_w // 2
        pr = int(8 * scale * SS / 2.2)
        d.ellipse([cx - pr, py - pr, cx + pr, py + pr],
                  fill=(249, 115, 22, 255))
        d.ellipse([cx - pr - 4, py - pr - 4, cx + pr + 4, py + pr + 4],
                  outline=(249, 115, 22, 120),
                  width=max(2, int(2 * scale * SS / 2.2)))

    # Ripple at current indicator center
    rip_cx = bar_x + bar_w // 2
    rip_y = bar_top + int(bar_h * 0.52)
    for rad_mult, alpha in [(0.6, 220), (1.2, 140), (1.9, 70)]:
        rr = int(30 * scale * SS / 2.2 * rad_mult)
        d.ellipse([rip_cx - rr, rip_y - rr, rip_cx + rr, rip_y + rr],
                  outline=(56, 189, 248, alpha),
                  width=max(2, int(2 * scale * SS / 2.2)))

    # Floating pin memo (theme-tinted green, like forest)
    mp_w = int(300 * scale * SS / 2.2)
    mp_h = int(210 * scale * SS / 2.2)
    mp_x = int(30 * scale * SS / 2.2)
    mp_y = h - mp_h - int(70 * scale * SS / 2.2)
    # Forest-tinted bg (85% dark + 15% green)
    d.rounded_rectangle([mp_x, mp_y, mp_x + mp_w, mp_y + mp_h],
                        radius=int(18 * scale * SS / 2.2),
                        fill=(40, 62, 46, 240),
                        outline=(74, 222, 128, 150),
                        width=max(2, int(2 * scale * SS / 2.2)))
    d.text((mp_x + int(22 * scale * SS / 2.2),
            mp_y + int(16 * scale * SS / 2.2)),
           '핀', font=font(18, 'heavy'), fill='#f0fdf4')
    d.text((mp_x + mp_w - int(34 * scale * SS / 2.2),
            mp_y + int(14 * scale * SS / 2.2)),
           '—', font=font(20, 'heavy'), fill='#f0fdf4')
    # Divider
    divy = mp_y + int(50 * scale * SS / 2.2)
    d.line([(mp_x + int(14 * scale * SS / 2.2), divy),
            (mp_x + mp_w - int(14 * scale * SS / 2.2), divy)],
           fill=(74, 222, 128, 120), width=1)
    # Items
    ity = divy + int(14 * scale * SS / 2.2)
    for txt in ['#1 · 서문', '#2 · 2장 개요', '#3 · 결론']:
        cx = mp_x + int(24 * scale * SS / 2.2)
        cy = ity + int(14 * scale * SS / 2.2)
        dr = int(8 * scale * SS / 2.2)
        d.ellipse([cx - dr, cy - dr, cx + dr, cy + dr],
                  fill=(249, 115, 22, 255))
        d.text((cx + int(22 * scale * SS / 2.2),
                ity + int(2 * scale * SS / 2.2)),
               txt, font=font(15, 'regular'), fill='#f0fdf4')
        d.text((mp_x + mp_w - int(28 * scale * SS / 2.2),
                ity + int(2 * scale * SS / 2.2)),
               '×', font=font(18, 'heavy'), fill='#f0fdf4')
        ity += int(40 * scale * SS / 2.2)

    return img


def draw_main_mockup():
    """Main.html app info page. Returns RGBA image."""
    pw, ph = 390, 844
    scale = 2.2
    w, h = int(pw * scale * SS), int(ph * scale * SS)
    img = Image.new('RGBA', (w, h), (14, 18, 30, 255))
    d = ImageDraw.Draw(img, 'RGBA')

    # App icon (orange gradient square)
    icon_size = int(120 * scale * SS / 2.2)
    ix = (w - icon_size) // 2
    iy = int(60 * scale * SS / 2.2)
    icon_grad = gradient((icon_size, icon_size),
                         (251, 146, 60), (249, 115, 22), angle=135)
    # Apply rounded corners to icon_grad via mask
    mask = Image.new('L', (icon_size, icon_size), 0)
    mask_d = ImageDraw.Draw(mask)
    mask_d.rounded_rectangle([0, 0, icon_size, icon_size],
                             radius=icon_size // 4, fill=255)
    icon_rgba = icon_grad.copy()
    icon_rgba.putalpha(mask)
    img.alpha_composite(icon_rgba, (ix, iy))
    # Icon content — horizontal lines + bar
    cd = ImageDraw.Draw(img, 'RGBA')
    icon_pad = int(22 * scale * SS / 2.2)
    line_y = iy + int(28 * scale * SS / 2.2)
    for ln_w in [0.7, 0.55, 0.4]:
        cd.rounded_rectangle(
            [ix + icon_pad,
             line_y,
             ix + icon_pad + int((icon_size - icon_pad * 2) * ln_w * 0.6),
             line_y + int(6 * scale * SS / 2.2)],
            radius=2, fill='#fff')
        line_y += int(14 * scale * SS / 2.2)
    # Right mini bar
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
    # Tagline
    text_center(d, (w // 2, tty + int(56 * scale * SS / 2.2)),
                '긴 웹페이지를 지도처럼 탐색',
                font(16, 'regular'), fill=(180, 190, 210, 255))

    # Step cards (3)
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
        # Card bg
        d.rounded_rectangle([step_x, sy, step_x + step_w, sy + step_h],
                            radius=int(14 * scale * SS / 2.2),
                            fill=(26, 32, 48, 255))
        # Left orange accent bar
        d.rounded_rectangle([step_x, sy, step_x + int(5 * scale * SS / 2.2),
                             sy + step_h],
                            radius=int(3 * scale * SS / 2.2),
                            fill=(249, 115, 22, 255))
        # Number circle
        cr = int(18 * scale * SS / 2.2)
        cx = step_x + int(34 * scale * SS / 2.2)
        cy = sy + step_h // 2
        d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr],
                  fill=(249, 115, 22, 255))
        text_center(d, (cx, cy - int(13 * scale * SS / 2.2)),
                    num, font(18, 'heavy'), fill='#fff')
        # Title + sub
        d.text((cx + int(34 * scale * SS / 2.2),
                sy + int(18 * scale * SS / 2.2)),
               title, font=font(16, 'heavy'), fill='#fff')
        d.text((cx + int(34 * scale * SS / 2.2),
                sy + int(44 * scale * SS / 2.2)),
               sub, font=font(12, 'regular'), fill=(170, 180, 200, 255))

    # "주요 기능" header
    fy = step_y + 3 * (step_h + step_gap) + int(10 * scale * SS / 2.2)
    d.text((int(30 * scale * SS / 2.2), fy),
           '✦ 주요 기능', font=font(16, 'heavy'), fill='#fff')

    # Feature items (mini)
    feats = [
        ((56, 164, 255), '탭 · 드래그', '바 탭 점프, 드래그 스크럽'),
        ((249, 115, 22), 'Pin Drop', '0.5초 눌러 화면 저장'),
        ((74, 222, 128), '플로팅 메모장', '드래그 이동, 탭 복귀'),
    ]
    fly = fy + int(30 * scale * SS / 2.2)
    item_h = int(55 * scale * SS / 2.2)
    for i, (col, t, s) in enumerate(feats):
        iy_ = fly + i * (item_h + int(8 * scale * SS / 2.2))
        # Icon sq
        isz = int(36 * scale * SS / 2.2)
        ix_ = int(30 * scale * SS / 2.2)
        d.rounded_rectangle([ix_, iy_, ix_ + isz, iy_ + isz],
                            radius=int(8 * scale * SS / 2.2), fill=col)
        d.text((ix_ + isz + int(14 * scale * SS / 2.2),
                iy_ + int(2 * scale * SS / 2.2)),
               t, font=font(15, 'heavy'), fill='#fff')
        d.text((ix_ + isz + int(14 * scale * SS / 2.2),
                iy_ + int(22 * scale * SS / 2.2)),
               s, font=font(12, 'regular'), fill=(170, 180, 200, 255))

    return img


# ────────────────────────── Compositor ──────────────────────────

def phone_frame_around(mockup, radius_px=48):
    """Wrap mockup image with a phone-like bezel. Returns RGBA."""
    mw, mh = mockup.size
    bezel = 14 * SS
    w = mw + bezel * 2
    h = mh + bezel * 2
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(out, 'RGBA')
    # Bezel dark
    d.rounded_rectangle([0, 0, w, h],
                        radius=radius_px * SS + bezel, fill=(20, 22, 28, 255))
    # Inner screen cutout (use mockup as-is, rounded)
    # Paste mockup with rounded corners
    mask = Image.new('L', (mw, mh), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, mw, mh],
                         radius=radius_px * SS, fill=255)
    out.paste(mockup, (bezel, bezel), mask)
    # Notch island (top center)
    island_w = int(140 * SS)
    island_h = int(36 * SS)
    island_x = bezel + (mw - island_w) // 2
    island_y = bezel + int(24 * SS)
    d.rounded_rectangle(
        [island_x, island_y, island_x + island_w, island_y + island_h],
        radius=island_h // 2, fill=(10, 10, 14, 255))
    return out


def place_tilted_phone(canvas, mockup, angle_deg, cx, cy, target_h):
    """Rotate mockup phone with drop shadow, paste onto canvas."""
    framed = phone_frame_around(mockup)
    fw, fh = framed.size
    # Scale to target height
    scale = target_h / fh
    new_size = (int(fw * scale), int(fh * scale))
    framed = framed.resize(new_size, Image.LANCZOS)
    # Rotate
    rot = framed.rotate(angle_deg, resample=Image.BICUBIC, expand=True)
    # Shadow
    alpha = rot.split()[3]
    shadow = Image.new('RGBA', rot.size, (0, 0, 0, 0))
    shadow.putalpha(alpha.filter(ImageFilter.GaussianBlur(radius=24 * SS)))
    # Dark shadow by filling alpha channel onto a black layer
    shadow_black = Image.new('RGBA', rot.size, (0, 0, 0, 180))
    shadow_black.putalpha(alpha.filter(ImageFilter.GaussianBlur(radius=18 * SS)))
    # Paste shadow offset then the rotated mockup
    rw, rh = rot.size
    px = int(cx - rw / 2)
    py = int(cy - rh / 2)
    off = int(18 * SS)
    canvas.alpha_composite(shadow_black, (px + off // 2, py + off))
    canvas.alpha_composite(rot, (px, py))
    return canvas


def rounded_pill(d, box, fill, radius=None):
    x1, y1, x2, y2 = box
    r = radius or (y2 - y1) // 2
    d.rounded_rectangle([x1, y1, x2, y2], radius=r, fill=fill)


# ────────────────────────── Screenshots ──────────────────────────

def compose_screen1():
    """설정하고 지도처럼 — 팝업 설정"""
    canvas = gradient((W, H), (255, 107, 53), (214, 54, 73), angle=150)
    d = ImageDraw.Draw(canvas, 'RGBA')

    # Title
    text_center(d, (W // 2, 150 * SS), '설정하고 지도처럼',
                font(90, 'heavy'), fill='#fff')
    text_center(d, (W // 2, 280 * SS),
                '위치·여백·테마 5종 자유 커스텀',
                font(40, 'regular'), fill=(255, 255, 255, 230))

    # Mockup
    mock = draw_popup_mockup()
    place_tilted_phone(canvas, mock, angle_deg=-10,
                       cx=W // 2 + 20 * SS, cy=1850 * SS,
                       target_h=2180 * SS)

    # Bottom badge (pill)
    bxy = (420 * SS, 2680 * SS, W - 420 * SS, 2760 * SS)
    rounded_pill(d, bxy, fill=(15, 15, 25, 200))
    text_center(d, (W // 2, 2700 * SS),
                '한 번 구매, 평생 사용', font(34, 'heavy'), fill='#fff')

    return canvas


def compose_screen2():
    """어떤 긴글도 한눈에 — 긴 페이지 + 바"""
    canvas = gradient((W, H), (63, 169, 245), (147, 51, 234), angle=140)
    d = ImageDraw.Draw(canvas, 'RGBA')

    text_center(d, (W // 2, 140 * SS), '어떤 긴글도',
                font(110, 'heavy'), fill='#fff')
    text_center(d, (W // 2, 300 * SS), '한눈에',
                font(110, 'heavy'), fill='#fff')
    text_center(d, (W // 2, 480 * SS),
                '미니맵 + 꾹 눌러 북마크',
                font(42, 'regular'), fill=(255, 255, 255, 240))

    mock = draw_web_mockup()
    place_tilted_phone(canvas, mock, angle_deg=8,
                       cx=W // 2, cy=1850 * SS,
                       target_h=2180 * SS)

    bxy = (380 * SS, 2680 * SS, W - 380 * SS, 2760 * SS)
    rounded_pill(d, bxy, fill=(15, 15, 25, 200))
    text_center(d, (W // 2, 2700 * SS),
                '최대 5개 핀 · 원터치 복귀', font(34, 'heavy'), fill='#fff')

    return canvas


def compose_screen3():
    """데이터는 100% 안전 — Main.html"""
    canvas = gradient((W, H), (16, 185, 129), (5, 105, 73), angle=135)
    d = ImageDraw.Draw(canvas, 'RGBA')

    text_center(d, (W // 2, 150 * SS), '데이터는',
                font(110, 'heavy'), fill='#fff')
    text_center(d, (W // 2, 310 * SS), '100% 안전',
                font(110, 'heavy'), fill='#fff')
    text_center(d, (W // 2, 490 * SS),
                '기기 내 저장, 서버 없음',
                font(42, 'regular'), fill=(255, 255, 255, 240))

    mock = draw_main_mockup()
    place_tilted_phone(canvas, mock, angle_deg=-8,
                       cx=W // 2, cy=1850 * SS,
                       target_h=2180 * SS)

    bxy = (320 * SS, 2680 * SS, W - 320 * SS, 2760 * SS)
    rounded_pill(d, bxy, fill=(15, 15, 25, 200))
    text_center(d, (W // 2, 2700 * SS),
                '한 번 구매 · 구독·인앱 없음', font(34, 'heavy'), fill='#fff')

    return canvas


def finalize(canvas, name):
    """Downsample + flatten to RGB + save."""
    # Downsample (supersample → target)
    out = canvas.resize((W_OUT, H_OUT), Image.LANCZOS)
    # Flatten on white bg
    bg = Image.new('RGB', (W_OUT, H_OUT), (255, 255, 255))
    bg.paste(out, (0, 0), out)
    bg.save(OUT / name, 'PNG', optimize=True)
    print(f'{name} saved ({(OUT / name).stat().st_size // 1024} KB)')


if __name__ == '__main__':
    finalize(compose_screen1(), '01_hero.png')
    finalize(compose_screen2(), '02_pin.png')
    finalize(compose_screen3(), '03_privacy.png')
    print(f'Saved to: {OUT}')
