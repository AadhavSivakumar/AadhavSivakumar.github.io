"""The LEFT stage of the site, as Manim scenes (the owner: "refactor the whole
left side animation in manim").

One story, real -> sim -> real, in five acts that the page scrubs with the
scroll, plus a short idle loop for every page the reader can stop on:

  Rest     (Experience)          the depth camera, projecting its field of view
  Act0     Experience -> Research  it explodes, the sensor comes out, light lands on it
  Act1     Research -> Projects    VLA: patches -> tokens -> transformer -> action chunk
  Act2     Projects -> More        world model: encoder, latent dynamics, imagined frames
  Act3     More -> Resume          real2sim: splat -> sim twin, domain randomization, training
  Act4     Resume -> Contact       sim2real: the sim becomes the real table, the policy runs

Every act starts from the state the previous act ended on, built by the SAME
function (`state0` ... `state4`), and ends by swapping in that function's
output, so the seams between clips are exact by construction.

Render (see scripts/render-left.sh, which renders both themes and encodes):
  THEME=light manim -qh --disable_caching manim/left.py Act1
"""
from manim import *
import math
import os

THEME = os.environ.get("THEME", "light")
PAL = {
    "light": dict(bg="#F7F5F2", ink="#2E2A24", soft="#8C8375", line="#C9BFAE", gold="#A8823C",
                  copper="#C0703A", red="#C9473F", green="#4E9A5C", blue="#3F6FB8",
                  panel="#EFEBE3", body="#C9CDD2", plate="#2E3034", steel="#9FA6AE",
                  pcb="#556B5A", table="#E4DED2", wall="#EEEAE3", slab="#E9E4DA"),
    "dark": dict(bg="#121212", ink="#EDE6D8", soft="#9A917F", line="#4A453D", gold="#D4B47C",
                 copper="#E08A4C", red="#E0605A", green="#6DB57A", blue="#6A94D8",
                 panel="#1C1B19", body="#7D838B", plate="#2A2C30", steel="#8A919A",
                 pcb="#4D6453", table="#2A2723", wall="#1E1D1B", slab="#23221F"),
}[THEME]

# the stage is 340 x 660 on the page; rendered at 1.5x
config.pixel_width = 510
config.pixel_height = 990
config.frame_height = 8.0
config.frame_width = 8.0 * 510 / 990
config.frame_rate = 30
config.background_color = PAL["bg"]

FONT = "DejaVu Sans Mono"
ACT_T = 3.5      # seconds per act
IDLE_T = 4.0     # seconds per idle loop


def label(s, size=13, color=None):
    return Text(s, font=FONT, font_size=size, color=color or PAL["soft"], weight=BOLD)


def fade(m, a):
    """Scale a mobject's EXISTING stroke and fill opacities by `a`. (Manim's
    set_opacity sets fill opacity too, which fills outline-only shapes — a
    frame or a curve — with a solid white.)"""
    for sm in m.family_members_with_points():
        sm.set_stroke(opacity=sm.get_stroke_opacity() * a)
        sm.set_fill(opacity=sm.get_fill_opacity() * a)
    return m


