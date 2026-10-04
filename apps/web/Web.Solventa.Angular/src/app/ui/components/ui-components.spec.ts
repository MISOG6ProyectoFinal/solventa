import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertComponent } from './alert/alert.component';
import { BadgeComponent } from './badge/badge.component';
import { ButtonComponent } from './button/button.component';
import { IconComponent } from './icon/icon.component';
import { ModalComponent } from './modal/modal.component';
import { SwitchComponent } from './switch/switch.component';
import { TabsComponent } from './tabs/tabs.component';
import { ICONS } from '../constants/icons.constants';

@Component({
  imports: [ButtonComponent, BadgeComponent, AlertComponent, IconComponent, TabsComponent, SwitchComponent, ModalComponent],
  template: `
    <button slv-button variant="danger" id="btn">Eliminar</button>
    <slv-badge tone="success" id="badge">Activa</slv-badge>
    <slv-alert tone="error" id="alert">Falló</slv-alert>
    <slv-icon name="polizas" [size]="24" id="icon" />
    <slv-tabs [items]="items" [(active)]="tab" />
    <slv-switch [(checked)]="on" />
    <slv-modal [open]="open()" title="Título" (closed)="open.set(false)">
      <span id="body">cuerpo</span>
    </slv-modal>
  `,
})
class HostComponent {
  items = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];
  tab = signal('a');
  on = signal(false);
  open = signal(false);
}

describe('UI components', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('button applies the variant classes from the mockup', () => {
    const cls = el.querySelector('#btn')!.className;
    expect(cls).toContain('bg-error');
    expect(cls).toContain('rounded-xl');
    expect(cls).toContain('font-semibold');
  });

  it('badge and alert use the status surface tokens', () => {
    expect(el.querySelector('#badge')!.className).toContain('bg-success-surface');
    expect(el.querySelector('#alert')!.className).toContain('text-error-text');
  });

  it('icon renders the shapes of the catalog', () => {
    const svg = el.querySelector('#icon svg')!;
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.children.length).toBe(ICONS.polizas.shapes.length);
  });

  it('tabs update the two-way bound signal', async () => {
    const buttons = el.querySelectorAll<HTMLButtonElement>('slv-tabs button');
    buttons[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.tab()).toBe('b');
    expect(buttons[1].className).toContain('border-primary');
  });

  it('switch toggles the bound signal', async () => {
    el.querySelector<HTMLButtonElement>('slv-switch button')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.on()).toBe(true);
  });

  it('modal renders only when open and closes on Escape', async () => {
    expect(el.querySelector('#body')).toBeNull();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(el.querySelector('#body')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('exposes the complete icon catalog (54, same breakdown as the mockup)', () => {
    const counts: Record<string, number> = {};
    for (const def of Object.values(ICONS)) counts[def.category] = (counts[def.category] ?? 0) + 1;

    expect(Object.keys(ICONS).length).toBe(54);
    expect(counts).toEqual({
      Navegación: 11,
      Acciones: 9,
      Estados: 8,
      Negocio: 12,
      Ramos: 6,
      Plataforma: 8,
    });
  });
});
