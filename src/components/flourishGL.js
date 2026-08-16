// WebGL2 rasteriser for the side flourishes.
//
// Why this exists: the Canvas2D version issued ~573 separate `fill()` calls per
// frame — one per face, because every face has its own shade — plus a JS sort of
// ~600 objects and ~600 allocations every frame for the painter's algorithm.
// That is the ceiling of Canvas2D: the cost is the DRAW-CALL count, not the
// geometry, which is why adding detail made it worse. Here each part's geometry
// is uploaded ONCE and drawn with a single call against a depth buffer, so the
// whole scene is ~15 draw calls and the sort disappears into hardware.
//
// Deliberately NOT three.js: this is ~300 lines and a few KB against 150KB, and
// the site already proves what happens when the WebGL stack is unavailable —
// `createGLRenderer` returns null and the caller keeps its Canvas2D path.
//
// Everything about the geometry, the choreography and the lighting model is
// shared with the 2D backend; only the rasteriser differs. The lighting maths
// below is a direct port of the 2D shader so the two backends match, except
// that it runs PER PIXEL here, which removes the facet banding on curves.

const VERT = `#version 300 es
precision highp float;
in vec3 a_pos;
in vec3 a_norm;
uniform mat3 u_model;      // part rotation/scale
uniform vec3 u_trans;      // part translation
uniform mat3 u_view;       // camera rotation
uniform float u_dolly;
uniform float u_persp;
uniform vec2 u_half;       // canvas half-size in CSS px
out vec3 v_norm;
out float v_viewZ;
void main() {
  vec3 world = u_model * a_pos + u_trans;
  vec3 view = u_view * world;
  view.z += u_dolly;
  // the same manual perspective divide the 2D backend uses, so both agree
  float k = u_persp / (u_persp - view.z);
  vec2 s = view.xy * k;
  // w = 1 and a normalised depth in z: larger view z is nearer the camera, so
  // negating gives the smaller depth value that gl.LESS wants
  float depth = clamp(-view.z / 900.0, -0.999, 0.999);
  gl_Position = vec4(s.x / u_half.x, -s.y / u_half.y, depth, 1.0);
  v_norm = u_model * a_norm;
  v_viewZ = view.z;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 v_norm;
in float v_viewZ;
uniform vec3 u_base;       // material colour, 0..1
uniform float u_alpha;
uniform bool u_flat;       // lines: skip lighting entirely
out vec4 outColor;

// pre-normalised: some drivers reject built-in calls in const initialisers
const vec3 LIGHT = vec3(-0.419726, -0.799478, 0.429719);
const vec3 HALF  = vec3(-0.248293, -0.472940, 0.845380);

void main() {
  if (u_flat) { outColor = vec4(u_base, u_alpha); return; }
  vec3 n = normalize(v_norm);
  float d = max(0.0, dot(n, LIGHT));
  float hd = max(0.0, dot(n, HALF));

  // environment reflection: reflect the view dir (0,0,1) about the normal and
  // ask what it hits in a two-band studio — sky above, floor below, hot horizon
  // between. The horizon streak is what makes it read as metal.
  float envUp = -2.0 * n.z * n.y;
  float envT = clamp(0.5 + 1.9 * envUp, 0.0, 1.0);
  float horizon = exp(-(envUp * envUp) / 0.012);
  float env = 0.10 + 0.55 * envT + 0.42 * horizon;

  float rim = 0.30 * pow(1.0 - abs(n.z), 4.0);
  float fade = clamp(0.82 + 0.0009 * v_viewZ, 0.72, 1.06);
  float lit = (0.10 + 0.44 * d + 0.46 * env) * fade;
  float spec = 0.5 * pow(hd, 26.0) + rim;

  vec3 c = u_base * lit + vec3(1.0, 0.98, 0.94) * spec;
  outColor = vec4(clamp(c, 0.0, 1.0), u_alpha);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[flourish] shader failed:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

const hexToRgb01 = h => {
  const v = String(h).replace('#', '').trim();
  const n = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
  return [
    (parseInt(n.slice(0, 2), 16) || 0) / 255,
    (parseInt(n.slice(2, 4), 16) || 0) / 255,
    (parseInt(n.slice(4, 6), 16) || 0) / 255,
  ];
};

// quads -> triangles, interleaved position + normal
function facesToArray(faces) {
  const tris = [];
  for (const f of faces) {
    const v = f.v, n = f.n;
    const idx = v.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2];
    for (const i of idx) tris.push(v[i][0], v[i][1], v[i][2], n[0], n[1], n[2]);
  }
  return new Float32Array(tris);
}

// closed convex polylines -> triangle fans, for the flat filled quads the
// left-hand piece uses (photosites, tokens, the detection box)
function fillPolysToArray(polys) {
  const out = [];
  for (const poly of polys) {
    // the geometry closes the ring, so the repeated last point is dropped
    const n = poly.length > 2 && poly[0][0] === poly[poly.length - 1][0]
      && poly[0][1] === poly[poly.length - 1][1] ? poly.length - 1 : poly.length;
    for (let i = 1; i < n - 1; i++) {
      for (const q of [poly[0], poly[i], poly[i + 1]]) out.push(q[0], q[1], q[2], 0, 0, 1);
    }
  }
  return new Float32Array(out);
}

// polylines -> GL_LINES vertex pairs (normals unused, kept for one layout)
function polysToArray(polys) {
  const out = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      out.push(a[0], a[1], a[2], 0, 0, 1, b[0], b[1], b[2], 0, 0, 1);
    }
  }
  return new Float32Array(out);
}

export function createGLRenderer(canvas, W, H, dpr) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', { alpha: true, antialias: true, depth: true, premultipliedAlpha: false });
  } catch (e) {
    gl = null;
  }
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'a_pos');
  gl.bindAttribLocation(prog, 1, 'a_norm');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[flourish] link failed:', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const U = {};
  for (const name of ['u_model', 'u_trans', 'u_view', 'u_dolly', 'u_persp', 'u_half', 'u_base', 'u_alpha', 'u_flat']) {
    U[name] = gl.getUniformLocation(prog, name);
  }

  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(U.u_half, W / 2, H / 2);
  gl.uniform1f(U.u_persp, 600);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  // No face culling on purpose: the projection flips Y, which reverses the
  // apparent winding, so front/back would be a coin flip. The depth buffer
  // hides interior faces correctly regardless, and at this triangle count
  // culling buys nothing.
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);

  // geometry is uploaded once and keyed by the array identity — the scene code
  // hands us the same module-level arrays every frame
  const cache = new WeakMap();
  const upload = (key, build, isLines) => {
    let e = cache.get(key);
    if (!e) {
      const data = build(key);
      const vao = gl.createVertexArray();
      const buf = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      gl.bindVertexArray(null);
      e = { vao, buf, count: data.length / 6, isLines };
      cache.set(key, e);
    }
    return e;
  };

  let segs = 0, calls = 0;

  return {
    kind: 'webgl2',
    get segs() { return segs; },
    get calls() { return calls; },

    setCamera(yaw, pitch, dolly) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
      // view = Rx(pitch) * Ry(yaw), which row-major is
      //   [  cy       0    sy     ]
      //   [  sx*sy    cx  -sx*cy  ]
      //   [ -cx*sy    sx   cx*cy  ]
      // uniformMatrix3fv with transpose=false wants COLUMN-major, so this is
      // that matrix transposed. Verified numerically against the 2D backend's
      // own projection for arbitrary points — an earlier version of this was
      // silently wrong and would have skewed the whole scene.
      gl.uniformMatrix3fv(U.u_view, false, new Float32Array([
        cy, sx * sy, -cx * sy,
        0, cx, sx,
        sy, -sx * cy, cx * cy,
      ]));
      gl.uniform1f(U.u_dolly, dolly);
    },

    begin() {
      segs = 0; calls = 0;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },

    // T is { m: number[9] (row-major), t: [x,y,z] }
    submit(faces, T, rgb255, alpha) {
      if (!faces || !faces.length || alpha <= 0.02) return;
      const g = upload(faces, facesToArray, false);
      const m = T.m;
      gl.uniformMatrix3fv(U.u_model, false, new Float32Array([
        m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8],
      ]));
      gl.uniform3f(U.u_trans, T.t[0], T.t[1], T.t[2]);
      gl.uniform3f(U.u_base, rgb255[0] / 255, rgb255[1] / 255, rgb255[2] / 255);
      gl.uniform1f(U.u_alpha, Math.min(1, alpha));
      gl.uniform1i(U.u_flat, 0);
      gl.depthMask(alpha >= 0.99);
      gl.bindVertexArray(g.vao);
      gl.drawArrays(gl.TRIANGLES, 0, g.count);
      gl.depthMask(true);
      segs += g.count / 3;
      calls++;
    },

    stroke(polys, T, color, alpha, _width) {
      if (!polys || !polys.length || alpha <= 0.004) return;
      const g = upload(polys, polysToArray, true);
      const m = T.m;
      gl.uniformMatrix3fv(U.u_model, false, new Float32Array([
        m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8],
      ]));
      gl.uniform3f(U.u_trans, T.t[0], T.t[1], T.t[2]);
      const c = Array.isArray(color) ? [color[0] / 255, color[1] / 255, color[2] / 255] : hexToRgb01(color);
      gl.uniform3f(U.u_base, c[0], c[1], c[2]);
      gl.uniform1f(U.u_alpha, Math.min(1, alpha));
      gl.uniform1i(U.u_flat, 1);
      gl.disable(gl.DEPTH_TEST);          // hairlines lie on the surface they
      gl.bindVertexArray(g.vao);          // describe; depth-testing z-fights
      gl.drawArrays(gl.LINES, 0, g.count);
      gl.enable(gl.DEPTH_TEST);
      segs += g.count / 2;
      calls++;
    },

    fill(polys, T, color, alpha) {
      if (!polys || !polys.length || alpha <= 0.004) return;
      const g = upload(polys, fillPolysToArray, false);
      if (!g.count) return;
      const m = T.m;
      gl.uniformMatrix3fv(U.u_model, false, new Float32Array([
        m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8],
      ]));
      gl.uniform3f(U.u_trans, T.t[0], T.t[1], T.t[2]);
      const c = Array.isArray(color) ? [color[0] / 255, color[1] / 255, color[2] / 255] : hexToRgb01(color);
      gl.uniform3f(U.u_base, c[0], c[1], c[2]);
      gl.uniform1f(U.u_alpha, Math.min(1, alpha));
      gl.uniform1i(U.u_flat, 1);
      gl.bindVertexArray(g.vao);
      gl.drawArrays(gl.TRIANGLES, 0, g.count);
      segs += g.count / 3;
      calls++;
    },

    flush() { /* the depth buffer does the sorting; nothing to do */ },
    end() { gl.bindVertexArray(null); },

    dispose() {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    },
  };
}
