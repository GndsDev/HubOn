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
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly overlays = inject(OverlayStackService);
  private readonly previousFocus = this.document.activeElement as HTMLElement | null;
  private overlayElement?: HTMLElement;
  private unregister?: () => void;

  @Input() dialogCloseDisabled = false;
  @Output() readonly dialogClose = new EventEmitter<void>();

  ngAfterViewInit(): void {
    const dialog = this.element.nativeElement;
    if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
    const backdrop = dialog.closest<HTMLElement>('.modal-backdrop') ?? dialog;
    this.overlayElement = backdrop;
    this.overlays.root().appendChild(backdrop);
    this.unregister = this.overlays.register(backdrop);

    queueMicrotask(() => {
      const focusTarget =
        dialog.querySelector<HTMLElement>('[autofocus]') ??
        dialog.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
        );
      (focusTarget ?? dialog).focus();
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.overlayElement || !this.overlays.isTop(this.overlayElement)) return;

    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }
    if (event.key !== 'Escape' || this.dialogCloseDisabled) return;

    event.preventDefault();
    event.stopPropagation();
    this.dialogClose.emit();
  }

  ngOnDestroy(): void {
    this.unregister?.();
    this.overlayElement?.remove();
    queueMicrotask(() => this.previousFocus?.focus());
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((item) => !item.hasAttribute('hidden') && this.document.defaultView?.getComputedStyle(item).display !== 'none');
    if (focusable.length === 0) {
      event.preventDefault();
      this.element.nativeElement.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1)!;
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || !this.element.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !this.element.nativeElement.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }
}
