// The domain labels cannot contain dots, so the pattern never backtracks across the same characters twice.
const emailPattern = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(value: string): boolean {
  return emailPattern.test(value);
}
