import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OPS_POLICIES } from '../../testing/policy.fixtures';
import { EndorsementModalComponent } from './endorsement-modal.component';

describe('EndorsementModalComponent', () => {
  let fixture: ComponentFixture<EndorsementModalComponent>;
  let el: HTMLElement;

  const save = (): HTMLButtonElement =>
    Array.from(el.querySelectorAll('button')).find((item) => item.textContent?.includes('Guardar cambios'))!;

  const type = async (selector: string, value: string): Promise<void> => {
    const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const editName = (value: string) => type('[data-testid="endorsement-name"]', value);
  const fillReason = (value: string) => type('textarea', value);
  const setDate = (value: string) => type('input[type="date"]', value);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EndorsementModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(EndorsementModalComponent);
    fixture.componentRef.setInput('policy', OPS_POLICIES[0]);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('shows the original data read-only and the same data editable', () => {
    const before = Array.from(el.querySelectorAll<HTMLInputElement>('[data-testid="endorsement-before"] input'));
    const after = Array.from(el.querySelectorAll<HTMLInputElement>('[data-testid="endorsement-after"] input'));

    expect(before.every((input) => input.readOnly)).toBe(true);
    expect(before.map((input) => input.value)).toContain('María Rodríguez');
    expect(after.map((input) => input.value)).toContain('Calle 85 #12-34, Bogotá');
  });

  it('keeps save disabled until a field changes', async () => {
    expect(save().disabled).toBe(true);

    await editName('María R. Rodríguez');

    expect(save().disabled).toBe(false);
  });

  it('requires the reason, rejecting blanks', async () => {
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    await editName('María R. Rodríguez');
    await fillReason('   ');

    save().click();
    await fixture.whenStable();

    expect(saved).not.toHaveBeenCalled();
    expect(el.textContent).toContain('El motivo del endoso es obligatorio.');
  });

  it('rejects an effective date outside the policy term', async () => {
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    await editName('María R. Rodríguez');
    await fillReason('Corrección de nombre');
    await setDate('2030-01-01');

    save().click();
    await fixture.whenStable();

    expect(saved).not.toHaveBeenCalled();
    expect(el.textContent).toContain('dentro de la vigencia');
  });

  it('emits the draft when the form is valid', async () => {
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    await editName('María R. Rodríguez');
    await fillReason('Corrección de nombre');
    await setDate('2026-06-01');

    save().click();

    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'María R. Rodríguez', reason: 'Corrección de nombre', effectiveDate: '2026-06-01' }),
    );
  });

  it('emits closed when cancelling', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    Array.from(el.querySelectorAll('button')).find((item) => item.textContent?.includes('Cancelar'))!.click();

    expect(closed).toHaveBeenCalledOnce();
  });
});
