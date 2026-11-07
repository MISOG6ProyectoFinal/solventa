/** Iniciales (hasta dos) del nombre; si está vacío, la primera letra del respaldo. */
export function initials(name: string, fallback = ''): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 0 ? words.slice(0, 2).map((word) => word[0]).join('') : fallback.trim().slice(0, 1);
  return letters.toUpperCase();
}
