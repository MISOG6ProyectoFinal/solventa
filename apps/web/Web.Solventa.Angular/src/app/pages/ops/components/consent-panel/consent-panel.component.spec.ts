import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsentPanelComponent } from './consent-panel.component';

describe('ConsentPanelComponent', () => {
  let fixture: ComponentFixture<ConsentPanelComponent>;
  let el: HTMLElement;

  const render = async (required: boolean): Promise<void> => {
    fixture.componentRef.setInput('required', required);
    fixture.componentRef.setInput('ramoLabel', 'Viaje');
    await fixture.whenStable();
    el = fixture.nativeElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConsentPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(ConsentPanelComponent);
  });

  it('asks for the consent when the ramo requires it', async () => {
    await render(true);

    expect(el.textContent).toContain('Debe solicitar y validar el consentimiento antes de cotizar.');
    expect(el.querySelector('button')!.textContent).toContain('Solicitar consentimiento');
    expect(el.querySelectorAll('input[type="checkbox"]').length).toBe(2);
  });

  it('shows an informative message when the ramo does not require consent', async () => {
    await render(false);

    expect(el.textContent).toContain('El ramo Viaje no requiere consentimiento');
    expect(el.querySelector('button')).toBeNull();
  });

  it('emits when the consent request button is pressed', async () => {
    await render(true);
    const emitted = vi.fn();
    fixture.componentInstance.requested.subscribe(emitted);

    el.querySelector('button')!.click();

    expect(emitted).toHaveBeenCalledOnce();
  });
});
