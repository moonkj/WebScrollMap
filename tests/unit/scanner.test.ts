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
});
