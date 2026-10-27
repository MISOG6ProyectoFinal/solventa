/** yyyy-MM-dd, o el inicio de un ISO, sin reinterpretar la zona. */
export function policyDate(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? value;
}
