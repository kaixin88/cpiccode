const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, 'opencode-src', 'packages', 'opencode', 'dist', 'cpiccode-windows-x64', 'bin');

console.log('Looking for binary in:', binDir);
if (!fs.existsSync(binDir)) {
  console.error('ERROR: Directory not found:', binDir);
  // List what we have
  const distDir = path.join(__dirname, 'opencode-src', 'packages', 'opencode', 'dist');
  if (fs.existsSync(distDir)) {
    console.log('Contents of dist:');
    const walk = (d, indent) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        const stat = fs.statSync(p);
        console.log(indent + (stat.isDirectory() ? 'DIR: ' : 'FILE: ') + f + (stat.isFile() ? ' (' + stat.size + ' bytes)' : ''));
        if (stat.isDirectory()) walk(p, indent + '  ');
      }
    };
    walk(distDir, '');
  }
  process.exit(1);
}

const files = fs.readdirSync(binDir);
console.log('Files in bin:', files);

// Find the binary
let binaryName = files.find(f => f === 'cpiccode.exe') || files.find(f => f === 'cpiccode') || files[0];
console.log('Binary:', binaryName);

const zipDir = path.join(__dirname, 'opencode-src', 'packages', 'opencode', 'dist', 'cpiccode-windows-x64', 'bin');
const outZip = path.join(__dirname, 'opencode-src', 'cpiccode-windows-x64.zip');

// Use PowerShell to create zip (works on Windows)
execSync(`Compress-Archive -Path "${zipDir}\\*" -DestinationPath "${outZip}" -Force`, { stdio: 'inherit' });
console.log('Created:', outZip);
console.log('Size:', fs.statSync(outZip).size, 'bytes');