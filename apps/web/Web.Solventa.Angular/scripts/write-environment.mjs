import { writeFileSync } from 'node:fs';

const TARGET = 'src/environments/environment.deploy.ts';

const raw = process.env.API_BASE_URL;
if (!raw) {
  console.error('API_BASE_URL es obligatoria: es la dirección del backend que usará el portal.');
  process.exit(1);
}

let apiBaseUrl;
try {
  const url = new URL(raw);
  apiBaseUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, '');
} catch {
  console.error(`API_BASE_URL no es una URL válida: ${raw}`);
  process.exit(1);
}

const environment = {
  production: true,
  name: process.env.ENVIRONMENT_NAME ?? 'dev',
  apiBaseUrl,
};

writeFileSync(TARGET, `export const environment = ${JSON.stringify(environment, null, 2)};\n`);
console.log(`${TARGET}: apiBaseUrl=${apiBaseUrl}`);
