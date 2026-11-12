import { ContractProperty, ProductContract } from '../interfaces/product-contract.interface';
import { QuoteFieldDef, QuoteFieldType } from '../interfaces/quote-field.interface';

const NUMERIC_TYPES = ['integer', 'number'];
const CHANNEL_FIELDS = new Set(['producto_id', 'consentimiento_id', 'consentimiento_open_finance']);

export function isNumeric(property: ContractProperty | undefined): boolean {
  const types = [property?.type, ...(property?.anyOf ?? []).map((option) => option.type)];
  return types.some((type) => type !== undefined && NUMERIC_TYPES.includes(type));
}

export function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function fieldType(property: ContractProperty): QuoteFieldType {
  if (property.enum) return 'select';
  if (property.format === 'date') return 'date';
  return 'text';
}

/** Campos del riesgo tal como los publica Cotización en el contrato del producto, en su orden. */
export function contractFields(
  contract: ProductContract,
  label: (key: string, title: string) => string,
): QuoteFieldDef[] {
  const required = new Set(contract.required ?? []);
  return Object.entries(contract.properties)
    .filter(([name, property]) => !CHANNEL_FIELDS.has(name) && !property.$ref && property.const === undefined)
    .map(([name, property]) => {
      const key = toCamelCase(name);
      return {
        key,
        label: label(key, property.title ?? name),
        type: fieldType(property),
        required: required.has(name),
        numeric: !property.enum && isNumeric(property),
        options: property.enum,
      };
    });
}
