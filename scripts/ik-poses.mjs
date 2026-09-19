// Solve the robots' TASK WAYPOINTS by numerical IK, offline, from the same
// kinematics the renderer uses (src/robots/index.js).
//
//   node scripts/ik-poses.mjs            # prints joint arrays to paste into RB
//
// Each robot works while the page is settled — the SO-ARM101 moves one cube,
// the Franka stacks three, the URs pack a box, the OP1's arms fold a box —
// and a cube only reads as PICKED UP if the gripper is actually on it. Hand-
// tuning joint angles for that is hopeless; instead the props' positions are
// stated in the robot's own frame (mm, Z up) and the joints that put the tool
// there, pointing the right way, are solved here: damped least squares on a
// numerical Jacobian, position plus a tool-axis direction, from a seed pose
// that picks the elbow-up / elbow-down branch.
//
// The renderer then draws each cube at the TOOL POINT of the waypoint it is
// picked up at / put down at, so contact is exact by construction.

import fs from 'node:fs';
import path from 'node:path';
import { prepare, bodyPlacements, standing, mul } from '../src/robots/index.js';

const load = id => prepare(JSON.parse(fs.readFileSync(path.resolve('src/robots', `${id}.json`), 'utf8')));
const IDENT = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
const xf = (T, p) => [T.m[0] * p[0] + T.m[1] * p[1] + T.m[2] * p[2] + T.t[0], T.m[3] * p[0] + T.m[4] * p[1] + T.m[5] * p[2] + T.t[1], T.m[6] * p[0] + T.m[7] * p[1] + T.m[8] * p[2] + T.t[2]];
const dir = (T, v) => [T.m[0] * v[0] + T.m[1] * v[1] + T.m[2] * v[2], T.m[3] * v[0] + T.m[4] * v[1] + T.m[5] * v[2], T.m[6] * v[0] + T.m[7] * v[1] + T.m[8] * v[2]];
const r3 = x => Math.round(x * 1000) / 1000;

// tool point and tool axis in the robot frame for joints q
function tool(robot, tcp, q) {
  const T = bodyPlacements(robot, IDENT, q)[robot.index.get(tcp.body)];
  return { p: xf(T, tcp.off), z: dir(T, tcp.axis) };
}

