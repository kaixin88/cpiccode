const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'opencode-src');
const opencodePkg = path.join(src, 'packages', 'opencode');
const desktopPkg = path.join(src, 'packages', 'desktop');
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

// 1b. packages/desktop/package.json
const desktopJson = path.join(desktopPkg, 'package.json');
const desktopPkgData = JSON.parse(readFile(desktopJson));
desktopPkgData.name = '@cpiccode/desktop';
if (desktopPkgData.author && desktopPkgData.author.name === 'OpenCode') {
  desktopPkgData.author.name = 'cpiccode';
}
writeFile(desktopJson, JSON.stringify(desktopPkgData, null, 2));

// 1c. Fix workspace references
console.log('  Fixing workspace references...');
const allPkgJsons = findPackageJsons(path.join(src, 'packages'));
let fixedCount = 0;
for (const p of allPkgJsons) {
  if (p === pkgJson || p === desktopJson) continue;
  let content = readFile(p);
  let original = content;
  content = content.replace(/"opencode"\s*:\s*"workspace:\*"/g, '"cpiccode": "workspace:*"');
  content = content.replace(/"@opencode-ai\/desktop"\s*:\s*"workspace:\*"/g, '"@cpiccode/desktop": "workspace:*"');
  if (content !== original) { writeFile(p, content); fixedCount++; }
}
console.log('  Fixed ' + fixedCount + ' workspace reference(s)');

// 1d. build.ts - CLI binary
const buildTs = path.join(opencodePkg, 'script', 'build.ts');
let build = readFile(buildTs);
build = build.replace(/outfile:\s*`dist\/\$\{name\}\/bin\/opencode`/g, 'outfile: `dist/${name}/bin/cpiccode`');
build = build.replace(/--user-agent=opencode\//g, '--user-agent=cpiccode/');
build = build.replace(/const binaryPath = `dist\/\$\{name\}\/bin\/opencode`/g, 'const binaryPath = `dist/${name}/bin/cpiccode`');
writeFile(buildTs, build);

// 1e. electron-builder.config.ts - Desktop branding
const electronBuilderConfig = path.join(desktopPkg, 'electron-builder.config.ts');
if (fs.existsSync(electronBuilderConfig)) {
  let ebc = readFile(electronBuilderConfig);
  ebc = ebc.replace(/ai\.opencode\.desktop\.dev/g, 'ai.cpiccode.desktop.dev');
  ebc = ebc.replace(/ai\.opencode\.desktop\.beta/g, 'ai.cpiccode.desktop.beta');
  ebc = ebc.replace(/ai\.opencode\.desktop/g, 'ai.cpiccode.desktop');
  ebc = ebc.replace(/"OpenCode Dev"/g, '"cpiccode Dev"');
  ebc = ebc.replace(/"OpenCode Beta"/g, '"cpiccode Beta"');
  ebc = ebc.replace(/productName:\s*"OpenCode"/g, 'productName: "cpiccode"');
  ebc = ebc.replace(/name:\s*"OpenCode"/g, 'name: "cpiccode"');
  ebc = ebc.replace(/schemes:\s*\["opencode"\]/g, 'schemes: ["cpiccode"]');
  ebc = ebc.replace(/opencode-desktop-/g, 'cpiccode-desktop-');
  ebc = ebc.replace(/owner:\s*"anomalyco"/g, 'owner: "kaixin88"');
  ebc = ebc.replace(/repo:\s*"opencode"/g, 'repo: "cpiccode"');
  writeFile(electronBuilderConfig, ebc);
}

// 1f. src/renderer/index.html - Window title
const indexHtml = path.join(desktopPkg, 'src', 'renderer', 'index.html');
if (fs.existsSync(indexHtml)) {
  let html = readFile(indexHtml);
  html = html.replace(/<title>OpenCode<\/title>/g, '<title>cpiccode</title>');
  writeFile(indexHtml, html);
}

// 1g. src/main/index.ts - App name (if hardcoded)
const mainIndex = path.join(desktopPkg, 'src', 'main', 'index.ts');
if (fs.existsSync(mainIndex)) {
  let mainTs = readFile(mainIndex);
  if (mainTs.includes("'OpenCode'") || mainTs.includes('"OpenCode"')) {
    mainTs = mainTs.replace(/['"]OpenCode['"]/g, '"cpiccode"');
    writeFile(mainIndex, mainTs);
  }
}

// 1h. Linux desktop file
const linuxDesktop = path.join(desktopPkg, 'resources', 'linux', 'opencode-desktop.desktop');
if (fs.existsSync(linuxDesktop)) {
  let ld = readFile(linuxDesktop);
  ld = ld.replace(/Name=OpenCode/g, 'Name=cpiccode');
  ld = ld.replace(/opencode-desktop/g, 'cpiccode-desktop');
  writeFile(linuxDesktop, ld);
}

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
}

console.log('\n=== Verification ===');
const verifyFiles = [
  [desktopJson, 'cpiccode'],
  [electronBuilderConfig, 'cpiccode'],
  [indexHtml, 'cpiccode'],
  [retryTs, 'RETRY_MAX_RETRIES'],
  [providerTs, 'OPENAI_HEADER_TIMEOUT_DEFAULT'],
  [executorTs, 'MAX_RETRIES'],
  [buildTs, 'cpiccode'],
];
for (const [f, pattern] of verifyFiles) {
  if (!fs.existsSync(f)) { console.log('  SKIP: ' + path.relative(src, f)); continue; }
  const content = readFile(f);
  const lines = content.split('\n').filter(l => l.includes(pattern));
  console.log('  ' + path.relative(src, f) + ': ' + lines.slice(0,3).join(' | '));
}

console.log('\nDone!');