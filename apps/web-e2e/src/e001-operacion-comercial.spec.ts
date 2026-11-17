import { expect, test, type Locator, type Page } from '@playwright/test';
import { login } from './login';

/**
 * KAN-1. Cotiza Viaje (viaje-internacional) contra el BFF local.
 * Ese ramo no pide consentimiento. Vida hipotecario sí lo exige y queda fuera
 * de este recorrido: el OTP depende del simulador de notificaciones.
 */

interface QuoteBreakdown {
  prima_basica: string | number;
  recargo_riesgo: string | number;
  coberturas_adicionales: string | number;
  impuestos: string | number;
  total: string | number;
}

interface QuoteResponse {
  id: string;
  producto_id: string;
  prima: string | number;
  estado?: string;
  degradada?: boolean;
  vigente_hasta?: string;
  vigencia_propuesta: { desde: string; hasta: string };
  coberturas: { id: string; nombre: string }[];
  desglose?: QuoteBreakdown | null;
}

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Lee un monto en COP tal como lo pinta el portal o como lo devuelve el API. */
function parseCop(text: string): number {
  const cleaned = text.replace(/[^\d,.-]/g, '').trim();
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, ''));
  }
  return Number(cleaned.replace(',', '.'));
}

async function expectAmount(locator: Locator, raw: string | number): Promise<void> {
  const text = (await locator.innerText()).replace(/\s+/g, ' ').trim();
  const parsed = parseCop(text);
  const numeric = Number(raw);
  const matches = parsed === numeric || parsed === Math.round(numeric);
  expect(matches, `se mostró "${text}" y la cotización trae ${numeric}`).toBeTruthy();
}

async function setQuoteField(page: Page, key: string, value: string): Promise<void> {
  const control = page.getByTestId(`quote-field-${key}`);
  await expect(control).toBeVisible();
  const tag = await control.evaluate((element) => element.tagName.toLowerCase());
  if (tag === 'select') {
    await control.selectOption(value);
    return;
  }
  await control.fill(value);
}

test('calcula una cotización de viaje con el backend', async ({ page }) => {
  const departure = isoDate(30);
  const returnDate = isoDate(44);
  const documentNumber = `9${String(Date.now()).slice(-9)}`;

  await test.step('Inicia sesión', async () => {
    await login(page);
    await expect(page.getByTestId('web-operator-role')).toContainText(/Administrador|Asesor/);
  });

  await test.step('Abre la cotización', async () => {
    await page.getByTestId('nav-operaciones').click();
    await expect(page.getByTestId('ops-page')).toBeVisible();
    await page.getByTestId('ops-tab-cotizar').click();
    await expect(page.getByTestId('quote-form')).toBeVisible();
    await expect(page.getByText('Su rol es de consulta')).toHaveCount(0);
  });

  const ramo = page.getByTestId('quote-ramo');
  await expect(ramo.locator('option', { hasText: 'Viaje' })).toHaveCount(1);
  await expect(ramo.locator('option', { hasText: 'Paramétrico (clima / vuelo)' })).toHaveCount(1);

  await test.step('El formulario cambia con el ramo', async () => {
    await ramo.selectOption({ label: 'Paramétrico (clima / vuelo)' });
    await expect(page.getByTestId('quote-form')).toContainText('Datos del riesgo · Paramétrico (clima / vuelo)');
    await expect(page.getByTestId('quote-field-evento')).toBeVisible();
    await expect(page.getByTestId('quote-field-destino')).toHaveCount(0);
    await expect(page.getByTestId('quote-field-nombre')).toBeVisible();

    await ramo.selectOption({ label: 'Viaje' });
    await expect(page.getByTestId('quote-form')).toContainText('Datos del riesgo · Viaje');
    await expect(page.getByTestId('quote-field-destino')).toBeVisible();
    await expect(page.getByTestId('quote-field-evento')).toHaveCount(0);
    await expect(page.getByText('Este ramo no requiere autorización del cliente para cotizar.')).toBeVisible();
    await expect(page.getByTestId('quote-calculate')).toBeEnabled();
  });

  await test.step('Completa cliente y riesgo', async () => {
    await expect(page.getByTestId('quote-field-tipoDocumento').locator('option[value="CC"]')).toHaveCount(1);
    await setQuoteField(page, 'tipoDocumento', 'CC');
    await setQuoteField(page, 'numeroDocumento', documentNumber);
    await setQuoteField(page, 'nombre', 'Cliente E2E');
    await setQuoteField(page, 'apellido', 'Portal');
    await setQuoteField(page, 'telefono', '3000001122');
    await setQuoteField(page, 'email', `e2e-web-${documentNumber}@example.test`);
    await setQuoteField(page, 'destino', 'España');
    await setQuoteField(page, 'fechaSalida', departure);
    await setQuoteField(page, 'fechaRegreso', returnDate);
    await setQuoteField(page, 'viajeros', '2');
  });

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/web/cotizaciones') && response.request().method() === 'POST',
  );
  await page.getByTestId('quote-calculate').click();
  const response = await responsePromise;
  const raw = await response.text();
  expect(response.ok(), raw).toBeTruthy();

  const quote = JSON.parse(raw) as QuoteResponse;
  const sent = response.request().postDataJSON() as Record<string, unknown>;

  expect(sent['producto_id']).toBe('viaje-internacional');
  expect(sent['destino']).toBe('España');
  expect(sent['fecha_salida']).toBe(departure);
  expect(sent['fecha_regreso']).toBe(returnDate);
  expect(sent['viajeros']).toBe(2);
  expect(sent['numero_documento']).toBe(documentNumber);

  expect(quote.producto_id).toBe('viaje-internacional');
  expect(quote.vigencia_propuesta).toEqual({ desde: departure, hasta: returnDate });
  expect(Number(quote.prima)).toBeGreaterThan(0);
  expect(quote.coberturas.length).toBeGreaterThan(0);
  expect(quote.id).toMatch(/^COT-/);

  const base = quote.desglose?.prima_basica ?? quote.prima;
  const risk = quote.desglose?.recargo_riesgo ?? 0;
  const extras = quote.desglose?.coberturas_adicionales ?? 0;
  const taxes = quote.desglose?.impuestos ?? 0;

  await expect(page.getByTestId('quote-id')).toHaveText(quote.id);
  await expect(page.getByTestId('quote-result')).toContainText('Ramo: Viaje');
  await expect(page.getByTestId('quote-result')).toContainText(quote.estado === 'VIGENTE' ? 'VIGENTE' : 'Vigente');
  await expect(page.getByText('Cotización generada correctamente.')).toHaveCount(quote.degradada ? 0 : 1);
  await expect(page.getByText('modo degradado')).toHaveCount(quote.degradada ? 1 : 0);

  const validUntil = String(quote.vigente_hasta ?? quote.vigencia_propuesta.hasta).slice(0, 10);
  await expect(page.getByTestId('quote-result')).toContainText(validUntil);

  await expectAmount(page.getByTestId('quote-base-premium'), base);
  await expectAmount(page.getByTestId('quote-risk-surcharge'), risk);
  await expectAmount(page.getByTestId('quote-extra-coverages'), extras);
  await expectAmount(page.getByTestId('quote-taxes'), taxes);
  await expectAmount(page.getByTestId('quote-total'), quote.prima);

  for (const coverage of quote.coberturas) {
    await expect(page.getByTestId('quote-result')).toContainText(coverage.nombre);
  }
});
