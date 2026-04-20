// H10: prefers-color-scheme + body 배경 휘도 YIQ 이중 판정.

function luminanceYIQ(rgb: string): number {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return 255;
  const r = Number(m[0] ?? 255);
  const g = Number(m[1] ?? 255);
  const b = Number(m[2] ?? 255);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export function detectTheme(doc: Document = document, win: Window = window): 'light' | 'dark' {
  let prefersDark = false;
  try {
    prefersDark = win.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  } catch {
    prefersDark = false;
  }

  const body = doc.body;
  if (!body) return prefersDark ? 'dark' : 'light';
  const bg = win.getComputedStyle(body).backgroundColor;
  const lum = luminanceYIQ(bg);

  if (lum < 128) return 'dark';
  if (lum > 200) return 'light';
  return prefersDark ? 'dark' : 'light';
}
