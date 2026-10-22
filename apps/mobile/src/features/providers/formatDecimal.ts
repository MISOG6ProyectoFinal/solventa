// One decimal with a comma, as shown to people: 2.4 -> "2,4".
export function formatDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}