// Damped least squares. `dof` = which joint indices move; `target` = { p, z }
// (z optional); `w` weights; iterate until the error is small.
function solve(robot, tcp, seed, dof, target, opts = {}) {
  const q = seed.slice();
  const lim = opts.limits || {};
  const wz = target.z ? (opts.wz ?? 120) : 0;      // mm of position error one unit of axis error is worth
  const err = () => {
    const t = tool(robot, tcp, q);
    const e = [target.p[0] - t.p[0], target.p[1] - t.p[1], target.p[2] - t.p[2]];
    if (target.z) e.push(wz * (target.z[0] - t.z[0]), wz * (target.z[1] - t.z[1]), wz * (target.z[2] - t.z[2]));
    return e;
  };
  for (let it = 0; it < 400; it++) {
    const e = err();
    const n = Math.hypot(...e);
    if (n < 0.5) break;
    // numerical Jacobian, columns = dof
    const J = e.map(() => new Array(dof.length).fill(0));
    const h = 1e-4;
    for (let c = 0; c < dof.length; c++) {
      const j = dof[c]; const q0 = q[j];
      q[j] = q0 + h; const e1 = err(); q[j] = q0;
      for (let r = 0; r < e.length; r++) J[r][c] = -(e1[r] - e[r]) / h;   // d(err)/dq = -d(tool)/dq
    }
    // dq = J^T (J J^T + λI)^-1 e
    const m = e.length;
    const A = Array.from({ length: m }, (_, r) => Array.from({ length: m }, (_, c) => J[r].reduce((s, _, k) => s + J[r][k] * J[c][k], 0) + (r === c ? (opts.lambda ?? 40) : 0)));
    const y = gauss(A, e);
    const step = Math.min(1, 60 / Math.max(1, n));
    for (let c = 0; c < dof.length; c++) {
      let d = 0; for (let r = 0; r < m; r++) d += J[r][c] * y[r];
      // J is d(tool)/dq, so tool(q + dq) ~ tool + J dq = target
      const j = dof[c];
      q[j] = q[j] + d * step * 0.9;
      if (lim[j]) q[j] = Math.max(lim[j][0], Math.min(lim[j][1], q[j]));
    }
  }
  const e = err();
  return { q, err: Math.hypot(e[0], e[1], e[2]), zerr: target.z ? Math.hypot(...e.slice(3)) / wz : 0 };
}
function gauss(A, b) {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = 0; r < n; r++) { if (r === i) continue; const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
const fmt = q => '[' + q.map(x => r3(x)).join(', ') + ']';

/* ── the SO-ARM101: one cube, picked up and put down ─────────────────── */
{
  const R = load('soarm');
  // jaw tip: the fixed jaw's farthest vertex from the gripper origin
  const fixed = R.parts.find(p => p.name === 'wrist_roll_follower_so101_v1');
  let tip = [0, 0, 0], best = 0;
  for (let i = 0; i < fixed.nv; i++) { const d = Math.hypot(fixed.v[i * 3], fixed.v[i * 3 + 1], fixed.v[i * 3 + 2]); if (d > best) { best = d; tip = [fixed.v[i * 3], fixed.v[i * 3 + 1], fixed.v[i * 3 + 2]]; } }
  const L = Math.hypot(...tip);
  // the moving jaw's tip, brought into the gripper frame with the jaw CLOSED
  // on a 30 mm cube (joint 5 = 0.3); the tool point is between the two tips,
  // pulled 12 mm back along the jaw so the cube sits in the fingers, not on
  // their ends
  const mj = R.parts.find(p => p.name === 'moving_jaw_so101_v1');
  let mtip = [0, 0, 0], mbest = 0;
  for (let i = 0; i < mj.nv; i++) { const d = Math.hypot(mj.v[i * 3], mj.v[i * 3 + 1], mj.v[i * 3 + 2]); if (d > mbest) { mbest = d; mtip = [mj.v[i * 3], mj.v[i * 3 + 1], mj.v[i * 3 + 2]]; } }
  const Pq = bodyPlacements(R, IDENT, [0, 0, 0, 0, 0, 0.3]);
  const Tg = Pq[R.index.get('gripper')], Tm = Pq[R.index.get('moving_jaw')];
  const wf = xf(Tg, tip), wm = xf(Tm, mtip);
  const mid = [(wf[0] + wm[0]) / 2, (wf[1] + wm[1]) / 2, (wf[2] + wm[2]) / 2];
  const inv = v => [Tg.m[0] * v[0] + Tg.m[3] * v[1] + Tg.m[6] * v[2], Tg.m[1] * v[0] + Tg.m[4] * v[1] + Tg.m[7] * v[2], Tg.m[2] * v[0] + Tg.m[5] * v[1] + Tg.m[8] * v[2]];
  const midG = inv([mid[0] - Tg.t[0], mid[1] - Tg.t[1], mid[2] - Tg.t[2]]);
  const ax = tip.map(x => x / L);
  const tcp = { body: 'gripper', off: midG.map((x, i) => x - ax[i] * 12), axis: ax };
  console.log('// SO-ARM101 tool: fixed-jaw tip', tip.map(r3), 'moving-jaw tip (gripper frame, closed)', inv([wm[0] - Tg.t[0], wm[1] - Tg.t[1], wm[2] - Tg.t[2]]).map(r3), 'tool', tcp.off.map(r3));
  const home = tool(R, tcp, [0, 0.6, -0.2, 1.15, 0, 0.35]);
  console.log('// SO-ARM101 rest tool point', home.p.map(r3), 'axis', home.z.map(r3));
  // targets: cube on the table plane (z = 0 is the base's underside; the base
  // is ~60 mm tall, and the cube 30 mm, so the tool centre sits at z 15)
  const fwd = home.p.map((x, i) => (i < 2 ? x : 0)); const fL = Math.hypot(fwd[0], fwd[1]); const f = [fwd[0] / fL, fwd[1] / fL];
  const side = [-f[1], f[0]];
  const at = (a, s, z) => [f[0] * a + side[0] * s, f[1] * a + side[1] * s, z];
  const seed = [0, 0.6, -0.2, 1.15, 0, 0.35];
  const dof = [0, 1, 2, 3];
  const down = [0, 0, -1];
  // A and B out at 250 (the arm reaches ~330): closer, at 200, the IK bunched
  // the arm up with the elbow below the shoulder. The shoulder lift is kept
  // positive — upper arm tilted toward the work — for the same reason.
  const A = at(250, -75, 18), B = at(250, 75, 18), liftZ = 95;
  const P = {};
  for (const [name, p] of [['A', A], ['Aup', [A[0], A[1], liftZ]], ['B', B], ['Bup', [B[0], B[1], liftZ]]]) {
    const s = solve(R, tcp, seed, dof, { p, z: down }, { limits: { 0: [-1.9, 1.9], 1: [-0.15, 1.7], 2: [-1.7, 1.7], 3: [-1.7, 1.7] } });
    P[name] = s.q; console.log(`// so ${name.padEnd(4)} err ${r3(s.err)}mm axis ${r3(s.zerr)}  ${fmt(s.q)}`);
  }
  console.log('SO_TCP =', JSON.stringify({ body: 'gripper', off: tcp.off.map(r3), axis: tcp.axis.map(r3) }));
  console.log('SO_P =', JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v.map(r3)]))));
}

