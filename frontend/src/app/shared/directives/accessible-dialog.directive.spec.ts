import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccessibleDialogDirective } from './accessible-dialog.directive';

@Component({
  imports: [AccessibleDialogDirective],
  template: `
    <button id="opener" type="button" (click)="mainOpen.set(true)">Abrir</button>
    @if (mainOpen()) {
      <div class="modal-backdrop">
        <section class="modal-panel" appAccessibleDialog role="dialog" aria-modal="true" aria-labelledby="main-title" (dialogClose)="mainOpen.set(false)">
          <h2 id="main-title">Principal</h2>
          <input id="first-field" autofocus />
          <button id="open-confirm" type="button" (click)="confirmOpen.set(true)">Confirmar</button>
          <button id="last-button" type="button">Último</button>
        </section>
      </div>
    }
    @if (confirmOpen()) {
      <div class="modal-backdrop">
        <section class="modal-panel" appAccessibleDialog role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" (dialogClose)="confirmOpen.set(false)">
          <h2 id="confirm-title">Confirmação</h2>
          <button id="confirm-close" type="button" (click)="confirmOpen.set(false)">Fechar</button>
        </section>
      </div>
    }
  `,
})
class DialogHostComponent {
  readonly mainOpen = signal(false);
  readonly confirmOpen = signal(false);
}

describe('AccessibleDialogDirective', () => {
  let fixture: ComponentFixture<DialogHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DialogHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(DialogHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.getElementById('hubon-overlay-root')?.remove();
    document.body.classList.remove('hubon-overlay-open');
    TestBed.resetTestingModule();
  });

  async function openMain(): Promise<void> {
    const opener = fixture.nativeElement.querySelector('#opener') as HTMLButtonElement;
    opener.focus();
    opener.click();
    fixture.detectChanges();
    await Promise.resolve();
  }

  it('portals the modal, locks scroll and moves focus into it', async () => {
    await openMain();
    expect(document.querySelector('#hubon-overlay-root .modal-backdrop')).not.toBeNull();
    expect(document.body.classList.contains('hubon-overlay-open')).toBe(true);
    expect(document.activeElement?.id).toBe('first-field');
  });

  it('traps Tab and Shift+Tab inside a large dialog', async () => {
    await openMain();
    const first = document.querySelector('#first-field') as HTMLInputElement;
    const last = document.querySelector('#last-button') as HTMLButtonElement;
    last.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);

    first.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
  });

  it('closes only the upper confirmation with Escape', async () => {
    await openMain();
    (document.querySelector('#open-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();
    await Promise.resolve();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.confirmOpen()).toBe(false);
    expect(fixture.componentInstance.mainOpen()).toBe(true);
  });

  it('restores focus to the opener after closing', async () => {
    await openMain();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await Promise.resolve();
    expect(document.querySelectorAll('#hubon-overlay-root .modal-backdrop')).toHaveLength(0);
    expect(document.activeElement?.id).toBe('opener');
  });
});
