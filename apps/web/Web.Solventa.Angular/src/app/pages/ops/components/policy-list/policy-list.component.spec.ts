import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCatalogFixture } from '../../../../core/testing/catalog.fixtures';
import { OPS_POLICIES } from '../../testing/policy.fixtures';
import { PolicyListComponent } from './policy-list.component';

describe('PolicyListComponent', () => {
  let fixture: ComponentFixture<PolicyListComponent>;
  let el: HTMLElement;

  const rows = (): HTMLTableRowElement[] => Array.from(el.querySelectorAll('tbody tr'));

  const type = async (value: string): Promise<void> => {
    const input = el.querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PolicyListComponent],
      providers: [provideCatalogFixture()],
    }).compileComponents();
    fixture = TestBed.createComponent(PolicyListComponent);
    fixture.componentRef.setInput('policies', OPS_POLICIES);
    fixture.componentRef.setInput('partners', ['Banco Aurora', 'RetailPay']);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('lists every policy with its status badge', () => {
    expect(rows().length).toBe(OPS_POLICIES.length);
    expect(rows()[0].textContent).toContain('SLV-2024-00391');
    expect(rows()[0].querySelector('slv-badge')!.textContent).toContain('ACTIVA');
  });

  it('offers the statuses the policy service publishes and filters by one', async () => {
    const select = el.querySelectorAll('select')[0];

    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'activa', 'vencida', 'cancelada']);
    select.value = 'vencida';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(rows().length).toBeGreaterThan(0);
    expect(rows().every((row) => row.querySelector('slv-badge')!.textContent!.includes('VENCIDA'))).toBe(true);
  });

  it('filters by policy number or identification', async () => {
    await type('01820');
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('SLV-2025-01820');
  });

  it('notifies search change when typing', async () => {
    const searched = vi.fn();
    fixture.componentInstance.searchChange.subscribe(searched);
    await type('1020304050');
    expect(searched).toHaveBeenLastCalledWith('1020304050');
  });

  it('shows an empty message when there are no results', async () => {
    fixture.componentRef.setInput('policies', []);
    await fixture.whenStable();

    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('No se encontraron pólizas');
  });

  it('emits the policy id when "Abrir" is pressed', () => {
    const emitted = vi.fn();
    fixture.componentInstance.opened.subscribe(emitted);

    rows()[1].querySelector('button')!.click();

    expect(emitted).toHaveBeenCalledWith('p2');
  });

  it('renders the HU005 data-testid hooks', () => {
    ['policy-search', 'policy-filter-estado', 'policy-filter-socio', 'hu005-policy-results', 'btn-abrir-poliza-SLV-2024-00391'].forEach(
      (id) => expect(el.querySelector(`[data-testid="${id}"]`), id).not.toBeNull(),
    );
  });

  it('filters by status Vencida and shows only the VENCIDA badge', async () => {
    const select = el.querySelector<HTMLSelectElement>('[data-testid="policy-filter-estado"]')!;
    select.value = 'vencida';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(rows().length).toBeGreaterThan(0);
    rows().forEach((row) => expect(row.querySelector('slv-badge')!.textContent).toContain('VENCIDA'));
  });
});