/* ── the Franka: three cubes, stacked and unstacked ──────────────────── */
{
  const R = load('fr3');
  const tcp = { body: 'hand', off: [0, 0, 103.4], axis: [0, 0, 1] };
  const home = tool(R, tcp, [0, -0.6, 0, -1.9, 0, 1.3, 0.785]);
  console.log('// Franka rest tool point', home.p.map(r3), 'axis', home.z.map(r3));
  const seed = [0, -0.4, 0, -2.2, 0, 1.9, 0.785];
  const dof = [0, 1, 3, 5];                       // pan, shoulder, elbow, wrist pitch (keep the rolls)
  const down = [0, 0, -1];
  const C = 50;                                    // cube, mm
  // close in (400-500 mm): at 520-660 the work area projected off the stage
  const P1 = [400, -110, C / 2], P2 = [400, 110, C / 2], P3 = [510, 0, C / 2];
  const P = {};
  const targets = { P1: P1, P2: P2, P3: P3, S1: [P1[0], P1[1], C * 1.5], S2: [P1[0], P1[1], C * 2.5], HI: [430, 0, 300] };
  for (const [name, p] of Object.entries(targets)) {
    const s = solve(R, tcp, seed, dof, { p, z: down }, { limits: { 0: [-2.8, 2.8], 1: [-1.7, 1.7], 3: [-3.0, -0.1], 5: [0, 3.7] } });
    P[name] = s.q; console.log(`// fr ${name.padEnd(3)} err ${r3(s.err)}mm axis ${r3(s.zerr)}  ${fmt(s.q)}`);
  }
  console.log('FR_TCP =', JSON.stringify(tcp));
  console.log('FR_P =', JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v.map(r3)]))));
}

