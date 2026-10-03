export function formatDate(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1); // Months are 0-indexed
  const year = date.getFullYear();
  const hours = pad(date.getHours());    // (date.getHours() % 12 || 12) for 12-hour format
  const minutes = pad(date.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
