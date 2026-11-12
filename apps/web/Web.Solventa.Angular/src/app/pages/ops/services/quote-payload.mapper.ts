import { ProductContract } from '../interfaces/product-contract.interface';
import { isNumeric, toSnakeCase } from '../utils/contract-fields';

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
