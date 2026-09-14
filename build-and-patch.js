const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'opencode-src');
const opencodePkg = path.join(src, 'packages', 'opencode');
const llmPkg = path.join(src, 'packages', 'llm');

function readFile(p) { return fs.readFileSync(p, 'utf8'); }
function writeFile(p, c) { fs.writeFileSync(p, c); console.log('  Updated: ' + path.relative(src, p)); }

function findPackageJsons(dir, results) {
  results = results || [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'node_modules' && item.name !== '.git') {
      findPackageJsons(full, results);
    } else if (item.name === 'package.json') {
      results.push(full);
    }
  }
  return results;
}

console.log('=== Step 1: Rename opencode -> cpiccode ===');

// 1a. packages/opencode/package.json
const pkgJson = path.join(opencodePkg, 'package.json');
const pkg = JSON.parse(readFile(pkgJson));
console.log('  Original name: ' + pkg.name);
pkg.name = 'cpiccode';
if (pkg.bin) {
  const newBin = {};
  for (const [k, v] of Object.entries(pkg.bin)) {
    newBin[k === 'opencode' ? 'cpiccode' : k] = v;
  }
  pkg.bin = newBin;
}
writeFile(pkgJson, JSON.stringify(pkg, null, 2));

// 1b. Fix workspace references
console.log('  Fixing workspace references...');
const allPkgJsons = findPackageJsons(path.join(src, 'packages'));
let fixedCount = 0;
for (const p of allPkgJsons) {
  if (p === pkgJson) continue;
  let content = readFile(p);
  let original = content;
  content = content.replace(/"opencode"\s*:\s*"workspace:\*"/g, '"cpiccode": "workspace:*"');
  content = content.replace(/"opencode":\s*"\*/g, '"cpiccode": "*"');
  if (content !== original) { writeFile(p, content); fixedCount++; }
}
console.log('  Fixed ' + fixedCount + ' workspace reference(s)');

// 1c. build.ts - output name + smoke test path
const buildTs = path.join(opencodePkg, 'script', 'build.ts');
let build = readFile(buildTs);
build = build.replace(/outfile:\s*`dist\/\$\{name\}\/bin\/opencode`/g, 'outfile: `dist/${name}/bin/cpiccode`');
build = build.replace(/--user-agent=opencode\//g, '--user-agent=cpiccode/');
// Also fix the smoke test path that references opencode
build = build.replace(/const binaryPath = `dist\/\$\{name\}\/bin\/opencode`/g, 'const binaryPath = `dist/${name}/bin/cpiccode`');
writeFile(buildTs, build);

console.log('\n=== Step 2: Patch timeouts for slow network ===');

const retryTs = path.join(opencodePkg, 'src', 'session', 'retry.ts');
let retry = readFile(retryTs);
retry = retry.replace(/RETRY_MAX_RETRIES\s*=\s*\d+/, 'RETRY_MAX_RETRIES = 20');
retry = retry.replace(/RETRY_INITIAL_DELAY\s*=\s*\d+/, 'RETRY_INITIAL_DELAY = 5000');
retry = retry.replace(/RETRY_MAX_DELAY_NO_HEADERS\s*=\s*\d+/, 'RETRY_MAX_DELAY_NO_HEADERS = 120000');
writeFile(retryTs, retry);

const providerTs = path.join(opencodePkg, 'src', 'provider', 'provider.ts');
let provider = readFile(providerTs);
provider = provider.replace(/OPENAI_HEADER_TIMEOUT_DEFAULT\s*=\s*\d+/, 'OPENAI_HEADER_TIMEOUT_DEFAULT = 600000');
writeFile(providerTs, provider);

const executorTs = path.join(llmPkg, 'src', 'route', 'executor.ts');
let executor = readFile(executorTs);
executor = executor.replace(/MAX_RETRIES\s*=\s*\d+/, 'MAX_RETRIES = 20');
executor = executor.replace(/BASE_DELAY_MS\s*=\s*\d+/, 'BASE_DELAY_MS = 3000');
executor = executor.replace(/MAX_DELAY_MS\s*=\s*\d+/, 'MAX_DELAY_MS = 120000');
writeFile(executorTs, executor);

const httpClientTs = path.join(opencodePkg, 'src', 'util', 'effect-http-client.ts');
if (fs.existsSync(httpClientTs)) {
  let httpClient = readFile(httpClientTs);
  httpClient = httpClient.replace(/times:\s*\d+/, 'times: 20');
  writeFile(httpClientTs, httpClient);
} else {
  console.log('  effect-http-client.ts not found, skipping');
}

console.log('\n=== Verification ===');
const verifyFiles = [
  [retryTs, 'RETRY_MAX_RETRIES'],
  [providerTs, 'OPENAI_HEADER_TIMEOUT_DEFAULT'],
  [executorTs, 'MAX_RETRIES'],
  [buildTs, 'cpiccode'],
  [pkgJson, 'cpiccode'],
];
for (const [f, pattern] of verifyFiles) {
  const content = readFile(f);
  const lines = content.split('\n').filter(l => l.includes(pattern));
  console.log('  ' + path.relative(src, f) + ': ' + lines.join(' | '));
}

console.log('\nDone!');