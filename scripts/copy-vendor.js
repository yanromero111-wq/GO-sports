// Copia o Three.js de node_modules para client/vendor (o front-end fica 100% estático).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'three', 'build');
const dst = path.join(root, 'client', 'vendor', 'three');
fs.mkdirSync(dst, { recursive: true });
for (const f of ['three.module.js', 'three.core.js']) {
  const from = path.join(src, f);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dst, f));
}
console.log('[go-sports] three.js copiado para client/vendor/three');
