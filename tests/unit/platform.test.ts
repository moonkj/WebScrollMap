import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPlatform } from '@platform/platform';

type MM = (q: string) => MediaQueryList;

function mm(matches: (q: string) => boolean): MM {
  return (q: string) =>
    ({
      matches: matches(q),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
      onchange: null,
    }) as unknown as MediaQueryList;
}

const originalUA = navigator.userAgent;

function stubUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

beforeAll(() => {
  // capture once
});

afterAll(() => {
  Object.defineProperty(navigator, 'userAgent', {
    value: originalUA,
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getPlatform', () => {
  it('detects iPhone as iOS with haptics', () => {
    stubUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    vi.stubGlobal('matchMedia', mm(() => false));
    const p = getPlatform();
    expect(p.isIOS).toBe(true);
    expect(p.hasHaptics).toBe(true);
  });

  it('detects iPad as iOS', () => {
    stubUA('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)');
    vi.stubGlobal('matchMedia', mm(() => false));
    expect(getPlatform().isIOS).toBe(true);
  });

  it('detects iPod as iOS', () => {
    stubUA('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)');
    vi.stubGlobal('matchMedia', mm(() => false));
    expect(getPlatform().isIOS).toBe(true);
  });

  it('classic Macintosh (non-touch) is not iOS', () => {
    stubUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    vi.stubGlobal('matchMedia', mm(() => false));
    // happy-dom document has no ontouchend property by default
    const p = getPlatform();
    expect(p.isIOS).toBe(false);
    expect(p.hasHaptics).toBe(false);
  });

  it('Macintosh with ontouchend is treated as iOS (iPadOS desktop UA)', () => {
    stubUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    vi.stubGlobal('matchMedia', mm(() => false));
    // Inject ontouchend on document
    (document as unknown as { ontouchend: null | (() => void) }).ontouchend = null;
    try {
      expect(getPlatform().isIOS).toBe(true);
    } finally {
      delete (document as unknown as { ontouchend?: unknown }).ontouchend;
    }
  });

  it('pointerType=mouse when only fine pointer available', () => {
    stubUA('Mozilla/5.0 Desktop');
    vi.stubGlobal(
      'matchMedia',
      mm((q) => q.includes('pointer: fine'))
    );
    expect(getPlatform().pointerType).toBe('mouse');
  });

  it('pointerType=touch when only coarse pointer available', () => {
    stubUA('Mozilla/5.0 (iPhone;)');
    vi.stubGlobal(
      'matchMedia',
      mm((q) => q.includes('pointer: coarse'))
    );
    expect(getPlatform().pointerType).toBe('touch');
  });

  it('pointerType=mixed when both pointer types match', () => {
    stubUA('Mozilla/5.0 Surface');
    vi.stubGlobal(
      'matchMedia',
      mm((q) => q.includes('pointer: coarse') || q.includes('pointer: fine'))
    );
    expect(getPlatform().pointerType).toBe('mixed');
  });

  it('prefersReducedMotion reflects matchMedia result', () => {
    stubUA('Mozilla/5.0 Desktop');
    vi.stubGlobal(
      'matchMedia',
      mm((q) => q.includes('prefers-reduced-motion'))
    );
    expect(getPlatform().prefersReducedMotion).toBe(true);

    vi.stubGlobal('matchMedia', mm(() => false));
    expect(getPlatform().prefersReducedMotion).toBe(false);
  });

  it('safeAreaInsets uses CSS custom properties when present', () => {
    stubUA('Mozilla/5.0 Desktop');
    vi.stubGlobal('matchMedia', mm(() => false));
    const root = document.documentElement;
    root.style.setProperty('--sat', '10px');
    root.style.setProperty('--sar', '5px');
    root.style.setProperty('--sab', '20px');
    root.style.setProperty('--sal', '0px');
    try {
      const p = getPlatform();
      const insets = p.safeAreaInsets();
      expect(insets.top).toBe(10);
      expect(insets.right).toBe(5);
      expect(insets.bottom).toBe(20);
      expect(insets.left).toBe(0);
    } finally {
      root.style.removeProperty('--sat');
      root.style.removeProperty('--sar');
      root.style.removeProperty('--sab');
      root.style.removeProperty('--sal');
    }
  });

  it('safeAreaInsets returns zeros when no custom properties set', () => {
    stubUA('Mozilla/5.0 Desktop');
    vi.stubGlobal('matchMedia', mm(() => false));
    const insets = getPlatform().safeAreaInsets();
    expect(insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('returns a PlatformCapabilities shape with all required fields', () => {
    stubUA('Mozilla/5.0 Desktop');
    vi.stubGlobal('matchMedia', mm(() => false));
    const p = getPlatform();
    expect(typeof p.isIOS).toBe('boolean');
    expect(typeof p.hasHaptics).toBe('boolean');
    expect(typeof p.prefersReducedMotion).toBe('boolean');
    expect(['touch', 'mouse', 'mixed']).toContain(p.pointerType);
    expect(typeof p.safeAreaInsets).toBe('function');
  });
});
