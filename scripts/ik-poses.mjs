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
  const tcp = { body: 'wrist3', off: [0, 275, 0], axis: [0, 1, 0] };   // = UR_TCP in Flourish3D.jsx: flange 100 + Generalist's gripper 175
  const DEG = Math.PI / 180;
  const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  // Generalist's cell (their GTC photo): the arms come off a black tower
  // behind the table, each base plate TILTED OUTWARD (TILT about the stage's
  // z) and a little toward the viewer (LEAN about x), so the pair makes a V
  const FRAME_X = 0, UR_DX = 30, UR_K = 0.22, MOUNT_Y = -14, MOUNT_Z = -78, TILT = 55, LEAN = -14, TABLE_Y = 80;
  const leaning = (root, k, yaw, lean) => { const B = standing(root, k, yaw); const sd = Math.sign(root[0] - FRAME_X) || 1; return { m: mul(rotX(lean * DEG), mul(rotZ(sd * TILT * DEG), B.m)), t: root }; };
  const toLocal = (base, p) => {                     // stage -> arm frame (mm)
    const k = UR_K, m = base.m, d = [p[0] - base.t[0], p[1] - base.t[1], p[2] - base.t[2]];
    return [(m[0] * d[0] + m[3] * d[1] + m[6] * d[2]) / (k * k), (m[1] * d[0] + m[4] * d[1] + m[7] * d[2]) / (k * k), (m[2] * d[0] + m[5] * d[1] + m[8] * d[2]) / (k * k)];
  };
  const dirLocal = (base, v) => { const m = base.m, k = UR_K; const o = [(m[0] * v[0] + m[3] * v[1] + m[6] * v[2]) / k, (m[1] * v[0] + m[4] * v[1] + m[7] * v[2]) / k, (m[2] * v[0] + m[5] * v[1] + m[8] * v[2]) / k]; const L = Math.hypot(...o); return o.map(x => x / L); };
  const C = 60 * UR_K;                                  // the item, stage px
  const out = {};
  for (const [name, side, yaw] of [['R', 1, 270], ['L', -1, 90]]) {
    const root = [FRAME_X + side * UR_DX, MOUNT_Y, MOUNT_Z];
    const base = leaning(root, UR_K, yaw, LEAN);
    const down = dirLocal(base, [0, 1, 0]);
    const item = [FRAME_X + side * 58, TABLE_Y - C / 2, 40], box = [FRAME_X + side * 6, TABLE_Y - 160 * UR_K, 30];
    const T = { ITEM: item, ITEMUP: [item[0], item[1] - 44, item[2]], BOX: box, BOXUP: [box[0], box[1] - 26, box[2]] };
    out[name] = {};
    // MULTI-START: the tilted mounts put the default seed on a bad branch.
    // ITEMUP first, from many seeds (best error, then the elbow highest);
    // the rest seeded from their neighbour so the loop stays on one branch.
    let rnd = 12345; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    const lim = { limits: { 1: [-3.1, 3.1], 2: [-3.1, 3.1], 3: [-3.1, 3.1] } };
    const go = (p, seed) => solve(R, tcp, seed, [0, 1, 2, 3, 4], { p: toLocal(base, p), z: down }, lim);
    const score = s => s.err + 60 * s.zerr;
    // the branch the cell has been drawn on (solved for the shorter 230 mm
    // tool): seeded from it first, so a longer gripper keeps the arms' pose
    // family; the multi-start only if that seed fails
    const BRANCH = { R: [0.378, -2.04, -2.117, -0.678, 0.595, 0], L: [3.289, -2.218, -2.08, 0.156, 2.42, 0] };
    let best = go(T.ITEMUP, BRANCH[name].slice());
    const seeded = best.err < 1 && best.zerr < 0.01;
    if (!seeded) best = null;
    for (let i = 0; i < 400 && !seeded; i++) {
      const sd = [(rand() * 2 - 1) * 3.1, (rand() * 2 - 1) * 3.1, (rand() * 2 - 1) * 3.1, (rand() * 2 - 1) * 3.1, 1.57, 0];
      const s2 = go(T.ITEMUP, sd);
      if (!best || score(s2) < score(best) - 1e-6) best = s2;
    }
    out[name].ITEMUP = best.q.map(r3);
    console.log(`// ur ${name} ITEMUP err ${r3(best.err)}mm axis ${r3(best.zerr)}  ${fmt(best.q)}`);
    for (const [k, from] of [['ITEM', 'ITEMUP'], ['BOXUP', 'ITEMUP'], ['BOX', 'BOXUP']]) {
      const s2 = go(T[k], out[name][from].slice());
      out[name][k] = s2.q.map(r3);
      console.log(`// ur ${name} ${k.padEnd(6)} err ${r3(s2.err)}mm axis ${r3(s2.zerr)}  ${fmt(s2.q)}`);
    }
  }
  console.log('UR_LAYOUT =', JSON.stringify({ FRAME_X, MOUNT_Y, UR_DX, UR_K, MOUNT_Z, TILT, LEAN, TABLE_Y }));
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
  const S_Y = 240, S_Z = 205, L1 = 230, L2 = 220, L3 = 150;   // UNIT in Flourish3D.jsx
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
  const solveArm = (target, side, seed, rollMax = 0.08) => {
    const P = { ...seed };
    const keys = ['pitch', 'roll', 'elbow', 'wrist'];
    const err = () => { const t = fk(P, side); const e = [target.p[0] - t.p[0], target.p[1] - t.p[1], target.p[2] - t.p[2]]; if (target.z) { const w = target.w ?? 120; e.push(w * (target.z[0] - t.z[0]), w * (target.z[1] - t.z[1]), w * (target.z[2] - t.z[2])); }; return e; };
    for (let it = 0; it < 600; it++) {
      const e = err(); const n = Math.hypot(...e); if (n < 0.5) break;
      const J = e.map(() => new Array(4).fill(0)); const h = 1e-4;
      keys.forEach((k, c) => { const q0 = P[k]; P[k] = q0 + h; const e1 = err(); P[k] = q0; for (let r = 0; r < e.length; r++) J[r][c] = -(e1[r] - e[r]) / h; });
      const m = e.length;
      const A = Array.from({ length: m }, (_, r) => Array.from({ length: m }, (_, c) => J[r].reduce((s, _, k) => s + J[r][k] * J[c][k], 0) + (r === c ? 40 : 0)));
      const y = gauss(A, e); const step = Math.min(1, 60 / Math.max(1, n));
      keys.forEach((k, c) => { let d = 0; for (let r = 0; r < m; r++) d += J[r][c] * y[r]; P[k] += d * step * 0.9; });
      // roll: in this chain POSITIVE swings an arm INWARD (toward the other
      // arm), so it is capped near zero — the arms stay outboard of their
      // shoulders and never cross in front of the torso
      P.roll = Math.max(-1.0, Math.min(rollMax, P.roll));
      P.elbow = Math.max(-2.6, Math.min(0, P.elbow));   // elbow DOWN: the upper arm hangs and the forearm reaches forward, as photographed
    }
    const e = err(); return { P, err: Math.hypot(e[0], e[1], e[2]) };
  };
  const seed = { pitch: -0.3, roll: 0, elbow: -1.2, wrist: -0.3 };
  const down = [0, 0, -1];
  const D2R = Math.PI / 180;
  // ── THE JOB, from Ultra's own films (ultra.tech: ORDER PACKAGING, HERO,
  // INSTALLS IN HOURS; Oct 8, the owner: "ground the ultra stuff based on
  // videos of the actual robot"). An OPEN carton sits on a ROLLER CONVEYOR in
  // front of the unit: BD deep (x) by BW across (y), walls BH tall from
  // z = BZ, centred BX forward; its two long top flaps (front and back,
  // FL = BD/2 each) are hinged on the front and back walls' top edges and
  // stand open. The right arm picks a product out of a blue bin beside the
  // conveyor and puts it in over the right wall; the left pulls the packing
  // slip out of a label printer on the other side and drops it in over the
  // left wall; the right arm takes the front flap by its edge and folds it
  // shut, the left the back flap; the right presses the lid; the box rolls
  // away and the next one rolls in (Flourish3D draws the rolling).
  // What was tried and dropped, each by these checks: side flaps the arms
  // PUSHED shut (carrying the product over a standing flap needs the wrist
  // above the shoulder, which this elbow-down arm cannot do pointing down),
  // and four flaps (the back one leans toward the unit: 41 mm into the torso).
  const BZ = -200, BX = 250, BW = 200, BD = 220, BH = 120, FL = BD / 2;   // OPB in Flourish3D.jsx
  const TOP = BZ + BH;
  const CONV = { TW: 280, TL: 500 };                                 // the conveyor bed, centred on the box
  const BIN = { x: 40, y: 355, w: 190, h: 60 };                      // the blue bin (outer), its floor on its stand at BZ - 6
  const PRN = { x: 160, y: -375, dx: 140, dy: 120, h: 120 };         // the label printer on its stand, past the conveyor's end (nearer the unit it stood on the Fairino's cart)
  const SLIP_OUT = 75;                                               // of the 90 mm slip, standing up out of the printer's top slot
  const ITEM_C = [BIN.x, BIN.y, BZ - 6 + 5 + 40];                    // the product (80 cube) on the bin's floor
  const SLIP_Z = BZ - 6 + PRN.h + SLIP_OUT - 25;                     // where the fingers pinch it
  const OPEN = { F: 100, B: 100 };                                   // degrees from shut (90 upright; more leans out)
  const ROLL_MAX = 0.9;                                              // each arm works its own half; their approach is checked below
  // a flap at angle th (deg): its hinge point (at `along` on the hinge line),
  // its direction hinge → tip, its outward normal, its hinge axis
  const flapAt = (f, th, along = 0) => {
    const c = Math.cos(th * D2R), s = Math.sin(th * D2R), sg = f === 'F' ? 1 : -1;
    return { h: [BX + sg * BD / 2, along, TOP], d: [-sg * c, 0, s], n: [sg * s, 0, c], e: [0, 1, 0], half: BW / 2 };
  };
  // where the fingers hold a flap: on its free edge, `along` the hinge
  const edge = (f, th, along, lift = 0) => { const { h, d, n } = flapAt(f, th, along); return [0, 1, 2].map(i => h[i] + FL * d[i] + 3 * n[i] + (i === 2 ? lift : 0)); };
  const fold = (f, sg) => ({
    [f + 'F_PRE']: edge(f, OPEN[f], sg * 60, 70), [f + 'F_A']: edge(f, OPEN[f], sg * 60), [f + 'F_90']: edge(f, 90, sg * 60), [f + 'F_45']: edge(f, 45, sg * 60), [f + 'F_0']: edge(f, 0, sg * 60, 6),
    [f + 'F_UP']: edge(f, 0, sg * 60, 110),
  });
  const T = {
    RIGHT: { REST: [330, 250, -70], ITEM: ITEM_C, ITEM_UP: [ITEM_C[0] + 30, ITEM_C[1], ITEM_C[2] + 120], OVER: [BX, 50, TOP + 100], IN: [BX, 50, TOP + 55],
             ...fold('F', 1), PRESS: [BX, 0, TOP + 6 + 8], PRESS_UP: [BX, 60, TOP + 110] },
    LEFT: { REST: [330, -250, -70], SLIP: [PRN.x, PRN.y, SLIP_Z], SLIP_UP: [PRN.x, PRN.y, SLIP_Z + 70], WAIT: [BX - 40, -220, TOP + 110], OVER: [BX, -50, TOP + 100], IN: [BX, -50, TOP + 55],
            ...fold('B', -1) },
  };
  // the loop, waypoint by waypoint ([target, gripper opening]); both arms
  // run the same number of steps. Flourish3D's unitTaskState indexes into
  // these for the flaps, the product and the slip.
  const SEQ_R = [['REST', 60], ['ITEM_UP', 100], ['ITEM', 100], ['ITEM', 76], ['ITEM_UP', 76], ['OVER', 76], ['IN', 76], ['IN', 88], ['OVER', 88],
                 ['FF_PRE', 30], ['FF_A', 30], ['FF_A', 8], ['FF_90', 8], ['FF_45', 8], ['FF_0', 8], ['FF_0', 30], ['FF_UP', 30],
                 ['REST', 60], ['REST', 60], ['REST', 60], ['PRESS_UP', 20], ['PRESS', 20], ['PRESS_UP', 20], ['REST', 60]];
  const SEQ_L = [['REST', 60], ['SLIP_UP', 40], ['SLIP', 40], ['SLIP', 4], ['SLIP_UP', 4], ['WAIT', 4], ['WAIT', 4], ['WAIT', 4], ['WAIT', 4], ['OVER', 4], ['IN', 4], ['IN', 40], ['OVER', 40],
                 ['BF_PRE', 30], ['BF_A', 30], ['BF_A', 8], ['BF_90', 8], ['BF_45', 8], ['BF_0', 8], ['BF_0', 30], ['BF_UP', 30], ['REST', 60], ['REST', 60], ['REST', 60]];
  // the flaps: angle at each waypoint index (open before, shut after), and
  // when each is held by its edge (the fingers ON the cardboard, not a clip)
  const FLAPS = { F: [11, OPEN.F, 12, 90, 13, 45, 14, 0], B: [15, OPEN.B, 16, 90, 17, 45, 18, 0] };
  const HELD = { F: [10, 15], B: [14, 19] };
  const flapAngle = (f, ph) => { const k = FLAPS[f]; if (ph <= k[0]) return k[1]; for (let i = 0; i < k.length - 2; i += 2) if (ph <= k[i + 2]) { const u = (ph - k[i]) / (k[i + 2] - k[i]); return k[i + 1] + (k[i + 3] - k[i + 1]) * u; } return 0; };
  const REST_DIR = [0.5, 0, -Math.sqrt(0.75)];
  const out = {};
  for (const [side, name, s] of [[1, 'RIGHT', T.RIGHT], [-1, 'LEFT', T.LEFT]]) {
    out[name] = {};
    for (const [k, p] of Object.entries(s)) {
      // a light hand on the tool axis (the POSITION is what puts the gripper
      // on the flap), lighter still on the points it only passes through —
      // with none, the wrist flipped the gripper over carrying the product
      const free = /_UP$|_PRE$|^WAIT$|^OVER$/.test(k);
      const r = solveArm({ p, z: k === 'REST' ? REST_DIR : down, w: free ? 6 : 25 }, side, seed, ROLL_MAX);
      out[name][k] = { pitch: r3(r.P.pitch), roll: r3(r.P.roll), elbow: r3(r.P.elbow), wrist: r3(r.P.wrist) };
      console.log(`// op ${name} ${k.padEnd(8)} err ${r3(r.err)}mm  ${JSON.stringify(out[name][k])}`);
    }
  }
  // ── CHECKS, along the loop (joint-space lerp between waypoints, sampled):
  // the gripper (drawSmallArm's boxes, in the wrist frame, on a grid)
  // against the box's walls, every flap at its scheduled angle, the torso,
  // the bin and the printer; the arms against the conveyor top and each
  // other. Every number should print 0 except the clearances.
  {
    const wristF = (P, side) => {
      const S = mul(rotX(-side * P.roll), rotY(P.pitch)), o = [0, side * S_Y, S_Z];
      const e = ap(S, [0, 0, -L1]).map((x, i) => x + o[i]);
      const E = mul(S, rotY(P.elbow)); const w = ap(E, [0, 0, -L2]).map((x, i) => x + e[i]);
      return { W: mul(E, rotY(P.wrist)), w, e };
    };
    const at = (F, p) => ap(F.W, p).map((x, i) => x + F.w[i]);
    const gripBoxes = g => [[50, 156, 50, 0, 0, -74], [4, 128, 30, 25, 0, -74], [16, 36, 16, 16, 45, -41], [16, 36, 16, 16, -45, -41],
      ...[-1, 1].flatMap(s2 => [[32, 20, 34, 0, s2 * (g / 2 + 9), -116], [30, 20, 17, 2, s2 * (g / 2 + 9), -141.5]])];
    const grid = ([w, d, h, cx, cy, cz]) => { const o = []; for (let a = 0; a <= 4; a++) for (let b = 0; b <= 6; b++) for (let c = 0; c <= 4; c++) o.push([cx + (a / 4 - 0.5) * w, cy + (b / 6 - 0.5) * d, cz + (c / 4 - 0.5) * h]); return o; };
    const inBox = (p, x0, x1, y0, y1, z0, z1) => (p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1 && p[2] > z0 && p[2] < z1) ? Math.min(p[0] - x0, x1 - p[0], p[1] - y0, y1 - p[1], p[2] - z0, z1 - p[2]) : 0;
    const walls = p => Math.max(inBox(p, BX - BD / 2, BX - BD / 2 + 6, -BW / 2, BW / 2, BZ, TOP), inBox(p, BX + BD / 2 - 6, BX + BD / 2, -BW / 2, BW / 2, BZ, TOP),
                                inBox(p, BX - BD / 2, BX + BD / 2, -BW / 2, -BW / 2 + 6, BZ, TOP), inBox(p, BX - BD / 2, BX + BD / 2, BW / 2 - 6, BW / 2, BZ, TOP));
    const flapPen = (p, ph) => { let m = 0; for (const f of ['F', 'B']) {
      const { h, d, n, e, half } = flapAt(f, flapAngle(f, ph)); const v = [p[0] - h[0], p[1] - h[1], p[2] - h[2]];
      const a = v[0] * d[0] + v[1] * d[1] + v[2] * d[2], b = v[0] * n[0] + v[1] * n[1] + v[2] * n[2], c = Math.abs(v[0] * e[0] + v[1] * e[1] + v[2] * e[2]);
      const lim = ph >= HELD[f][0] && ph <= HELD[f][1] ? FL - 30 : FL;   // the held edge's last 30 mm are between the fingers
      if (a > 0 && a < lim && b > 0 && b < 6 && c < half) m = Math.max(m, Math.min(a, lim - a, b, 6 - b, half - c)); } return m; };
    const torso = p => Math.max(inBox(p, -70, 70, -90, 90, 0, 155), inBox(p, -70, 70, -150, 150, 155, 250));
    const bin = p => { const x0 = BIN.x - BIN.w / 2, y0 = BIN.y - BIN.w / 2, z0 = BZ - 6, z1 = BZ - 6 + BIN.h;
      return Math.max(inBox(p, x0, x0 + 5, y0, y0 + BIN.w, z0, z1), inBox(p, x0 + BIN.w - 5, x0 + BIN.w, y0, y0 + BIN.w, z0, z1), inBox(p, x0, x0 + BIN.w, y0, y0 + 5, z0, z1), inBox(p, x0, x0 + BIN.w, y0 + BIN.w - 5, y0 + BIN.w, z0, z1)); };
    const printer = p => inBox(p, PRN.x - PRN.dx / 2, PRN.x + PRN.dx / 2, PRN.y - PRN.dy / 2, PRN.y + PRN.dy / 2, BZ - 6, BZ - 6 + PRN.h);
    const lp = (A, B, u) => Object.fromEntries(['pitch', 'roll', 'elbow', 'wrist'].map(k => [k, A[k] + (B[k] - A[k]) * u]));
    const worst = { walls: [0], flaps: [0], torso: [0], bin: [0], printer: [0], itemWalls: [0], itemFlaps: [0] };
    let gg = Infinity, ggAt = '';
    const note = (k, v, what) => { if (v > worst[k][0]) worst[k] = [v, what]; };
    let lo = Infinity, near = Infinity;
    const n = SEQ_R.length;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < 16; j++) {
      const u = j / 16, ph = i + u;
      const arms = [[1, SEQ_R, out.RIGHT], [-1, SEQ_L, out.LEFT]].map(([side, seq, O]) => {
        const P = lp(O[seq[i][0]], O[seq[i + 1][0]], u), g = seq[i][1] + (seq[i + 1][1] - seq[i][1]) * u, F = wristF(P, side);
        return { side, F, g, pts: gripBoxes(g).flatMap(b2 => grid(b2).map(p => at(F, p))), tip: at(F, [0, 0, -L3]) };
      });
      for (const A of arms) {
        const tag = `${A.side > 0 ? 'R' : 'L'} ph ${r3(ph)}`;
        for (const p of A.pts) { note('walls', walls(p), tag); note('flaps', flapPen(p, ph), tag); note('torso', torso(p), tag); note('bin', bin(p), tag); note('printer', printer(p), tag); }
        for (const p of [A.F.e, A.F.w, A.tip]) lo = Math.min(lo, p[2]);
      }
      // the held product's corners against the walls (carried 3 → 7)
      if (ph >= 3 && ph < 7) { const c = arms[0].tip; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 0, 1]) { const q2 = [c[0] + sx * 40, c[1] + sy * 40, c[2] + sz * 40]; note('itemWalls', walls(q2), `ph ${r3(ph)}`); note('itemFlaps', flapPen(q2, ph), `ph ${r3(ph)}`); } }
      // the two grippers against each other (every 4th grid point)
      for (let a3 = 0; a3 < arms[0].pts.length; a3 += 4) for (let b3 = 0; b3 < arms[1].pts.length; b3 += 4) { const p3 = arms[0].pts[a3], q3 = arms[1].pts[b3], d3 = Math.hypot(p3[0] - q3[0], p3[1] - q3[1], p3[2] - q3[2]); if (d3 < gg) { gg = d3; ggAt = `ph ${r3(ph)}`; } }
      for (const a2 of [arms[0].F.e, arms[0].F.w, arms[0].tip]) for (const b2 of [arms[1].F.e, arms[1].F.w, arms[1].tip]) near = Math.min(near, Math.hypot(a2[0] - b2[0], a2[1] - b2[1], a2[2] - b2[2]));
    }
    console.log(`// op check: lowest arm point ${r3(lo - (BZ - 6))} mm above the conveyor; elbows, wrists and tips no closer than ${r3(near)} mm; grippers no closer than ${r3(gg)} mm (${ggAt})`);
    // up to 3 mm reads as CONTACT (a finger on the cardboard it pushes; 3 mm
    // is under a pixel at the unit's 0.24 px/mm) — more is a clip to fix
    console.log(`// op box check (mm into; <= 3 is contact): ${Object.entries(worst).map(([k, [v, w]]) => `${k} ${r3(v)}${v > 0 ? ` (${w})` : ''}`).join(', ')}`);
  }
  console.log('OP_BOX =', JSON.stringify({ BZ, BX, BW, BD, BH, FL, OPEN, CONV, BIN, PRN, SLIP_OUT }));
  console.log('OP_SEQ =', JSON.stringify({ R: SEQ_R, L: SEQ_L, FLAPS, HELD }));
  console.log('OP_P =', JSON.stringify(out));
}
