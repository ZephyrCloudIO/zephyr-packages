const fs = require('node:fs');
const path = require('node:path');

const [source, destination] = process.argv.slice(2);

if (!source || !destination) {
  throw new Error('Usage: node scripts/copy-file.js <source> <destination>');
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
