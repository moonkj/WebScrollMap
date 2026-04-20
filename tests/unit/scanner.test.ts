import { describe, expect, it } from 'vitest';
import { createScanner, type ScannerDeps } from '@core/scanner';

function makeDeps(): ScannerDeps {
  let t = 0;
  return {
    now: () => (t += 1),
    random: () => 0.5,
    createObserver: () => ({ dispose() {} }),
  };
}

function withOffset(el: HTMLElement, top: number, height = 20): void {
  Object.defineProperty(el, 'offsetTop', { value: top, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
  Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
}

describe('scanner', () => {
  it('extracts and sorts anchors by y', () => {
    document.body.innerHTML = `
      <div>
        <h2 id="b">B</h2>
        <h1 id="a">A</h1>
        <img id="img" src="data:">
      </div>
    `;
    const h2 = document.getElementById('b') as HTMLElement;
    const h1 = document.getElementById('a') as HTMLElement;
    const img = document.getElementById('img') as HTMLElement;
    withOffset(h1, 100);
    withOffset(h2, 300);
    withOffset(img, 200);

    const scanner = createScanner(makeDeps());
    const r = scanner.scan(document.body);
    expect(r.anchors.length).toBe(3);
    expect(r.anchors[0]!.y).toBeLessThanOrEqual(r.anchors[1]!.y);
    expect(r.anchors[1]!.y).toBeLessThanOrEqual(r.anchors[2]!.y);
  });

  it('skips display:none (offsetParent null)', () => {
    document.body.innerHTML = `<h1 id="x">X</h1>`;
    const h1 = document.getElementById('x') as HTMLElement;
    Object.defineProperty(h1, 'offsetParent', { value: null, configurable: true });
    Object.defineProperty(h1, 'offsetHeight', { value: 20, configurable: true });
    const scanner = createScanner(makeDeps());
    const r = scanner.scan(document.body);
    expect(r.anchors.length).toBe(0);
  });

  it('respects maxAnchors', () => {
    document.body.innerHTML = Array.from({ length: 50 }, (_, i) => `<p><a href="#">L${i}</a></p>`).join('');
    document.querySelectorAll<HTMLElement>('a').forEach((el, i) => withOffset(el, i * 10));
    const scanner = createScanner(makeDeps());
    const r = scanner.scan(document.body, { maxAnchors: 10, timeBudgetMs: 50 });
    expect(r.anchors.length).toBe(10);
  });

  it('classifies heading tags (h1..h6) correctly', () => {
    document.body.innerHTML = `
      <h1 id="h1">A</h1>
      <h2 id="h2">B</h2>
      <h3 id="h3">C</h3>
      <h4 id="h4">D</h4>
      <h5 id="h5">E</h5>
      <h6 id="h6">F</h6>`;
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach((id, i) =>
      withOffset(document.getElementById(id) as HTMLElement, i * 50),
    );
    const scanner = createScanner(makeDeps());
    const r = scanner.scan(document.body);
    expect(r.anchors.length).toBe(6);
    // heading snippet preserved for heading kinds
    const snippets = r.anchors.map((a) => a.snippet);
    expect(snippets.every((s) => s.length > 0)).toBe(true);
  });

  it('classifies img and video as media', () => {
    document.body.innerHTML = `<img id="i" src="data:"><video id="v"></video>`;
    withOffset(document.getElementById('i') as HTMLElement, 10);
    withOffset(document.getElementById('v') as HTMLElement, 20);
    const scanner = createScanner(makeDeps());
    const r = scanner.scan(document.body);
    expect(r.anchors.length).toBe(2);
    // media anchors snippet empty
    expect(r.anchors.every((a) => a.snippet === '')).toBe(true);
  });

  it('classifies strong and b as strong-text', () => {
    document.body.innerHTML = `<p><strong id="s">S</strong> <b id="b">B</b></p>`;
    withOffset(document.getElementById('s') as HTMLElement, 10);
    withOffset(document.getElementById('b') as HTMLElement, 20);
    const scanner = createScanner(makeDeps());
    const r = scanner.scan(document.body);
    expect(r.anchors.length).toBe(2);
    expect(r.anchors.every((a) => a.snippet.length > 0)).toBe(true);
  });

  it('classifies anchor links as link-cluster with empty snippet (privacy)', () => {
    document.body.innerHTML = `<a id="link" href="#">my link text</a>`;
    withOffset(document.getElementById('link') as HTMLElement, 10);
    const r = createScanner(makeDeps()).scan(document.body);
    expect(r.anchors.length).toBe(1);
    expect(r.anchors[0]!.snippet).toBe('');
  });

  it('skips zero-height elements', () => {
    document.body.innerHTML = `<h1 id="z">hidden</h1>`;
    const el = document.getElementById('z') as HTMLElement;
    Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
    Object.defineProperty(el, 'offsetHeight', { value: 0, configurable: true });
    const r = createScanner(makeDeps()).scan(document.body);
    expect(r.anchors.length).toBe(0);
  });

  it('produces 64 density blocks when docHeight > 0', () => {
    document.body.innerHTML = `<h1 id="a">A</h1>`;
    withOffset(document.getElementById('a') as HTMLElement, 100);
    const scrollEl = (document.scrollingElement ?? document.documentElement) as HTMLElement;
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 3200, configurable: true });
    const r = createScanner(makeDeps()).scan(document.body);
    expect(r.blocks.length).toBe(64);
  });

  it('returns zero blocks when docHeight <= 0', () => {
    document.body.innerHTML = `<h1 id="a">A</h1>`;
    withOffset(document.getElementById('a') as HTMLElement, 0);
    const scrollEl = (document.scrollingElement ?? document.documentElement) as HTMLElement;
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 0, configurable: true });
    const r = createScanner(makeDeps()).scan(document.body);
    expect(r.blocks.length).toBe(0);
  });

  it('ignores non-matching tags entirely', () => {
    document.body.innerHTML = `<div id="d">hi</div><span>x</span>`;
    withOffset(document.getElementById('d') as HTMLElement, 10);
    const r = createScanner(makeDeps()).scan(document.body);
    expect(r.anchors.length).toBe(0);
  });

  it('detectContainer returns a window target', () => {
    const scanner = createScanner(makeDeps());
    const t = scanner.detectContainer();
    expect(t.kind).toBe('window');
    expect(t.el).toBeNull();
  });

  it('dispose does not throw even without registered observers', () => {
    const scanner = createScanner(makeDeps());
    expect(() => scanner.dispose()).not.toThrow();
  });
});
