const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'opencode-src');
const opencodePkg = path.join(src, 'packages', 'opencode');
const llmPkg = path.join(src, 'packages', 'llm');

function readFile(p) { return fs.readFileSync(p, 'utf8'); }
function writeFile(p, c) { fs.writeFileSync(p, c); console.log('  Updated: ' + path.relative(src, p)); }

// Recursively find all package.json files
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

// 1a. packages/opencode/package.json - name
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

// 1b. Fix ALL workspace references from "opencode" to "cpiccode"
console.log('\n  Fixing workspace references...');
const allPkgJsons = findPackageJsons(path.join(src, 'packages'));
let fixedCount = 0;
for (const p of allPkgJsons) {
  if (p === pkgJson) continue; // skip the one we already changed
  let content = readFile(p);
  let original = content;
  // Replace workspace references like "opencode": "workspace:*" -> "cpiccode": "workspace:*"
  content = content.replace(/"opencode"\s*:\s*"workspace:\*"/g, '"cpiccode": "workspace:*"');
  // Also replace in dependencies/devDependencies blocks
  content = content.replace(/"opencode":\s*"\*/g, '"cpiccode": "*"');
  if (content !== original) {
    writeFile(p, content);
    fixedCount++;
  }
}
console.log('  Fixed ' + fixedCount + ' workspace reference(s)');

// 1c. Fix root package.json workspace config if exists
const rootPkg = path.join(src, 'package.json');
if (fs.existsSync(rootPkg)) {
  let rootContent = readFile(rootPkg);
  let rootOriginal = rootContent;
  rootContent = rootContent.replace(/"opencode"\s*:\s*"workspace:\*"/g, '"cpiccode": "workspace:*"');
  if (rootContent !== rootOriginal) {
    writeFile(rootPkg, rootContent);
  }
}

// 1d. build.ts - output binary name + user-agent
const buildTs = path.join(opencodePkg, 'script', 'build.ts');
let build = readFile(buildTs);
build = build.replace(/outfile:\s*`dist\/\$\{name\}\/bin\/opencode`/g, 'outfile: `dist/${name}/bin/cpiccode`');
build = build.replace(/--user-agent=opencode\//g, '--user-agent=cpiccode/');
writeFile(buildTs, build);

console.log('\n=== Step 2: Patch timeouts for slow network ===');

// 2a. packages/opencode/src/session/retry.ts - MAX_RETRIES=20, longer delays
const retryTs = path.join(opencodePkg, 'src', 'session', 'retry.ts');
let retry = readFile(retryTs);
retry = retry.replace(/RETRY_MAX_RETRIES\s*=\s*\d+/, 'RETRY_MAX_RETRIES = 20');
retry = retry.replace(/RETRY_INITIAL_DELAY\s*=\s*\d+/, 'RETRY_INITIAL_DELAY = 5000');
retry = retry.replace(/RETRY_MAX_DELAY_NO_HEADERS\s*=\s*\d+/, 'RETRY_MAX_DELAY_NO_HEADERS = 120000');
writeFile(retryTs, retry);

// 2b. packages/opencode/src/provider/provider.ts - header timeout=10min
const providerTs = path.join(opencodePkg, 'src', 'provider', 'provider.ts');
let provider = readFile(providerTs);
provider = provider.replace(/OPENAI_HEADER_TIMEOUT_DEFAULT\s*=\s*\d+/, 'OPENAI_HEADER_TIMEOUT_DEFAULT = 600000');
writeFile(providerTs, provider);

// 2c. packages/llm/src/route/executor.ts - MAX_RETRIES=20, longer delays
const executorTs = path.join(llmPkg, 'src', 'route', 'executor.ts');
let executor = readFile(executorTs);
executor = executor.replace(/MAX_RETRIES\s*=\s*\d+/, 'MAX_RETRIES = 20');
executor = executor.replace(/BASE_DELAY_MS\s*=\s*\d+/, 'BASE_DELAY_MS = 3000');
executor = executor.replace(/MAX_DELAY_MS\s*=\s*\d+/, 'MAX_DELAY_MS = 120000');
writeFile(executorTs, executor);

// 2d. packages/opencode/src/util/effect-http-client.ts - transient retry
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

console.log('\nDone! All patches applied.');