def smooth01(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


# ── the real -> sim -> real tracker at the top ─────────────────────────────
TRK_Y, TRK_X = 3.5, [-1.15, 0.0, 1.15]


def tracker(p, a=1.0):
    y = TRK_Y
    x = TRK_X[0] + min(max(p, 0.0), 2.0) * 1.15
    g = VGroup(Line([TRK_X[0], y, 0], [TRK_X[2], y, 0], stroke_color=PAL["line"], stroke_width=2))
    if x > TRK_X[0] + 1e-3:
        g.add(Line([TRK_X[0], y, 0], [x, y, 0], stroke_color=PAL["copper"], stroke_width=3))
    for i, t in enumerate(["real", "sim", "real"]):
        on = abs(p - i) < 0.5
        g.add(Circle(0.075, stroke_color=PAL["copper"] if on else PAL["line"], stroke_width=2.5,
                     fill_color=PAL["bg"], fill_opacity=1).move_to([TRK_X[i], y, 0]))
        g.add(label(t, 11, PAL["copper"] if on else PAL["soft"]).move_to([TRK_X[i], y - 0.22, 0]))
    g.add(Dot([x, y, 0], radius=0.055, color=PAL["copper"]))
    return fade(g, a) if a < 1 else g


# ── the pick-and-place loop, shared by the picture and the table ───────────
# keys: (u, spot, level (1 high / 0 at the cube), open, phase of the red cube
# during the segment that starts here: 0 at A, 1 carried, 2 at B, 3 carried)
PICK = [
    (0.00, "H", 1, 1, 0), (0.10, "A", 1, 1, 0), (0.18, "A", 0, 1, 0), (0.22, "A", 0, 0, 1),
    (0.32, "A", 1, 0, 1), (0.42, "B", 1, 0, 1), (0.50, "B", 0, 0, 1), (0.54, "B", 0, 1, 2),
    (0.60, "B", 1, 1, 2), (0.66, "B", 1, 1, 2), (0.72, "B", 0, 1, 2), (0.76, "B", 0, 0, 3),
    (0.84, "A", 1, 0, 3), (0.90, "A", 0, 0, 3), (0.94, "A", 0, 1, 0), (1.00, "H", 1, 1, 0),
]


def pick_key(u):
    u = u % 1.0
    i = 0
    while i < len(PICK) - 2 and PICK[i + 1][0] <= u:
        i += 1
    k0, k1 = PICK[i], PICK[i + 1]
    f = smooth01((u - k0[0]) / max(1e-6, k1[0] - k0[0]))
    return k0, k1, f


# ── the picture: a table, three cubes, a gripper (picture units: x -1..1, y -1..1) ──
PA, PB = (0.28, -0.28), (-0.22, -0.12)          # where the red cube goes, A and B
CUBES = [(PA, 0.22, "red"), ((0.62, -0.42), 0.19, "green"), ((-0.64, -0.48), 0.16, "blue")]


def pic_state(u):
    k0, k1, f = pick_key(u)

    def spot(sp, lv):
        if sp == "H":
            return (-0.45, 0.55)
        c = PA if sp == "A" else PB
        return (c[0], 0.3) if lv else (c[0], c[1] + 0.2)
    p0, p1 = spot(k0[1], k0[2]), spot(k1[1], k1[2])
    g = (p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f)
    op = k0[3] + (k1[3] - k0[3]) * f
    ph = k0[4]
    cube = (g[0], g[1] - 0.2) if ph in (1, 3) else (PB if ph == 2 else PA)
    return g, op, cube


# the UNTRAINED policy (the owner: "have the robot moving in random
# locations"): the gripper wanders between random spots over the table —
# seeded, so every render is the same — dipping to the table at some and
# closing on air, never on the cube; the loop starts and ends at home
def _wander_keys(n=7, seed=11):
    import random as _r
    rnd = _r.Random(seed)
    keys = [(-0.45, 0.55, 1.0)]
    for i in range(n):
        x = rnd.uniform(-0.8, 0.85)
        if abs(x - PA[0]) < 0.28:                     # never onto the red cube
            x += 0.4 if x < PA[0] else -0.4
        dip = rnd.random() < 0.55
        y = rnd.uniform(-0.18, -0.05) if dip else rnd.uniform(0.1, 0.62)
        keys.append((x, y, 0.0 if dip and rnd.random() < 0.7 else 1.0))
    keys.append((-0.45, 0.55, 1.0))
    return keys


WANDER = _wander_keys()


def fumble_state(u):
    u = u % 1.0
    n = len(WANDER) - 1
    k = min(n - 1, int(u * n))
    f = smooth01(u * n - k)
    (x0, y0, o0), (x1, y1, o1) = WANDER[k], WANDER[k + 1]
    # the jaw closes as it arrives at a dip and opens as it leaves
    op = o1 if f > 0.7 else (o0 if f < 0.3 else o0 + (o1 - o0) * (f - 0.3) / 0.4)
    return (x0 + (x1 - x0) * f, y0 + (y1 - y0) * f + 0.08 * math.sin(math.pi * f)), op, PA


def iso_cube(c, s, color, depth=0.45):
    """A cube drawn in cabinet projection: front face, top and right side."""
    x, y = c
    d = s * depth
    col = ManimColor(color)
    front = Polygon([x - s / 2, y - s / 2, 0], [x + s / 2, y - s / 2, 0], [x + s / 2, y + s / 2, 0], [x - s / 2, y + s / 2, 0],
                    fill_color=col, fill_opacity=1, stroke_width=0)
    top = Polygon([x - s / 2, y + s / 2, 0], [x + s / 2, y + s / 2, 0], [x + s / 2 + d, y + s / 2 + d, 0], [x - s / 2 + d, y + s / 2 + d, 0],
                  fill_color=col.lighter(0.3), fill_opacity=1, stroke_width=0)
    side = Polygon([x + s / 2, y - s / 2, 0], [x + s / 2 + d, y - s / 2 + d, 0], [x + s / 2 + d, y + s / 2 + d, 0], [x + s / 2, y + s / 2, 0],
                   fill_color=col.darker(0.25), fill_opacity=1, stroke_width=0)
    return VGroup(side, top, front)


def picture(u=0.0, w=3.3, h=2.1, center=(0, 2.0, 0), frame=True, fumble=False):
    cx, cy = center[0], center[1]
    sx, sy = w / 2, h / 2
    P = lambda x, y: [cx + x * sx, cy + y * sy, 0]
    g = VGroup()
    g.add(Rectangle(width=w, height=h, fill_color=PAL["wall"], fill_opacity=1, stroke_width=0).move_to([cx, cy, 0]))
    g.add(Polygon(P(-1, -1), P(1, -1), P(1, -0.05), P(-1, -0.05), fill_color=PAL["table"], fill_opacity=1, stroke_width=0))
    g.add(Line(P(-1, -0.05), P(1, -0.05), stroke_color=PAL["line"], stroke_width=1.5))
    gp, op, cube = fumble_state(u) if fumble else pic_state(u)
    for (c, s, col) in CUBES:
        cc = cube if col == "red" else c
        g.add(iso_cube((cx + cc[0] * sx, cy + cc[1] * sy), s * sx, PAL[col]))
    # the gripper, down from the top edge
    gx, gy = cx + gp[0] * sx, cy + gp[1] * sy
    o = (0.13 + 0.07 * op) * sx
    g.add(Line([gx, cy + sy, 0], [gx, gy + 0.2 * sy, 0], stroke_color=PAL["ink"], stroke_width=3))
    g.add(Rectangle(width=2 * o + 0.1 * sx, height=0.06 * sy * 2, fill_color=PAL["ink"], fill_opacity=1, stroke_width=0).move_to([gx, gy + 0.17 * sy, 0]))
    for sg in (-1, 1):
        g.add(Rectangle(width=0.035 * sx * 2, height=0.2 * sy, fill_color=PAL["ink"], fill_opacity=1, stroke_width=0).move_to([gx + sg * o, gy + 0.06 * sy, 0]))
        g.add(Rectangle(width=0.035 * sx * 2, height=0.05 * sy, fill_color=PAL["copper"], fill_opacity=1, stroke_width=0).move_to([gx + sg * o, gy - 0.05 * sy, 0]))
    if frame:
        g.add(Rectangle(width=w, height=h, stroke_color=PAL["gold"], stroke_width=2.5).move_to([cx, cy, 0]))
    return g


# ── act 0 pieces: the RealSense ─────────────────────────────────────────────
CAM_C = (-0.12, 0.6)   # the stage overhangs the screen's left edge by up to ~20 px: keep the body clear of it
LENS = [(-1.0, 0.16), (-0.45, 0.12), (0.5, 0.16), (1.02, 0.18)]      # IR, projector, IR, RGB


def cam_casing():
    x, y = CAM_C
    depth = RoundedRectangle(width=3.0, height=0.82, corner_radius=0.41, fill_color=ManimColor(PAL["body"]).darker(0.35),
                             fill_opacity=1, stroke_width=0).move_to([x - 0.13, y - 0.12, 0])
    body = RoundedRectangle(width=3.0, height=0.82, corner_radius=0.41, fill_color=PAL["body"], fill_opacity=1,
                            stroke_color=ManimColor(PAL["body"]).darker(0.3), stroke_width=1.5).move_to([x, y, 0])
    return VGroup(depth, body)


def cam_plate():
    x, y = CAM_C
    return RoundedRectangle(width=2.8, height=0.66, corner_radius=0.33, fill_color=PAL["plate"], fill_opacity=1,
                            stroke_color=ManimColor(PAL["plate"]).lighter(0.2), stroke_width=1.5).move_to([x, y, 0])


def cam_lenses():
    x, y = CAM_C
    g = VGroup()
    for lx, r in LENS:
        g.add(VGroup(Circle(r, fill_color="#111316", fill_opacity=1, stroke_color=PAL["gold"], stroke_width=2).move_to([x + lx, y, 0]),
                     Circle(r * 0.5, stroke_color=PAL["gold"], stroke_width=1.2).move_to([x + lx, y, 0])))
    return g


def cam_module():
    x, y = CAM_C
    board = Rectangle(width=2.5, height=0.4, fill_color=PAL["steel"], fill_opacity=1, stroke_color=ManimColor(PAL["steel"]).darker(0.3), stroke_width=1.2).move_to([x, y, 0])
    barrels = VGroup(*[Circle(0.1, fill_color=ManimColor(PAL["steel"]).darker(0.4), fill_opacity=1, stroke_width=1, stroke_color=PAL["ink"]).move_to([x + lx, y, 0]) for lx, _ in (LENS[0], LENS[2])])
    return VGroup(board, barrels)


def rgb_barrel():
    x, y = CAM_C
    return VGroup(Circle(0.12, fill_color=ManimColor(PAL["steel"]).darker(0.4), fill_opacity=1, stroke_color=PAL["ink"], stroke_width=1.2),
                  Circle(0.06, stroke_color=PAL["gold"], stroke_width=1.2)).move_to([x + LENS[3][0], y, 0])


def cam_pcb():
    x, y = CAM_C
    return Rectangle(width=2.4, height=0.4, fill_color=PAL["pcb"], fill_opacity=1, stroke_width=1, stroke_color=ManimColor(PAL["pcb"]).darker(0.3)).move_to([x, y, 0])


def capture_cone(a=1.0, sweep=None):
    x, y = CAM_C[0] + LENS[3][0], CAM_C[1]
    far = [[x + 0.42, y + 0.85, 0], [x + 0.95, y + 0.68, 0], [x + 0.95, y - 0.55, 0], [x + 0.42, y - 0.75, 0]]
    o = [x, y, 0]
    g = VGroup(Polygon(o, far[0], far[1], far[2], far[3], fill_color=PAL["copper"], fill_opacity=0.07 * a, stroke_width=0))
    for c in far:
        g.add(Line(o, c, stroke_color=PAL["copper"], stroke_width=1.3, stroke_opacity=0.7 * a))
    g.add(Polygon(*far, stroke_color=PAL["copper"], stroke_width=1.3, stroke_opacity=0.7 * a, fill_opacity=0))
    if sweep is not None:
        d = sweep
        pts = [[o[0] + (c[0] - o[0]) * d, o[1] + (c[1] - o[1]) * d, 0] for c in far]
        g.add(Polygon(*pts, stroke_color=PAL["copper"], stroke_width=2, stroke_opacity=0.9 * (1 - d) * a, fill_opacity=0))
    return g


# ── the D435i IN 3D (the owner: "have the 3d camera BE in 3d, and slightly be
# spinning around"). Manim's Cairo renderer sorts whole mobjects, so its 3D
# solids painted end caps over the front plate; this is a small renderer of
# its own instead: parts are EXTRUDED outlines (a stadium for the body and
# the plate, circles for the lens barrels, rectangles for the boards) in the
# camera's frame (x along the bar, y up, z out of the front), rotated by
# yaw/pitch, back faces CULLED, faces shaded by a light and sorted by depth,
# projected with a mild perspective, and drawn as flat polygons — so a frame
# of it is drawn exactly like everything else here. `ex` explodes each part
# out along the camera's OWN depth axis.
C3 = np.array([-0.55, 0.55, 0.0])
L3, R3, D3 = 2.2, 0.38, 0.62
LIGHT = np.array([-0.45, 0.55, 0.7]) / np.linalg.norm([-0.45, 0.55, 0.7])


def _stadium_pts(L, R, n=14):
    pts = []
    for i in range(n + 1):
        a = math.pi / 2 + math.pi * i / n
        pts.append((-L / 2 + R * math.cos(a), R * math.sin(a)))
    for i in range(n + 1):
        a = -math.pi / 2 + math.pi * i / n
        pts.append((L / 2 + R * math.cos(a), R * math.sin(a)))
    return pts


def _circle_pts(r, n=18, cx=0.0, cy=0.0):
    return [(cx + r * math.cos(math.tau * i / n), cy + r * math.sin(math.tau * i / n)) for i in range(n)]


def _rect_pts(w, h):
    return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]


