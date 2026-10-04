// ベース画像の変換：assets/source/<scene>/base.png → public/scenes/<scene>/base.webp
// 使い方：npm run convert:base -- <scene>
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// シーンの論理解像度（docs/plan.md の「シーンの定義」）
const WIDTH = 2560;
const HEIGHT = 1440;
const WEBP_QUALITY = 82;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scene = process.argv[2];
if (!scene) {
  console.error('シーン名を指定してください（例：npm run convert:base -- cafe-window）');
  process.exit(1);
}

const input = path.join(root, 'assets', 'source', scene, 'base.png');
const outDir = path.join(root, 'public', 'scenes', scene);
const output = path.join(outDir, 'base.webp');

const meta = await sharp(input).metadata();
if (meta.width < WIDTH || meta.height < HEIGHT) {
  console.warn(`原本が ${WIDTH}×${HEIGHT} より小さいため、拡大されます（${meta.width}×${meta.height}）`);
}

await mkdir(outDir, { recursive: true });
// 16:9 でない原本は、中央を基準に切り落としてそろえる
await sharp(input)
  .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
  .webp({ quality: WEBP_QUALITY })
  .toFile(output);

const { size } = await stat(output);
console.log(`${path.relative(root, output)}（${meta.width}×${meta.height} → ${WIDTH}×${HEIGHT}、${Math.round(size / 1024)} KB）`);
