#!/usr/bin/env node
// frame-stats.mjs — measure a rendered FRAME, so "it looks too dark / it looks like daytime" stops
// being a matter of taste and becomes a number a harness can fail on.
//
// Why this exists: a night scene shipped with every contract green and rendered a bright afternoon.
// Contracts checked the light rig; nobody checked the IMAGE. Mean luminance would have caught it in
// one line. Reading the canvas back in-page does NOT work on a WebGPU context (drawImage of the
// canvas yields transparent black once the frame is presented) — measure the saved PNG instead.
//
//   node frame-stats.mjs shot.png                       # print the stats
//   node frame-stats.mjs shot.png --min 0.08 --max 0.28 # fail (exit 1) outside the band
//   node frame-stats.mjs shot.png --preset night        # the floodlit-match band
//   node frame-stats.mjs a.png b.png                    # compare several frames
//
// Zero dependencies: PNG is inflate + one of five per-row filters, and node ships zlib.
import { readFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const PRESETS = {           // measured bands, not invented ones — see reference/46
  night: [0.05, 0.30],      // floodlit match: bright pitch, dark stands, black sky
  day: [0.30, 0.70],        // open daylight
  interior: [0.08, 0.45],
};

/** Decode an 8-bit non-interlaced PNG to {w, h, ch, data}. That is what every screenshot tool emits. */
export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('pas un PNG');
  let pos = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; color = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8) throw new Error(`profondeur ${depth} bits non gérée (8 attendus)`);
  if (interlace) throw new Error('PNG entrelacé non géré');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[color];
  if (!ch) throw new Error(`type de couleur ${color} non géré`);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++], row = y * stride, prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[p + x];
      const a = x >= ch ? out[row + x - ch] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= ch && y > 0 ? out[prev + x - ch] : 0;
      let d;
      if (f === 0) d = v;
      else if (f === 1) d = v + a;
      else if (f === 2) d = v + b;
      else if (f === 3) d = v + ((a + b) >> 1);
      else {                                             // Paeth
        const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        d = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      out[row + x] = d & 255;
    }
    p += stride;
  }
  return { w, h, ch, data: out };
}

/** Rec.709 luminance of every pixel, plus the shape of the distribution (a night frame is not just
 *  darker on average — it is a bright small area inside a dark one, which the percentiles show). */
export function frameStats(png) {
  const { w, h, ch, data } = png, n = w * h, lum = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const o = i * ch;
    const l = ch >= 3 ? (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255 : data[o] / 255;
    lum[i] = l; sum += l;
  }
  const sorted = Float32Array.from(lum).sort();
  const q = (t) => sorted[Math.min(n - 1, Math.floor(t * n))];
  const mean = sum / n;
  let dark = 0, blown = 0;
  for (let i = 0; i < n; i++) { if (lum[i] < 0.02) dark++; if (lum[i] > 0.98) blown++; }
  return {
    w, h, mean: +mean.toFixed(3), median: +q(0.5).toFixed(3),
    p05: +q(0.05).toFixed(3), p95: +q(0.95).toFixed(3),
    contrast: +(q(0.95) - q(0.05)).toFixed(3),
    darkPct: +(100 * dark / n).toFixed(1), blownPct: +(100 * blown / n).toFixed(1),
  };
}

// ---- self-test: encode a PNG we know the answer to, decode it back, compare. This exists because a
// hand-rolled PNG reader is only ever wrong in one place — the per-row filters — and a wrong unfilter
// does not crash, it just returns plausible garbage, which is the worst possible failure for a tool
// whose entire job is to be trusted about a number.
function selfTest() {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  /** Encode w×h RGBA with a chosen per-row filter, so every filter branch gets exercised. */
  const encode = (w, h, px, filter) => {
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
    const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
    for (let y = 0; y < h; y++) {
      raw[y * (stride + 1)] = filter;
      for (let x = 0; x < stride; x++) {
        const v = px[y * stride + x];
        const a = x >= 4 ? px[y * stride + x - 4] : 0;
        const b = y > 0 ? px[(y - 1) * stride + x] : 0;
        const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
        let d;
        if (filter === 0) d = v;
        else if (filter === 1) d = v - a;
        else if (filter === 2) d = v - b;
        else if (filter === 3) d = v - ((a + b) >> 1);
        else { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); d = v - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
        raw[y * (stride + 1) + 1 + x] = d & 255;
      }
    }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  };
  let pass = 0, fail = 0;
  const ok = (n, c, i = '') => { (c ? pass++ : fail++); console.log(`${c ? '✓' : '✗'} ${n}${i ? ' — ' + i : ''}`); };
  const W = 32, H = 16, stride = W * 4, px = Buffer.alloc(H * stride);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {          // a left-to-right ramp: mean = 0.5 by construction
    const o = y * stride + x * 4, v = Math.round((x / (W - 1)) * 255);
    px[o] = px[o + 1] = px[o + 2] = v; px[o + 3] = 255;
  }
  for (const f of [0, 1, 2, 3, 4]) {
    const s = frameStats(decodePNG(encode(W, H, px, f)));
    ok(`filtre ${f} (${['aucun', 'Sub', 'Up', 'Average', 'Paeth'][f]}) : rampe décodée exactement`, Math.abs(s.mean - 0.5) < 0.01 && s.w === W && s.h === H, `moyenne ${s.mean}`);
  }
  const black = Buffer.alloc(H * stride); for (let i = 3; i < black.length; i += 4) black[i] = 255;
  const sb = frameStats(decodePNG(encode(W, H, black, 4)));
  ok('image noire : moyenne 0, 100 % de noir', sb.mean === 0 && sb.darkPct === 100);
  const white = Buffer.alloc(H * stride, 255);
  const sw = frameStats(decodePNG(encode(W, H, white, 1)));
  ok('image blanche : moyenne 1, 100 % de brûlé', sw.mean === 1 && sw.blownPct === 100);
  const sr = frameStats(decodePNG(encode(W, H, px, 4)));
  ok('percentiles cohérents (p05 < médiane < p95)', sr.p05 < sr.median && sr.median < sr.p95, `${sr.p05} < ${sr.median} < ${sr.p95}`);
  console.log(`\n${pass} ✓ / ${fail} ✗`);
  return fail === 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) process.exit(selfTest() ? 0 : 1);
  const files = args.filter((a) => !a.startsWith('--'));
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i < 0 ? null : args[i + 1]; };
  const preset = opt('preset');
  const band = preset ? PRESETS[preset] : null;
  if (preset && !band) { console.error(`préréglage inconnu: ${preset} (${Object.keys(PRESETS).join(', ')})`); process.exit(2); }
  const min = opt('min') != null ? +opt('min') : band?.[0];
  const max = opt('max') != null ? +opt('max') : band?.[1];
  if (!files.length) { console.error('usage: frame-stats.mjs <shot.png…> [--preset night|day|interior] [--min x] [--max y]'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    const s = frameStats(decodePNG(readFileSync(f)));
    const out = min != null && (s.mean < min || s.mean > max);
    if (out) bad++;
    console.log(`${out ? '✗' : '✓'} ${f}  luminance ${s.mean}  (médiane ${s.median}, p05 ${s.p05}, p95 ${s.p95}, contraste ${s.contrast}, noir ${s.darkPct}%, brûlé ${s.blownPct}%)${out ? `  — hors bande [${min}, ${max}]` : ''}`);
  }
  process.exit(bad ? 1 : 0);
}
