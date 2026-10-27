const fs = require('fs');
const path = require('path');

const PROPERTIES_PATH = path.join(process.cwd(), 'properties.json');
const DESTINOS = ['Estados Unidos', 'España', 'México', 'Otro país'];

function readProperties() {
  if (!fs.existsSync(PROPERTIES_PATH)) {
    throw new Error(
      'Falta apps/mobile-e2e/properties.json. Copia properties.example.json y completa el usuario E2E local.',
    );
  }

  try {
    return JSON.parse(fs.readFileSync(PROPERTIES_PATH, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`properties.json no es JSON válido: ${message}`);
  }
}

function required(properties, key) {
  const value = properties[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Falta ${key} en properties.json.`);
  }
  return value.trim();
}

function quoteConfig() {
  const properties = readProperties();
  const salida = Number(required(properties, 'QUOTE_SALIDA_OFFSET_DAYS'));
  const regreso = Number(required(properties, 'QUOTE_REGRESO_OFFSET_DAYS'));
  const destino = required(properties, 'QUOTE_DESTINO');
  const viajeros = required(properties, 'QUOTE_VIAJEROS');
  const cedula = required(properties, 'QUOTE_CEDULA');

  if (!Number.isInteger(salida) || salida < 0) {
    throw new Error('QUOTE_SALIDA_OFFSET_DAYS debe ser un entero mayor o igual a 0.');
  }
  if (!Number.isInteger(regreso) || regreso <= salida) {
    throw new Error('QUOTE_REGRESO_OFFSET_DAYS debe ser un entero posterior a la salida.');
  }
  if (!DESTINOS.includes(destino)) {
    throw new Error(`QUOTE_DESTINO debe ser uno de: ${DESTINOS.join(', ')}.`);
  }
  if (!/^\d+$/.test(viajeros) || Number(viajeros) < 1) {
    throw new Error('QUOTE_VIAJEROS debe ser un entero mayor a 0.');
  }
  if (!/^\d+$/.test(cedula)) {
    throw new Error('QUOTE_CEDULA debe contener solo dígitos.');
  }

  return {
    email: required(properties, 'E2E_EMAIL'),
    password: required(properties, 'E2E_PASSWORD'),
    nombre: required(properties, 'QUOTE_NOMBRE'),
    cedula,
    destino,
    viajeros,
    salida,
    regreso,
    productId: required(properties, 'PRODUCT_ID'),
  };
}

function deviceSerial() {
  const fromEnv = process.env.KRAKEN_UDID;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }

  if (!fs.existsSync(PROPERTIES_PATH)) {
    return '';
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(PROPERTIES_PATH, 'utf8'));
    return typeof parsed.KRAKEN_UDID === 'string' ? parsed.KRAKEN_UDID.trim() : '';
  } catch {
    return '';
  }
}

module.exports = {
  quoteConfig,
  deviceSerial,
};