/* ── the URs, hanging from Generalist's frame: each packs an item ─────── */
// The arms hang from the crossbar and LEAN toward the viewer (Generalist's
// come down over the table at an angle), so their frames are awkward to
// think in. The props are stated in STAGE coordinates (px; x right, y down,
// z toward the viewer) and brought into each arm's frame here — the same
// construction the renderer uses (`hanging` then a lean about the stage's x).
{
  const R = load('ur5e');
  const tcp = { body: 'wrist3', off: [0, 230, 0], axis: [0, 1, 0] };
  const DEG = Math.PI / 180;
  const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const FRAME_X = 0, BAR_Y = -104, UR_DX = 82, UR_K = 0.22, MOUNT_Z = -46, LEAN = 28, TABLE_Y = 80;
  const leaning = (root, k, yaw, lean) => { const B = standing(root, k, yaw); const M = mul(rotZ(Math.PI), B.m); return { m: mul(rotX(lean * DEG), M), t: root }; };
  const toLocal = (base, p) => {                     // stage -> arm frame (mm)
    const k = UR_K, m = base.m, d = [p[0] - base.t[0], p[1] - base.t[1], p[2] - base.t[2]];
    return [(m[0] * d[0] + m[3] * d[1] + m[6] * d[2]) / (k * k), (m[1] * d[0] + m[4] * d[1] + m[7] * d[2]) / (k * k), (m[2] * d[0] + m[5] * d[1] + m[8] * d[2]) / (k * k)];
  };
  const dirLocal = (base, v) => { const m = base.m, k = UR_K; const o = [(m[0] * v[0] + m[3] * v[1] + m[6] * v[2]) / k, (m[1] * v[0] + m[4] * v[1] + m[7] * v[2]) / k, (m[2] * v[0] + m[5] * v[1] + m[8] * v[2]) / k]; const L = Math.hypot(...o); return o.map(x => x / L); };
  const C = 60 * UR_K;                                  // the item, stage px
  const out = {};
  for (const [name, side, yaw] of [['R', 1, 270], ['L', -1, 90]]) {
    const root = [FRAME_X + side * UR_DX, BAR_Y + 12, MOUNT_Z];
    const base = leaning(root, UR_K, yaw, LEAN);
    const down = dirLocal(base, [0, 1, 0]);
    const item = [FRAME_X + side * 58, TABLE_Y - C / 2, 40], box = [FRAME_X + side * 6, TABLE_Y - 160 * UR_K, 30];
    const T = { ITEM: item, ITEMUP: [item[0], item[1] - 44, item[2]], BOX: box, BOXUP: [box[0], box[1] - 26, box[2]] };
    out[name] = {};
    for (const [k, p] of Object.entries(T)) {
      // the left arm is seeded from the right arm's answer, so both land on
      // the same elbow branch and the pair moves as a mirror
      const seed = name === 'L' ? out.R[k] : [0, -1.4, -2.3, 2.1, 1.57, 0];
      const s = solve(R, tcp, seed, [0, 1, 2, 3], { p: toLocal(base, p), z: down }, { limits: { 1: [-3.1, 0], 2: [-3.1, 3.1], 3: [-3.1, 3.1] } });
      out[name][k] = s.q.map(r3);
      console.log(`// ur ${name} ${k.padEnd(6)} err ${r3(s.err)}mm axis ${r3(s.zerr)}  ${fmt(s.q)}`);
    }
  }
  console.log('UR_LAYOUT =', JSON.stringify({ FRAME_X, BAR_Y, UR_DX, UR_K, MOUNT_Z, LEAN, TABLE_Y }));
  console.log('UR_P =', JSON.stringify(out));
}

/* ── the Fairino: where its flange points at the candidate rest poses ── */
{
  const R = load('ultra');
  for (const [name, q] of [['rest', [0.3, -1.3, 2.2, -2.4, -1.57, 0]], ['r2', [0.3, -1.2, 2.0, -2.35, -1.57, 0]], ['r3', [0.3, -1.4, 2.4, -2.55, -1.57, 0]], ['r4', [0.3, -1.1, 2.3, -2.75, -1.57, 0]]]) {
    const T = bodyPlacements(R, IDENT, q)[R.index.get('wrist3_link')];
    const fl = xf(T, [0, 0, 120]); const n = dir(T, [0, 0, 1]);
    console.log(`// fairino ${name.padEnd(5)} flange ${fl.map(r3)} normal ${n.map(r3)}  (horizontal-ness ${r3(Math.hypot(n[0], n[1]))})`);
  }
}

