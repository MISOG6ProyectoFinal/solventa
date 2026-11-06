import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { provideCatalogFixture } from '../../../core/testing/catalog.fixtures';
import { CONTRACTS, RAMOS_DTO } from '../../../core/testing/ramos.fixtures';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { POLICY_DTO } from '../testing/policy.fixtures';
import { OpsPageComponent } from './ops-page.component';

describe('OpsPageComponent', () => {
  let fixture: ComponentFixture<OpsPageComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;

  const button = (text: string): HTMLButtonElement =>
    Array.from(el.querySelectorAll('button')).find((item) => item.textContent?.includes(text))!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpsPageComponent],
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), provideCatalogFixture()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OpsPageComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
    http.expectOne(API_ENDPOINTS.simulator('open-finance')).flush({ proveedor: 'open-finance', modo: 'normal' });
    http.expectOne(API_ENDPOINTS.ramos).flush(RAMOS_DTO);
    await fixture.whenStable();
    http.expectOne(API_ENDPOINTS.productContract('viaje-internacional')).flush(CONTRACTS['viaje-internacional']);
  });

  afterEach(() => http.verify());

  const showPolicies = async () => {
    button('Consulta de pólizas').click();
    await fixture.whenStable();
  };

  it('lists the policies the BFF returns', async () => {
    http.expectOne(API_ENDPOINTS.policies).flush([POLICY_DTO]);
    await showPolicies();

    expect(el.textContent).toContain('POL-ABC123');
    expect(el.textContent).toContain('Lina Díaz');
    expect(el.textContent).toContain('Directo · App móvil');
  });

  it('offers a retry when the policies cannot be loaded', async () => {
    http.expectOne(API_ENDPOINTS.policies).flush({ detail: 'Servicio interno no disponible' }, { status: 503, statusText: 'Unavailable' });
    await showPolicies();

    expect(el.textContent).toContain('No fue posible cargar las pólizas.');
    button('Reintentar').click();
    http.expectOne(API_ENDPOINTS.policies).flush([POLICY_DTO]);
    await fixture.whenStable();

    expect(el.textContent).toContain('POL-ABC123');
  });

  it('opens the detail with its payments and claims and goes back', async () => {
    http.expectOne(API_ENDPOINTS.policies).flush([{ ...POLICY_DTO, pagos: undefined, siniestros: undefined }]);
    await showPolicies();

    button('Abrir').click();
    http.expectOne(API_ENDPOINTS.policy('pol-1')).flush(POLICY_DTO);
    await fixture.whenStable();

    expect(el.textContent).toContain('Detalle de póliza');
    button('Siniestros').click();
    await fixture.whenStable();
    expect(el.textContent).toContain('SIN-1001');

    button('Volver al listado').click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Buscar por número de póliza o identificación');
  });
});
