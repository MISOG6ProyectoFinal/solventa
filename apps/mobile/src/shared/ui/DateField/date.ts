export type DateParts = {
  day: number;
  month: number;
  year: number;
  time?: string;
};

export const months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const monthLabels = months.map(
  (month) => `${month.charAt(0).toUpperCase()}${month.slice(1)}`,
);

export function parseDate(value?: string): DateParts | null {
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?$/);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      time: iso[4],
    };
  }

  const local = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2}))?$/);
  if (local) {
    return {
      day: Number(local[1]),
      month: Number(local[2]),
      year: Number(local[3]),
      time: local[4],
    };
  }

  return null;
}

export function formatDate(parts: DateParts) {
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  const date = `${day}/${month}/${parts.year}`;
  return parts.time ? `${date} ${parts.time}` : date;
}

export function parseTime(value?: string) {
  const match = value?.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function formatTime(parts: { hour: number; minute: number }) {
  const hour = String(parts.hour).padStart(2, '0');
  const minute = String(parts.minute).padStart(2, '0');
  return `${hour}:${minute}`;
}

export const yearsPerPage = 12;

// Leaves the current year near the middle of the page.
export function yearPageStart(year: number) {
  return year - 5;
}

export function monthLayout(year: number, month: number) {
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  return { lead, days, rows: Math.ceil((lead + days) / 7) };
}
