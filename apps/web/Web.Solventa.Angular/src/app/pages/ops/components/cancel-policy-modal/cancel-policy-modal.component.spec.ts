import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OPS_POLICIES } from '../../data/ops-policies.data';
import { CancelPolicyModalComponent } from './cancel-policy-modal.component';

describe('CancelPolicyModalComponent', () => {
  let fixture: ComponentFixture<CancelPolicyModalComponent>;
  let el: HTMLElement;

  const button = (text: string): HTMLButtonElement =>
    Array.from(el.querySelectorAll('button')).find((item) => item.textContent?.includes(text))!;

  const selectCause = async (cause: string): Promise<void> => {
    const select = el.querySelector('select')!;
    select.value = cause;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CancelPolicyModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(CancelPolicyModalComponent);
    fixture.componentRef.setInput('policy', OPS_POLICIES[1]);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('asks for a cause and keeps "Continuar" disabled until one is selected', () => {
    expect(el.textContent).toContain('Seleccione la causa para calcular la prima no devengada.');
    expect(button('Continuar').disabled).toBe(true);
    expect(button('Cerrar')).toBeDefined();
  });

  it('shows the estimated refund once a cause is selected', async () => {
    await selectCause('Retracto');

    expect(el.textContent).toContain('Devolución estimada');
    expect(el.textContent).toContain('Días no devengados');
    expect(button('Continuar').disabled).toBe(false);
  });

  it('shows no refund for non-payment', async () => {
    await selectCause('Impago de prima');

    expect(el.textContent).toContain('No aplica devolución por impago de prima.');
  });

  it('goes through the confirmation step and emits the cause', async () => {
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    await selectCause('Retracto');

    button('Continuar').click();
    await fixture.whenStable();
    expect(el.textContent).toContain('SLV-2025-01820');

    button('Confirmar cancelación').click();
    expect(confirmed).toHaveBeenCalledWith('Retracto');
  });
});
