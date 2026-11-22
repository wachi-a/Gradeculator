import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const folder = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(folder, { recursive: true });
for (const [source, dest, width] of [
  ['logo-app.svg','icon-192-v2.png',192],
  ['logo-app.svg','icon-512-v2.png',512],
  ['logo-maskable.svg','maskable-512-v2.png',512],
  ['logo-app.svg','apple-touch-icon-v2.png',180],
  ['logo-round.svg','favicon-32-v2.png',32],
  ['logo-round.svg','favicon.png',96]
]) {
  const svg = readFileSync(resolve(folder, source), 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }}).render().asPng();
  writeFileSync(resolve(folder, dest), png);
  console.log(`Built ${dest} (${width}px)`);
}
