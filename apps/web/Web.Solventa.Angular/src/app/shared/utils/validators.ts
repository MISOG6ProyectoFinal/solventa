/** Validadores puros reutilizables (devuelven `true` si el valor es válido). */
export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isPhone = (value: string): boolean => /^\+?[0-9\s-]{7,15}$/.test(value.trim());

export const isDocumentId = (value: string): boolean => /^[A-Za-z0-9]{5,15}$/.test(value.trim());

export const isPositiveNumber = (value: number | string): boolean => Number(value) > 0;
