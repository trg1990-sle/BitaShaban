#!/usr/bin/env node
// Regenerates images from assets/image-prompts.md with Codex CLI's $imagegen skill.
//
//   node scripts/generate-images.mjs ink-insomnia ink-iron-gall
//   node scripts/generate-images.mjs --all
//
// Env: CODEX_MODEL (default gpt-6-astra), CONCURRENCY (default 3).

import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const promptsFile = path.join(root, 'assets', 'image-prompts.md');
const outDir = 'assets/source';
const model = process.env.CODEX_MODEL || 'gpt-6-astra';
const concurrency = Number(process.env.CONCURRENCY || 3);

// On Windows the global `codex` is a .cmd shim that spawn() can't run without a shell,
// so call its JS entry with node directly. Override with CODEX_JS if it lives elsewhere.
function codexCommand() {
  const js =
    process.env.CODEX_JS ||
    (process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
  return js && existsSync(js) ? [process.execPath, [js]] : ['codex', []];
}

function parsePrompts(markdown) {
  const style = markdown.match(/```style\n([\s\S]*?)```/)?.[1].trim() ?? '';
  const images = new Map();
  const re = /^## ([\w-]+)\.png \((\d+)x(\d+)\)\s*\n+```prompt\n([\s\S]*?)```/gm;
  for (const [, name, w, h, prompt] of markdown.matchAll(re)) {
    images.set(name, {
      name,
      size: `${w}x${h}`,
      prompt: prompt.trim().replaceAll('{{INK_STUDY}}', style),
    });
  }
  return images;
}

function run(image) {
  const instruction =
    `${image.prompt} $imagegen Save the final image as ./${outDir}/${image.name}.png, ` +
    `${image.size}, PNG. Do not modify any other file.`;
  const [bin, pre] = codexCommand();
  const args = [...pre, 'exec', '-m', model, '--skip-git-repo-check', '-s', 'workspace-write', '-C', root, instruction];
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    child.on('close', (code) => {
      const ok = code === 0 && !/ERROR:/.test(log);
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${image.name}.png${ok ? '' : `\n${log.slice(-800)}`}`);
      resolve(ok);
    });
  });
}

const md = await readFile(promptsFile, 'utf8');
const all = parsePrompts(md);
const argv = process.argv.slice(2);
const names = argv.includes('--all') ? [...all.keys()] : argv;

if (!names.length) {
  console.log(`Usage: node scripts/generate-images.mjs <name ...> | --all\nAvailable: ${[...all.keys()].join(', ')}`);
  process.exit(1);
}
const unknown = names.filter((n) => !all.has(n));
if (unknown.length) {
  console.error(`Unknown image(s): ${unknown.join(', ')}`);
  process.exit(1);
}

await mkdir(path.join(root, outDir), { recursive: true });
const queue = names.map((n) => all.get(n));
let failed = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) if (!(await run(queue.shift()))) failed++;
  }),
);
process.exit(failed ? 1 : 0);
