import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PageHeaderComponent } from './page-header.component';

@Component({
  standalone: true,
  imports: [PageHeaderComponent],
  template: `
    <app-page-header kicker="Gestão" title="Relatório" description="Resumo do período">
      <div page-actions class="page-header-actions">
        <button type="button">Exportar</button>
        <button type="button">Imprimir</button>
      </div>
    </app-page-header>
  `,
})
class PageHeaderHostComponent {}

describe('PageHeaderComponent', () => {
  it('projects commands as one explicit action group', async () => {
    await TestBed.configureTestingModule({ imports: [PageHeaderHostComponent] }).compileComponents();
    const fixture: ComponentFixture<PageHeaderHostComponent> = TestBed.createComponent(PageHeaderHostComponent);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('.page-header') as HTMLElement;
    const actions = header.querySelector(':scope > .page-header-actions') as HTMLElement;

    expect(actions).not.toBeNull();
    expect(actions.querySelectorAll(':scope > button')).toHaveLength(2);
    expect(header.querySelectorAll(':scope > button')).toHaveLength(0);
    expect(Array.from(actions.children).every((item) => (item as HTMLElement).style.marginLeft !== 'auto')).toBe(true);
  });
});
