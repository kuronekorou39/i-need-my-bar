// 仮の同梱曲を作る：サイン波の音階だけの、仮だとわかる単純な音。
// オーナーの曲が入ったら、public/music/placeholder-*.wav とこのスクリプトは消す。
// 使い方：npm run make:placeholder
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 11025;
const NOTE_SECONDS = 0.75;
const AMPLITUDE = 0.2;
const FADE_SECONDS = 0.05;

// 音階（Hz）。曲の切り替えを試しやすいよう、12 秒で終わる長さにしている
const TRACKS = {
  'placeholder-01.wav': [262, 330, 392, 523, 392, 330, 262, 330, 392, 523, 392, 330, 262, 330, 392, 262],
  'placeholder-02.wav': [220, 262, 330, 440, 330, 262, 220, 262, 330, 440, 330, 262, 220, 262, 330, 220],
};

function renderWav(notes) {
  const perNote = Math.round(SAMPLE_RATE * NOTE_SECONDS);
  const fade = Math.round(SAMPLE_RATE * FADE_SECONDS);
  const samples = new Int16Array(perNote * notes.length);
  notes.forEach((hz, n) => {
    for (let i = 0; i < perNote; i++) {
      const envelope = Math.min(1, i / fade, (perNote - i) / fade);
      const value = Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE) * AMPLITUDE * envelope;
      samples[n * perNote + i] = Math.round(value * 0x7fff);
    }
  });

  // 16bit モノラル PCM の WAV ヘッダー
  const header = Buffer.alloc(44);
  const dataBytes = samples.byteLength;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataBytes, 40);
  return Buffer.concat([header, Buffer.from(samples.buffer)]);
}

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'music');
await mkdir(outDir, { recursive: true });
for (const [name, notes] of Object.entries(TRACKS)) {
  await writeFile(path.join(outDir, name), renderWav(notes));
  console.log(`public/music/${name}`);
}
