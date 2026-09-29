import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error(`Missing ${name}`);
  }
  return process.argv[index + 1];
}

function argumentsFor(name) {
  return process.argv.flatMap((value, index) =>
    value === name && process.argv[index + 1] ? [process.argv[index + 1]] : [],
  );
}

const base = argument('--base');
const lcovPaths = argumentsFor('--lcov');
if (lcovPaths.length === 0) throw new Error('Missing --lcov');
const sourcePrefix = argument('--source-prefix').replaceAll('\\', '/').replace(/\/$/, '');

const coverage = new Map();
for (const lcovPath of lcovPaths) {
  let currentFile;
  for (const line of readFileSync(lcovPath, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      const relative = line.slice(3).replaceAll('\\', '/').replace(/^\.\//, '');
      currentFile = `${sourcePrefix}/${relative}`;
      if (!coverage.has(currentFile)) coverage.set(currentFile, new Map());
    } else if (currentFile && line.startsWith('DA:')) {
      const [lineNumber, hits] = line.slice(3).split(',').map(Number);
      const previous = coverage.get(currentFile).get(lineNumber) ?? 0;
      coverage.get(currentFile).set(lineNumber, previous + hits);
    }
  }
}

const diff = execFileSync(
  'git',
  ['diff', '--unified=0', '--no-color', base, '--', sourcePrefix],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

const untrackedFiles = execFileSync(
  'git',
  ['ls-files', '--others', '--exclude-standard', '--', sourcePrefix],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
  .split(/\r?\n/)
  .map((file) => file.replaceAll('\\', '/'))
  .filter(Boolean);

const changedLines = new Map();
let currentPath;
let newLine = 0;
for (const line of diff.split(/\r?\n/)) {
  if (line.startsWith('+++ b/')) {
    currentPath = line.slice(6).replaceAll('\\', '/');
    if (currentPath !== '/dev/null' && !changedLines.has(currentPath)) {
      changedLines.set(currentPath, new Set());
    }
    continue;
  }
  const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (hunk) {
    newLine = Number(hunk[1]);
    continue;
  }
  if (!currentPath || line.startsWith('diff --git')) continue;
  if (line.startsWith('+') && !line.startsWith('+++')) {
    changedLines.get(currentPath)?.add(newLine);
    newLine += 1;
  } else if (!line.startsWith('-')) {
    newLine += 1;
  }
}

for (const file of untrackedFiles) {
  if (!existsSync(file)) continue;
  const lineCount = readFileSync(file, 'utf8').split(/\r?\n/).length;
  changedLines.set(file, new Set(Array.from({ length: lineCount }, (_, index) => index + 1)));
}

let covered = 0;
let executable = 0;
const uncovered = [];
const missingCoverage = [];
let productionFiles = 0;
for (const [file, lines] of changedLines) {
  if (
    !file.startsWith(`${sourcePrefix}/src/`) ||
    /(?:^|\/)coverage(?:-[^/]+)?\//.test(file) ||
    /(?:^|\/)(__tests__|test-utils)\//.test(file) ||
    /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file) ||
    /\/test-setup\.[cm]?[jt]sx?$/.test(file) ||
    /\.d\.[cm]?ts$/.test(file) ||
    !/\.[cm]?[jt]sx?$/.test(file)
  ) {
    continue;
  }
  productionFiles += 1;
  const fileCoverage = coverage.get(file);
  if (!fileCoverage) {
    missingCoverage.push(file);
    continue;
  }
  for (const lineNumber of lines) {
    if (!fileCoverage.has(lineNumber)) continue;
    executable += 1;
    if (fileCoverage.get(lineNumber) > 0) covered += 1;
    else uncovered.push(`${file}:${lineNumber}`);
  }
}

const percent = executable === 0 ? 0 : (covered / executable) * 100;
console.log(
  JSON.stringify(
    {
      base,
      lcov: lcovPaths.map((lcovPath) => path.normalize(lcovPath)),
      covered,
      executable,
      percent: Number(percent.toFixed(2)),
      uncovered,
      productionFiles,
      missingCoverage,
    },
    null,
    2,
  ),
);
process.exitCode = percent >= 90 && missingCoverage.length === 0 ? 0 : 1;
