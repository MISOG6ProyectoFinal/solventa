import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OPS_POLICIES } from '../../data/ops-policies.data';
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
});
