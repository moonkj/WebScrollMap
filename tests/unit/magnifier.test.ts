import { describe, expect, it } from 'vitest';
import { createMagnifier } from '@ui/magnifier';
import { AnchorKind, type AnchorPoint, type ScannerResult } from '@core/types';

function mkRoot(): ShadowRoot {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

function anchor(y: number, type: AnchorKind, snippet = ''): AnchorPoint {
  return { y, type, weight: 1, textHash: 0, snippet };
}

function result(anchors: AnchorPoint[]): ScannerResult {
  return { anchors, blocks: [], docHeight: 5000, scannedAt: 0, elapsedMs: 0 };
}

describe('createMagnifier', () => {
  it('mounts tooltip with role=tooltip and initial hidden opacity', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.opacity).toBe('0');
    api.destroy();
  });

  it('uses dark scheme styling', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'dark', 'right');
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.style.cssText.replace(/\s+/g, '')).toContain('rgba(15,23,42,0.92)');
    api.destroy();
  });

  it('show() with null result keeps tooltip hidden', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    api.show(200, 1000, null);
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.style.opacity).toBe('0');
    api.destroy();
  });

  it('show() with result containing heading near docY displays text', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    const res = result([anchor(1000, AnchorKind.Heading1, 'Intro')]);
    api.show(150, 1000, res);
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.textContent).toBe('Intro');
    expect(el.style.opacity).toBe('1');
    expect(el.style.top).toBe('150px');
    expect(el.style.right).toBe('56px');
    api.destroy();
  });

  it('show() picks nearest anchor among three candidates', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    const res = result([
      anchor(100, AnchorKind.Heading1, 'Alpha'),
      anchor(500, AnchorKind.Heading2, 'Beta'),
      anchor(900, AnchorKind.Heading3, 'Gamma'),
    ]);
    api.show(50, 510, res);
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.textContent).toBe('Beta');
    api.destroy();
  });

  it('show() hides when anchor has empty snippet', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    const res = result([anchor(500, AnchorKind.Image, '')]);
    api.show(50, 500, res);
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.style.opacity).toBe('0');
    api.destroy();
  });

  it('show() with empty anchors hides tooltip', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    const res = result([]);
    api.show(50, 500, res);
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.style.opacity).toBe('0');
    api.destroy();
  });

  it('show() falls back to snippet-only when kind label is empty', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    // unknown kind - use 99 cast
    const a: AnchorPoint = { y: 100, type: 99 as unknown as AnchorKind, weight: 1, textHash: 0, snippet: 'BareSnippet' };
    const res = result([a]);
    api.show(50, 100, res);
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.textContent).toBe('BareSnippet');
    api.destroy();
  });

  it('hide() sets opacity 0', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    const res = result([anchor(100, AnchorKind.Heading1, 'X')]);
    api.show(50, 100, res);
    api.hide();
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.style.opacity).toBe('0');
    api.destroy();
  });

  it('setSide(left) switches placement', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    api.setSide('left');
    const res = result([anchor(100, AnchorKind.Heading1, 'X')]);
    api.show(200, 100, res);
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.style.left).toBe('56px');
    expect(el.style.right).toBe('');
    api.destroy();
  });

  it('initialSide=left positions tooltip on left', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'left');
    const res = result([anchor(100, AnchorKind.Heading1, 'X')]);
    api.show(10, 100, res);
    const el = root.querySelector('[role="tooltip"]') as HTMLElement;
    expect(el.style.left).toBe('56px');
    api.destroy();
  });

  it('destroy() removes tooltip element', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    expect(root.querySelector('[role="tooltip"]')).toBeTruthy();
    api.destroy();
    expect(root.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('displays only snippet (no kind prefix) for all anchor kinds', () => {
    const root = mkRoot();
    const api = createMagnifier(root, 'light', 'right');
    const kinds: AnchorKind[] = [
      AnchorKind.Heading2,
      AnchorKind.Heading3,
      AnchorKind.Image,
      AnchorKind.Video,
      AnchorKind.StrongText,
      AnchorKind.LinkCluster,
    ];
    for (const kind of kinds) {
      const res = result([anchor(100, kind, 'S')]);
      api.show(10, 100, res);
      const el = root.querySelector('[role="tooltip"]') as HTMLElement;
      expect(el.textContent).toBe('S');
    }
    api.destroy();
  });
});
