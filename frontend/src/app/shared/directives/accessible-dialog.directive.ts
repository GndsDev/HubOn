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

@Directive({
  selector: '[appAccessibleDialog]',
  standalone: true,
})
export class AccessibleDialogDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly previousFocus = this.document.activeElement as HTMLElement | null;

  @Input() dialogCloseDisabled = false;
  @Output() readonly dialogClose = new EventEmitter<void>();

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      const dialog = this.element.nativeElement;
      const focusTarget =
        dialog.querySelector<HTMLElement>('[autofocus]') ??
        dialog.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
        );
      focusTarget?.focus();
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.dialogCloseDisabled) return;

    event.preventDefault();
    this.dialogClose.emit();
  }

  ngOnDestroy(): void {
    queueMicrotask(() => this.previousFocus?.focus());
  }
}
