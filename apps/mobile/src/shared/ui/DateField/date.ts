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

export const monthLabels = months.map((month) => `${month[0].toUpperCase()}${month.slice(1)}`);

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

export function monthLayout(year: number, month: number) {
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  return { lead, days, rows: Math.ceil((lead + days) / 7) };
}
