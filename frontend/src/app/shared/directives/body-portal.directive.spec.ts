import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { BodyPortalDirective } from './body-portal.directive';

@Component({
  imports: [BodyPortalDirective],
  template: `@if (open()) { <div class="test-menu" appBodyPortal>Menu</div> }`,
})
class PortalHostComponent {
  readonly open = signal(false);
}

describe('BodyPortalDirective', () => {
  let fixture: ComponentFixture<PortalHostComponent>;

  afterEach(() => {
    fixture?.destroy();
    document.getElementById('hubon-overlay-root')?.remove();
    TestBed.resetTestingModule();
  });

  it('removes the portaled element when its Angular view closes', async () => {
    await TestBed.configureTestingModule({ imports: [PortalHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(PortalHostComponent);
    fixture.detectChanges();

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(document.querySelectorAll('#hubon-overlay-root .test-menu')).toHaveLength(1);

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(document.querySelectorAll('#hubon-overlay-root .test-menu')).toHaveLength(0);
  });
});
