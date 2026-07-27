import { describe, expect, it } from 'vitest';
import { calculateOverlayPosition, RectLike } from './overlay-position';

function rect(left: number, top: number, width: number, height: number): RectLike {
  return { left, right: left + width, top, bottom: top + height, width, height };
}

describe('overlay position', () => {
  it('opens below the first rows when there is enough room', () => {
    const position = calculateOverlayPosition(rect(100, 80, 40, 40), rect(0, 0, 220, 260), 1366, 768);
    expect(position.placement).toBe('bottom');
    expect(position.top).toBe(128);
    expect(position.left).toBeGreaterThanOrEqual(12);
  });

  it('opens above the last rows when the bottom space is insufficient', () => {
    const position = calculateOverlayPosition(rect(1100, 690, 40, 40), rect(0, 0, 220, 260), 1366, 768);
    expect(position.placement).toBe('top');
    expect(position.top).toBe(422);
  });

  it('keeps a scrolled menu inside the horizontal and vertical viewport', () => {
    const position = calculateOverlayPosition(rect(1330, 380, 30, 30), rect(0, 0, 280, 900), 1366, 768);
    expect(position.left).toBe(1074);
    expect(position.top).toBeGreaterThanOrEqual(12);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(756);
  });

  it('adapts to a wider desktop viewport without changing the anchor rule', () => {
    const position = calculateOverlayPosition(rect(1840, 120, 40, 40), rect(0, 0, 240, 300), 1920, 1080);
    expect(position.left).toBe(1640);
    expect(position.placement).toBe('bottom');
  });
});
