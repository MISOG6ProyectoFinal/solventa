import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LocaleService } from '../../core/services/locale.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputDirective } from '../../shared/directives/input.directive';
import { CopCurrencyPipe } from '../../shared/pipes/cop-currency.pipe';
import { RAMOS } from '../../shared/constants/ramos.constants';
import { AlertComponent } from '../../ui/components/alert/alert.component';
import { BadgeComponent } from '../../ui/components/badge/badge.component';
import { ButtonComponent } from '../../ui/components/button/button.component';
import { CardComponent } from '../../ui/components/card/card.component';
import { ChipComponent } from '../../ui/components/chip/chip.component';
import { FieldComponent } from '../../ui/components/field/field.component';
import { IconComponent } from '../../ui/components/icon/icon.component';
import { ModalComponent } from '../../ui/components/modal/modal.component';
import { SwitchComponent } from '../../ui/components/switch/switch.component';
import { TabItem, TabsComponent } from '../../ui/components/tabs/tabs.component';
import {
  BRAND_SWATCHES,
  NEUTRAL_SWATCHES,
  STATUS_SWATCHES,
  ButtonVariant,
  Tone,
} from '../../ui/constants/design-tokens.constants';
import { ICONS, ICON_CATEGORIES, IconName } from '../../ui/constants/icons.constants';

interface TypeSample {
  readonly name: string;
  readonly spec: string;
  readonly classes: string;
  readonly sample: string;
}

/** Referencia viva del Design System (equivale a Colores / Tipografía / Componentes / Íconos de los mockups). */
@Component({
  selector: 'slv-design-system-page',
  imports: [
    PageHeaderComponent,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    AlertComponent,
    ChipComponent,
    FieldComponent,
    IconComponent,
    ModalComponent,
    SwitchComponent,
    TabsComponent,
    StatCardComponent,
    InputDirective,
    CopCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './design-system-page.component.html',
})
export class DesignSystemPageComponent {
  protected readonly locale = inject(LocaleService);

  protected readonly tabs: readonly TabItem[] = [
    { id: 'colores', label: 'Colores' },
    { id: 'tipografia', label: 'Tipografía' },
    { id: 'componentes', label: 'Componentes' },
    { id: 'iconos', label: 'Íconos' },
  ];
  protected readonly tab = signal('colores');
  protected readonly modalOpen = signal(false);
  protected readonly switchOn = signal(true);

  protected readonly brand = BRAND_SWATCHES;
  protected readonly neutral = NEUTRAL_SWATCHES;
  protected readonly status = STATUS_SWATCHES;
  protected readonly ramos = RAMOS;
  protected readonly categories = ICON_CATEGORIES;
  protected readonly variants: readonly ButtonVariant[] = ['primary', 'secondary', 'accent', 'outline', 'danger', 'ghost'];
  protected readonly tones: readonly Tone[] = ['neutral', 'success', 'warning', 'error', 'info', 'primary'];

  protected readonly types: readonly TypeSample[] = [
    { name: 'H1 / Hero', spec: 'Fraunces · 40–56px · Semibold', classes: 'font-serif text-5xl font-semibold text-foreground', sample: 'Protección que se mueve contigo' },
    { name: 'H2 / Título de página', spec: 'Fraunces · 24px · Semibold', classes: 'font-serif text-2xl font-semibold text-foreground', sample: 'Operaciones y Pólizas' },
    { name: 'H3 / Subtítulo', spec: 'Outfit · 18px · Medium', classes: 'text-lg font-medium text-foreground', sample: 'Detalle de la póliza' },
    { name: 'Body 1', spec: 'Outfit · 16px · Regular', classes: 'text-base text-foreground', sample: 'Gestiona cotizaciones, pólizas y socios en un solo lugar.' },
    { name: 'Body 2', spec: 'Outfit · 14px · Regular', classes: 'text-sm text-foreground', sample: 'Descripciones y detalles de formulario.' },
    { name: 'Caption', spec: 'Outfit · 12px · Medium', classes: 'text-xs font-medium text-muted-foreground', sample: 'Actualizado hace 5 minutos' },
    { name: 'Label en mayúsculas', spec: 'Outfit · 11–12px · tracking 0.2em', classes: 'text-xs uppercase tracking-[0.2em] text-muted-foreground', sample: 'Sección de formulario' },
    { name: 'Button', spec: 'Outfit · 14px · Semibold', classes: 'text-sm font-semibold text-foreground', sample: 'Emitir póliza' },
    { name: 'Número / Stat', spec: 'Fraunces · 32–48px · Semibold', classes: 'font-serif text-4xl font-semibold text-foreground', sample: '$ 154.167' },
  ];

  protected iconsOf(category: string): { name: IconName; label: string }[] {
    return (Object.keys(ICONS) as IconName[])
      .filter((name) => ICONS[name].category === category)
      .map((name) => ({ name, label: ICONS[name].label }));
  }
}
