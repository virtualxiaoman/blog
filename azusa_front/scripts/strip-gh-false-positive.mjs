/**
 * Deploy-time safety net: remove a GitHub push-protection false positive from dist.
 *
 * The transformers.js library embeds GitHub Gist ID `42e32852...` (hollance's
 * Whisper alignment-heads gist) inside a Whisper generation error message. That
 * ID is a 32-hex-character string, the same shape as a Mistral AI API key, so
 * GitHub's secret scanner rejects any push containing it. It is not a secret.
 * This script replaces it with a non-hex placeholder before gh-pages uploads.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const TARGET = '42e32852f24243b748ae6bc1f985b13a';
const REPLACEMENT = 'hollance-whisper-alignment-heads-gist';

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

let cleaned = 0;
for (const file of walk(distDir)) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue; // binary file
  }
  if (content.includes(TARGET)) {
    writeFileSync(file, content.split(TARGET).join(REPLACEMENT));
    cleaned++;
    console.log(`[strip] cleaned ${path.relative(root, file)}`);
  }
}
console.log(cleaned ? `[strip] ${cleaned} file(s) cleaned` : '[strip] nothing to clean');