def extrude(outline, z0, z1, col):
    """Faces of a prism: (points, outward normal, colour), in the part's frame.
    The outline runs counter-clockwise."""
    faces = [([(x, y, z1) for x, y in outline], (0, 0, 1), col), ([(x, y, z0) for x, y in reversed(outline)], (0, 0, -1), col)]
    n = len(outline)
    for i in range(n):
        (xa, ya), (xb, yb) = outline[i], outline[(i + 1) % n]
        nx, ny = yb - ya, -(xb - xa)
        ln = math.hypot(nx, ny) or 1
        faces.append(([(xa, ya, z0), (xb, yb, z0), (xb, yb, z1), (xa, ya, z1)], (nx / ln, ny / ln, 0), col))
    return faces


def _rot(yaw, pitch):
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    return Ry @ Rx


def _proj(p):
    k = 14.0 / (14.0 - p[2])                 # a mild perspective
    return [C3[0] + p[0] * k, C3[1] + p[1] * k, 0]


def render_parts(parts, yaw, pitch, alpha=None):
    """parts: [(name, faces, offset_z)] -> a VGroup, parts back to front."""
    R = _rot(yaw, pitch)
    drawn = []
    for name, faces, dz in parts:
        a = 1.0 if alpha is None else alpha.get(name, 1.0)
        if a <= 0.01:
            continue
        polys = []
        for pts, nrm, col in faces:
            n = R @ np.array(nrm)
            if n[2] <= 0.02:
                continue                      # culled: faces away from the viewer
            wp = [R @ np.array([x, y, z + dz]) for x, y, z in pts]
            lit = 0.55 + 0.45 * max(0.0, float(n @ LIGHT))
            c = ManimColor(col)
            shade = c.darker(1 - lit) if lit < 1 else c
            polys.append((sum(q[2] for q in wp) / len(wp),
                          Polygon(*[_proj(q) for q in wp], fill_color=shade, fill_opacity=a, stroke_color=shade, stroke_width=0.6, stroke_opacity=a)))
        polys.sort(key=lambda t: t[0])
        zc = sum(t[0] for t in polys) / len(polys) if polys else 0
        drawn.append((zc, VGroup(*[p for _, p in polys])))
    drawn.sort(key=lambda t: t[0])
    return VGroup(*[g for _, g in drawn])


def cam_parts(ex=0.0):
    parts = [("casing", extrude(_stadium_pts(L3, R3), -D3 / 2, D3 / 2, PAL["body"]), -0.55 * ex),
             ("pcb", extrude(_rect_pts(L3 * 0.78, 0.36), -0.05, 0.0, PAL["pcb"]), -1.0 * ex),
             ("module", extrude(_rect_pts(L3 * 0.8, 0.34), -0.04, 0.04, PAL["steel"]), 0.2 + 0.25 * ex),
             ("plate", extrude(_stadium_pts(L3 * 0.94, R3 * 0.82), D3 / 2, D3 / 2 + 0.05, PAL["plate"]), 0.95 * ex)]
    for i, (lx, r) in enumerate(LENS):
        parts.append((f"lens{i}", extrude(_circle_pts(r * 0.8, 16, lx * 0.95, 0), D3 / 2 + 0.05, D3 / 2 + 0.16, "#1B1D21"), 1.7 * ex))
    return parts


def cam3d(yaw=0.95, pitch=0.2, ex=0.0, cone=1.0, sweep=None, others=1.0):
    alpha = {k: others for k in ("casing", "pcb", "plate", "lens0", "lens1", "lens2", "lens3")}
    g = render_parts(cam_parts(ex), yaw, pitch, alpha)
    R = _rot(yaw, pitch)
    # gold rims on the lenses, when their fronts face the viewer
    if others > 0.01 and (R @ np.array([0, 0, 1]))[2] > 0.05:
        for lx, r in LENS:
            ring = [_proj(R @ np.array([x, y, D3 / 2 + 0.165 + 1.7 * ex])) for x, y in _circle_pts(r * 0.62, 18, lx * 0.95, 0)]
            g.add(Polygon(*ring, stroke_color=PAL["gold"], stroke_width=1.6, stroke_opacity=others, fill_opacity=0))
    if cone > 0.01:
        o = np.array([LENS[3][0] * 0.95, 0, D3 / 2 + 0.17])
        D = 1.25                             # on the stage at the widest point of the sway
        far = [o + np.array([sx * D * math.tan(0.6), sy * D * math.tan(0.37), D]) for sx, sy in ((-1, 1), (1, 1), (1, -1), (-1, -1))]
        O, F = _proj(R @ o), [_proj(R @ f) for f in far]
        cg = VGroup(Polygon(*F, stroke_color=PAL["copper"], stroke_width=1.5, stroke_opacity=0.75 * cone, fill_color=PAL["copper"], fill_opacity=0.06 * cone),
                    *[Line(O, f, stroke_color=PAL["copper"], stroke_width=1.5, stroke_opacity=0.75 * cone) for f in F])
        if sweep is not None:
            cg.add(Polygon(*[_proj(R @ (o + (f - o) * sweep)) for f in far], stroke_color=PAL["copper"], stroke_width=2.2, stroke_opacity=0.9 * (1 - sweep) * cone, fill_opacity=0))
        g.add(cg)
    return g


