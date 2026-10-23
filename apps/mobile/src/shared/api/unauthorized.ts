let handler: (() => void) | null = null;

// Lets the session feature react to a rejected token without shared/api depending on it.
export function setUnauthorizedHandler(next: (() => void) | null): void {
  handler = next;
}

export function notifyUnauthorized(): void {
  handler?.();
}
