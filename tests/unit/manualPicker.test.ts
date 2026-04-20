import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualPicker } from '@platform/manualPicker';

describe('manualPicker', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<section id="a"><div id="inner">inner</div></section><section id="b"></section>';
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  function fireMouse(target: HTMLElement, type: 'mousemove' | 'click', opts?: MouseEventInit) {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, ...(opts ?? {}) });
    target.dispatchEvent(ev);
    return ev;
  }

  it('injects highlight style on activate', () => {
    const picker = createManualPicker({ onPicked: () => {} });
    expect(document.getElementById('wsm-picker-outline')).not.toBeNull();
    picker.dispose();
  });

  it('does not duplicate style tag on re-activate', () => {
    const p1 = createManualPicker({ onPicked: () => {} });
    p1.dispose();
    const p2 = createManualPicker({ onPicked: () => {} });
    const styles = document.querySelectorAll('#wsm-picker-outline');
    expect(styles.length).toBe(1);
    p2.dispose();
  });

  it('highlights hovered element via classList', () => {
    const picker = createManualPicker({ onPicked: () => {} });
    const a = document.getElementById('a') as HTMLElement;
    fireMouse(a, 'mousemove');
    expect(a.classList.contains('wsm-picker-hl')).toBe(true);
    picker.dispose();
  });

  it('moves highlight when hovering different element', () => {
    const picker = createManualPicker({ onPicked: () => {} });
    const a = document.getElementById('a') as HTMLElement;
    const b = document.getElementById('b') as HTMLElement;
    fireMouse(a, 'mousemove');
    fireMouse(b, 'mousemove');
    expect(a.classList.contains('wsm-picker-hl')).toBe(false);
    expect(b.classList.contains('wsm-picker-hl')).toBe(true);
    picker.dispose();
  });

  it('click with altKey calls onPicked and deactivates', () => {
    const onPicked = vi.fn();
    const picker = createManualPicker({ onPicked });
    const a = document.getElementById('a') as HTMLElement;
    fireMouse(a, 'mousemove');
    const ev = fireMouse(a, 'click', { altKey: true });
    expect(onPicked).toHaveBeenCalledWith(a);
    expect(ev.defaultPrevented).toBe(true);

    // After picked, further mousemove should not re-highlight
    const b = document.getElementById('b') as HTMLElement;
    fireMouse(b, 'mousemove');
    expect(b.classList.contains('wsm-picker-hl')).toBe(false);
    picker.dispose();
  });

  it('click without altKey does not call onPicked', () => {
    const onPicked = vi.fn();
    const picker = createManualPicker({ onPicked });
    const a = document.getElementById('a') as HTMLElement;
    fireMouse(a, 'click', { altKey: false });
    expect(onPicked).not.toHaveBeenCalled();
    picker.dispose();
  });

  it('Escape key deactivates without onPicked', () => {
    const onPicked = vi.fn();
    const picker = createManualPicker({ onPicked });
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    const a = document.getElementById('a') as HTMLElement;
    fireMouse(a, 'click', { altKey: true });
    expect(onPicked).not.toHaveBeenCalled();
    picker.dispose();
  });

  it('auto-cancels after 10 seconds', () => {
    const onPicked = vi.fn();
    const picker = createManualPicker({ onPicked });
    vi.advanceTimersByTime(10_001);
    const a = document.getElementById('a') as HTMLElement;
    fireMouse(a, 'click', { altKey: true });
    expect(onPicked).not.toHaveBeenCalled();
    picker.dispose();
  });

  it('window blur deactivates', () => {
    const onPicked = vi.fn();
    const picker = createManualPicker({ onPicked });
    window.dispatchEvent(new Event('blur'));
    const a = document.getElementById('a') as HTMLElement;
    fireMouse(a, 'click', { altKey: true });
    expect(onPicked).not.toHaveBeenCalled();
    picker.dispose();
  });

  it('dispose is idempotent', () => {
    const picker = createManualPicker({ onPicked: () => {} });
    expect(() => {
      picker.dispose();
      picker.dispose();
    }).not.toThrow();
  });

  it('mousemove on non-HTMLElement target (null) does not throw', () => {
    const picker = createManualPicker({ onPicked: () => {} });
    // Dispatch synthetic event with target undefined by using document directly
    const ev = new MouseEvent('mousemove', { bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(() => picker.dispose()).not.toThrow();
  });
});