/* ── the OP1's small arms: my own chain, so its own FK ───────────────── */
// unit frame: x forward (where the ZED looks), y across the shoulders, z UP,
// origin at the torso's bottom centre. Shoulder at (0, side*S_Y, S_Z); the
// upper arm hangs DOWN at pitch 0; pitch swings it forward about y, roll
// swings it outward about x, elbow and wrist about the arm's local y.
{
  const S_Y = 165, S_Z = 300, L1 = 260, L2 = 250, L3 = 120;
  const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const mul = (A, B) => [A[0]*B[0]+A[1]*B[3]+A[2]*B[6], A[0]*B[1]+A[1]*B[4]+A[2]*B[7], A[0]*B[2]+A[1]*B[5]+A[2]*B[8], A[3]*B[0]+A[4]*B[3]+A[5]*B[6], A[3]*B[1]+A[4]*B[4]+A[5]*B[7], A[3]*B[2]+A[4]*B[5]+A[5]*B[8], A[6]*B[0]+A[7]*B[3]+A[8]*B[6], A[6]*B[1]+A[7]*B[4]+A[8]*B[7], A[6]*B[2]+A[7]*B[5]+A[8]*B[8]];
  const ap = (M, v) => [M[0]*v[0]+M[1]*v[1]+M[2]*v[2], M[3]*v[0]+M[4]*v[1]+M[5]*v[2], M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
  const fk = (P, side) => {
    const S = mul(rotX(-side * P.roll), rotY(P.pitch));
    const o = [0, side * S_Y, S_Z];
    const e = ap(S, [0, 0, -L1]).map((x, i) => x + o[i]);
    const E = mul(S, rotY(P.elbow));
    const w = ap(E, [0, 0, -L2]).map((x, i) => x + e[i]);
    const W = mul(E, rotY(P.wrist));
    const p = ap(W, [0, 0, -L3]).map((x, i) => x + w[i]);
    return { p, z: ap(W, [0, 0, -1]) };
  };
  const solveArm = (target, side, seed) => {
    const P = { ...seed };
    const keys = ['pitch', 'roll', 'elbow', 'wrist'];
    const err = () => { const t = fk(P, side); const e = [target.p[0] - t.p[0], target.p[1] - t.p[1], target.p[2] - t.p[2]]; if (target.z) e.push(120 * (target.z[0] - t.z[0]), 120 * (target.z[1] - t.z[1]), 120 * (target.z[2] - t.z[2])); return e; };
    for (let it = 0; it < 600; it++) {
      const e = err(); const n = Math.hypot(...e); if (n < 0.5) break;
      const J = e.map(() => new Array(4).fill(0)); const h = 1e-4;
      keys.forEach((k, c) => { const q0 = P[k]; P[k] = q0 + h; const e1 = err(); P[k] = q0; for (let r = 0; r < e.length; r++) J[r][c] = -(e1[r] - e[r]) / h; });
      const m = e.length;
      const A = Array.from({ length: m }, (_, r) => Array.from({ length: m }, (_, c) => J[r].reduce((s, _, k) => s + J[r][k] * J[c][k], 0) + (r === c ? 40 : 0)));
      const y = gauss(A, e); const step = Math.min(1, 60 / Math.max(1, n));
      keys.forEach((k, c) => { let d = 0; for (let r = 0; r < m; r++) d += J[r][c] * y[r]; P[k] += d * step * 0.9; });
      P.roll = Math.max(-0.3, Math.min(1.3, P.roll));
      P.elbow = Math.max(0, Math.min(2.6, P.elbow));
    }
    const e = err(); return { P, err: Math.hypot(e[0], e[1], e[2]) };
  };
  const seed = { pitch: 0.6, roll: 0.3, elbow: 0.9, wrist: 0.5 };
  const down = [0, 0, -1];
  // The box, on a table in front: base BD (x) by BW (y) at z = BZ, walls BH
  // tall when folded; its centre BX forward of the torso. Flaps lie flat
  // outward from each base edge until an arm folds them up.
  const BZ = -200, BX = 240, BW = 300, BD = 180, BH = 120;
  const T = {
    RIGHT: { FLAP: [BX, BW / 2 + 60, BZ + 15], FLAP_UP: [BX, BW / 2 - 12, BZ + BH + 8], FLAP2: [BX + BD / 2 + 50, 70, BZ + 15], FLAP2_UP: [BX + BD / 2 - 12, 70, BZ + BH + 8],
             ITEM: [BX - 30, BW / 2 + 110, BZ + 40], ITEM_UP: [BX - 30, BW / 2 + 110, BZ + 240], OVER: [BX, 60, BZ + 250], IN: [BX, 60, BZ + 70], REST: [180, 230, -60] },
    LEFT:  { FLAP: [BX, -(BW / 2 + 60), BZ + 15], FLAP_UP: [BX, -(BW / 2 - 12), BZ + BH + 8], FLAP2: [BX - BD / 2 - 50, -70, BZ + 15], FLAP2_UP: [BX - BD / 2 + 12, -70, BZ + BH + 8], REST: [180, -230, -60] },
  };
  const out = {};
  for (const [side, name, s] of [[1, 'RIGHT', T.RIGHT], [-1, 'LEFT', T.LEFT]]) {
    out[name] = {};
    for (const [k, p] of Object.entries(s)) {
      const r = solveArm({ p, z: down }, side, seed);
      out[name][k] = { pitch: r3(r.P.pitch), roll: r3(r.P.roll), elbow: r3(r.P.elbow), wrist: r3(r.P.wrist) };
      console.log(`// op ${name} ${k.padEnd(8)} err ${r3(r.err)}mm  ${JSON.stringify(out[name][k])}`);
    }
  }
  console.log('OP_BOX =', JSON.stringify({ BZ, BX, BW, BD, BH }));
  console.log('OP_P =', JSON.stringify(out));
}
