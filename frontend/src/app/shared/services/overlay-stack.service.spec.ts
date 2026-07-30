import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { OverlayStackService } from './overlay-stack.service';

describe('OverlayStackService', () => {
  afterEach(() => {
    document.body.classList.remove('hubon-overlay-open');
    document.body.style.paddingRight = '';
    document.getElementById('hubon-overlay-root')?.remove();
    TestBed.resetTestingModule();
  });

  it('creates one global root outside feature containers', () => {
    const service = TestBed.inject(OverlayStackService);
    expect(service.root().parentElement).toBe(document.body);
    expect(service.root()).toBe(service.root());
  });

  it('tracks the upper overlay and locks page scrolling', () => {
    const service = TestBed.inject(OverlayStackService);
    const first = document.createElement('div');
    const second = document.createElement('div');
    const unregisterFirst = service.register(first);
    const unregisterSecond = service.register(second);

    expect(document.body.classList.contains('hubon-overlay-open')).toBe(true);
    expect(service.isTop(first)).toBe(false);
    expect(service.isTop(second)).toBe(true);

    unregisterSecond();
    expect(service.isTop(first)).toBe(true);
    unregisterFirst();
    expect(document.body.classList.contains('hubon-overlay-open')).toBe(false);
  });

  it('assigns increasing controlled depths instead of fixed component z-indexes', () => {
    const service = TestBed.inject(OverlayStackService);
    const first = document.createElement('div');
    const second = document.createElement('div');
    service.register(first);
    service.register(second);
    expect(first.style.getPropertyValue('--overlay-depth')).toBe('1');
    expect(second.style.getPropertyValue('--overlay-depth')).toBe('2');
  });
});
