export function formatDate(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1); // Months are 0-indexed
  const year = date.getFullYear();
  const hours = pad(date.getHours());    // (date.getHours() % 12 || 12) for 12-hour format
  const minutes = pad(date.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

const displayOccurredAtPattern = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})$/;

export function displayOccurredAt(value: string): string {
  const match = displayOccurredAtPattern.exec(value);
  if (!match) {
    return value;
  }

  return `${match[3]}-${match[2]}-${match[1]} ${match[4]}`;
}

export function toIsoOccurredAt(value: string): string {
  return `${displayOccurredAt(value).replace(' ', 'T')}:00`;
}

const occurredAtPattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

export function formatOccurredAt(value: string): string {
  const match = occurredAtPattern.exec(value);
  if (!match) {
    return value;
  }

  return `${match[1]} ${match[2]}`;
}

export function formatClock(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
