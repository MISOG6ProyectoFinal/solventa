const fs = require('fs');

const input = fs.readFileSync(0, 'utf8');
const line = input.split(/\r?\n/).find((entry) => entry.trim() !== '') || '';
const value = line.trim().split(/\s+/)[1] || '0';
process.stdout.write(`${value}\n`);