YAW0, PITCH0 = 0.95, 0.22      # turned well round to face INTO the stage, so the cone projects across it, not at the viewer or off the edge


def camera_rest(sweep=None):
    return VGroup(cam_casing(), cam_plate(), cam_lenses(), capture_cone(1.0, sweep))


# ── the sensor, the end of act 0 ────────────────────────────────────────────
SEN_C = (0.0, 0.9)
PX_C, PX_R, PX = 8, 6, 0.3


def pixel_colour(c, r):
    """The picture, sampled at 8 x 6: wall, table, the three cubes."""
    u = (c + 0.5) / PX_C * 2 - 1
    v = 1 - (r + 0.5) / PX_R * 2
    for (cc, s, col) in CUBES:
        if abs(u - cc[0]) < s * 0.8 and abs(v - cc[1]) < s * 1.2:
            return PAL[col]
    return PAL["table"] if v < -0.05 else PAL["wall"]


def sensor(lit=1.0, band=None):
    x, y = SEN_C
    w, h = PX_C * PX, PX_R * PX
    g = VGroup()
    g.add(Rectangle(width=w + 0.5, height=h + 0.5, fill_color=PAL["panel"], fill_opacity=1, stroke_color=PAL["ink"], stroke_width=1.5).move_to([x, y, 0]))
    pins = VGroup()
    for i in range(14):
        px = x - (w + 0.5) / 2 + 0.15 + i * (w + 0.2) / 13.5
        pins.add(Line([px, y + (h + 0.5) / 2, 0], [px, y + (h + 0.5) / 2 + 0.12, 0], stroke_color=PAL["soft"], stroke_width=1.5))
        pins.add(Line([px, y - (h + 0.5) / 2, 0], [px, y - (h + 0.5) / 2 - 0.12, 0], stroke_color=PAL["soft"], stroke_width=1.5))
    g.add(pins)
    g.add(Rectangle(width=w + 0.08, height=h + 0.08, fill_color="#1A1B1E", fill_opacity=1, stroke_width=0).move_to([x, y, 0]))
    n = PX_C * PX_R
    for i in range(n):
        c, r = i % PX_C, i // PX_C
        a = smooth01(lit * 1.3 - (i / n) * 0.3)
        if a <= 0:
            continue
        g.add(Square(PX * 0.82 * (0.4 + 0.6 * a), fill_color=pixel_colour(c, r), fill_opacity=a, stroke_width=0)
              .move_to([x - w / 2 + (c + 0.5) * PX, y + h / 2 - (r + 0.5) * PX, 0]))
    if band is not None:
        g.add(Rectangle(width=w + 0.1, height=0.12, fill_color=PAL["copper"], fill_opacity=0.35, stroke_width=0).move_to([x, y + h / 2 - band * h, 0]))
    return g


def state0():
    return VGroup(tracker(0), sensor(1.0))


# ── act 1: the VLA ──────────────────────────────────────────────────────────
TOK_Y, LANG_Y = 0.62, 0.3
LAYER_Y = [-0.32, -0.64, -0.96, -1.28]
NTOK = 13


def tok_x(k):
    return (k - (NTOK - 1) / 2) * 0.245


def patch_colour(k):
    c, r = k % 4, k // 4
    return pixel_colour(min(PX_C - 1, c * 2 + 1), min(PX_R - 1, r * 2 + 1))


def tokens(hot=-1):
    g = VGroup()
    for k in range(NTOK):
        col = PAL["red"] if k == 12 else patch_colour(k)
        sq = iso_cube((tok_x(k), TOK_Y), 0.18, col, depth=0.35)
        g.add(sq)
        if k == 12 or k == hot:
            g.add(Square(0.24, stroke_color=PAL["ink"], stroke_width=1.8).move_to([tok_x(k), TOK_Y, 0]))
    return g


def lang_tokens():
    widths = [0.28, 0.24, 0.26, 0.32, 0.18, 0.24, 0.26]
    g, x = VGroup(), -sum(widths) / 2 - 0.05 * 3
    for wd in widths:
        g.add(RoundedRectangle(width=wd, height=0.16, corner_radius=0.05, stroke_color=PAL["gold"], stroke_width=1.5).move_to([x + wd / 2, LANG_Y, 0]))
        x += wd + 0.05
    return g


def layers(run=None):
    g = VGroup()
    for i, y in enumerate(LAYER_Y):
        lit = 0.0 if run is None else max(0.0, 1 - abs(run * 4.4 - i) * 1.3)
        g.add(RoundedRectangle(width=3.4, height=0.2, corner_radius=0.06, fill_color=ManimColor(PAL["slab"]).darker(0.12), fill_opacity=1, stroke_width=0).move_to([0.06, y - 0.06, 0]))
        g.add(RoundedRectangle(width=3.4, height=0.2, corner_radius=0.06, fill_color=PAL["slab"], fill_opacity=1,
                               stroke_color=PAL["copper"] if lit > 0.3 else PAL["line"], stroke_width=1.5 + lit).move_to([0, y, 0]))
        if lit > 0:
            g.add(RoundedRectangle(width=3.3 * lit + 0.01, height=0.08, corner_radius=0.03, fill_color=PAL["copper"], fill_opacity=0.35 * lit, stroke_width=0).move_to([0, y, 0]))
    return g


def attention(hot, a=1.0):
    g = VGroup()
    src = tok_x(hot if hot >= 0 else 12)
    for d in (-5, -2, 1, 4, 7):
        k = min(max((hot if hot >= 0 else 12) + d, 0), NTOK - 1)
        g.add(ArcBetweenPoints([src, TOK_Y - 0.13, 0], [tok_x(k) * 0.95, LAYER_Y[0] + 0.1, 0], angle=-0.5 if d > 0 else 0.5,
                               stroke_color=PAL["copper"], stroke_width=1.2, stroke_opacity=0.55 * a))
    return g


PANEL_C = (0.0, -2.25)


def action_panel(u=0.0, center=PANEL_C, scale=1.0, lab="action chunk", lab_a=1.0):
    cx, cy = center
    w, h = 2.2 * scale, 1.05 * scale
    g = VGroup(RoundedRectangle(width=w, height=h, corner_radius=0.08 * scale, fill_color=PAL["panel"], fill_opacity=1,
                                stroke_color=PAL["line"], stroke_width=1.5).move_to([cx, cy, 0]))
    # the chunk: the next 16 steps of the gripper's path in the picture
    pts = []
    for i in range(24):
        gp, _, _ = pic_state(u + i * 0.02)
        pts.append([cx + gp[0] * w * 0.4, cy + (gp[1] - 0.05) * h * 0.55, 0])
    g.add(VMobject(stroke_color=PAL["line"], stroke_width=2).set_points_smoothly(pts))
    for i in range(16):
        gp, op, _ = pic_state(u + i * 0.03)
        g.add(Dot([cx + gp[0] * w * 0.4, cy + (gp[1] - 0.05) * h * 0.55, 0], radius=(0.05 if i == 0 else 0.028) * scale, color=PAL["copper"]))
    if lab:
        g.add(fade(label(lab, 12 if scale > 0.7 else 10).next_to(g[0], DOWN if scale > 0.7 else RIGHT, buff=0.1), lab_a))
    return g


