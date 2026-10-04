import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OPS_POLICIES } from '../../data/ops-policies.data';
import { EndorsementModalComponent } from './endorsement-modal.component';

describe('EndorsementModalComponent', () => {
  let fixture: ComponentFixture<EndorsementModalComponent>;
  let el: HTMLElement;

  const button = (text: string): HTMLButtonElement =>
    Array.from(el.querySelectorAll('button')).find((item) => item.textContent?.includes(text))!;

  const fillReason = async (value: string): Promise<void> => {
    const input = el.querySelector<HTMLInputElement>('input[placeholder^="Ej:"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EndorsementModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(EndorsementModalComponent);
    fixture.componentRef.setInput('policy', OPS_POLICIES[0]);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('is prefilled with the contact data of the policy', () => {
    const values = Array.from(el.querySelectorAll('input')).map((input) => input.value);

    expect(el.textContent).toContain('Registrar endoso');
    expect(values).toContain('+57 300 123 4567');
    expect(values).toContain('maria.rodriguez@email.com');
    expect(values).toContain('Calle 85 #12-34, Bogotá');
  });

  it('requires the reason before continuing', async () => {
    const continued = vi.fn();
    fixture.componentInstance.continued.subscribe(continued);

    button('Continuar').click();
    await fixture.whenStable();

    expect(continued).not.toHaveBeenCalled();
    expect(el.textContent).toContain('El motivo del endoso es obligatorio.');
  });

  it('emits the draft when the form is valid', async () => {
    const continued = vi.fn();
    fixture.componentInstance.continued.subscribe(continued);

    await fillReason('Actualización de datos');
    button('Continuar').click();

    expect(continued).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Actualización de datos', phone: '+57 300 123 4567' }),
    );
  });

  it('emits closed when cancelling', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    button('Cancelar').click();

    expect(closed).toHaveBeenCalledOnce();
  });
});
