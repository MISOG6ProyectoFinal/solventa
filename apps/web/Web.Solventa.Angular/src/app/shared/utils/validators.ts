/** Validadores puros reutilizables (devuelven `true` si el valor es válido). */
export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
