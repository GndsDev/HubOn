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
  private autoDirty = false;

  @Input() dialogCloseDisabled = false;
  @Input() dialogDirty = false;
  @Output() readonly dialogClose = new EventEmitter<void>();

  ngAfterViewInit(): void {
    const dialog = this.element.nativeElement;
    if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
    const backdrop = dialog.closest<HTMLElement>('.modal-backdrop') ?? dialog;
    this.overlayElement = backdrop;
    backdrop.addEventListener('click', this.ignoreBackdropClick, true);
    dialog.addEventListener('input', this.markDirty, true);
    dialog.addEventListener('change', this.markDirty, true);
    dialog.addEventListener('click', this.confirmDirtyCloseClick, true);
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
    this.requestClose();
  }

  ngOnDestroy(): void {
    const dialog = this.element.nativeElement;
    this.overlayElement?.removeEventListener('click', this.ignoreBackdropClick, true);
    dialog.removeEventListener('input', this.markDirty, true);
    dialog.removeEventListener('change', this.markDirty, true);
    dialog.removeEventListener('click', this.confirmDirtyCloseClick, true);
    this.unregister?.();
    this.overlayElement?.remove();
    queueMicrotask(() => this.previousFocus?.focus());
  }

  private readonly ignoreBackdropClick = (event: MouseEvent): void => {
    if (event.target !== this.overlayElement) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly markDirty = (): void => {
    this.autoDirty = true;
  };

  private readonly confirmDirtyCloseClick = (event: MouseEvent): void => {
    if (!this.isDirty() || this.dialogCloseDisabled) return;
    const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>('button, a');
    if (!trigger || !this.element.nativeElement.contains(trigger) || !this.isCloseIntent(trigger)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    this.requestClose();
  };

  private requestClose(): void {
    if (this.isDirty() && !this.confirmDiscard()) return;
    this.dialogClose.emit();
  }

  private isDirty(): boolean {
    return this.dialogDirty || this.autoDirty;
  }

  private isCloseIntent(trigger: HTMLElement): boolean {
    const label = this.normalized(trigger.getAttribute('aria-label') ?? '');
    if (label.includes('fechar') || label.includes('cancelar')) return true;

    const text = this.normalized(trigger.textContent ?? '');
    return text === 'cancelar' || text === 'voltar';
  }

  private confirmDiscard(): boolean {
    return this.document.defaultView?.confirm('Descartar alterações não salvas?') ?? true;
  }

  private normalized(value: string): string {
    return value.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
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