def vla_label(a=1.0):
    return fade(label("VLA · vision + language → action", 12).move_to([0, LAYER_Y[0] + 0.28, 0]), a)


def state1(u=0.0, hot=-1, run=None):
    return VGroup(tracker(0), picture(u), tokens(hot), lang_tokens(), attention(hot), layers(run),
                  Line([0, LAYER_Y[-1] - 0.12, 0], [0, PANEL_C[1] + 0.55, 0], stroke_color=PAL["line"], stroke_width=2),
                  vla_label(), action_panel(u))


# ── act 2: the world model ──────────────────────────────────────────────────
LAT_Y = -0.35
LAT_X = [-1.5 + k * 0.75 for k in range(5)]
FRAME_Y = -1.75
PANEL_SMALL = (0.0, 0.62)


def latents(pulse=None, grow=None, LAT_Y=LAT_Y):
    g = VGroup()
    for k, x in enumerate(LAT_X):
        s = 1.0 if grow is None else grow(k)
        if s <= 0.01:
            continue
        box = VGroup(Rectangle(width=0.4, height=0.55, fill_color=ManimColor(PAL["slab"]).darker(0.12), fill_opacity=1, stroke_width=0).move_to([x + 0.05, LAT_Y - 0.05, 0]),
                     Rectangle(width=0.4, height=0.55, fill_color=PAL["slab"], fill_opacity=1, stroke_color=PAL["line"], stroke_width=1.5).move_to([x, LAT_Y, 0]))
        for c in range(5):
            on = math.sin(c * 2.1 + k * 1.3) > 0.1
            box.add(Rectangle(width=0.26, height=0.05, fill_color=PAL["copper"] if on else PAL["line"], fill_opacity=0.9, stroke_width=0).move_to([x, LAT_Y + 0.18 - c * 0.09, 0]))
        g.add(box.scale(s, about_point=[x, LAT_Y, 0]))
        if k < 4 and (grow is None or grow(k + 1) > 0.5):
            g.add(Arrow([x + 0.22, LAT_Y, 0], [LAT_X[k + 1] - 0.22, LAT_Y, 0], buff=0, stroke_width=2, color=PAL["soft"],
                        max_tip_length_to_length_ratio=0.35))
            ax = (x + LAT_X[k + 1]) / 2
            g.add(Square(0.1, fill_color=PAL["copper"], fill_opacity=1, stroke_width=0).move_to([ax, LAT_Y + 0.36, 0]))
            g.add(Line([ax, LAT_Y + 0.3, 0], [ax, LAT_Y + 0.05, 0], stroke_color=PAL["copper"], stroke_width=1.5))
    if pulse is not None:
        g.add(Dot([LAT_X[0] + pulse * (LAT_X[4] - LAT_X[0]), LAT_Y, 0], radius=0.06, color=PAL["copper"]))
    return g


def imagined(u=0.0, grow=None, LAT_Y=LAT_Y, FRAME_Y=FRAME_Y):
    g = VGroup()
    for k in range(1, 5):
        s = 1.0 if grow is None else grow(k)
        if s <= 0.01:
            continue
        x = LAT_X[k]
        g.add(fade(Line([x, LAT_Y - 0.3, 0], [x, FRAME_Y + 0.3, 0], stroke_color=PAL["line"], stroke_width=1.5), s))
        pic = picture(u + k * 0.08, w=0.66, h=0.46, center=(x, FRAME_Y, 0))
        fade(pic, s * (1 - (k - 1) * 0.13))
        g.add(pic)
    return g


def wm_label(a=1.0):
    return fade(label("world model", 12).move_to([LAT_X[0] + 0.3, LAT_Y + 0.52, 0]), a)


def fut_label(a=1.0):
    return fade(label("imagined futures", 12).move_to([0.37, FRAME_Y - 0.42, 0]), a)


def state2(u=0.0, pulse=None):
    return VGroup(tracker(0), picture(u), action_panel(u, PANEL_SMALL, 0.42, "actions"), latents(pulse), wm_label(), imagined(u), fut_label())


# ── act 3: real2sim ─────────────────────────────────────────────────────────
def floor_pt(uu, vv, hh=0.0, c=(0.0, -0.7), sc=1.0):
    """The table in perspective: uu -1..1 across, vv 0 (near) .. 1 (far)."""
    return [c[0] + sc * uu * (1.75 - 0.55 * vv), c[1] + sc * (-0.75 + 1.35 * vv + hh), 0]


FL_CUBES = [((0.25, 0.45), 0.34, "red"), ((0.62, 0.32), 0.28, "green"), ((-0.6, 0.25), 0.24, "blue")]
FL_A, FL_B = (0.25, 0.45), (-0.2, 0.62)


def floor_grid(c=(0.0, -0.7), sc=1.0, a=1.0, solid=0.0):
    g = VGroup()
    if solid > 0:
        g.add(Polygon(floor_pt(-1, 0, 0, c, sc), floor_pt(1, 0, 0, c, sc), floor_pt(1, 1, 0, c, sc), floor_pt(-1, 1, 0, c, sc),
                      fill_color=PAL["table"], fill_opacity=solid, stroke_color=PAL["line"], stroke_width=2 * solid))
        g.add(Polygon(floor_pt(-1, 0, 0, c, sc), floor_pt(1, 0, 0, c, sc), floor_pt(1, 0, -0.12, c, sc), floor_pt(-1, 0, -0.12, c, sc),
                      fill_color=ManimColor(PAL["table"]).darker(0.2), fill_opacity=solid, stroke_width=0))
    for i in range(7):
        f = i / 6
        g.add(Line(floor_pt(-1 + 2 * f, 0, 0, c, sc), floor_pt(-1 + 2 * f, 1, 0, c, sc), stroke_color=PAL["line"], stroke_width=1.3, stroke_opacity=a))
        g.add(Line(floor_pt(-1, f, 0, c, sc), floor_pt(1, f, 0, c, sc), stroke_color=PAL["line"], stroke_width=1.3, stroke_opacity=a))
    return g


def floor_cubes(c=(0.0, -0.7), sc=1.0, jig=None, tints=None, red_at=None, a=1.0):
    g = VGroup()
    for i, (p, s, col) in enumerate(FL_CUBES):
        uu, vv = p
        if jig is not None:
            uu += 0.18 * math.sin(jig + i * 2.3)
            vv += 0.12 * math.cos(jig * 0.8 + i * 1.7)
        base = floor_pt(uu, vv, 0, c, sc)
        hh = 0.0
        if i == 0 and red_at is not None:
            base = floor_pt(red_at[0], red_at[1], 0, c, sc)
            hh = red_at[2] * sc
        sz = s * sc * (1 - 0.3 * vv)
        colr = PAL[tints[i]] if tints else PAL[col]
        g.add(fade(iso_cube((base[0], base[1] + sz / 2 + hh), sz, colr), a))
    # far cubes behind near ones: draw in order of depth
    return VGroup(*sorted(g, key=lambda m: -m.get_center()[1]))


def splats(t, seed=3):
    g = VGroup()
    rnd = __import__("random").Random(seed)
    for (p, s, col) in FL_CUBES:
        base = floor_pt(p[0], p[1])
        for j in range(26):
            x = base[0] + (rnd.random() - 0.5) * s * 1.3
            y = base[1] + rnd.random() * s * 1.1
            r = 0.02 + rnd.random() * 0.035
            g.add(fade(Dot([x, y, 0], radius=r, color=PAL[col]), 0.55 * t))
    return g


