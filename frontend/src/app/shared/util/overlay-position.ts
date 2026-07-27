export interface OverlayPosition {
  left: number;
  top: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
}

export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export function calculateOverlayPosition(
  trigger: RectLike,
  menu: Pick<RectLike, 'width' | 'height'>,
  viewportWidth: number,
  viewportHeight: number,
  gap = 8,
  margin = 12,
): OverlayPosition {
  const menuWidth = Math.min(menu.width || 192, Math.max(160, viewportWidth - margin * 2));
  const menuHeight = menu.height || 280;
  const spaceBelow = Math.max(0, viewportHeight - trigger.bottom - gap - margin);
  const spaceAbove = Math.max(0, trigger.top - gap - margin);
  const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
  const availableHeight = Math.max(144, openAbove ? spaceAbove : spaceBelow);
  const renderedHeight = Math.min(menuHeight, availableHeight);
  const maxLeft = Math.max(margin, viewportWidth - margin - menuWidth);
  const left = Math.max(margin, Math.min(trigger.right - menuWidth, maxLeft));
  const desiredTop = openAbove
    ? trigger.top - gap - renderedHeight
    : trigger.bottom + gap;
  const top = Math.max(margin, Math.min(desiredTop, viewportHeight - margin - renderedHeight));

  return {
    left: Math.round(left),
    top: Math.round(top),
    maxHeight: Math.floor(availableHeight),
    placement: openAbove ? 'top' : 'bottom',
  };
}
