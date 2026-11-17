import { expect, test } from '@playwright/test';
import { login } from './login';

/**
 * KAN-4. Da de alta un socio en el backend local.
 * El identificador lleva el prefijo E2E-WEB- para reconocerlo.
 * No hay un endpoint de limpieza: esos registros se quedan en la base.
 */

interface CreatedPartner {
  identificador: string;
  client_id: string;
  secreto: string;
  estado_contrato: string;
  estado_credencial: string;
  version_contrato: string;
  alcances: string[];
  alta_usuario: string;
  alta_fecha: string;
  tipo: string;
  nombre: string;
}

interface ListedPartner {
  identificador: string;
  client_id: string;
  estado_contrato: string;
  estado_credencial: string;
  alcances: string[];
  tipo: string;
  nombre: string;
}

test('da de alta un socio y lo vuelve a consultar', async ({ page }) => {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const identifier = `E2E-WEB-${stamp}`;
  const partnerName = `Socio E2E ${stamp}`;
  const email = `e2e-web-${stamp.toLowerCase()}@example.test`;

  await test.step('Inicia sesión como administrador', async () => {
    await login(page);
    await page.getByTestId('nav-socios').click();
    await expect(page.getByTestId('web-operator-role')).toContainText('Administrador');
    await expect(page.getByRole('heading', { name: 'Socios e Integraciones' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Socios aprovisionados' })).toBeVisible();
    await expect(page.getByTestId('partners-create')).toBeVisible();
  });

  await page.getByTestId('partners-create').click();
  const modal = page.getByTestId('create-partner-modal');
  await expect(modal.getByRole('dialog', { name: 'Nuevo socio' })).toBeVisible();

  const operatorName = (await page.getByTestId('web-operator-name').innerText()).trim();
  const typeSelect = modal.getByTestId('partner-type');
  await expect.poll(async () => typeSelect.inputValue()).not.toBe('');
  const partnerType = await typeSelect.inputValue();

  await modal.getByTestId('partner-name').fill(partnerName);
  await modal.getByTestId('partner-identifier').fill(identifier);
  await modal.getByTestId('partner-country').selectOption('Colombia');
  await modal.getByTestId('partner-email').fill(email);

  const scope = modal.getByRole('checkbox', { name: 'Cotización' });
  await scope.check();
  await expect(scope).toBeChecked();

  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/web/socios' && response.request().method() === 'POST';
  });
  await modal.getByRole('button', { name: 'Crear y aprovisionar' }).click();
  const response = await responsePromise;
  const raw = await response.text();
  expect(response.status(), response.ok() ? '' : raw).toBe(201);

  const created = JSON.parse(raw) as CreatedPartner;
  expect(created.identificador).toBe(identifier);
  expect(created.nombre).toBe(partnerName);
  expect(created.tipo).toBe(partnerType);
  expect(created.alcances).toContain('cotizacion');
  expect(created.estado_contrato).toBe('Activo');
  expect(created.estado_credencial).toBe('Activa');
  expect(created.version_contrato.length).toBeGreaterThan(0);
  expect(created.client_id.startsWith('sv_live_')).toBeTruthy();
  expect(created.alta_usuario).toBe(operatorName);
  expect(typeof created.secreto).toBe('string');
  expect(created.secreto.startsWith('sv_sec_')).toBeTruthy();
  expect(created.secreto.length).toBeGreaterThan('sv_sec_'.length + 8);

  const confirmation = page.getByTestId('partner-created');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('Socio aprovisionado y contrato de API activo');
  await expect(page.getByTestId('client-id')).toHaveText(created.client_id);
  await expect(confirmation).toContainText('Activo');
  await expect(confirmation).toContainText(created.version_contrato);
  await expect(confirmation).toContainText('Activa');

  const secretMatches = await page.getByTestId('secret').evaluate((element, expected: string) => {
    const value = (element.textContent ?? '').trim();
    return value === expected && !value.includes('•');
  }, created.secreto);
  expect(secretMatches).toBeTruthy();

  const today = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const todayText = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const audit = page.getByTestId('audit-trail');
  await expect(audit).toContainText(todayText);
  await expect(audit).toContainText(operatorName);
  await expect(audit).toContainText('Cotización');

  await page.getByRole('button', { name: 'Ir al detalle del socio' }).click();
  await expect(page.getByTestId('partner-created')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: partnerName })).toBeVisible();
  await expect(page.getByText(`client_id: ${created.client_id}`)).toBeVisible();
  await expect(page.getByText(identifier)).toBeVisible();
  await expect(page.getByText(/credencial: Activa/)).toBeVisible();

  const listPromise = page.waitForResponse((listResponse) => {
    const url = new URL(listResponse.url());
    return url.pathname === '/web/socios' && listResponse.request().method() === 'GET';
  });
  await page.reload();
  const listResponse = await listPromise;
  expect(listResponse.ok()).toBeTruthy();
  const partners = (await listResponse.json()) as ListedPartner[];
  const saved = partners.find((partner) => partner.identificador === identifier);
  expect(saved?.client_id).toBe(created.client_id);
  expect(saved?.estado_contrato).toBe('Activo');
  expect(saved?.estado_credencial).toBe('Activa');
  expect(saved?.alcances).toContain('cotizacion');
  expect(saved?.nombre).toBe(partnerName);

  const row = page.getByRole('row').filter({ hasText: identifier });
  await expect(row).toBeVisible();
  await expect(row).toContainText(partnerName);
  await expect(row).toContainText('Activo');
  await expect(row).toContainText('Cotización');
  await row.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.getByRole('heading', { level: 2, name: partnerName })).toBeVisible();
  await expect(page.getByText(`client_id: ${created.client_id}`)).toBeVisible();
});