TWIN_L, TWIN_R, TWIN_SC = (-1.0, 2.1), (1.0, 2.1), 0.46


def twins(jig=0.0, a=1.0):
    g = VGroup()
    for c, tints, ph in ((TWIN_L, ["blue", "red", "green"], 0.0), (TWIN_R, ["green", "blue", "red"], 2.2)):
        g.add(floor_grid(c, TWIN_SC, a))
        g.add(floor_cubes(c, TWIN_SC, jig=jig + ph, tints=tints, a=a))
    return g


CURVE_C = (0.0, -2.75)


def curve(upto=1.0, flick=0.0, a=1.0, C=CURVE_C, w=2.4, h=0.8, lab="training in sim"):
    cx, cy = C
    g = VGroup(Line([cx - w / 2, cy - h / 2, 0], [cx + w / 2, cy - h / 2, 0], stroke_color=PAL["line"], stroke_width=1.8),
               Line([cx - w / 2, cy - h / 2, 0], [cx - w / 2, cy + h / 2, 0], stroke_color=PAL["line"], stroke_width=1.8))
    pts = []
    n = 40
    for i in range(n + 1):
        x = i / n
        if x > upto:
            break
        yv = 1 - math.exp(-x * 3.4) - math.sin(x * 19) * 0.05 * (1 - x) + flick * math.sin(x * 40 + flick * 9) * 0.03 * smooth01((x - 0.6) / 0.4)
        pts.append([cx - w / 2 + x * w, cy - h / 2 + yv * h * 0.9, 0])
    if len(pts) > 1:
        g.add(VMobject(stroke_color=PAL["copper"], stroke_width=2.6).set_points_smoothly(pts))
    g.add(label(lab, 12 if w > 2 else 11).next_to(g[0], DOWN, buff=0.1))
    return fade(g, a) if a < 1 else g


def state3(jig=0.0, flick=0.0):
    return VGroup(tracker(1), floor_grid(), floor_cubes(), label("real2sim", 12).move_to([-1.1, 0.55, 0]),
                  twins(jig), label("domain randomization", 12).move_to([0, 2.95, 0]), curve(1.0, flick))


# ── act 4: sim2real ─────────────────────────────────────────────────────────
def pick3(u):
    k0, k1, f = pick_key(u)
    CS = FL_CUBES[0][1] * (1 - 0.3 * 0.45)

    def spot(sp, lv):
        if sp == "H":
            return (-0.55, 0.3, 1.4)
        c = FL_A if sp == "A" else FL_B
        return (c[0], c[1], 1.0) if lv else (c[0], c[1], CS * 0.55)
    p0, p1 = spot(k0[1], k0[2]), spot(k1[1], k1[2])
    g = tuple(p0[i] + (p1[i] - p0[i]) * f for i in range(3))
    op = k0[3] + (k1[3] - k0[3]) * f
    ph = k0[4]
    cube = (g[0], g[1], g[2] - CS * 0.55) if ph in (1, 3) else ((FL_B[0], FL_B[1], 0.0) if ph == 2 else (FL_A[0], FL_A[1], 0.0))
    return g, op, cube


def gripper3(g, op, a=1.0, drop=0.0):
    base = floor_pt(g[0], g[1], g[2] + drop)
    x, y = base[0], base[1]
    o = 0.2 + 0.09 * op
    grp = VGroup(Line([x, 3.1, 0], [x, y + 0.36, 0], stroke_color=PAL["steel"], stroke_width=6),
                 Rectangle(width=2 * o + 0.14, height=0.1, fill_color=PAL["ink"], fill_opacity=1, stroke_width=0).move_to([x, y + 0.31, 0]))
    for sg in (-1, 1):
        grp.add(Rectangle(width=0.06, height=0.3, fill_color=PAL["ink"], fill_opacity=1, stroke_width=0).move_to([x + sg * o, y + 0.13, 0]))
        grp.add(Rectangle(width=0.06, height=0.06, fill_color=PAL["copper"], fill_opacity=1, stroke_width=0).move_to([x + sg * o, y - 0.02, 0]))
    return fade(grp, a) if a < 1 else grp


def table_scene(u=0.0, a=1.0, drop=0.0):
    g, op, cube = pick3(u)
    cubes = floor_cubes(red_at=cube)
    return VGroup(floor_grid(a=0.0, solid=1.0), cubes, gripper3(g, op, a, drop))


def state4(u=0.0):
    return VGroup(tracker(2), table_scene(u), label("sim2real", 12).move_to([-1.25, -2.05, 0]))


# ═══════════════════ THE STORY, IN THE ORDER IT HAPPENS ═══════════════════
# (the owner, on the first cut: "does the progression make sense?" — it did
# not: the VLA drove the gripper perfectly BEFORE anything was trained, and
# the sim section ended where it began. Now: real (an untrained policy
# fumbles) -> real2sim -> sim data (randomised twins, a world model imagining
# rollouts) -> train the VLA on it -> sim2real (the same gripper succeeds).)

def untrained_label(a=1.0):
    return fade(label("policy · untrained", 12).move_to([0, 0.72, 0]), a)


def S0(u=0.0):
    """Real: the camera's picture, the untrained policy. (No tracker yet: the
    real/sim/real bar arrives with real2sim — the owner: "the real to sim to
    real bar is showing up too early".)"""
    return VGroup(picture(u, fumble=True), untrained_label())


def r2s_label(a=1.0):
    return fade(label("real2sim", 12).move_to([-1.1, 0.55, 0]), a)


def scan_band(v):
    """A scan line sweeping the sim twin, depth-wise."""
    return Line(floor_pt(-1, v), floor_pt(1, v), stroke_color=PAL["copper"], stroke_width=2.5, stroke_opacity=0.6 * math.sin(math.pi * v))


def S1(v=None):
    """Real2sim: the sim twin."""
    g = VGroup(tracker(1), floor_grid(), floor_cubes(), r2s_label())
    if v is not None:
        g.add(scan_band(v))
    return g


C2, SC2 = (0.0, -0.15), 0.8            # the twin, moved up, while the data is made
LAT2, FR2 = -1.85, -2.95


def demo_path(c, sc, ph, prog=1.0):
    """A demonstration in a twin: the red cube's pick-and-place arc, dashed."""
    pts = []
    for i in range(25):
        f = i / 24
        uu = 0.25 + (-0.45 - 0.25) * f + 0.1 * math.sin(ph)
        vv = 0.45 + 0.15 * math.sin(math.pi * f + ph)
        pts.append(floor_pt(uu, vv, 0.9 * math.sin(math.pi * f), c, sc))
    path = VMobject().set_points_smoothly(pts)
    return DashedVMobject(path, num_dashes=12).set_stroke(PAL["copper"], 1.8, opacity=0.85 * prog)


def S2(jig=0.0, pulse=None, u=0.0):
    """Sim data: randomised twins producing demos; a world model imagining rollouts."""
    g = VGroup(tracker(1), floor_grid(C2, SC2), floor_cubes(C2, SC2))
    g.add(twins(jig))
    g.add(demo_path(TWIN_L, TWIN_SC, jig), demo_path(TWIN_R, TWIN_SC, jig + 2.2))
    g.add(label("domain randomization", 12).move_to([0, 2.95, 0]), label("1,000+ demos", 11).move_to([0, 1.5, 0]))
    g.add(latents(pulse, LAT_Y=LAT2), label("world model", 12).move_to([LAT_X[0] + 0.3, LAT2 + 0.52, 0]),
          imagined(u, LAT_Y=LAT2, FRAME_Y=FR2), label("imagined rollouts", 12).move_to([0.37, FR2 - 0.42, 0]))
    return g


