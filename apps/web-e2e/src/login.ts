import { expect, type Page } from '@playwright/test';

/** Cuenta de administrador del portal. Sirve para cotizar y para dar de alta socios. */
export function webCredentials(): { email: string; password: string } {
  const email = process.env['WEB_E2E_EMAIL'];
  const password = process.env['WEB_E2E_PASSWORD'];
  if (!email || !password) {
    throw new Error('Defina WEB_E2E_EMAIL y WEB_E2E_PASSWORD antes de ejecutar las pruebas.');
  }
  return { email, password };
}

/** Entra por el formulario real. La sesión queda en el navegador, no se inyecta el token. */
export async function login(page: Page): Promise<void> {
  const { email, password } = webCredentials();
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('web-operator-name')).toBeVisible();
  await expect(page.getByTestId('web-operator-name')).not.toHaveText('');
  await expect(page).toHaveURL(/\/ops(\?.*)?$/);
}
