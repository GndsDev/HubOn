import { AfterViewInit, Directive, ElementRef, inject, OnDestroy } from '@angular/core';
import { OverlayStackService } from '../services/overlay-stack.service';

@Directive({
  selector: '[appBodyPortal]',
  standalone: true,
})
export class BodyPortalDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly overlays = inject(OverlayStackService);
  private unregister?: () => void;

  ngAfterViewInit(): void {
    const host = this.element.nativeElement;
    this.overlays.root().appendChild(host);
    this.unregister = this.overlays.register(host, false);
  }

  ngOnDestroy(): void {
    this.unregister?.();
    this.element.nativeElement.remove();
  }
}
