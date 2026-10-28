const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectDir = __dirname;
const propertiesPath = path.join(projectDir, 'properties.json');
const flowPath = 'flows/e001-compra-poliza.yaml';

const DESTINOS = ['Estados Unidos', 'España', 'México', 'Otro país'];

const defaults = {
  APP_ID: 'com.solventa',
  PRODUCT_ID: 'viaje-internacional',
  QUOTE_NOMBRE: 'Maria Rodriguez',
  QUOTE_CEDULA: '1020304050',
  QUOTE_DESTINO: 'España',
  QUOTE_VIAJEROS: '1',
  QUOTE_SALIDA_OFFSET_DAYS: '0',
  QUOTE_REGRESO_OFFSET_DAYS: '14',
};

function readProperties() {
  if (!fs.existsSync(propertiesPath)) {
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`apps/mobile-e2e/properties.json no es JSON válido: ${message}`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('apps/mobile-e2e/properties.json debe ser un objeto JSON.');
  }

  return parsed;
}

function configured(key, properties) {
  const fromEnv = process.env[key];
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }

  const fromFile = properties[key];
  if (typeof fromFile === 'string' && fromFile.trim() !== '') {
    return fromFile.trim();
  }

  return Object.prototype.hasOwnProperty.call(defaults, key) ? defaults[key] : '';
}

function required(key, properties) {
  const value = configured(key, properties);
  if (value === '') {
    throw new Error(`Falta ${key}. Defínela en el entorno o en apps/mobile-e2e/properties.json.`);
  }
  if (/[\r\n]/.test(value)) {
    throw new Error(`${key} no puede contener saltos de línea.`);
  }
  return value;
}

function requireOffset(key, properties) {
  const value = required(key, properties);
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${key} debe ser un entero mayor o igual a 0.`);
  }
  return Number(value);
}

function requireDigits(key, properties, minimum) {
  const value = required(key, properties);
  if (!/^[0-9]+$/.test(value) || Number(value) < minimum) {
    throw new Error(`${key} debe ser un entero mayor o igual a ${minimum}.`);
  }
  if (value.length > 100) {
    throw new Error(`${key} supera 100 caracteres.`);
  }
  return value;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function quoteTargets(today, salidaOffset, regresoOffset) {
  const salida = addDays(today, salidaOffset);
  const regreso = addDays(today, regresoOffset);
  const dayId = (date) => `date-day-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const monthIndex = (date) => date.getFullYear() * 12 + date.getMonth();

  return {
    QUOTE_SALIDA_DAY_ID: dayId(salida),
    QUOTE_SALIDA_INDEX: String(monthIndex(salida)),
    QUOTE_REGRESO_DAY_ID: dayId(regreso),
    QUOTE_REGRESO_INDEX: String(monthIndex(regreso)),
  };
}

function flowEnv(properties, today) {
  const salidaOffset = requireOffset('QUOTE_SALIDA_OFFSET_DAYS', properties);
  const regresoOffset = requireOffset('QUOTE_REGRESO_OFFSET_DAYS', properties);
  if (regresoOffset <= salidaOffset) {
    throw new Error('QUOTE_REGRESO_OFFSET_DAYS debe ser posterior a QUOTE_SALIDA_OFFSET_DAYS.');
  }

  const destino = required('QUOTE_DESTINO', properties);
  if (!DESTINOS.includes(destino)) {
    throw new Error(`QUOTE_DESTINO debe ser uno de: ${DESTINOS.join(', ')}.`);
  }

  const nombre = required('QUOTE_NOMBRE', properties);
  if (nombre.length > 100) {
    throw new Error('QUOTE_NOMBRE supera 100 caracteres.');
  }

  return {
    APP_ID: required('APP_ID', properties),
    E2E_EMAIL: required('E2E_EMAIL', properties),
    E2E_PASSWORD: required('E2E_PASSWORD', properties),
    PRODUCT_ID: required('PRODUCT_ID', properties),
    QUOTE_NOMBRE: nombre,
    QUOTE_CEDULA: requireDigits('QUOTE_CEDULA', properties, 0),
    QUOTE_DESTINO: destino,
    QUOTE_VIAJEROS: requireDigits('QUOTE_VIAJEROS', properties, 1),
    ...quoteTargets(today, salidaOffset, regresoOffset),
  };
}

function quoteCmdArg(arg) {
  const escaped = String(arg).replace(/%/g, '%%');
  if (escaped.length === 0) {
    return '""';
  }
  if (!/[\s"&|<>^]/.test(escaped)) {
    return escaped;
  }
  return `"${escaped.replace(/"/g, '""')}"`;
}

function assertMaestroOnPath() {
  const probe =
    process.platform === 'win32'
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'where maestro'], { windowsVerbatimArguments: true })
      : spawnSync('which', ['maestro']);

  if (probe.error || probe.status !== 0) {
    throw new Error('No se encontró maestro en PATH. Instala la CLI de Maestro y vuelve a lanzar el comando.');
  }
}

function runMaestro(args) {
  if (process.platform !== 'win32') {
    return spawnSync('maestro', args, {
      cwd: projectDir,
      stdio: 'inherit',
    });
  }

  const commandLine = ['maestro', ...args.map(quoteCmdArg)].join(' ');
  return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], {
    cwd: projectDir,
    stdio: 'inherit',
    windowsVerbatimArguments: true,
  });
}

function maestroArgs(deviceId, env) {
  const args = ['--platform=android'];
  if (deviceId) {
    args.push(`--device=${deviceId}`);
  }
  args.push('test', flowPath);
  for (const [key, value] of Object.entries(env)) {
    args.push(`--env=${key}=${value}`);
  }
  return args;
}

function main() {
  const properties = readProperties();
  const deviceId = configured('MAESTRO_DEVICE_ID', properties);
  const env = flowEnv(properties, new Date());
  const args = maestroArgs(deviceId, env);

  console.log(deviceId ? `Maestro Android en ${deviceId}.` : 'Maestro Android en el dispositivo por defecto.');
  assertMaestroOnPath();

  const result = runMaestro(args);
  if (result.error) {
    throw new Error(`No se pudo ejecutar Maestro (${result.error.message}).`);
  }
  if (result.signal) {
    throw new Error(`Maestro terminó por la señal ${result.signal}.`);
  }

  process.exit(result.status === 0 ? 0 : result.status ?? 1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  flowEnv,
  maestroArgs,
  quoteTargets,
};