DATA_C = (-0.95, 2.2)
CURVE3 = dict(C=(0.95, 2.25), w=1.45, h=0.62, lab="policy success")


def dataset(a=1.0):
    """The demos, as a stack of sim frames."""
    g = VGroup()
    for k in range(3):
        c = (DATA_C[0] - 0.12 + k * 0.12, DATA_C[1] - 0.1 + k * 0.1)
        card = VGroup(Rectangle(width=1.15, height=0.62, fill_color=PAL["panel"], fill_opacity=1, stroke_color=PAL["line"], stroke_width=1.3).move_to([c[0], c[1], 0]))
        cc = (c[0], c[1] + 0.12)
        card.add(floor_grid(cc, 0.3), floor_cubes(cc, 0.3, jig=k * 1.7))
        g.add(card)
    g.add(label("sim demos", 11).move_to([DATA_C[0], DATA_C[1] - 0.55, 0]))
    return fade(g, a) if a < 1 else g


def S3(u=0.0, hot=-1, run=None, upto=1.0, flick=0.0):
    """Train the VLA on the sim demos."""
    return VGroup(tracker(1), dataset(), curve(upto, flick, **CURVE3), tokens(hot), lang_tokens(), attention(hot), layers(run),
                  Line([0, LAYER_Y[-1] - 0.12, 0], [0, PANEL_C[1] + 0.55, 0], stroke_color=PAL["line"], stroke_width=2),
                  vla_label(), action_panel(u))


PANEL4 = (0.0, 2.35)


def S4(u=0.0):
    """Sim2real: the trained VLA drives the real gripper."""
    return VGroup(tracker(2), action_panel(u, PANEL4, 0.42, "VLA policy"), table_scene(u),
                  label("sim2real", 12).move_to([-1.25, -2.05, 0]), label("policy · trained in sim", 11).move_to([0.5, -2.4, 0]))


# ═══════════════════════════ the scenes ═══════════════════════════════════
class Base(Scene):
    def finish(self, final):
        """End on exactly `final`, the builder the next act starts from."""
        self.clear()
        self.add(final)
        self.wait(1 / config.frame_rate)


def idle(scene, build, t):
    u = ValueTracker(0)
    scene.add(always_redraw(lambda: build(u.get_value())))
    scene.play(u.animate.set_value(1), run_time=t, rate_func=linear)


class IdleRest(Scene):
    """The camera, in 3D, swaying about its vertical axis; a frame of light
    sweeps out along its capture cone."""
    def construct(self):
        u = ValueTracker(0)
        self.add(always_redraw(lambda: cam3d(YAW0 + 0.32 * math.sin(math.tau * u.get_value()), PITCH0 + 0.06 * math.sin(math.tau * 2 * u.get_value()),
                                             sweep=(u.get_value() * 3) % 1)))
        self.play(u.animate.set_value(1), run_time=IDLE_T * 1.5, rate_func=linear)


class Act0(Base):
    """Real: the camera, in 3D, explodes along its depth; the stereo module turns
    square-on, the barrel lifts, the sensor catches light, the pixels become
    the picture."""
    def construct(self):
        ex, yaw, oth, cone = ValueTracker(0), ValueTracker(YAW0), ValueTracker(1), ValueTracker(1)
        self.add(always_redraw(lambda: cam3d(yaw.get_value(), PITCH0, ex.get_value(), cone.get_value(), others=oth.get_value())))
        # 1 · the exploded view, turning a little further so the layers read
        self.play(ex.animate.set_value(1), yaw.animate.set_value(1.15), cone.animate.set_value(0), run_time=1.1, rate_func=smooth)
        # 2 · the rest goes; the camera turns square-on
        self.play(oth.animate.set_value(0), yaw.animate.set_value(0), run_time=0.7)
        self.clear()
        # hand over to the flat module at the sensor
        mc = np.array([SEN_C[0], SEN_C[1], 0])
        module, barrel = cam_module(), rgb_barrel()
        flat = VGroup(module, barrel)
        flat.shift(mc - module[0].get_center()).scale(1.25, about_point=mc)
        m3 = cam3d(0, PITCH0, 1, 0, others=0)
        self.add(m3)
        self.play(ReplacementTransform(m3, flat), run_time=0.45)
        die_at = barrel.get_center()
        die = Square(0.16, fill_color="#1A1B1E", fill_opacity=1, stroke_color=PAL["gold"], stroke_width=1.5).move_to(die_at)
        self.add(die)
        self.bring_to_front(barrel)
        self.play(barrel.animate.shift([0.35, 0.55, 0]).rotate(0.6).set_opacity(0), run_time=0.4)
        src = [die_at + np.array([0.5 + 0.12 * i, 1.1 - 0.05 * i, 0]) for i in range(5)]
        rays = VGroup(*[Line(p, die_at, stroke_color=PAL["copper"], stroke_width=2) for p in src])
        self.play(LaggedStart(*[ShowPassingFlash(r.copy(), time_width=0.6) for r in rays], lag_ratio=0.12), run_time=0.45)
        self.play(Flash(die_at, color=PAL["copper"], line_length=0.14, num_lines=10, flash_radius=0.16), run_time=0.3)
        sen = sensor(1.0)
        self.play(FadeOut(module), ReplacementTransform(die, sen), run_time=0.5)
        pic = picture(0, fumble=True)
        self.play(ReplacementTransform(sen, pic), run_time=0.6)
        self.play(Write(untrained_label()), run_time=0.45)
        self.finish(S0())


class IdleUntrained(Scene):
    def construct(self):
        idle(self, S0, IDLE_T)


class Act1(Base):
    """Real2sim: the bar arrives; the picture lies down; a Gaussian splat condenses into the sim twin."""
    def construct(self):
        pic, lab = S0()
        self.add(pic, lab)
        p = ValueTracker(0)
        # the real / sim / real bar draws itself in, here, where sim begins
        self.play(Unwrite(lab), Create(tracker(0)), run_time=0.5)
        self.add(always_redraw(lambda: tracker(p.get_value())))
        grid = floor_grid()
        self.play(ReplacementTransform(pic, grid), p.animate.set_value(0.5), run_time=0.85)
        sp = splats(1.0)
        self.play(LaggedStart(*[GrowFromCenter(d) for d in sp], lag_ratio=0.01), Write(r2s_label()), run_time=0.6)
        cubes = floor_cubes()
        self.play(FadeOut(sp, scale=0.6), LaggedStart(*[GrowFromPoint(c, c.get_bottom()) for c in cubes], lag_ratio=0.2),
                  p.animate.set_value(1.0), run_time=0.7)
        self.play(Circumscribe(VGroup(grid, cubes), color=PAL["copper"], buff=0.08, stroke_width=2), run_time=0.55)
        self.finish(S1())


class IdleTwin(Scene):
    def construct(self):
        idle(self, lambda u: S1(v=u), IDLE_T * 0.75)


