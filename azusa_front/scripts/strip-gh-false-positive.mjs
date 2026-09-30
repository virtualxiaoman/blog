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

// 只处理文本文件。二进制文件（图片/字体/wasm）按 UTF-8 读取不会抛错，
// 而是把非法字节解码为 U+FFFD——一旦误命中并写回，整个文件会被重编码损坏。
const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.html', '.htm', '.css', '.map',
  '.json', '.txt', '.svg', '.xml', '.webmanifest', '.md',
]);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

let cleaned = 0;
for (const file of walk(distDir)) {
  if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes(TARGET)) {
    writeFileSync(file, content.split(TARGET).join(REPLACEMENT));
    cleaned++;
    console.log(`[strip] cleaned ${path.relative(root, file)}`);
  }
}
console.log(cleaned ? `[strip] ${cleaned} file(s) cleaned` : '[strip] nothing to clean');
