const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'opencode-src');
const binDir = path.join(srcDir, 'packages', 'opencode', 'dist', 'cpiccode-windows-x64', 'bin');
const outDir = path.join(srcDir, 'dist');

console.log('Looking for binary in:', binDir);
if (!fs.existsSync(binDir)) {
  console.error('ERROR: Directory not found:', binDir);
  process.exit(1);
}

const files = fs.readdirSync(binDir);
console.log('Files in bin:', files);

// Find the exe
let binaryName = files.find(f => f === 'cpiccode.exe') || files.find(f => f === 'cpiccode') || files[0];
if (!binaryName) {
  console.error('ERROR: No binary found');
  process.exit(1);
}

// Copy to dist root
fs.mkdirSync(outDir, { recursive: true });
const src = path.join(binDir, binaryName);
const dst = path.join(outDir, 'cpiccode.exe');
fs.copyFileSync(src, dst);
console.log('Copied:', src, '->', dst);
console.log('Size:', fs.statSync(dst).size, 'bytes');