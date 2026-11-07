import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OPS_POLICIES } from '../../testing/policy.fixtures';
import { PolicyDetailComponent } from './policy-detail.component';

describe('PolicyDetailComponent', () => {
  let fixture: ComponentFixture<PolicyDetailComponent>;
  let el: HTMLElement;

  const render = async (policyId: string): Promise<void> => {
    fixture.componentRef.setInput('policy', OPS_POLICIES.find((policy) => policy.id === policyId)!);
    await fixture.whenStable();
    el = fixture.nativeElement;
  };

  const actionButton = (text: string): HTMLButtonElement =>
    Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.includes(text))!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PolicyDetailComponent] }).compileComponents();
    fixture = TestBed.createComponent(PolicyDetailComponent);
  });

  it('shows the insured data and the beneficiaries of an active policy', async () => {
    await render('p1');

    expect(el.querySelector('h2')!.textContent).toContain('SLV-2024-00391');
    expect(el.textContent).toContain('maria.rodriguez@email.com');
    expect(el.textContent).toContain('Banco Aurora (acreedor)');
    expect(el.textContent).toContain('80%');
  });

  it('enables the actions only for active policies', async () => {
    await render('p1');
    expect(actionButton('Registrar endoso').disabled).toBe(false);

    await render('p4');
    expect(actionButton('Registrar endoso').disabled).toBe(true);
    expect(actionButton('Cancelar póliza').disabled).toBe(true);
    expect(el.textContent).toContain('no admite endosos ni cancelación');
  });

  it('emits the requested actions', async () => {
    await render('p1');
    const back = vi.fn();
    const endorse = vi.fn();
    const cancel = vi.fn();
    fixture.componentInstance.backRequested.subscribe(back);
    fixture.componentInstance.endorsementRequested.subscribe(endorse);
    fixture.componentInstance.cancellationRequested.subscribe(cancel);

    actionButton('Volver al listado').click();
    actionButton('Registrar endoso').click();
    actionButton('Cancelar póliza').click();

    expect(back).toHaveBeenCalledOnce();
    expect(endorse).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('switches the content when another tab is selected', async () => {
    await render('p1');

    const coverageTab = Array.from(el.querySelectorAll<HTMLButtonElement>('slv-tabs button')).find((button) =>
      button.textContent?.includes('Coberturas'),
    )!;
    coverageTab.click();
    await fixture.whenStable();

    expect(el.querySelector('table')).not.toBeNull();
    expect(el.textContent).toContain('Fallecimiento (saldo del crédito)');
  });

  it.each([
    ['p1', 'ACTIVA'],
    ['p4', 'CANCELADA'],
    ['p3', 'VENCIDA'],
  ])('shows the status badge of %s in uppercase', async (id, label) => {
    await render(id);

    expect(el.querySelector('[data-testid="policy-status-badge"]')!.textContent).toContain(label);
  });

  it('renders the HU005 data-testid hooks', async () => {
    await render('p1');

    ['btn-volver-listado', 'hu005-policy-detail', 'hu005-policy-tabs-content', 'hu005-beneficiarios'].forEach((id) =>
      expect(el.querySelector(`[data-testid="${id}"]`), id).not.toBeNull(),
    );
    expect(el.querySelector('[data-testid="hu005-beneficiarios"]')!.textContent).toContain('Banco Aurora');
  });

  it('shows payments and claims through the policy-tab-* hooks', async () => {
    await render('p1');
    el.querySelector<HTMLButtonElement>('[data-testid="policy-tab-pagos"]')!.click();
    await fixture.whenStable();
    expect(el.textContent).toContain('PAY-10231');

    await render('p2');
    el.querySelector<HTMLButtonElement>('[data-testid="policy-tab-siniestros"]')!.click();
    await fixture.whenStable();
    expect(el.textContent).toContain('SIN-4412');
  });
});
