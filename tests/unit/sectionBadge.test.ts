import { describe, expect, it } from 'vitest';
import { createSectionBadge } from '@ui/sectionBadge';
import { AnchorKind, type AnchorPoint } from '@core/types';

function mkRoot(): ShadowRoot {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

function anchor(y: number, type: AnchorKind, snippet = 'Snippet'): AnchorPoint {
  return { y, type, weight: 1, textHash: 0, snippet };
}

describe('createSectionBadge', () => {
  it('mounts badge element with right side class applied', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.right).toBe('56px');
    expect(el.style.left).toBe('');
    api.destroy();
  });

  it('mounts badge element with left side class applied', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'left');
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.style.left).toBe('56px');
    expect(el.style.right).toBe('');
    api.destroy();
  });

  it('show() adds wsm-visible class', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    api.show();
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.classList.contains('wsm-visible')).toBe(true);
    api.destroy();
  });

  it('hide() removes wsm-visible class', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    api.show();
    api.hide();
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.classList.contains('wsm-visible')).toBe(false);
    api.destroy();
  });

  it('update() finds nearest preceding heading and sets text', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    const anchors: AnchorPoint[] = [
      anchor(100, AnchorKind.Heading1, 'Intro'),
      anchor(500, AnchorKind.Heading2, 'Details'),
      anchor(900, AnchorKind.Heading1, 'Summary'),
    ];
    api.update(600, anchors);
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.textContent).toBe('H2 · Details');
    api.destroy();
  });

  it('update() prefers H3 labelling', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    const anchors: AnchorPoint[] = [anchor(50, AnchorKind.Heading3, 'Tiny')];
    api.update(100, anchors);
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.textContent).toBe('H3 · Tiny');
    api.destroy();
  });

  it('update() hides when no headings precede scrollY', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    api.show();
    const anchors: AnchorPoint[] = [anchor(1000, AnchorKind.Heading1, 'Later')];
    api.update(100, anchors);
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.classList.contains('wsm-visible')).toBe(false);
  });

  it('update() ignores non-heading anchors', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    api.show();
    const anchors: AnchorPoint[] = [
      anchor(50, AnchorKind.Image, ''),
      anchor(100, AnchorKind.LinkCluster, ''),
    ];
    api.update(200, anchors);
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.textContent).toBe('');
    api.destroy();
  });

  it('update() is no-op when text unchanged (cache)', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    const anchors: AnchorPoint[] = [anchor(100, AnchorKind.Heading1, 'Intro')];
    api.update(200, anchors);
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    el.textContent = 'MUTATED';
    api.update(200, anchors);
    expect(el.textContent).toBe('MUTATED');
    api.destroy();
  });

  it('setSide() toggles between left and right positioning', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.style.right).toBe('56px');
    api.setSide('left');
    expect(el.style.left).toBe('56px');
    expect(el.style.right).toBe('');
    api.setSide('right');
    expect(el.style.right).toBe('56px');
    expect(el.style.left).toBe('');
    api.destroy();
  });

  it('destroy() and dispose() both remove element', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    api.destroy();
    expect(root.querySelector('.wsm-section-badge')).toBeNull();
    // dispose after destroy should be safe
    expect(() => api.dispose()).not.toThrow();
  });

  it('update() respects 40px lookahead tolerance', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    // anchor at y=120; scrollY=100 means scrollY+40=140, which passes threshold
    const anchors: AnchorPoint[] = [anchor(120, AnchorKind.Heading1, 'Near')];
    api.update(100, anchors);
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.textContent).toBe('H1 · Near');
    api.destroy();
  });

  it('update() skips headings without snippet', () => {
    const root = mkRoot();
    const api = createSectionBadge(root, 'right');
    api.show();
    const anchors: AnchorPoint[] = [anchor(100, AnchorKind.Heading1, '')];
    api.update(200, anchors);
    const el = root.querySelector('.wsm-section-badge') as HTMLElement;
    expect(el.classList.contains('wsm-visible')).toBe(false);
  });
});
