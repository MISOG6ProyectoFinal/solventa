const fs = require('fs');

const raw = process.argv[2] || '';
const needle = raw.replace(/^['"]+|['"]+$/g, '');
const input = fs.readFileSync(0, 'utf8');
const lines = input.split(/\r?\n/).filter((line) => line.includes(needle));
process.stdout.write(lines.join('\n'));
if (lines.length > 0) {
  process.stdout.write('\n');
}
process.exit(lines.length > 0 ? 0 : 1);
