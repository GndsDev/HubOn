import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportProductSortComponent } from './report-product-sort.component';

describe('ReportProductSortComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReportProductSortComponent] }).compileComponents();
  });

  function create(productCount: number) {
    const fixture = TestBed.createComponent(ReportProductSortComponent);
    fixture.componentRef.setInput('productCount', productCount);
    fixture.componentRef.setInput('sort', 'REVENUE');
    fixture.componentRef.setInput('direction', 'DESC');
    fixture.detectChanges();
    return fixture;
  }

  it('shows contextual empty and single-product messages without inactive controls', () => {
    const empty = create(0);
    expect(empty.nativeElement.textContent).toContain('Nenhum produto vendido no período');
    expect(empty.nativeElement.querySelector('button')).toBeNull();

    const single = create(1);
    expect(single.nativeElement.textContent).toContain('1 produto no período');
    expect(single.nativeElement.querySelector('button')).toBeNull();
  });

  it('labels multiple products and exposes the active criterion semantically', () => {
    const fixture = create(8);
    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('.report-sort-criteria button'));

    expect(fixture.nativeElement.textContent).toContain('8 produtos no período');
    expect(fixture.nativeElement.textContent).toContain('Ordenar produtos por');
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(fixture.nativeElement.querySelector('[aria-live="polite"]').textContent)
      .toContain('Produtos ordenados por faturamento, do maior para o menor.');

    fixture.componentRef.setInput('sort', 'NAME');
    fixture.componentRef.setInput('direction', 'ASC');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-live="polite"]').textContent)
      .toContain('Produtos ordenados por nome, de A a Z.');
  });

  it('emits criterion and direction changes through native keyboard-accessible buttons', () => {
    const fixture = create(3);
    const element = fixture.nativeElement as HTMLElement;
    const sortSpy = vi.spyOn(fixture.componentInstance.sortChange, 'emit');
    const directionSpy = vi.spyOn(fixture.componentInstance.directionChange, 'emit');
    const name = Array.from(element.querySelectorAll<HTMLButtonElement>('.report-sort-criteria button'))
      .find((button) => button.textContent?.trim() === 'Nome')!;
    const direction = element.querySelector<HTMLButtonElement>('.report-sort-direction')!;

    name.focus();
    expect(document.activeElement).toBe(name);
    name.click();
    direction.click();

    expect(sortSpy).toHaveBeenCalledWith('NAME');
    expect(directionSpy).toHaveBeenCalledWith('ASC');
    expect(name.type).toBe('button');
    expect(name.tabIndex).toBe(0);
    expect(direction.getAttribute('aria-label')).toContain('Ordem decrescente');
  });
});
