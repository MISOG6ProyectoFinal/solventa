import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { provideCatalogFixture } from '../../../../core/testing/catalog.fixtures';
import { CancellationQuote } from '../../interfaces/cancellation-quote.interface';
import { OpsPoliciesService } from '../../services/ops-policies.service';
import { OPS_POLICIES } from '../../testing/policy.fixtures';
import { CancelPolicyModalComponent } from './cancel-policy-modal.component';

const QUOTE: CancellationQuote = { termDays: 365, unearnedDays: 100, refund: 27397 };

describe('CancelPolicyModalComponent', () => {
  let fixture: ComponentFixture<CancelPolicyModalComponent>;
  let el: HTMLElement;
  const quoteCancellation = vi.fn();

  const button = (text: string): HTMLButtonElement =>
    Array.from(el.querySelectorAll('button')).find((item) => item.textContent?.includes(text))!;

  const selectCause = async (cause: string): Promise<void> => {
    const select = el.querySelector('select')!;
    select.value = cause;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    quoteCancellation.mockReset().mockReturnValue(of(QUOTE));
    await TestBed.configureTestingModule({
      imports: [CancelPolicyModalComponent],
      providers: [provideCatalogFixture(), { provide: OpsPoliciesService, useValue: { quoteCancellation } }],
    }).compileComponents();
    fixture = TestBed.createComponent(CancelPolicyModalComponent);
    fixture.componentRef.setInput('policy', OPS_POLICIES[1]);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('asks for a cause and keeps "Continuar" disabled until one is selected', () => {
    expect(el.textContent).toContain('Seleccione la causa para calcular la prima no devengada.');
    expect(button('Continuar').disabled).toBe(true);
    expect(quoteCancellation).not.toHaveBeenCalled();
  });

  it('asks the backend for the refund and highlights the amount to return', async () => {
    await selectCause('retracto');

    expect(quoteCancellation).toHaveBeenCalledWith(OPS_POLICIES[1].id, 'retracto');
    expect(el.querySelector('[data-testid="cancel-refund"]')?.textContent).toContain('Valor a reintegrar al cliente:');
    expect(el.textContent).toContain('Días no devengados');
    expect(button('Continuar').disabled).toBe(false);
  });

  it('shows a spinner while the backend recalculates', async () => {
    const pending = new Subject<CancellationQuote>();
    quoteCancellation.mockReturnValue(pending);

    await selectCause('retracto');
    expect(el.querySelector('[data-testid="cancel-spinner"]')).not.toBeNull();
    expect(button('Continuar').disabled).toBe(true);

    pending.next(QUOTE);
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="cancel-spinner"]')).toBeNull();
  });

  it('shows an error and blocks continuing when the recalculation fails', async () => {
    quoteCancellation.mockReturnValue(throwError(() => new Error('503')));

    await selectCause('retracto');

    expect(el.textContent).toContain('No se pudo calcular la devolución');
    expect(button('Continuar').disabled).toBe(true);
  });

  it('shows no refund for non-payment', async () => {
    await selectCause('impago-de-prima');

    expect(el.textContent).toContain('No aplica devolución por impago de prima.');
  });

  it('goes through the confirmation step and emits the cause', async () => {
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    await selectCause('retracto');

    button('Continuar').click();
    await fixture.whenStable();
    expect(el.textContent).toContain('SLV-2025-01820');

    button('Confirmar cancelación').click();
    expect(confirmed).toHaveBeenCalledWith('retracto');
  });

  it('shows the backend error on the confirmation step', async () => {
    await selectCause('retracto');
    button('Continuar').click();
    fixture.componentRef.setInput('error', 'La póliza no está activa');
    await fixture.whenStable();

    expect(el.textContent).toContain('La póliza no está activa');
  });
});