class Act2(Base):
    """Sim data: the twin is randomised into demos, and a world model imagines rollouts."""
    def construct(self):
        tr, grid, cubes, lab = S1()
        self.add(tr, lab)
        m = ValueTracker(0)
        mv = lambda: (0.0, -0.7 + (C2[1] + 0.7) * m.get_value())
        sc = lambda: 1.0 + (SC2 - 1.0) * m.get_value()
        self.add(always_redraw(lambda: VGroup(floor_grid(mv(), sc()), floor_cubes(mv(), sc()))))
        self.play(m.animate.set_value(1), Unwrite(lab), run_time=0.55)
        # domain randomisation: the twin is copied out, re-arranged, re-tinted
        tw = twins(0.0)
        src = VGroup(floor_grid(C2, SC2), floor_cubes(C2, SC2))
        self.play(TransformFromCopy(src, tw), Write(label("domain randomization", 12).move_to([0, 2.95, 0])), run_time=0.6)
        self.play(Create(demo_path(TWIN_L, TWIN_SC, 0.0)), Create(demo_path(TWIN_R, TWIN_SC, 2.2)),
                  Write(label("1,000+ demos", 11).move_to([0, 1.5, 0])), run_time=0.55)
        # the world model: latents grow one after another, a pulse runs the chain
        lat = latents(LAT_Y=LAT2)
        self.play(LaggedStart(*[GrowFromCenter(m_) for m_ in lat], lag_ratio=0.05), Write(label("world model", 12).move_to([LAT_X[0] + 0.3, LAT2 + 0.52, 0])), run_time=0.75)
        run = Line([LAT_X[0], LAT2, 0], [LAT_X[4], LAT2, 0], stroke_color=PAL["copper"], stroke_width=5)
        self.play(ShowPassingFlash(run, time_width=0.35), run_time=0.5)
        im = imagined(0, LAT_Y=LAT2, FRAME_Y=FR2)
        self.play(LaggedStart(*[FadeIn(m_, shift=DOWN * 0.15) for m_ in im], lag_ratio=0.12), Write(label("imagined rollouts", 12).move_to([0.37, FR2 - 0.42, 0])), run_time=0.7)
        self.finish(S2())


class IdleData(Scene):
    def construct(self):
        idle(self, lambda u: S2(jig=math.tau * u, pulse=(u * 3) % 1, u=u), IDLE_T * 1.5)


class Act3(Base):
    """Train the VLA on the sim data."""
    def construct(self):
        s2 = S2()
        self.add(s2)
        rest = VGroup(*s2[1:])
        # the sim data collapses into a dataset
        self.play(rest.animate.scale(0.25).move_to([DATA_C[0], DATA_C[1], 0]).set_opacity(0), DrawBorderThenFill(dataset()), run_time=0.8)
        self.remove(rest)
        # it is tokenised into the VLA
        tok = tokens()
        self.play(LaggedStart(*[TransformFromCopy(Dot([DATA_C[0], DATA_C[1] - 0.2, 0], radius=0.04, color=PAL["copper"]), t) for t in tok], lag_ratio=0.04), run_time=0.65)
        self.play(Circumscribe(VGroup(tok[12], tok[13]), color=PAL["red"], buff=0.05, stroke_width=2), run_time=0.4)
        self.play(LaggedStart(*[Create(q) for q in lang_tokens()], lag_ratio=0.1), run_time=0.35)
        lay = layers()
        self.play(LaggedStart(*[GrowFromEdge(l, UP) for l in lay], lag_ratio=0.08), Write(vla_label()), Create(attention(-1)), run_time=0.5)
        # a forward pass: flashes run down through the slabs to the action chunk
        down = VGroup(*[Line([x, TOK_Y - 0.15, 0], [x * 0.6, PANEL_C[1] + 0.55, 0], stroke_color=PAL["copper"], stroke_width=3) for x in (-1.0, -0.3, 0.4, 1.1)])
        self.play(Create(Line([0, LAYER_Y[-1] - 0.12, 0], [0, PANEL_C[1] + 0.55, 0], stroke_color=PAL["line"], stroke_width=2)),
                  LaggedStart(*[ShowPassingFlash(d, time_width=0.5) for d in down], lag_ratio=0.15),
                  FadeIn(action_panel(0), shift=DOWN * 0.15), run_time=0.55)
        # and its success in sim climbs
        cu = ValueTracker(0.02)
        self.add(always_redraw(lambda: curve(cu.get_value(), **CURVE3)))
        self.play(cu.animate.set_value(1.0), run_time=0.7, rate_func=linear)
        self.play(Indicate(curve(1.0, **CURVE3)[-1], color=PAL["copper"], scale_factor=1.12), run_time=0.45)
        self.finish(S3())


class IdleTrain(Scene):
    def construct(self):
        idle(self, lambda u: S3(u, hot=int(u * 26) % NTOK, run=(u * 3) % 1, flick=math.sin(math.tau * u)), IDLE_T * 2)


class Act4(Base):
    """Sim2real: the trained VLA drives the real gripper."""
    def construct(self):
        s3 = S3()
        tr, data, crv, tok, lang, att, lay, arrow, vlab, panel = s3
        self.add(s3)
        p = ValueTracker(1.0)
        self.remove(tr)
        self.add(always_redraw(lambda: tracker(p.get_value())))
        self.play(FadeOut(VGroup(data, crv, tok, lang, att, lay, arrow), lag_ratio=0.05), Unwrite(vlab),
                  ReplacementTransform(panel, action_panel(0, PANEL4, 0.42, "VLA policy")), p.animate.set_value(1.5), run_time=0.8)
        self.play(DrawBorderThenFill(floor_grid(a=0.0, solid=1.0)), LaggedStart(*[GrowFromPoint(c, c.get_bottom()) for c in floor_cubes()], lag_ratio=0.15), run_time=0.7)
        d = ValueTracker(2.2)
        g0, op0, _ = pick3(0)
        self.add(always_redraw(lambda: gripper3(g0, op0, 1.0, d.get_value())))
        self.play(d.animate.set_value(0.0), p.animate.set_value(2.0),
                  Write(label("sim2real", 12).move_to([-1.25, -2.05, 0])), Write(label("policy · trained in sim", 11).move_to([0.5, -2.4, 0])),
                  run_time=1.0, rate_func=smooth)
        self.play(Circumscribe(action_panel(0, PANEL4, 0.42, "VLA policy")[0], color=PAL["copper"], buff=0.05, stroke_width=2), run_time=0.45)
        self.finish(S4())


def grasp_burst(u):
    """A small Flash-style burst at the cube, just after the jaw closes on it
    (u 0.22-0.30) and when it lets go at B (u 0.54-0.62)."""
    g = VGroup()
    for t0 in (0.22, 0.54):
        f = (u - t0) / 0.08
        if 0 <= f <= 1:
            gg, _, cube = pick3(u)
            c = floor_pt(cube[0], cube[1], cube[2] + 0.12)
            for i in range(10):
                ang = i / 10 * math.tau
                r0, r1 = 0.18 + 0.12 * f, 0.26 + 0.14 * f
                g.add(Line([c[0] + r0 * math.cos(ang), c[1] + r0 * math.sin(ang), 0], [c[0] + r1 * math.cos(ang), c[1] + r1 * math.sin(ang), 0],
                           stroke_color=PAL["copper"], stroke_width=2, stroke_opacity=1 - f))
    return g


class IdleReal(Scene):
    def construct(self):
        idle(self, lambda u: VGroup(S4(u), grasp_burst(u)), IDLE_T * 2)
