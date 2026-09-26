// Bake the owner's Atlas OBJ (Blender export: metres, Y up, +Z forward, one
// `o` per part, one material per part) into src/robots/atlas26.bin:
//   u32 headerLength | JSON header | pad to 4 | int16 positions (0.1 mm, x y z)
//   | int8 normals (x y z, padded to 4 per vertex) | uint16 indices per part
// The header lists every part: name, material, vertex range, index range.
// Faces are fan-triangulated; each (v, vn) pair becomes one vertex. The
// studio backdrop (`Studio_Cyc`) is dropped.
//   node scripts/bake-atlas26.mjs <obj> <mtl>
import fs from 'node:fs';

const [objPath, mtlPath] = process.argv.slice(2);
if (!objPath || !mtlPath) { console.error('usage: node scripts/bake-atlas26.mjs <obj> <mtl>'); process.exit(1); }

// materials: diffuse, specular exponent, emission
const mats = {};
let cm = null;
for (const line of fs.readFileSync(mtlPath, 'utf8').split('\n')) {
  const a = line.trim().split(/\s+/);
  if (a[0] === 'newmtl') mats[cm = a[1]] = { kd: [0.8, 0.8, 0.8], ke: [0, 0, 0], ns: 250 };
  else if (cm && a[0] === 'Kd') mats[cm].kd = a.slice(1, 4).map(Number);
  else if (cm && a[0] === 'Ke') mats[cm].ke = a.slice(1, 4).map(Number);
  else if (cm && a[0] === 'Ns') mats[cm].ns = +a[1];
}

const V = [], N = [];
const parts = [];
let cur = null;
for (const line of fs.readFileSync(objPath, 'utf8').split('\n')) {
  if (line.startsWith('v ')) { const a = line.split(/\s+/); V.push(+a[1], +a[2], +a[3]); }
  else if (line.startsWith('vn ')) { const a = line.split(/\s+/); N.push(+a[1], +a[2], +a[3]); }
  else if (line.startsWith('o ')) { cur = { name: line.slice(2).trim(), mat: null, faces: [] }; parts.push(cur); }
  else if (line.startsWith('usemtl ') && cur) cur.mat = line.slice(7).trim();
  else if (line.startsWith('f ') && cur) cur.faces.push(line.slice(2).trim().split(/\s+/).map(t => { const p = t.split('/'); return [+p[0] - 1, p[2] ? +p[2] - 1 : -1]; }));
}

const pos = [], nrm = [], idx = [], header = { mats, parts: [] };
for (const p of parts) {
  if (p.name === 'Studio_Cyc' || !p.faces.length) continue;
  const map = new Map(), v0 = pos.length / 3, i0 = idx.length;
  const vid = ([v, n]) => {
    const key = v * 1e6 + n;
    let i = map.get(key);
    if (i === undefined) {
      i = pos.length / 3 - v0; map.set(key, i);
      pos.push(Math.round(V[v * 3] * 1e4), Math.round(V[v * 3 + 1] * 1e4), Math.round(V[v * 3 + 2] * 1e4));
      const nx = n >= 0 ? N[n * 3] : 0, ny = n >= 0 ? N[n * 3 + 1] : 1, nz = n >= 0 ? N[n * 3 + 2] : 0;
      nrm.push(Math.round(nx * 127), Math.round(ny * 127), Math.round(nz * 127), 0);
    }
    return i;
  };
  for (const f of p.faces) for (let k = 1; k + 1 < f.length; k++) idx.push(vid(f[0]), vid(f[k]), vid(f[k + 1]));
  const vCount = pos.length / 3 - v0;
  if (vCount > 65535) throw new Error(`${p.name}: ${vCount} vertices exceed uint16`);
  header.parts.push({ name: p.name, mat: p.mat, v0, vCount, i0, iCount: idx.length - i0 });
}

const hj = Buffer.from(JSON.stringify(header));
const hpad = (4 - ((4 + hj.length) % 4)) % 4;
const nV = pos.length / 3;
const posBytes = nV * 6, posPad = (4 - (posBytes % 4)) % 4;
const buf = Buffer.alloc(4 + hj.length + hpad + posBytes + posPad + nV * 4 + idx.length * 2);
let o = 0;
buf.writeUInt32LE(hj.length, o); o += 4;
hj.copy(buf, o); o += hj.length + hpad;
for (const v of pos) { buf.writeInt16LE(v, o); o += 2; }
o += posPad;
for (const v of nrm) { buf.writeInt8(v, o); o += 1; }
for (const v of idx) { buf.writeUInt16LE(v, o); o += 2; }
const out = new URL('../src/robots/atlas26.bin', import.meta.url);
fs.writeFileSync(out, buf);
console.log(`${header.parts.length} parts, ${nV} vertices, ${idx.length / 3} triangles, ${(buf.length / 1024).toFixed(0)} KB -> src/robots/atlas26.bin`);
