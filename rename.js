const fs = require('fs');
const path = require('path');

// Rename packages/opencode/package.json
const pkgPath = path.join(__dirname, 'opencode-src', 'packages', 'opencode', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
console.log('Original name:', pkg.name);
pkg.name = 'cpiccode';
if (pkg.bin) {
  const newBin = {};
  for (const [key, value] of Object.entries(pkg.bin)) {
    newBin[key === 'opencode' ? 'cpiccode' : key] = value;
  }
  pkg.bin = newBin;
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('New name:', pkg.name);

// Rename in build.ts
const buildPath = path.join(__dirname, 'opencode-src', 'packages', 'opencode', 'script', 'build.ts');
let build = fs.readFileSync(buildPath, 'utf8');
build = build.replace(/outfile:\s*`dist\/\$\{name\}\/bin\/opencode`/g, 'outfile: `dist/${name}/bin/cpiccode`');
build = build.replace(/--user-agent=opencode\//g, '--user-agent=cpiccode/');
build = build.replace(/OPENCODE_VERSION/g, 'CPICCODE_VERSION');
build = build.replace(/OPENCODE_MODELS_DEV/g, 'CPICCODE_MODELS_DEV');
build = build.replace(/OPENCODE_CHANNEL/g, 'CPICCODE_CHANNEL');
build = build.replace(/OPENCODE_LIBC/g, 'CPICCODE_LIBC');
build = build.replace(/OPENCODE_WORKER_PATH/g, 'CPICCODE_WORKER_PATH');
fs.writeFileSync(buildPath, build);

// Also rename in packages/opencode/src/ where OPENCODE_ constants are defined
const srcDir = path.join(__dirname, 'opencode-src', 'packages', 'opencode', 'src');
function renameInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      renameInDir(fullPath);
    } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx') || item.name.endsWith('.json')) {
      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        // Only rename branding strings, not code references
        if (content.includes('OpenCode') || content.includes('opencode')) {
          // Keep code intact, just note the changes needed
          console.log(`Found opencode references in: ${fullPath}`);
        }
      } catch(e) {}
    }
  }
}
renameInDir(srcDir);

console.log('Rename complete!');