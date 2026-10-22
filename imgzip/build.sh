#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
site_root="${1:-${project_root}/_site}"

if [[ $# -gt 1 ]]; then
  printf 'Usage: bash build.sh [site-output-directory]\n' >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js 22 or later is required. No npm installation is needed.\n' >&2
  exit 1
fi

node - "$project_root" "$site_root" <<'NODE'
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TextDecoder } = require('node:util');

const projectRoot = path.resolve(process.argv[2]);
const siteRoot = path.resolve(process.argv[3]);
const decoder = new TextDecoder('utf-8', { fatal: true });

function read(relativePath) {
  const bytes = fs.readFileSync(path.join(projectRoot, relativePath));
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) ||
      (bytes[0] === 0xfe && bytes[1] === 0xff)) {
    throw new Error(`${relativePath}: UTF-16 is unsupported; save the file as UTF-8.`);
  }
  try {
    return decoder.decode(bytes);
  } catch {
    throw new Error(`${relativePath}: invalid UTF-8.`);
  }
}

function jsonScript(id, value) {
  const encoded = JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<script id="${id}" type="application/json">${encoded}</script>`;
}

function inlineScript(relativePath) {
  const source = read(relativePath);
  new vm.Script(source, { filename: relativePath });
  if (/<\/script/i.test(source)) {
    throw new Error(`${relativePath}: literal closing script tags must be escaped before embedding.`);
  }
  return `<script>\n${source}\n</script>`;
}

try {
  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error('Node.js 22 or later is required.');
  }

  const vendorFiles = [
    'vendor/crc32.umd.min.js',
    'vendor/md5.umd.min.js',
    'vendor/xxhash64.umd.min.js',
    'vendor/xxhash128.umd.min.js'
  ];
  const workerSource = vendorFiles.map(read).concat(read('src/hash-worker.js')).join('\n;\n');
  new vm.Script(workerSource, { filename: 'embedded-hash-worker.js' });

  const sample = fs.readFileSync(path.join(projectRoot, 'src/sample.png'));
  if (!sample.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('src/sample.png is not a PNG file.');
  }

  const css = read('src/style.css');
  if (/<\/style/i.test(css)) throw new Error('src/style.css contains a closing style tag.');
  const license = read('vendor/LICENSE.hash-wasm');
  const substitutions = new Map([
    ['CSS', `<style>\n${css}\n</style>`],
    ['ENGINE', inlineScript('src/engine.js')],
    ['APP', inlineScript('src/app.js')],
    ['WORKER', jsonScript('hash-worker-source', workerSource)],
    ['SAMPLE', jsonScript('sample-source', `data:image/png;base64,${sample.toString('base64')}`)],
    ['SPEC', jsonScript('spec-source', read('src/spec.md'))]
  ]);

  let html = read('src/index.html');
  for (const [name, replacement] of substitutions) {
    const marker = `<!-- BUILD:${name} -->`;
    if (html.split(marker).length !== 2) {
      throw new Error(`src/index.html must contain exactly one ${marker}.`);
    }
    html = html.replace(marker, () => replacement);
  }
  if (/<!-- BUILD:[A-Z]+ -->/.test(html)) throw new Error('An unresolved build marker remains.');
  if (!/<meta\s+charset=["']?utf-8/i.test(html)) throw new Error('The HTML must declare UTF-8.');

  const attribution = `\n<!--\nhash-wasm 4.12.0 — https://github.com/Daninet/hash-wasm\n${license.replace(/--/g, '- -')}\n-->\n`;
  html += attribution;

  const outputDirectory = path.join(siteRoot, 'zip');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, 'index.html');
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporaryPath, html, 'utf8');
    fs.renameSync(temporaryPath, outputPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
  fs.writeFileSync(path.join(siteRoot, '.nojekyll'), '', 'utf8');
  process.stdout.write(`Built ${outputPath}\n${Buffer.byteLength(html, 'utf8').toLocaleString('en-US')} bytes; self-contained UTF-8 HTML.\n`);
} catch (error) {
  process.stderr.write(`Build failed: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
