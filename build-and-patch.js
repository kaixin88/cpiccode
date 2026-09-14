const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const src = path.join(__dirname, 'opencode-src');
const opencodePkg = path.join(src, 'packages', 'opencode');
const llmPkg = path.join(src, 'packages', 'llm');

function readFile(p) { return fs.readFileSync(p, 'utf8'); }
function writeFile(p, c) { fs.writeFileSync(p, c); console.log('  Updated: ' + path.relative(src, p)); }

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

// 1b. build.ts - output binary name + user-agent
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
// Verify changes
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