import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { OverlayStackService } from '../services/overlay-stack.service';

@Directive({
  selector: '[appAccessibleDialog]',
  standalone: true,
})
export class AccessibleDialogDirective implements AfterViewInit, OnDestroy {
  private readonly element =
    inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly document = inject(DOCUMENT);
  private readonly overlays = inject(OverlayStackService);

  private readonly previousFocus =
    this.document.activeElement instanceof HTMLElement
      ? this.document.activeElement
      : null;

  private overlayElement: HTMLElement | null = null;
  private unregister: (() => void) | null = null;
  private autoDirty = false;
  private destroyed = false;

  @Input() dialogCloseDisabled = false;
  @Input() dialogDirty = false;

  @Output()
  readonly dialogClose = new EventEmitter<void>();

  ngAfterViewInit(): void {
    const dialog = this.element.nativeElement;

    if (!dialog.hasAttribute('tabindex')) {
      dialog.tabIndex = -1;
    }

    const backdrop =
      dialog.closest<HTMLElement>('.modal-backdrop') ??
      dialog;

    this.overlayElement = backdrop;

    backdrop.addEventListener(
      'click',
      this.ignoreBackdropClick,
      true,
    );

    dialog.addEventListener(
      'input',
      this.markDirty,
      true,
    );

    dialog.addEventListener(
      'change',
      this.markDirty,
      true,
    );

    dialog.addEventListener(
      'click',
      this.confirmDirtyCloseClick,
      true,
    );

    dialog.addEventListener(
      'click',
      this.stopDialogClick,
    );

    this.overlays.root().appendChild(backdrop);
    this.unregister = this.overlays.register(backdrop);

    queueMicrotask(() => {
      if (this.destroyed) return;

      const focusTarget =
        dialog.querySelector<HTMLElement>('[autofocus]') ??
        dialog.querySelector<HTMLElement>(
          [
            'input:not([type="hidden"]):not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'button:not([disabled])',
            'a[href]',
          ].join(', '),
        ) ??
        dialog;

      this.focusWithoutScroll(focusTarget);
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const overlay = this.overlayElement;

    if (
      !overlay ||
      !this.overlays.isTop(overlay)
    ) {
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }

    if (
      event.key !== 'Escape' ||
      this.dialogCloseDisabled
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.requestClose();
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    const dialog = this.element.nativeElement;
    const overlay = this.overlayElement;

    overlay?.removeEventListener(
      'click',
      this.ignoreBackdropClick,
      true,
    );

    dialog.removeEventListener(
      'input',
      this.markDirty,
      true,
    );

    dialog.removeEventListener(
      'change',
      this.markDirty,
      true,
    );

    dialog.removeEventListener(
      'click',
      this.confirmDirtyCloseClick,
      true,
    );

    dialog.removeEventListener(
      'click',
      this.stopDialogClick,
    );

    this.unregister?.();
    overlay?.remove();

    this.unregister = null;
    this.overlayElement = null;

    queueMicrotask(() => {
      const previousFocus = this.previousFocus;

      if (
        !previousFocus ||
        !previousFocus.isConnected
      ) {
        return;
      }

      this.focusWithoutScroll(previousFocus);
    });
  }

  private readonly ignoreBackdropClick = (
    event: MouseEvent,
  ): void => {
    if (event.target !== this.overlayElement) {
      return;
    }

    /*
     * O fechamento ocorre somente por botão, Escape ou dialogClose.
     * Isso evita perda acidental de formulários ao clicar fora.
     */
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly markDirty = (): void => {
    this.autoDirty = true;
  };

  private readonly stopDialogClick = (
    event: MouseEvent,
  ): void => {
    event.stopPropagation();
  };

  private readonly confirmDirtyCloseClick = (
    event: MouseEvent,
  ): void => {
    if (
      !this.isDirty() ||
      this.dialogCloseDisabled
    ) {
      return;
    }

    const target =
      event.target instanceof HTMLElement
        ? event.target
        : null;

    const trigger = target?.closest<HTMLElement>(
      'button, a',
    );

    if (
      !trigger ||
      !this.element.nativeElement.contains(trigger) ||
      !this.isCloseIntent(trigger)
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    this.requestClose();
  };

  private requestClose(): void {
    if (this.dialogCloseDisabled) {
      return;
    }

    if (
      this.isDirty() &&
      !this.confirmDiscard()
    ) {
      return;
    }

    this.dialogClose.emit();
  }

  private isDirty(): boolean {
    return this.dialogDirty || this.autoDirty;
  }

  private isCloseIntent(
    trigger: HTMLElement,
  ): boolean {
    const label = this.normalized(
      trigger.getAttribute('aria-label') ?? '',
    );

    if (
      label.includes('fechar') ||
      label.includes('cancelar') ||
      label.includes('voltar')
    ) {
      return true;
    }

    const text = this.normalized(
      trigger.textContent ?? '',
    );

    return (
      text === 'cancelar' ||
      text === 'voltar' ||
      text === 'fechar'
    );
  }

  private confirmDiscard(): boolean {
    return (
      this.document.defaultView?.confirm(
        'Descartar alterações não salvas?',
      ) ?? true
    );
  }

  private normalized(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase('pt-BR')
      .replace(/\s+/g, ' ');
  }

  private trapFocus(
    event: KeyboardEvent,
  ): void {
    const dialog = this.element.nativeElement;

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled]):not([type="hidden"])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(', '),
      ),
    ).filter((item) => this.isFocusable(item));

    if (focusable.length === 0) {
      event.preventDefault();
      this.focusWithoutScroll(dialog);
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.document.activeElement;

    if (
      event.shiftKey &&
      (
        active === first ||
        !dialog.contains(active)
      )
    ) {
      event.preventDefault();
      this.focusWithoutScroll(last);
      return;
    }

    if (
      !event.shiftKey &&
      (
        active === last ||
        !dialog.contains(active)
      )
    ) {
      event.preventDefault();
      this.focusWithoutScroll(first);
    }
  }

  private isFocusable(
    element: HTMLElement,
  ): boolean {
    if (
      element.hidden ||
      element.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }

    const view = this.document.defaultView;

    if (!view) {
      return true;
    }

    const styles = view.getComputedStyle(element);

    return (
      styles.display !== 'none' &&
      styles.visibility !== 'hidden'
    );
  }

  private focusWithoutScroll(
    element: HTMLElement,
  ): void {
    try {
      element.focus({
        preventScroll: true,
      });
    } catch {
      element.focus();
    }
  }
}
