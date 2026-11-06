import { ContractProperty, ProductContract } from '../interfaces/product-contract.interface';

const NUMERIC_TYPES = ['integer', 'number'];

function isNumeric(property: ContractProperty | undefined): boolean {
  const types = [property?.type, ...(property?.anyOf ?? []).map((option) => option.type)];
  return types.some((type) => type !== undefined && NUMERIC_TYPES.includes(type));
}

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function mapFormValuesToQuotePayload(
  productId: string,
  values: Record<string, string>,
  contract: ProductContract,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { producto_id: productId };
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (!value) continue;
    const field = toSnakeCase(key);
    payload[field] = isNumeric(contract.properties[field]) ? Number(value) : value;
  }
  return payload;
}
