import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

interface OverlayEntry {
  element: HTMLElement;
  id: number;
  lockScroll: boolean;
}

@Injectable({ providedIn: 'root' })
export class OverlayStackService {
  private readonly document = inject(DOCUMENT);
  private readonly entries: OverlayEntry[] = [];
  private nextId = 1;
  private previousBodyPadding = '';

  root(): HTMLElement {
    const current = this.document.getElementById('hubon-overlay-root');
    if (current) return current;

    const root = this.document.createElement('div');
    root.id = 'hubon-overlay-root';
    root.className = 'hubon-overlay-root';
    this.document.body.appendChild(root);
    return root;
  }

  register(element: HTMLElement, lockScroll = true): () => void {
    const entry = { element, id: this.nextId++, lockScroll };
    this.entries.push(entry);
    this.refresh();

    return () => {
      const index = this.entries.findIndex((candidate) => candidate.id === entry.id);
      if (index === -1) return;
      this.entries.splice(index, 1);
      this.refresh();
    };
  }

  isTop(element: HTMLElement): boolean {
    return this.entries.at(-1)?.element === element;
  }

  private refresh(): void {
    this.entries.forEach((entry, index) => {
      entry.element.style.setProperty('--overlay-depth', String(index + 1));
    });

    const body = this.document.body;
    const shouldLockScroll = this.entries.some((entry) => entry.lockScroll);
    if (shouldLockScroll && !body.classList.contains('hubon-overlay-open')) {
      const viewport = this.document.defaultView?.innerWidth ?? this.document.documentElement.clientWidth;
      const scrollbarWidth = Math.max(0, viewport - this.document.documentElement.clientWidth);
      this.previousBodyPadding = body.style.paddingRight;
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
      body.classList.add('hubon-overlay-open');
    } else if (!shouldLockScroll && body.classList.contains('hubon-overlay-open')) {
      body.classList.remove('hubon-overlay-open');
      body.style.paddingRight = this.previousBodyPadding;
    }
  }
}
