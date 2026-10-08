const sizeUnits = ['B', 'KB', 'MB'] as const;

export function photoUri(filePath: string) {
  if (filePath.startsWith('file://')) {
    return filePath;
  }

  return `file://${filePath}`;
}

export function formatFileSize(bytes: number) {
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < sizeUnits.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(value)} ${sizeUnits[unitIndex]}`;
  }

  const rounded = Math.round(value * 10) / 10;
  const digits = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);

  return `${digits.replace('.', ',')} ${sizeUnits[unitIndex]}`;
}
