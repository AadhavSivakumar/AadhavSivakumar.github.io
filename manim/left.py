"""The LEFT stage of the site, as Manim scenes, scrubbed by the scroll.

One story — the owner's pipeline, real -> sim -> real — in five acts (one per
page boundary) and six idle loops (one per page the reader can stop on). ONE
shot recurs: a table, three cubes, a copper target mark and a small arm
clamped to the table's far-left corner (the SO-ARM101 of the right-hand
stage, drawn flat). The real shot and the sim shot are the same geometry in
two looks, so real -> sim and sim -> real are true morphs.

  IdleRest      (Experience)   the D435i over the table, its view cone on it
  Act0          Exp -> Research  the camera blows apart and its parts fly off
                                 the stage, leaving the bare sensor die; light
                                 runs up the view onto it, the die spreads into
                                 the photosite array, read out row by row, a
                                 mosaic that resolves into the photo
  IdleUntrained (Research)     REAL, untrained policy: the arm grasps at air
                                 (a trail, an x at each empty grasp)
  Act1          -> Projects    REAL2SIM: multi-view capture, the photo
                                 dissolves into Gaussian splats that settle
                                 onto the surfaces, the sim twin draws in
  IdleTwin      (Projects)     the twin simulates: the red cube drops, bounces
  Act2          -> More        SIM DATA: the twin tiles a wall of randomised
                                 copies, each arm runs a demonstration; a
                                 world model rolls one forward in latent space
  IdleData      (More)         six demonstrations running, out of phase
  Act3          -> Resume      TRAIN: the wall stacks into a dataset, a frame
                                 is patched into tokens beside the instruction,
                                 the VLA's predicted action chunk converges on
                                 the demonstration as the loss falls
  IdleTrain     (Resume)       forward / backward passes, chunk on target
  Act4          -> Contact     SIM2REAL: the VLA folds into a chip that flies
                                 into the arm's base; the twin is re-lit as the
                                 real shot
  IdleReal      (Contact)      the SAME shot as IdleUntrained, now succeeding

Seams are exact by construction: every act starts from S(K-1)() and ends with
finish(SK()), the builders the idles use.

Render (scripts/render-left.sh renders both themes and encodes):
  THEME=light manim -qh --disable_caching manim/left.py Act1
"""
from manim import *
import math
import os
import random

THEME = os.environ.get("THEME", "light")
# The site's language: ink hairlines, near-white fills, ONE accent (terracotta).
# The background is the PAGE'S OWN colour (App.css --background-color, light
# and dark): change these if the page colour changes.
PAL = {
    "light": dict(bg="#F6F5F1", ink="#1A1917", soft="#8C8981", line="#D9D5CD", gold="#1A1917",
                  copper="#C0553A", red="#C0553A",
                  panel="#FFFFFF", body="#E6E3DC", plate="#1E1E1F", steel="#C9C6BF",
                  pcb="#B8B4AB", slab="#F6F4EF", cube="#F3F1EC",
                  wall="#ECEAE4", floor="#E2DFD7", table="#FBFAF7", lip="#D3CFC6", arm="#FBFAF7", shadow="#1A1917"),
    "dark": dict(bg="#0C0C0D", ink="#E9E7E2", soft="#8A8780", line="#3A3935", gold="#E9E7E2",
                 copper="#E0735A", red="#E0735A",
                 panel="#161615", body="#77746E", plate="#2C2C2E", steel="#6A6863",
                 pcb="#4A4946", slab="#131312", cube="#1E1D1C",
                 wall="#171716", floor="#121211", table="#252422", lip="#33322F", arm="#3A3936", shadow="#000000"),
}[THEME]

# the stage is 340 x 660 on the page; rendered at 1.5x
config.pixel_width = 510
config.pixel_height = 990
config.frame_height = 8.0
config.frame_width = 8.0 * 510 / 990
config.frame_rate = 30
# The ACTS are scrubbed by the scroll and every frame of them is a keyframe,
# so their size is per frame: 20 fps is ~a frame per 9 px of scroll, smooth
# under a scrub, and a third lighter. The idles PLAY, at 30.
import sys
if any(a.startswith("Act") for a in sys.argv[1:]):
    config.frame_rate = 20
config.background_color = PAL["bg"]

import manimpango
from pathlib import Path
# the site's own label face (src/assets/fonts/fragment-mono-400.woff2, as TTF)
manimpango.register_font(str(Path(__file__).parent / "fonts" / "FragmentMono-Regular.ttf"))
FONT = "Fragment Mono"
IDLE_T = 4.0


def label(s, size=13, color=None):
    return Text(s, font=FONT, font_size=size - 1, color=color or PAL["soft"], weight=NORMAL)


def caption(s, y, x=0.0):
    return label(s, 13, PAL["soft"]).move_to([x, y, 0])


def fade(m, a):
    """Scale a mobject's EXISTING stroke and fill opacities by `a`. (Manim's
    set_opacity sets fill opacity too, which fills outline-only shapes.)"""
    for sm in m.family_members_with_points():
        sm.set_stroke(opacity=sm.get_stroke_opacity() * a)
        sm.set_fill(opacity=sm.get_fill_opacity() * a)
    return m


def smooth01(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def lerp(a, b, t):
    return a + (b - a) * t


def show(m, **kw):
    """Text appears by fading up (Write draws heavy outlines in the dark theme)."""
    return FadeIn(m, shift=UP * 0.08, **kw)


# ── the real -> sim -> real tracker at the top ─────────────────────────────
TRK_Y, TRK_X = 3.6, [-1.15, 0.0, 1.15]


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
        g.add(label(t, 12, PAL["copper"] if on else PAL["soft"]).move_to([TRK_X[i], y - 0.23, 0]))
    g.add(Dot([x, y, 0], radius=0.055, color=PAL["copper"]))
    return fade(g, a) if a < 1 else g


# ═══════════════════════════ THE SHOT ═════════════════════════════════════
# The table in perspective: uu -1..1 across, vv 0 (near) .. 1 (far), hh up.
SC_C, SC_K = (0.0, -0.45), 0.92


def fp(uu, vv, hh=0.0, c=SC_C, sc=SC_K):
    return np.array([c[0] + sc * uu * (1.75 - 0.55 * vv), c[1] + sc * (-0.75 + 1.35 * vv + hh), 0.0])


def frame_box(c=SC_C, sc=SC_K, top=2.1):
    """(x half-width, bottom y, top y) of the shot's picture frame."""
    return 1.72 * sc / SC_K, c[1] - 0.95 * sc, c[1] + top * sc


# the task: the red cube from A onto the copper mark at B; two distractors
A0, B0 = (0.42, 0.40), (-0.38, 0.30)
CUBES = [(0.34, "red"), ((0.02, 0.80), 0.24, "cube"), ((0.78, 0.74), 0.27, "cube")]
DISTRACT = [((0.02, 0.80), 0.24), ((0.78, 0.74), 0.27)]
RED_S = 0.34
HOME = (-0.1, 0.42, 1.0)
BASE_UV = (-1.02, 0.92)


def iso_cube(x, y, s, target, look="real", a=1.0, sw=1.4):
    """A cube in cabinet projection, its front face's bottom centre at (x, y).
    The TARGET is solid copper; every other cube is a hairline box."""
    d = s * 0.45
    ink = ManimColor(PAL["ink"])
    if target:
        fill = ManimColor(PAL["copper"])
        fo = 1.0 if look == "real" else 0.85
        st = 0
    else:
        fill = ManimColor(PAL["cube"])
        fo = 1.0 if look == "real" else 0.0
        st = sw
    x0, x1, y0, y1 = x - s / 2, x + s / 2, y, y + s
    front = Polygon([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], fill_color=fill, fill_opacity=fo * a,
                    stroke_color=ink, stroke_width=st, stroke_opacity=a)
    top = Polygon([x0, y1, 0], [x1, y1, 0], [x1 + d, y1 + d, 0], [x0 + d, y1 + d, 0],
                  fill_color=fill.lighter(0.25) if target else fill, fill_opacity=fo * a, stroke_color=ink, stroke_width=st, stroke_opacity=a)
    side = Polygon([x1, y0, 0], [x1 + d, y0 + d, 0], [x1 + d, y1 + d, 0], [x1, y1, 0],
                   fill_color=fill.darker(0.25) if target else fill.darker(0.05), fill_opacity=fo * a, stroke_color=ink, stroke_width=st, stroke_opacity=a)
    return VGroup(side, top, front)


def cube_at(uu, vv, hh, s, target, look, c, sc, a=1.0):
    p = fp(uu, vv, hh, c, sc)
    sz = s * sc * (1 - 0.3 * vv)
    k = sc / SC_K
    return iso_cube(p[0] - sz * 0.22, p[1], sz, target, look, a, sw=max(0.6, 1.4 * k))


def mark(B, c, sc, look="real"):
    """The target: a dashed copper square on the table."""
    h = 0.15
    pts = [fp(B[0] - h, B[1] - h * 0.8, 0, c, sc), fp(B[0] + h, B[1] - h * 0.8, 0, c, sc),
           fp(B[0] + h, B[1] + h * 0.8, 0, c, sc), fp(B[0] - h, B[1] + h * 0.8, 0, c, sc)]
    k = sc / SC_K
    return DashedVMobject(Polygon(*pts), num_dashes=16, dashed_ratio=0.55).set_stroke(PAL["copper"], max(0.8, 2.0 * k))


# ── the pick-and-place: keys (u, spot, level (1 up / 0 at the cube), open,
# cube phase during the segment that starts here: 0 at A, 1 carried, 2 at B)
PICK = [
    (0.00, "H", 1, 1, 0), (0.09, "A", 1, 1, 0), (0.17, "A", 0, 1, 0), (0.22, "A", 0, 0, 1),
    (0.31, "A", 1, 0, 1), (0.43, "B", 1, 0, 1), (0.51, "B", 0, 0, 1), (0.56, "B", 0, 1, 2),
    (0.64, "B", 1, 1, 2), (0.76, "H", 1, 1, 2), (1.00, "H", 1, 1, 2),
]
GRASP_H = 0.12          # gripper anchor (between the fingertips) above the table, at a grasp


def pick_key(u):
    u = u % 1.0
    i = 0
    while i < len(PICK) - 2 and PICK[i + 1][0] <= u:
        i += 1
    k0, k1 = PICK[i], PICK[i + 1]
    f = smooth01((u - k0[0]) / max(1e-6, k1[0] - k0[0]))
    return k0, k1, f


def pick3(u, A=A0, B=B0):
    """-> gripper (uu, vv, hh), opening 0..1, red cube (uu, vv, hh, alpha)."""
    k0, k1, f = pick_key(u)

    def spot(sp, lv):
        if sp == "H":
            return HOME
        c = A if sp == "A" else B
        return (c[0], c[1], 0.62) if lv else (c[0], c[1], GRASP_H)
    p0, p1 = spot(k0[1], k0[2]), spot(k1[1], k1[2])
    g = tuple(p0[i] + (p1[i] - p0[i]) * f for i in range(3))
    op = k0[3] + (k1[3] - k0[3]) * f
    ph = k0[4]
    uu = u % 1.0
    if ph == 1:
        cube = (g[0], g[1], g[2] - GRASP_H, 1.0)
    elif ph == 2:
        # placed; after the arm has gone home the episode resets: the cube
        # fades off the mark and back in at A
        if uu < 0.80:
            cube = (B[0], B[1], 0.0, 1.0)
        elif uu < 0.87:
            cube = (B[0], B[1], 0.0, 1 - smooth01((uu - 0.80) / 0.07))
        else:
            cube = (A[0], A[1], 0.0, smooth01((uu - 0.88) / 0.08))
    else:
        cube = (A[0], A[1], 0.0, 1.0)
    return g, op, cube


# the UNTRAINED policy: the arm wanders between seeded random spots, dips
# and closes on air — never within 0.3 of a cube
def _wander_keys(n=7, seed=5):
    rnd = random.Random(seed)
    keys = [(HOME[0], HOME[1], HOME[2], 1.0)]
    avoid = [A0] + [p for p, _ in DISTRACT]
    while len(keys) < n + 1:
        uu, vv = rnd.uniform(-0.75, 0.8), rnd.uniform(0.12, 0.78)
        q = fp(uu, vv)
        if any(np.linalg.norm(q - (fp(a[0], a[1]) + [0, 0.15, 0])) < 0.5 for a in avoid):
            continue
        dip = rnd.random() < 0.6
        keys.append((uu, vv, GRASP_H + 0.02 if dip else rnd.uniform(0.45, 0.85), 0.0 if dip else 1.0))
    keys.append((HOME[0], HOME[1], HOME[2], 1.0))
    return keys


WANDER = _wander_keys()


def fumble_state(u):
    u = u % 1.0
    n = len(WANDER) - 1
    k = min(n - 1, int(u * n))
    f = smooth01(u * n - k)
    a, b = WANDER[k], WANDER[k + 1]
    op = b[3] if f > 0.7 else (a[3] if f < 0.3 else a[3] + (b[3] - a[3]) * (f - 0.3) / 0.4)
    g = (lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f) + 0.25 * math.sin(math.pi * f))
    return g, op


def misses(u, c, sc):
    """An x where the untrained policy closed on air, fading after."""
    g = VGroup()
    n = len(WANDER) - 1
    k_ = sc / SC_K
    for k in range(1, n):
        if WANDER[k][3] > 0.5:
            continue
        age = (u - k / n) % 1.0
        if age > 0.32:
            continue
        a = 1 - smooth01((age - 0.12) / 0.2)
        p = fp(WANDER[k][0], WANDER[k][1], 0, c, sc)
        r = 0.09 * k_
        g.add(Line(p + [-r, -r * 0.6, 0], p + [r, r * 0.6, 0], stroke_color=PAL["copper"], stroke_width=3, stroke_opacity=a),
              Line(p + [-r, r * 0.6, 0], p + [r, -r * 0.6, 0], stroke_color=PAL["copper"], stroke_width=3, stroke_opacity=a))
    return g


def trail(u, c, sc):
    """Where the untrained gripper has just been: a fading dotted trace."""
    g = VGroup()
    for i in range(1, 22):
        uu = u - i * 0.012
        gp, _ = fumble_state(uu)
        p = fp(gp[0], gp[1], gp[2], c, sc)
        g.add(Dot(p, radius=0.022, color=PAL["soft"]).set_opacity(0.75 * (1 - i / 22)))
    return g


def tick(p, a=1.0, r=0.13):
    return VMobject().set_points_as_corners([p + [-r, 0, 0], p + [-r * 0.3, -r * 0.7, 0], p + [r * 1.1, r * 0.8, 0]]) \
        .set_stroke(PAL["copper"], 3.5, opacity=a)


# ── the arm: a 2-link planar arm drawn in screen space, base on the table's
# far-left corner, the gripper hanging from the wrist
def arm(g, op, c=SC_C, sc=SC_K, look="real", a=1.0):
    k = sc / SC_K
    anchor = fp(g[0], g[1], g[2], c, sc) + np.array([0.06 * k, 0, 0])
    W = anchor + np.array([0, 0.46 * k, 0])
    base = fp(BASE_UV[0], BASE_UV[1], 0, c, sc)
    S = base + np.array([0, 0.42 * k, 0])
    L1, L2 = 1.12 * k, 1.04 * k
    d = W - S
    dist = float(np.linalg.norm(d)) or 1e-6
    dist_c = min(max(dist, 0.2 * k), (L1 + L2) * 0.995)
    u_ = d / dist
    Wc = S + u_ * dist_c
    aa = (L1 ** 2 - L2 ** 2 + dist_c ** 2) / (2 * dist_c)
    h = math.sqrt(max(L1 ** 2 - aa ** 2, 0.0))
    perp = np.array([-u_[1], u_[0], 0])
    E = S + u_ * aa + perp * h
    if E[1] < (S + u_ * aa - perp * h)[1]:
        E = S + u_ * aa - perp * h
    o = (0.12 + 0.08 * op) * k
    ink = PAL["ink"]
    real = look == "real"
    # one drawing for both looks, element for element (real -> sim and back are
    # ReplacementTransforms): real is filled ink and arm-grey, sim is hairline
    sw = max(2.0, 13 * k) if real else max(1.0, 2.2 * k)
    hw = max(1.0, 2.2 * k)
    body = PAL["arm"] if real else PAL["bg"]
    fo = a if real else 0.0                     # fill opacity of the solid parts
    st = 0 if real else hw                      # their outline in the sim look
    grp = VGroup()
    # base: a foot plate, then a turntable the arm yaws on
    grp.add(Polygon(base + [-0.2 * k, -0.04 * k, 0], base + [0.2 * k, -0.04 * k, 0], base + [0.12 * k, 0.16 * k, 0], base + [-0.12 * k, 0.16 * k, 0],
                    fill_color=ink, fill_opacity=fo, stroke_color=ink, stroke_width=st, stroke_opacity=a))
    grp.add(Ellipse(width=0.3 * k, height=0.07 * k, fill_color=body, fill_opacity=fo, stroke_color=ink, stroke_width=hw, stroke_opacity=a)
            .move_to(base + [0, 0.17 * k, 0]))
    grp.add(Line(base + [0, 0.18 * k, 0], S, stroke_color=ink, stroke_width=sw, stroke_opacity=a))
    # a cable loop from the base up to the elbow, behind the links
    # (it hugs the upper arm on the side away from the forearm)
    d1 = (E - S) / (np.linalg.norm(E - S) or 1)
    nc = np.array([-d1[1], d1[0], 0])
    if np.dot(nc, Wc - S) > 0:
        nc = -nc
    grp.add(VMobject().set_points_smoothly([base + [-0.06 * k, 0.14 * k, 0], S + nc * 0.11 * k, (S + E) / 2 + nc * 0.075 * k, E + nc * 0.06 * k])
            .set_stroke(ink, max(0.8, 2.6 * k) if real else hw * 0.7, opacity=(0.85 if real else 0.5) * a))
    for P, Q in ((S, E), (E, Wc)):
        dd = Q - P
        n = np.array([-dd[1], dd[0], 0]) / (np.linalg.norm(dd) or 1)
        grp.add(Line(P, Q, stroke_color=ink, stroke_width=sw, stroke_opacity=a))
        grp.add(Line(P, Q, stroke_color=PAL["arm"], stroke_width=sw * 0.62, stroke_opacity=a if real else 0))
        # a module seam across the link, two thirds along
        m = P + dd * 0.62
        grp.add(Line(m - n * 0.045 * k, m + n * 0.045 * k, stroke_color=ink, stroke_width=max(0.8, 1.8 * k), stroke_opacity=a))
    grp.add(Line(Wc, anchor + [0, 0.32 * k, 0], stroke_color=ink, stroke_width=sw * 0.7, stroke_opacity=a))
    # each joint: an actuator housing with a dark hub and a copper index mark
    for J, r in ((S, 0.1), (E, 0.088), (Wc, 0.07)):
        grp.add(Circle(r * k, fill_color=body, fill_opacity=a, stroke_color=ink, stroke_width=hw, stroke_opacity=a).move_to(J))
        grp.add(Circle(r * 0.42 * k, fill_color=ink, fill_opacity=fo, stroke_color=ink, stroke_width=st * 0.6, stroke_opacity=a).move_to(J))
        grp.add(Dot(J + [0, r * 0.72 * k, 0], radius=0.014 * k, color=PAL["copper"]).set_opacity(a))
    # the wrist camera on the gripper's mount
    grp.add(RoundedRectangle(width=0.13 * k, height=0.07 * k, corner_radius=0.02 * k, fill_color=ink, fill_opacity=fo,
                             stroke_color=ink, stroke_width=st, stroke_opacity=a).move_to(anchor + [0.17 * k + o * 0.4, 0.38 * k, 0]))
    grp.add(Rectangle(width=2 * o + 0.12 * k, height=0.08 * k, fill_color=ink, fill_opacity=fo, stroke_color=ink, stroke_width=st, stroke_opacity=a)
            .move_to(anchor + [0, 0.3 * k, 0]))
    for sg in (-1, 1):
        grp.add(Rectangle(width=0.05 * k, height=0.27 * k, fill_color=ink, fill_opacity=fo, stroke_color=ink, stroke_width=st, stroke_opacity=a)
                .move_to(anchor + [sg * o, 0.14 * k, 0]))
        grp.add(Rectangle(width=0.05 * k, height=0.05 * k, fill_color=PAL["copper"], fill_opacity=a, stroke_width=0)
                .move_to(anchor + [sg * o, 0.0, 0]))
    return grp


def backdrop(c, sc, look="real", tone=0.0, a=1.0):
    """The REAL look: a photo — wall, floor, a table with its front lip and
    soft cube shadows. The SIM look: a grid floor and a hairline horizon."""
    W, yb, yt = frame_box(c, sc)
    k = sc / SC_K
    far = fp(0, 1, 0, c, sc)[1]
    g = VGroup()
    corners = [fp(-1, 0, 0, c, sc), fp(1, 0, 0, c, sc), fp(1, 1, 0, c, sc), fp(-1, 1, 0, c, sc)]
    if look == "real":
        g.add(Polygon([-W + c[0], far + 0.18 * k, 0], [W + c[0], far + 0.18 * k, 0], [W + c[0], yt, 0], [-W + c[0], yt, 0],
                      fill_color=PAL["wall"], fill_opacity=a, stroke_width=0))
        g.add(Polygon([-W + c[0], yb, 0], [W + c[0], yb, 0], [W + c[0], far + 0.18 * k, 0], [-W + c[0], far + 0.18 * k, 0],
                      fill_color=PAL["floor"], fill_opacity=a, stroke_width=0))
        g.add(Polygon(corners[0], corners[1], corners[1] + [0, -0.12 * k, 0], corners[0] + [0, -0.12 * k, 0],
                      fill_color=PAL["lip"], fill_opacity=a, stroke_width=0))
        g.add(Polygon(*corners, fill_color=PAL["table"], fill_opacity=a, stroke_width=0))
        for (p, s) in [(A0, RED_S)] + DISTRACT:
            q = fp(p[0], p[1], 0, c, sc)
            sz = s * sc * (1 - 0.3 * p[1])
            g.add(Ellipse(width=sz * 1.5, height=sz * 0.35, fill_color=PAL["shadow"], fill_opacity=0.10 * a, stroke_width=0).move_to(q + [sz * 0.12, 0, 0]))
    else:
        if tone:
            g.add(Polygon(*corners, fill_color=ManimColor(PAL["line"]), fill_opacity=0.25 * tone * a, stroke_width=0))
        sw = max(0.7, 1.3 * k)
        for i in range(7):
            f = i / 6
            g.add(Line(fp(-1 + 2 * f, 0, 0, c, sc), fp(-1 + 2 * f, 1, 0, c, sc), stroke_color=PAL["line"] if 0 < i < 6 else PAL["soft"], stroke_width=sw, stroke_opacity=a))
        for i in range(7):
            f = i / 6
            g.add(Line(fp(-1, f, 0, c, sc), fp(1, f, 0, c, sc), stroke_color=PAL["line"] if 0 < i < 6 else PAL["soft"], stroke_width=sw, stroke_opacity=a))
    return g


def corners_mark(c=SC_C, sc=SC_K, a=1.0, top=2.1):
    """Viewfinder corner brackets: this is a camera's view."""
    W, yb, yt = frame_box(c, sc, top)
    L = 0.22 * sc / SC_K
    g = VGroup()
    for sx in (-1, 1):
        for y, sy in ((yb, 1), (yt, -1)):
            x = c[0] + sx * W
            g.add(VMobject().set_points_as_corners([[x, y + sy * L, 0], [x, y, 0], [x - sx * L, y, 0]]).set_stroke(PAL["ink"], 2.2, opacity=a))
    return g


def shot(look="real", u=0.0, policy="trained", c=SC_C, sc=SC_K, cubes_jig=None, A=A0, B=B0, tone=0.0,
         grip=True, frame=None, held_a=1.0, red=None):
    """The shot. Returns VGroup(backdrop, mark, cubes, arm, frame)."""
    if policy == "untrained":
        gp, op = fumble_state(u)
        cube = (A[0], A[1], 0.0, 1.0)
    elif policy == "static":
        gp, op, cube = HOME, 1.0, (A[0], A[1], 0.0, 1.0)
    else:
        gp, op, cube = pick3(u, A, B)
    if red is not None:
        cube = red
    bg = backdrop(c, sc, look, tone)
    mk = mark(B, c, sc, look)
    cubes = VGroup()
    ds = cubes_jig or DISTRACT
    items = [(p[0], p[1], 0.0, s, False, 1.0) for p, s in ds] + [(cube[0], cube[1], cube[2], RED_S, True, cube[3] * held_a)]
    items.sort(key=lambda t: -t[1])           # far first
    for uu, vv, hh, s, tgt, a in items:
        if a > 0.01:
            cubes.add(cube_at(uu, vv, hh, s, tgt, look, c, sc, a))
    am = arm(gp, op, c, sc, look) if grip else VGroup()
    fr = corners_mark(c, sc) if (frame if frame is not None else look == "real") else VGroup()
    return VGroup(bg, mk, cubes, am, fr)


# ── the D435i IN 3D, over the table (a small renderer of its own: extruded
# outlines in the camera's frame, rotated, back faces culled, faces shaded
# and depth-sorted, a mild perspective — Manim's Cairo 3D painted end caps
# over the front plate). The camera looks DOWN onto the table.
C3 = np.array([0.0, 2.45, 0.0])
L3, R3, D3 = 2.0, 0.34, 0.56
LENS = [(-1.0, 0.16), (-0.45, 0.12), (0.5, 0.16), (1.02, 0.18)]      # IR, projector, IR, RGB (x in units of L3/2.2)
LIGHT = np.array([-0.45, 0.75, 0.5]) / np.linalg.norm([-0.45, 0.75, 0.5])
YAW0, PITCH0 = 0.42, 0.62      # turned toward the reader and tipped down onto the table
CAM_K = L3 / 2.2


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


def _proj(p, s=1.0, at=None):
    at = C3 if at is None else at
    k = 14.0 / (14.0 - p[2])
    return [at[0] + p[0] * k * s, at[1] + p[1] * k * s, 0]


def _axis_rot(axis, ang):
    """Rodrigues: a rotation of `ang` about the unit `axis`."""
    k = np.array(axis, dtype=float)
    k /= np.linalg.norm(k) or 1
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * (K @ K)


def render_parts(parts, yaw, pitch, alpha=None, s=1.0, at=None, woff=None, spin=None):
    """woff: name -> a WORLD offset (after the camera's rotation); spin:
    name -> (axis, angle), a tumble about the part's own centre. Both are
    for the explosion (Act0); the resting camera passes neither."""
    R = _rot(yaw, pitch)
    drawn = []
    for name, faces, dz in parts:
        a = 1.0 if alpha is None else alpha.get(name, 1.0)
        if a <= 0.01:
            continue
        off = np.zeros(3) if not woff or name not in woff else np.array(woff[name], dtype=float)
        Rp = R
        ctr = np.zeros(3)
        if spin and name in spin:
            allp = np.array([[x, y, z + dz] for pts, _, _ in faces for x, y, z in pts])
            ctr = allp.mean(axis=0)
            Rp = R @ _axis_rot(*spin[name])
        polys = []
        for pts, nrm, col in faces:
            n = Rp @ np.array(nrm)
            if n[2] <= 0.02:
                continue
            wp = [R @ ctr + Rp @ (np.array([x, y, z + dz]) - ctr) + off for x, y, z in pts]
            if col == "RING":           # a lens's rim, drawn as a line (cam_burst)
                polys.append((sum(q[2] for q in wp) / len(wp) + 1e-3,
                              Polygon(*[_proj(q, s, at) for q in wp], stroke_color=PAL["soft"], stroke_width=1.4, stroke_opacity=a, fill_opacity=0)))
                continue
            lit = 0.55 + 0.45 * max(0.0, float(n @ LIGHT))
            c = ManimColor(col)
            shade = c.darker(1 - lit) if lit < 1 else c
            polys.append((sum(q[2] for q in wp) / len(wp),
                          Polygon(*[_proj(q, s, at) for q in wp], fill_color=shade, fill_opacity=a, stroke_color=shade, stroke_width=0.6, stroke_opacity=a)))
        polys.sort(key=lambda t: t[0])
        zc = sum(t[0] for t in polys) / len(polys) if polys else 0
        drawn.append((zc, VGroup(*[p for _, p in polys])))
    drawn.sort(key=lambda t: t[0])
    return VGroup(*[g for _, g in drawn])


def cam_parts(ex=0.0):
    parts = [("casing", extrude(_stadium_pts(L3, R3), -D3 / 2, D3 / 2, PAL["body"]), -0.55 * ex),
             ("pcb", extrude(_rect_pts(L3 * 0.78, 0.32), -0.05, 0.0, PAL["pcb"]), -1.0 * ex),
             ("module", extrude(_rect_pts(L3 * 0.8, 0.30), -0.04, 0.04, PAL["steel"]), 0.2 + 0.25 * ex),
             ("plate", extrude(_stadium_pts(L3 * 0.94, R3 * 0.82), D3 / 2, D3 / 2 + 0.05, PAL["plate"]), 0.95 * ex)]
    for i, (lx, r) in enumerate(LENS):
        parts.append((f"lens{i}", extrude(_circle_pts(r * 0.75 * CAM_K, 16, lx * 0.95 * CAM_K, 0), D3 / 2 + 0.05, D3 / 2 + 0.16, "#1B1D21"), 1.7 * ex))
    return parts


def lens_pt(yaw, pitch, ex=0.0, s=1.0, at=None):
    R = _rot(yaw, pitch)
    return np.array(_proj(R @ np.array([LENS[3][0] * 0.95 * CAM_K, 0, D3 / 2 + 0.17 + 1.7 * ex]), s, at))


def die_pt(yaw, pitch, ex=0.0, s=1.0, at=None):
    R = _rot(yaw, pitch)
    return np.array(_proj(R @ np.array([LENS[3][0] * 0.95 * CAM_K, 0, 0.2 + 0.25 * ex + 0.05]), s, at))


def table_quad(c=SC_C, sc=SC_K):
    return [fp(-1, 0, 0, c, sc), fp(1, 0, 0, c, sc), fp(1, 1, 0, c, sc), fp(-1, 1, 0, c, sc)]


def cone(yaw, pitch, a=1.0, sweep=None, ex=0.0, s=1.0, at=None, apex=None):
    """The RGB imager's view: from the lens down onto the table."""
    O = lens_pt(yaw, pitch, ex, s, at) if apex is None else np.array(apex)
    F = table_quad()
    g = VGroup(Polygon(*F, stroke_color=PAL["copper"], stroke_width=1.8, stroke_opacity=0.8 * a, fill_color=PAL["copper"], fill_opacity=0.05 * a),
               *[Line(O, f, stroke_color=PAL["copper"], stroke_width=1.6, stroke_opacity=0.7 * a) for f in F])
    if sweep is not None and sweep > 0.02:
        g.add(Polygon(*[O + (f - O) * sweep for f in F], stroke_color=PAL["copper"], stroke_width=2.4, stroke_opacity=0.9 * (1 - sweep) * a, fill_opacity=0))
    return g


def cam3d(yaw=YAW0, pitch=PITCH0, ex=0.0, others=1.0, module=1.0, s=1.0, at=None):
    alpha = {k: others for k in ("casing", "pcb", "plate", "lens0", "lens1", "lens2", "lens3")}
    alpha["module"] = module
    g = render_parts(cam_parts(ex), yaw, pitch, alpha, s, at)
    R = _rot(yaw, pitch)
    if others > 0.01 and (R @ np.array([0, 0, 1]))[2] > 0.05:
        for lx, r in LENS:
            ring = [_proj(R @ np.array([x, y, D3 / 2 + 0.165 + 1.7 * ex]), s, at) for x, y in _circle_pts(r * 0.58 * CAM_K, 18, lx * 0.95 * CAM_K, 0)]
            g.add(Polygon(*ring, stroke_color=PAL["soft"], stroke_width=1.4, stroke_opacity=others, fill_opacity=0))
    return g


# The explosion (Act0): every part flies out from the camera's centre on its
# own line — the case up and back, the boards up and out, the front plate and
# the four lenses out toward the reader and sideways, each tumbling — and
# leaves the stage. World offsets at e = 1 (view space: y up, z to the reader).
BURST = {
    "casing": ((-0.8, 3.9, -2.5), ((1, 0.2, 0), 0.6)),
    "module": ((1.3, 3.5, -1.0), ((0.3, 1, 0), 1.2)),
    "pcb":    ((2.9, 2.7, -2.0), ((1, 0, 0.4), 1.5)),
    "plate":  ((-2.0, 4.4, -0.6), ((0, 0.2, 1), 0.45)),
    "lens0":  ((-3.6, 1.0, 2.2), ((1, 1, 0), 2.6)),
    "lens1":  ((0.3, 4.4, 2.6), ((0, 1, 1), -2.8)),
    "lens2":  ((2.0, 3.8, 2.4), ((1, 0, 1), 2.8)),
    "lens3":  ((3.6, 0.7, 2.2), ((1, -1, 0), -2.4)),
}


BURST_SEP = 0.5       # how far the exploded view opens (cam_parts' ex) before the parts fly


def burst_sep(e):
    """The bang: the parts jump apart along the camera's own depth axis at
    once (out-cubic over the first 30%), an exploded view for a moment..."""
    x = min(max(e / 0.3, 0.0), 1.0)
    return BURST_SEP * (1 - (1 - x) ** 3)


def burst_fly(e):
    """...then each flies off on its own line, accelerating (ease-in), and
    is off the stage by e = 1."""
    x = min(max((e - 0.12) / 0.88, 0.0), 1.0)
    return x * x


def cam_burst(e, yaw=YAW0, pitch=PITCH0):
    """The D435i at explosion e: 0 is exactly cam3d(), 1 is every part gone."""
    if e <= 1e-4:
        return cam3d(yaw, pitch)
    ex, f = burst_sep(e), burst_fly(e)
    woff = {k: f * np.array(v[0]) for k, v in BURST.items()}
    spin = {k: (v[1][0], (0.15 * ex / BURST_SEP + f) * v[1][1]) for k, v in BURST.items()}
    # each lens carries its rim as a face, so it sorts and tumbles with it
    parts = []
    for name, faces, dz in cam_parts(ex):
        if name.startswith("lens"):
            lx, r = LENS[int(name[4:])]
            rim = [(x, y, D3 / 2 + 0.165) for x, y in _circle_pts(r * 0.58 * CAM_K, 18, lx * 0.95 * CAM_K, 0)]
            faces = faces + [(rim, (0, 0, 1), "RING")]
        parts.append((name, faces, dz))
    return render_parts(parts, yaw, pitch, None, woff=woff, spin=spin)


def faint_table(a=1.0):
    """What the camera is looking at, before it has taken the picture."""
    g = VGroup(Polygon(*table_quad(), stroke_color=PAL["soft"], stroke_width=1.6, stroke_opacity=a, fill_opacity=0))
    for (p, s) in [(A0, RED_S)] + DISTRACT:
        g.add(fade(cube_at(p[0], p[1], 0, s, False, "sim", SC_C, SC_K), 0.55 * a))
    return g


def rest_frame(u):
    yaw = YAW0 + 0.32 * math.sin(math.tau * u)
    pitch = PITCH0 + 0.05 * math.sin(math.tau * 2 * u)
    return VGroup(faint_table(), cone(yaw, pitch, 1.0, sweep=(u * 3) % 1), cam3d(yaw, pitch))


# ── pixel sampling (photosites, patch tokens): what colour is the shot at (x, y)?
def _pip(x, y, vs):
    inside = False
    n = len(vs)
    j = n - 1
    for i in range(n):
        xi, yi = vs[i][0], vs[i][1]
        xj, yj = vs[j][0], vs[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def sampler(mob):
    polys = []
    for m in mob.family_members_with_points():
        if isinstance(m, Polygram) and m.get_fill_opacity() > 0.3:
            polys.append((m.get_vertices(), m.get_fill_color()))
        elif isinstance(m, Line) and m.get_stroke_width() >= 6 and m.get_stroke_opacity() > 0.5:
            # the arm's links: a thick line as a thin quad
            a, b = m.get_start(), m.get_end()
            d = b - a
            ln = np.linalg.norm(d) or 1
            nrm = np.array([-d[1], d[0], 0]) / ln * 0.06
            polys.append(([a + nrm, b + nrm, b - nrm, a - nrm], m.get_stroke_color()))

    def at(x, y):
        for vs, col in reversed(polys):
            if _pip(x, y, vs):
                return col
        return ManimColor(PAL["bg"])
    return at


PXC, PXR = 14, 11


def photosites(lit_rows=0.0, a=1.0, scl=1.0):
    """The frame as a 14 x 11 mosaic read out row by row (rows below lit_rows dark)."""
    W, yb, yt = frame_box()
    cw, ch = 2 * W / PXC, (yt - yb) / PXR
    samp = sampler(shot("real", 0.0, "untrained"))
    g = VGroup()
    for r in range(PXR):
        f = min(max(lit_rows - r, 0.0), 1.0)
        for cc in range(PXC):
            x, y = -W + (cc + 0.5) * cw + SC_C[0], yt - (r + 0.5) * ch
            col = samp(x, y)
            dark = ManimColor(PAL["plate"])
            fill = dark.interpolate(col, f) if f < 1 else col
            g.add(Square(min(cw, ch) * 0.86 * scl, fill_color=fill, fill_opacity=a, stroke_width=0).move_to([x, y, 0]))
    return g


def readout_line(rows):
    W, yb, yt = frame_box()
    y = yt - rows * (yt - yb) / PXR
    return Line([-W, y, 0], [W, y, 0], stroke_color=PAL["copper"], stroke_width=3)


# ═══════════════════════ the states, S0 .. S4 ═══════════════════════════════
CAP_Y = -1.72        # the one caption line under the shot


def untrained_cap():
    return caption("policy · untrained", CAP_Y)


def S0(u=0.0):
    """REAL: the camera's picture; the untrained policy grasps at air."""
    return VGroup(shot("real", u, "untrained"), trail(u, SC_C, SC_K), misses(u, SC_C, SC_K), untrained_cap())


def r2s_cap():
    return caption("real2sim · gaussian splat", CAP_Y)


def drop_state(u):
    """IdleTwin: the red cube falls from above A and bounces to rest (sim)."""
    if u < 0.12 or u > 0.9:
        return (A0[0], A0[1], 0.0, 1.0)
    if u < 0.2:                                           # vanish
        return (A0[0], A0[1], 0.0, 1 - smooth01((u - 0.12) / 0.08))
    t = (u - 0.2) / 0.62                                  # 0..1 of the fall
    if t < 0:
        return (A0[0], A0[1], 1.2, 0.0)
    # a drop from 1.2 with restitution 0.45: bounces of decreasing height
    h0, e = 1.2, 0.45
    T0 = math.sqrt(h0)                                    # time to fall, in arbitrary units
    times = [T0]
    v = T0
    while len(times) < 6:
        v *= e
        times.append(2 * v)
    total = sum(times)
    tt = t * total * 1.25
    if tt < T0:
        return (A0[0], A0[1], h0 - tt * tt, min(1.0, tt / (0.25 * T0)))
    tt -= T0
    v = T0
    for d in times[1:]:
        v *= e
        if tt < d:
            return (A0[0], A0[1], max(0.0, v * tt - tt * tt), 1.0)
        tt -= d
    return (A0[0], A0[1], 0.0, 1.0)


def contact_burst(u):
    """A brief copper ring where the falling cube first meets the table."""
    T0 = math.sqrt(1.2)
    times = [T0]
    v = T0
    while len(times) < 6:
        v *= 0.45
        times.append(2 * v)
    t_hit = 0.2 + 0.62 * (T0 / (sum(times) * 1.25))
    f = (u - t_hit) / 0.08
    if not (0 <= f <= 1):
        return VGroup()
    p = fp(A0[0], A0[1], 0)
    return Ellipse(width=0.5 + 0.5 * f, height=0.14 + 0.12 * f, stroke_color=PAL["copper"], stroke_width=2.5, stroke_opacity=1 - f).move_to(p)


def S1(u=0.0):
    """SIM: the twin of the shot."""
    return VGroup(tracker(1), shot("sim", 0, "static", red=drop_state(u)), contact_burst(u), r2s_cap())


# ── S2: a wall of randomised twins, each running a demonstration; a world model
WALL = [(-0.9 + 1.8 * (i % 2), 2.32 - 1.14 * (i // 2)) for i in range(6)]
CELL_K = 0.4
CELL_TOP = 1.75
WALL_CAP_Y = -0.66
NC = len(WALL)


def cell_c(i):
    x, y = WALL[i]
    return (x, y - 0.4 * CELL_K)


def cell_params(i):
    """Randomised per twin: cube layout, the target's start, floor tone."""
    if i == 0:
        return DISTRACT, A0, B0, 0.0
    rnd = random.Random(100 + i)
    ds = [((rnd.uniform(-0.6, 0.75), rnd.uniform(0.62, 0.9)), s) for _, s in DISTRACT]
    A = (rnd.uniform(0.2, 0.6), rnd.uniform(0.3, 0.5))
    B = (rnd.uniform(-0.55, -0.2), rnd.uniform(0.22, 0.4))
    return ds, A, B, rnd.uniform(0.3, 1.0)


def cell_box(i, a=1.0):
    W, yb, yt = frame_box(cell_c(i), CELL_K, CELL_TOP)
    c = cell_c(i)
    return Rectangle(width=2 * W + 0.06, height=yt - yb, stroke_color=PAL["line"], stroke_width=1.2, stroke_opacity=a).move_to([c[0], (yb + yt) / 2, 0])


def cell(i, u=0.0, box=True):
    ds, A, B, tone = cell_params(i)
    g = shot("sim", u, "trained", cell_c(i), CELL_K, cubes_jig=ds, A=A, B=B, tone=tone)
    if box:
        g.add(cell_box(i))
    return g


def demo_path(i, prog=1.0):
    """The demonstration's end-effector path in twin i: A, up, over, down onto B."""
    _, A, B, _ = cell_params(i)
    pts = [fp(*pick3(t, A, B)[0], cell_c(i), CELL_K) + np.array([0.06 * CELL_K / SC_K, 0, 0]) for t in np.linspace(0.17, 0.51, 18)]
    path = VMobject().set_points_smoothly(pts)
    return DashedVMobject(path, num_dashes=9, dashed_ratio=0.6).set_stroke(PAL["copper"], 1.6, opacity=0.9 * prog)


def cell_phase(i):
    return (i * 0.37) % 1.0


def wall(u=0.0):
    g = VGroup()
    for i in range(NC):
        g.add(VGroup(cell(i, (u + cell_phase(i)) % 1.0), demo_path(i)))
    return g


# the world model: an observed frame -> encoder -> latent z0 -> z1 -> z2 (an
# action drops into each step) -> decoder -> imagined frames, fainter as the
# rollout runs away from the data
WM_Y = -1.5
WM_FRAME_K = 0.2
OBS_C = (-1.38, WM_Y - 0.12)
ZX = [-0.42, 0.42, 1.26]
IMG_Y = -2.72


def latent(x, y, k, a=1.0, hot=None):
    g = VGroup(RoundedRectangle(width=0.32, height=0.62, corner_radius=0.06, fill_color=PAL["slab"], fill_opacity=a,
                                stroke_color=PAL["soft"], stroke_width=1.4, stroke_opacity=a).move_to([x, y, 0]))
    rnd = random.Random(7 + k)
    for j in range(6):
        v = rnd.random()
        on = hot is not None and j == hot
        g.add(Dot([x, y + 0.22 - j * 0.088, 0], radius=0.018 + 0.03 * v,
                  color=PAL["copper"] if on or (j == (k * 2) % 6) else PAL["soft"]).set_opacity(a))
    return g


def trapz(cx, cy, w0, w1, h, a=1.0, down=True):
    """An encoder / decoder: a trapezoid narrowing toward the latent."""
    if down:   # wide on the left, narrow on the right
        pts = [[cx - h / 2, cy - w0 / 2, 0], [cx + h / 2, cy - w1 / 2, 0], [cx + h / 2, cy + w1 / 2, 0], [cx - h / 2, cy + w0 / 2, 0]]
    else:
        pts = [[cx - w1 / 2, cy + h / 2, 0], [cx + w1 / 2, cy + h / 2, 0], [cx + w0 / 2, cy - h / 2, 0], [cx - w0 / 2, cy - h / 2, 0]]
    return Polygon(*pts, fill_color=PAL["slab"], fill_opacity=a, stroke_color=PAL["soft"], stroke_width=1.4, stroke_opacity=a)


def wm_frame(k, u0=0.18, a=1.0):
    """k = 0: the observed frame; k = 1, 2: imagined, decoded from z1, z2."""
    if k == 0:
        c = OBS_C
    else:
        c = (ZX[k], IMG_Y)
    g = shot("sim", u0 + 0.12 * k, "trained", c, WM_FRAME_K, tone=0.0)
    W, yb, yt = frame_box(c, WM_FRAME_K, 1.45)
    box = Rectangle(width=2 * W + 0.06, height=yt - yb, stroke_color=PAL["soft"], stroke_width=1.3).move_to([c[0], (yb + yt) / 2, 0])
    if k > 0:
        box = DashedVMobject(box, num_dashes=22).set_stroke(PAL["soft"], 1.3)
    g.add(box)
    return fade(g, a * (1.0 if k == 0 else (0.85 if k == 1 else 0.6)))


def world_model(pulse=None, a=1.0):
    g = VGroup()
    g.add(wm_frame(0))
    g.add(trapz(-0.82, WM_Y, 0.62, 0.3, 0.34, a))                         # encoder
    for k, x in enumerate(ZX):
        g.add(latent(x, WM_Y, k, a))
        if k < 2:
            g.add(Arrow([x + 0.18, WM_Y, 0], [ZX[k + 1] - 0.18, WM_Y, 0], buff=0, stroke_width=2.2, color=PAL["soft"],
                        max_tip_length_to_length_ratio=0.22, max_stroke_width_to_length_ratio=10))
            ax = (x + ZX[k + 1]) / 2
            g.add(Square(0.11, fill_color=PAL["copper"], fill_opacity=a, stroke_width=0).move_to([ax, WM_Y + 0.48, 0]))
            g.add(Line([ax, WM_Y + 0.42, 0], [ax, WM_Y + 0.08, 0], stroke_color=PAL["copper"], stroke_width=1.6))
    for k in (1, 2):
        g.add(Arrow([ZX[k], WM_Y - 0.33, 0], [ZX[k], IMG_Y + 0.42, 0], buff=0, stroke_width=2.2, color=PAL["soft"],
                    max_tip_length_to_length_ratio=0.3, max_stroke_width_to_length_ratio=10))   # decode
        g.add(wm_frame(k))
    if pulse is not None:
        x = lerp(-0.82, ZX[2], pulse)
        g.add(Dot([x, WM_Y, 0], radius=0.06, color=PAL["copper"]).set_opacity(math.sin(math.pi * pulse)))
    return g


def S2(u=0.0, pulse=None):
    return VGroup(tracker(1), wall(u), caption("domain randomization · demos", WALL_CAP_Y),
                  world_model(pulse), caption("world model · imagined rollout", -3.45))


# ── S3: training the VLA
STACK_C = (-1.05, 2.5)
STACK_CARD_K = 0.3                     # a demo card in the stack
CURVE_C, CURVE_W, CURVE_H = (0.95, 2.52), 1.4, 0.62
TOK_Y, LANG_Y = 1.18, 0.78
LAYER_Y = [0.22, -0.08, -0.38, -0.68]
OUT_C, OUT_K = (0.0, -2.25), 0.5
# the instruction, as the words a person would type (Oct 8: it read "pick red
# cube place"); "red" and "cube" (1, 2) are what attend to the cube's patch
WORDS = ["put", "red", "cube", "on mark"]
PASS_Y1 = OUT_C[1] + 0.5 * 1.7 + 0.02


def stack(a=1.0):
    g = VGroup()
    for k in range(3):
        cc = (STACK_C[0] - 0.1 + k * 0.1, STACK_C[1] - 0.1 + k * 0.1)
        W, yb, yt = frame_box((0, 0), STACK_CARD_K, 1.45)
        card = VGroup(Rectangle(width=2 * W + 0.1, height=yt - yb + 0.06, fill_color=PAL["panel"], fill_opacity=a,
                                stroke_color=PAL["soft"], stroke_width=1.3, stroke_opacity=a).move_to([cc[0], cc[1], 0]))
        if k == 2:
            sh = shot("sim", 0.0, "static", (cc[0], cc[1] - (yt + yb) / 2), STACK_CARD_K)
            card.add(fade(sh, a))
        g.add(card)
    g.add(fade(label("demos", 12).move_to([STACK_C[0], STACK_C[1] - 0.58, 0]), a))
    return g


def loss_y(x):
    return 0.08 + 0.85 * math.exp(-x * 3.2) + 0.04 * math.sin(x * 23) * (1 - x)


def loss_curve(upto=1.0, flick=0.0, a=1.0):
    cx, cy = CURVE_C
    w, h = CURVE_W, CURVE_H
    g = VGroup(Line([cx - w / 2, cy - h / 2, 0], [cx + w / 2, cy - h / 2, 0], stroke_color=PAL["soft"], stroke_width=1.6),
               Line([cx - w / 2, cy - h / 2, 0], [cx - w / 2, cy + h / 2, 0], stroke_color=PAL["soft"], stroke_width=1.6))
    pts = []
    n = 40
    for i in range(n + 1):
        x = i / n * max(upto, 0.001)
        yv = loss_y(x) + (flick * 0.025 * math.sin(x * 37 + flick * 6) * smooth01((x - 0.75) / 0.25))
        pts.append([cx - w / 2 + x * w, cy - h / 2 + yv * h, 0])
    if upto > 0.02:
        g.add(VMobject(stroke_color=PAL["copper"], stroke_width=2.6).set_points_smoothly(pts))
        g.add(Dot(pts[-1], radius=0.04, color=PAL["copper"]))
    g.add(label("training loss", 12).move_to([cx, cy - h / 2 - 0.2, 0]))
    return fade(g, a) if a < 1 else g


def patch_tokens(a=1.0, hot=None):
    """12 image tokens: the demo frame cut into 4 x 3 patches, each the colour
    of its patch."""
    samp = sampler(shot("sim", OUT_U, "trained", PATCH_SRC_C, PATCH_SRC_K))
    g = VGroup()
    for k in range(12):
        col = patch_colour(k, samp)
        x = -1.62 + k * 0.295
        sq = Square(0.24, fill_color=col, fill_opacity=a, stroke_color=PAL["ink"], stroke_width=1.2, stroke_opacity=a).move_to([x, TOK_Y, 0])
        g.add(sq)
    return g


PATCH_SRC_C, PATCH_SRC_K = (0.0, 0.75), 0.42
OUT_U = 0.3


def patch_rect(k):
    W, yb, yt = frame_box(PATCH_SRC_C, PATCH_SRC_K, 1.45)
    cc, r = k % 4, k // 4
    pw, ph = 2 * W / 4, (yt - yb) / 3
    return np.array([-W + (cc + 0.5) * pw + PATCH_SRC_C[0], yt - (r + 0.5) * ph, 0]), pw, ph


def patch_colour(k, samp):
    p, pw, ph = patch_rect(k)
    # the most saturated sample in the patch: a patch with the target in it is copper
    best = None
    for dx in (-0.3, 0, 0.3):
        for dy in (-0.3, 0, 0.3):
            col = samp(p[0] + dx * pw, p[1] + dy * ph)
            if col.to_hex().upper() == ManimColor(PAL["copper"]).to_hex().upper() or col.to_hex().upper() == ManimColor(PAL["copper"]).lighter(0.25).to_hex().upper() or col.to_hex().upper() == ManimColor(PAL["copper"]).darker(0.25).to_hex().upper():
                return ManimColor(PAL["copper"])
            if best is None and col.to_hex().upper() != ManimColor(PAL["bg"]).to_hex().upper():
                best = col
    return ManimColor(PAL["slab"]) if best is None else best


def token_x(k):
    return -1.62 + k * 0.295


def word_chips(a=1.0):
    g = VGroup()
    x = -1.35
    for w in WORDS:
        t = label(w, 13, PAL["ink"])
        wd = t.width + 0.16
        box = RoundedRectangle(width=wd, height=0.26, corner_radius=0.07, fill_color=PAL["panel"], fill_opacity=a,
                               stroke_color=PAL["ink"], stroke_width=1.3, stroke_opacity=a).move_to([x + wd / 2, LANG_Y, 0])
        g.add(VGroup(box, fade(t.move_to(box.get_center()), a)))
        x += wd + 0.12
    return g.move_to([0.0, LANG_Y, 0])


def red_tokens():
    samp = sampler(shot("sim", OUT_U, "trained", PATCH_SRC_C, PATCH_SRC_K))
    return [k for k in range(12) if patch_colour(k, samp).to_hex().upper() == ManimColor(PAL["copper"]).to_hex().upper()]


def attention(a=1.0, w=1.0):
    """Cross-attention between the words "red", "cube" and the patch that has the
    red cube in it — arcs ABOVE the token row."""
    chips = word_chips()
    g = VGroup()
    rt = red_tokens() or [7]
    for wi in (1, 2):
        p0 = chips[wi][0].get_top()
        for k in rt[:1]:
            p1 = np.array([token_x(k), TOK_Y + 0.13, 0])
            g.add(ArcBetweenPoints(p0 + [0, 0.0, 0], p1, angle=-1.2 if p0[0] < p1[0] else 1.2,
                                   stroke_color=PAL["copper"], stroke_width=1.6 * w, stroke_opacity=0.8 * a))
    return g


def flow_arrow(p0, p1, col, a=1.0, w=1.4):
    d = (p1 - p0) / (np.linalg.norm(p1 - p0) or 1)
    n = np.array([-d[1], d[0], 0])
    tip = Polygon(p1, p1 - d * 0.09 + n * 0.05, p1 - d * 0.09 - n * 0.05, fill_color=col, fill_opacity=a, stroke_width=0)
    return VGroup(Line(p0, p1 - d * 0.06, stroke_color=col, stroke_width=w, stroke_opacity=a), tip)


LAYER_CELLS = 16                       # the 12 patch tokens and the 4 words, through every layer
FWD_X, BWD_X = -1.82, 1.82             # the forward / backward pass arrows down each side


def layers(a=1.0, lit=None, back=None, out_lit=0.0, out_back=0.0):
    """The VLA as a transformer: four layers, each the SAME row of 16 token
    slots (12 image patches, 4 words) the tokens above feed into; an arrow in
    from the tokens and out to the action chunk. `lit` lights the layer the
    forward pass is in (copper cells), `back` the one the backward pass is in
    (an ink outline); `out_lit` the arrow into the predicted chunk, `out_back`
    the ink arrow beside it that carries the loss back UP from the chunk vs.
    the demo, where backprop starts. Both run down the middle into the
    chunk's frame (the arrow out used to leave the network's left end and
    point past the frame)."""
    g = VGroup()
    cw = 3.0 / LAYER_CELLS
    for i, y in enumerate(LAYER_Y):
        on = lit is not None and abs(lit - i) < 0.6
        bk = back is not None and abs(back - i) < 0.6
        slab = RoundedRectangle(width=3.3, height=0.2, corner_radius=0.06, fill_color=PAL["slab"], fill_opacity=a,
                                stroke_color=PAL["copper"] if on else (PAL["ink"] if bk else PAL["soft"]),
                                stroke_width=1.8 if (on or bk) else 1.2, stroke_opacity=a).move_to([0, y, 0])
        cells = VGroup()
        for k in range(LAYER_CELLS):
            x = -1.5 + (k + 0.5) * cw
            word = k >= 12
            cells.add(Rectangle(width=cw * 0.62, height=0.09, fill_color=PAL["copper"] if on else PAL["panel"],
                                fill_opacity=(0.85 if on else 1.0) * a, stroke_color=PAL["ink"] if word else PAL["soft"],
                                stroke_width=0.8, stroke_opacity=(0.9 if word else 0.7) * a).move_to([x + (0.04 if word else 0), y, 0]))
        g.add(VGroup(slab, cells))
    top, bot = LAYER_Y[0] + 0.1, LAYER_Y[-1] - 0.1
    g.add(flow_arrow(np.array([0, LANG_Y - 0.15, 0]), np.array([0, top + 0.02, 0]), PAL["soft"], a))
    oc = ManimColor(PAL["soft"]).interpolate(ManimColor(PAL["copper"]), out_lit)
    g.add(flow_arrow(np.array([-0.08, bot, 0]), np.array([-0.08, PASS_Y1 + 0.02, 0]), oc, a, 1.4 + 1.2 * out_lit))
    if out_back > 0.01:
        g.add(flow_arrow(np.array([0.08, PASS_Y1 + 0.02, 0]), np.array([0.08, bot, 0]), PAL["ink"], a * out_back, 1.4 + 1.0 * out_back))
    return g


def vla_cap():
    # left of the arrows down the middle; the pass's name sits right of them
    return caption("VLA policy", LAYER_Y[-1] - 0.32, -0.95)


def chunk_pts(u0=OUT_U, n=8, step=0.035):
    return [fp(*pick3(u0 + 0.02 + i * step)[0], OUT_C, OUT_K) + np.array([0.06 * OUT_K / SC_K, 0.0, 0]) for i in range(n)]


def chunk(conv=1.0, a=1.0, seed=4):
    """The predicted action chunk (copper) against the demonstration's (ink
    rings): scattered at conv 0, on target at conv 1."""
    tgt = chunk_pts()
    rnd = random.Random(seed)
    g = VGroup()
    pred = []
    for i, p in enumerate(tgt):
        off = np.array([rnd.uniform(-0.5, 0.5), rnd.uniform(-0.35, 0.35), 0]) * (1 - conv)
        pred.append(p + off)
        g.add(Circle(0.05, stroke_color=PAL["ink"], stroke_width=1.3, stroke_opacity=0.8 * a).move_to(p))
    g.add(VMobject().set_points_smoothly(pred).set_stroke(PAL["copper"], 1.8, opacity=0.7 * a))
    for i, p in enumerate(pred):
        g.add(Dot(p, radius=0.045 if i else 0.06, color=PAL["copper"]).set_opacity(a))
    return g


def out_frame(conv=1.0, a=1.0):
    g = shot("sim", OUT_U, "trained", OUT_C, OUT_K)
    W, yb, yt = frame_box(OUT_C, OUT_K, 1.7)
    g.add(Rectangle(width=2 * W + 0.06, height=yt - yb, stroke_color=PAL["soft"], stroke_width=1.3).move_to([OUT_C[0], (yb + yt) / 2, 0]))
    g.add(chunk(conv))
    return fade(g, a) if a < 1 else g


def chunk_cap():
    W, yb, yt = frame_box(OUT_C, OUT_K, 1.7)
    return caption("action chunk vs. demo", yb - 0.24)


def S3(flick=0.0, lit=None):
    return VGroup(tracker(1), stack(), loss_curve(1.0, flick), patch_tokens(), word_chips(), attention(),
                  layers(lit=lit), vla_cap(), out_frame(1.0), chunk_cap())


# ── S4: the SAME shot as S0, now with the trained policy
def vla_tag(a=1.0, at=None, s=1.0):
    """The trained policy, as a chip on the arm's base."""
    p = fp(BASE_UV[0], BASE_UV[1], 0) + np.array([0.02, -0.26, 0]) if at is None else at
    box = RoundedRectangle(width=0.5 * s, height=0.22 * s, corner_radius=0.05 * s, fill_color=PAL["copper"], fill_opacity=a, stroke_width=0).move_to(p)
    t = label("VLA", int(12 * s) if s >= 1 else 12, PAL["bg"]).scale(min(1.0, s)).move_to(p)
    return VGroup(box, fade(t, a))


def placed_tick(u):
    """A tick by the mark once the cube is down on it."""
    if not (0.56 <= u % 1.0 <= 0.80):
        return VGroup()
    a = smooth01(((u % 1.0) - 0.56) / 0.04) * (1 - smooth01(((u % 1.0) - 0.76) / 0.04))
    p = fp(B0[0], B0[1], 0) + np.array([0.42, 0.32, 0])
    return tick(p, a)


def waypoints(u):
    """The action chunk the policy is executing: the next few gripper positions."""
    g = VGroup()
    for i in range(1, 8):
        gp = pick3(u + i * 0.03)[0]
        p = fp(*gp) + np.array([0.06, 0.0, 0])
        g.add(Dot(p, radius=0.028, color=PAL["copper"]).set_opacity(0.85 * (1 - i / 9)))
    return g


def S4(u=0.0):
    return VGroup(tracker(2), shot("real", u, "trained"), waypoints(u), placed_tick(u), vla_tag(), caption("sim2real · trained policy", CAP_Y))


# ═══════════════════════════ the scenes ═══════════════════════════════════
class Base(Scene):
    def finish(self, final):
        """End on exactly `final`, the builder the next idle starts from."""
        self.clear()
        self.add(final)
        self.wait(1 / config.frame_rate)


def idle(scene, build, t):
    u = ValueTracker(0)
    scene.add(always_redraw(lambda: build(u.get_value())))
    scene.play(u.animate.set_value(1), run_time=t, rate_func=linear)


class IdleRest(Scene):
    """The D435i over the table, swaying; a frame of light sweeps down its view."""
    def construct(self):
        idle(self, rest_frame, IDLE_T * 1.5)


class Act0(Base):
    """REAL. The shutter: the camera blows apart, leaving its bare sensor die
    in the air; light runs back up the view onto it, the die spreads into the
    photosite array over the table, the frame is read out row by row and the
    mosaic resolves into the photo."""
    def construct(self):
        e = ValueTracker(0)
        table = faint_table()
        L0 = lens_pt(YAW0, PITCH0)
        D = die_pt(YAW0, PITCH0, BURST_SEP)
        self.add(table)
        # the cone's apex slides from the lens onto the die as the lens leaves
        cn = always_redraw(lambda: cone(YAW0, PITCH0, 1.0, sweep=0.0,
                                        apex=L0 + (D - L0) * smooth01((e.get_value() - 0.1) * 3)))
        cam = always_redraw(lambda: cam_burst(e.get_value()))
        self.add(cn, cam)
        # 1 · the camera explodes: every part flies out from its centre and off
        # the stage; the bare sensor die is left where it sat
        die = Square(0.2, fill_color=PAL["copper"], fill_opacity=1, stroke_width=0).move_to(D)
        self.play(e.animate.set_value(1.0),
                  Succession(Wait(0.3), DrawBorderThenFill(die, stroke_color=PAL["copper"], stroke_width=1.5, run_time=0.55)),
                  run_time=1.3, rate_func=linear)
        self.remove(cam)
        # 2 · light comes back up the view onto the die
        rays = VGroup(*[Line(f, D, stroke_color=PAL["copper"], stroke_width=4.5) for f in table_quad()])
        self.play(LaggedStart(*[ShowPassingFlash(r, time_width=0.5) for r in rays], lag_ratio=0.12), run_time=0.4)
        self.play(Flash(D, color=PAL["copper"], line_length=0.12, num_lines=10, flash_radius=0.16), run_time=0.2)
        # 3 · the die spreads into the dark sensor array over the table, cell by
        # cell nearest first; the view and the faint table are drawn out
        grid0 = photosites(0.0)
        order = sorted(grid0, key=lambda q: np.linalg.norm(q.get_center() - D))
        self.remove(cn)
        cone_now = cone(YAW0, PITCH0, 1.0, sweep=0.0, apex=D)
        self.add(cone_now)
        # Uncreate runs its rate function backwards (rate(1 - t)), so this is
        # "drawn out over the first 60% of the play"
        early = lambda t: smooth(max(0.0, (t - 0.4) / 0.6))
        self.play(Uncreate(cone_now, rate_func=early, lag_ratio=0), Uncreate(table, rate_func=early, lag_ratio=0),
                  LaggedStart(*[TransformFromCopy(die, q) for q in order], lag_ratio=0.006, rate_func=smooth),
                  FadeOut(die, rate_func=lambda t: smooth(min(1.0, t / 0.3))), run_time=0.6)
        self.remove(*grid0)
        # 4 · the frame is read out row by row (a rolling shutter)
        rows = ValueTracker(0)
        mos = always_redraw(lambda: photosites(rows.get_value()))
        line = always_redraw(lambda: readout_line(rows.get_value()))
        self.add(mos, line)
        self.play(rows.animate.set_value(PXR + 0.01), run_time=0.75, rate_func=linear)
        self.remove(line, mos)
        # 5 · the mosaic resolves into the photo: each cell lets go of its colour
        # onto the picture under it, top row first; the viewfinder draws on
        s0 = S0()
        sh, tr_, ms_, cap = s0
        final_mos = photosites(PXR + 1)
        under = VGroup(sh[0], sh[1], sh[2], sh[3])
        self.add(under, final_mos)
        cells = sorted(final_mos, key=lambda q: (-q.get_center()[1], q.get_center()[0]))
        self.play(LaggedStart(*[FadeOut(q, scale=0.4) for q in cells], lag_ratio=0.03),
                  Create(sh[4]), FadeIn(tr_), FadeIn(ms_), run_time=0.6)
        self.play(show(cap), run_time=0.35)
        self.finish(S0())


class IdleUntrained(Scene):
    def construct(self):
        idle(self, S0, IDLE_T * 1.5)


def _splat_specs(seed=3):
    """The splats of the reconstruction, once: where each SETTLES on a surface
    of the shot (the table top, its front lip, the three cubes), its size and
    angle there, its colour (the photo's, lifted off the page), and where it
    STARTS: a loose, bloated blob somewhere in the volume over the table (the
    initialisation the optimisation starts from), never outside the frame."""
    rnd = random.Random(seed)
    W, yb, yt = frame_box()
    tab = ManimColor(PAL["table"]).interpolate(ManimColor(PAL["soft"]), 0.42)
    lip = ManimColor(PAL["lip"]).interpolate(ManimColor(PAL["soft"]), 0.3)
    out = []

    def add(pos, w, h, ang, col, op, key, lo=None):
        if lo is None:
            lo = fp(rnd.uniform(-0.85, 0.85), rnd.uniform(0.05, 0.95), rnd.uniform(0.05, 0.75))
            lo = lo + np.array([rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), 0])
        lo = np.array(lo, dtype=float)
        lo[0] = min(max(lo[0], -W + 0.25), W - 0.25)
        lo[1] = min(max(lo[1], yb + 0.2), yt - 0.35)
        out.append(dict(p=np.array(pos, dtype=float), lo=lo, w=w, h=h, ang=ang, ang0=rnd.uniform(-1.6, 1.6),
                        col=col, op=op, key=key + rnd.uniform(0, 0.25)))

    # the table top: jittered on a 9 x 6 grid so it is covered evenly, flat
    # (wide and foreshortened), turned a little with the perspective
    for i in range(9):
        for j in range(6):
            uu = -0.9 + 1.8 * (i + rnd.uniform(0.15, 0.85)) / 9
            vv = 0.02 + 0.96 * (j + rnd.uniform(0.15, 0.85)) / 6
            q = fp(uu, vv)
            k = 1 - 0.3 * vv
            add(q, 0.24 * k, 0.07 * k, -0.18 * uu * vv + rnd.uniform(-0.12, 0.12), tab, 0.5, 0.55 * (1 - vv))
    # its front lip: a row of thin splats along the near edge
    for i in range(8):
        uu = -0.92 + 1.84 * (i + 0.5) / 8
        q = fp(uu, 0) + np.array([0, -0.06, 0])
        add(q, 0.3, 0.06, rnd.uniform(-0.05, 0.05), lip, 0.75, 0.0)
    # the cubes: small splats filling each cube's projected prism, coloured by
    # the face they land on
    for (p, s), tgt in [((A0, RED_S), True)] + [(d, False) for d in DISTRACT]:
        q = fp(p[0], p[1], 0)
        sz = s * SC_K * (1 - 0.3 * p[1])
        x = q[0] - sz * 0.22
        dd = sz * 0.45
        base = ManimColor(PAL["copper"]) if tgt else ManimColor(PAL["soft"])
        n = 22 if tgt else 16
        for _ in range(n):
            t = rnd.uniform(0, 1) ** 1.4
            px, py = x + rnd.uniform(-0.42, 0.42) * sz, q[1] + rnd.uniform(0.08, 0.92) * sz
            pos = np.array([px + t * dd, py + t * dd, 0])
            face = "front" if t < 0.3 else ("top" if py > q[1] + sz * 0.55 else "side")
            col = base.lighter(0.25) if face == "top" else (base.darker(0.25) if face == "side" else base)
            r = sz * (0.32 if tgt else 0.36)
            lo = q + np.array([rnd.uniform(-0.55, 0.55), rnd.uniform(0.1, 0.9), 0])
            add(pos, r * rnd.uniform(0.8, 1.2), r * rnd.uniform(0.45, 0.7), rnd.uniform(-0.8, 0.8), col,
                0.62 if tgt else 0.6, 0.35 + 0.3 * p[1], lo=lo)
    return out


_SPLATS = {}


def splat_set(loose=0.0, seed=3, a=1.0):
    """Gaussian splats over the shot's surfaces: each a soft core in a fainter
    halo (a Gaussian's falloff), anisotropic, rotated. loose 1 = the
    initialisation (bloated, scattered over the table's volume, faint);
    0 = settled on the surfaces. Splats settle in their own order (the lip
    and near table first), so the optimisation reads as converging."""
    if seed not in _SPLATS:
        _SPLATS[seed] = _splat_specs(seed)
    g = VGroup()
    for sp in _SPLATS[seed]:
        t = smooth01((1 - loose) * 1.45 - sp["key"] * 0.6) if 0 < loose < 1 else 1 - loose
        L = 1 - t
        pos = lerp(sp["p"], sp["lo"], L)
        w = sp["w"] * (1 + 0.7 * L)
        h = sp["h"] * (1 + 1.5 * L)
        ang = lerp(sp["ang"], sp["ang0"], L)
        op = sp["op"] * (1 - 0.5 * L) * a
        halo = Ellipse(width=w * 1.7, height=h * 1.7, fill_color=sp["col"], fill_opacity=op * 0.22, stroke_width=0)
        core = Ellipse(width=w, height=h, fill_color=sp["col"], fill_opacity=op, stroke_width=0)
        g.add(VGroup(halo, core).rotate(ang).move_to(pos))
    return g


def view_cam(p, target, s=0.16):
    """A small camera glyph at p looking at target."""
    d = target - p
    ang = math.atan2(d[1], d[0])
    body = Rectangle(width=s * 1.6, height=s, fill_color=PAL["ink"], fill_opacity=1, stroke_width=0).move_to(p).rotate(ang)
    lens = Triangle(fill_color=PAL["ink"], fill_opacity=1, stroke_width=0).scale(s * 0.55).rotate(ang - math.pi / 2).move_to(p + d / np.linalg.norm(d) * s * 0.95)
    return VGroup(body, lens)


VIEWS = [np.array([-1.3, 2.35, 0]), np.array([0.0, 2.6, 0]), np.array([1.3, 2.35, 0])]
VIEW_AT = fp(0.05, 0.5, 0.15)


def view_frustum(i):
    """What view i sees: hairlines from its lens to the table's four corners,
    and a faint wash over the table it captures."""
    v = VIEWS[i]
    lens = v + (VIEW_AT - v) / np.linalg.norm(VIEW_AT - v) * 0.2
    corners = [fp(-1, 0), fp(1, 0), fp(1, 1), fp(-1, 1)]
    lines = VGroup(*[Line(lens, q, stroke_color=PAL["copper"], stroke_width=1.2, stroke_opacity=0.45) for q in corners])
    wash = Polygon(*corners, fill_opacity=0, stroke_color=PAL["copper"], stroke_width=1.6, stroke_opacity=0.8)
    return VGroup(lines, wash)


class Act1(Base):
    """REAL2SIM. Three views capture the scene; the photo gives way to Gaussian
    splats that start as a loose cloud and converge onto the surfaces; the
    sim twin draws in under them and the splats are retired."""
    def construct(self):
        # draw order by z_index (Scene.play would otherwise re-stack what it
        # animates on top of the arm): backdrop or twin grid, mark, cubes, splats,
        # arm, viewfinder, view cameras, tracker/caption
        Z = dict(bg=0, grid=0, mark=1, cubes=2, splat=3, arm=5, frame=6, cam=7, ui=8)
        s0 = S0()
        sh, tr_, ms_, cap = s0
        for m, z in ((sh[0], "bg"), (sh[1], "mark"), (sh[2], "cubes"), (sh[3], "arm"), (sh[4], "frame"),
                     (tr_, "arm"), (ms_, "arm"), (cap, "ui")):
            m.set_z_index(Z[z])
        self.add(s0)
        p = ValueTracker(0)
        # the photo (wall, floor, table, real cubes, viewfinder) dims as one,
        # by its own opacities: it never re-stacks and never pops
        photo = ValueTracker(1.0)
        base_op = {}
        for grp in (sh[0], sh[2], sh[4]):
            for m in grp.family_members_with_points():
                base_op[id(m)] = (m.get_fill_opacity(), m.get_stroke_opacity())

        def dim(grp):
            v = photo.get_value()
            for m in grp.family_members_with_points():
                fo, so = base_op[id(m)]
                m.set_fill(opacity=fo * v)
                m.set_stroke(opacity=so * v)
        for grp in (sh[0], sh[2], sh[4]):
            grp.add_updater(dim)

        # 1 · the caption and the failed grasps go; the real/sim/real bar draws in
        t0 = tracker(0).set_z_index(Z["ui"])
        labels = VGroup(t0[2], t0[4], t0[6])
        rest = VGroup(*[m for m in t0 if m not in labels])
        self.play(FadeOut(cap), FadeOut(tr_), FadeOut(ms_), Create(rest, lag_ratio=0.15), show(labels, lag_ratio=0.2),
                  run_time=0.45, rate_func=smooth)
        self.remove(rest, labels)
        self.add(always_redraw(lambda: tracker(p.get_value()).set_z_index(Z["ui"])))

        # 2 · three views of the scene: each camera draws in, then shows what
        # it sees (its frustum onto the table), one after another
        cams = [view_cam(v, VIEW_AT).set_z_index(Z["cam"]) for v in VIEWS]
        self.play(LaggedStart(*[DrawBorderThenFill(c, stroke_color=PAL["ink"], stroke_width=1.2) for c in cams], lag_ratio=0.3),
                  run_time=0.35)
        frs = [view_frustum(i).set_z_index(Z["cam"]) for i in range(3)]
        self.play(LaggedStart(*[Succession(Create(fr, lag_ratio=0.0, run_time=0.36, rate_func=smooth),
                                           FadeOut(fr, run_time=0.2)) for fr in frs], lag_ratio=0.62),
                  p.animate.set_value(0.18), run_time=1.0)

        # 3 · the reconstruction starts: the photo dims and the splats'
        # initial cloud draws in over the table's volume; the cameras go
        cloud = splat_set(1.0).set_z_index(Z["splat"])
        self.play(photo.animate.set_value(0.35),
                  LaggedStart(*[FadeIn(e) for e in cloud], lag_ratio=0.01),
                  *[FadeOut(c) for c in cams], p.animate.set_value(0.35), run_time=0.55, rate_func=smooth)

        # 4 · the optimisation: the splats converge onto the surfaces as the
        # photo fades out under them; what is left is the splat model
        L = ValueTracker(1.0)
        self.remove(cloud, *cloud)
        conv = always_redraw(lambda: splat_set(L.get_value()).set_z_index(Z["splat"]))
        self.add(conv)
        self.play(L.animate.set_value(0.0), photo.animate.set_value(0.0), p.animate.set_value(0.7),
                  run_time=0.85, rate_func=smooth)
        for grp in (sh[0], sh[2], sh[4]):
            grp.clear_updaters()
        self.remove(sh[0], sh[2], sh[4])

        # 5 · the twin's geometry draws in under the splats, back to front,
        # cube by cube; the arm becomes its model; the splats are retired
        conv.clear_updaters()
        twin = shot("sim", 0.0, "static")
        twin[0].set_z_index(Z["grid"])
        twin[2].set_z_index(Z["cubes"])
        twin[3].set_z_index(Z["arm"])
        self.play(LaggedStart(*[Create(l) for l in twin[0]], lag_ratio=0.05),
                  LaggedStart(*[DrawBorderThenFill(c, stroke_color=PAL["ink"], stroke_width=1.2) for c in twin[2]], lag_ratio=0.25),
                  ReplacementTransform(sh[3], twin[3]),
                  LaggedStart(*[FadeOut(e) for e in conv], lag_ratio=0.004),
                  p.animate.set_value(1.0), run_time=0.8, rate_func=smooth)
        self.play(show(r2s_cap()), run_time=0.3)
        self.finish(S1())


class IdleTwin(Scene):
    def construct(self):
        idle(self, S1, IDLE_T)


class Act2(Base):
    """SIM DATA. The twin tiles a wall of randomised copies; each runs a
    demonstration; a world model rolls one forward in latent space."""
    def construct(self):
        s1 = S1()
        tr, twin, burst, cap = s1
        self.add(tr, twin, cap)
        # 1 · the twin shrinks rigidly into the wall's first cell
        c0 = cell(0, 0.0, box=False)
        self.play(FadeOut(cap), twin.animate.scale(CELL_K / SC_K, about_point=fp(0, 0, 0)).shift(fp(0, 0, 0, cell_c(0), CELL_K) - fp(0, 0, 0)),
                  run_time=0.6)
        self.remove(twin)
        self.add(c0)
        # 2 · copies spread across the wall, each re-randomised as it lands
        boxes = VGroup(*[cell_box(i) for i in range(NC)])
        cells = [c0] + [cell(i, 0.0, box=False) for i in range(1, NC)]
        self.play(Create(boxes[0]), LaggedStart(*[Create(cells[i], lag_ratio=0.02) for i in range(1, NC)], lag_ratio=0.1),
                  LaggedStart(*[Create(boxes[i]) for i in range(1, NC)], lag_ratio=0.08), run_time=0.9)
        # 3 · demonstrations: each arm runs, its path traced
        ph = ValueTracker(0)
        for i in range(NC):
            self.remove(cells[i])
        self.remove(boxes)
        live = always_redraw(lambda: VGroup(*[VGroup(cell(i, (ph.get_value() * cell_phase(i))), demo_path(i, ph.get_value())) for i in range(NC)]))
        self.add(live)
        self.play(ph.animate.set_value(1.0), show(caption("domain randomization · demos", WALL_CAP_Y)), run_time=0.6)
        # 4 · the world model: observe, encode, roll the latent forward, decode
        wm = world_model()
        obs, enc = wm[0], wm[1]
        rest = VGroup(*wm[2:])
        src = cell(0, cell_phase(0), box=False)
        self.play(TransformFromCopy(src, obs), run_time=0.35)
        self.play(DrawBorderThenFill(enc, stroke_color=PAL["ink"], stroke_width=1.5), LaggedStart(*[Create(m) for m in rest], lag_ratio=0.06), run_time=0.6)
        run = Line([-0.82, WM_Y, 0], [ZX[2], WM_Y, 0], stroke_color=PAL["copper"], stroke_width=5)
        self.play(ShowPassingFlash(run, time_width=0.4), show(caption("world model · imagined rollout", -3.45)), run_time=0.4)
        self.finish(S2())


class IdleData(Scene):
    def construct(self):
        idle(self, lambda u: S2(u, pulse=(u * 2) % 1), IDLE_T * 1.5)


class Act3(Base):
    """TRAIN. The wall stacks into a dataset; a frame is cut into patch
    tokens beside the instruction's words; the VLA's predicted action chunk
    converges on the demonstration as the loss falls."""
    def construct(self):
        s2 = S2()
        tr, wl, wcap, wm, wmcap = s2
        self.add(s2)
        # 1 · the wall slides into a stack (rigidly), the world model's
        # imagined frames go with it as data
        st = stack()
        moves = [wl[i].animate.scale(STACK_CARD_K / CELL_K).move_to([STACK_C[0] + 0.1, STACK_C[1] + 0.12, 0]) for i in range(NC)]
        self.play(LaggedStart(*moves, lag_ratio=0.05), FadeOut(wcap), FadeOut(wmcap), FadeOut(wm, shift=DOWN * 0.3),
                  FadeIn(loss_curve(0.0)), run_time=0.75)
        self.play(FadeOut(wl), FadeIn(st), run_time=0.25)
        # 2 · a frame comes off the stack; a patch grid is laid over it
        frame = shot("sim", OUT_U, "trained", PATCH_SRC_C, PATCH_SRC_K)
        W, yb, yt = frame_box(PATCH_SRC_C, PATCH_SRC_K, 1.45)
        fbox = Rectangle(width=2 * W, height=yt - yb, stroke_color=PAL["soft"], stroke_width=1.3).move_to([0, (yt + yb) / 2, 0])
        self.play(Create(fbox), Create(frame, lag_ratio=0.02), run_time=0.4)
        grid = VGroup(*[Line([-W + i * 2 * W / 4, yb, 0], [-W + i * 2 * W / 4, yt, 0], stroke_color=PAL["ink"], stroke_width=1.3) for i in (1, 2, 3)],
                      *[Line([-W, yb + j * (yt - yb) / 3, 0], [W, yb + j * (yt - yb) / 3, 0], stroke_color=PAL["ink"], stroke_width=1.3) for j in (1, 2)])
        self.play(LaggedStart(*[Create(l) for l in grid], lag_ratio=0.15), run_time=0.3)
        # 3 · the patches become tokens, flying to their slots
        toks = patch_tokens()
        pieces = VGroup()
        for k in range(12):
            p, pw, ph = patch_rect(k)
            pieces.add(Rectangle(width=pw * 0.94, height=ph * 0.94, fill_color=toks[k].get_fill_color(), fill_opacity=1, stroke_color=PAL["ink"], stroke_width=1.2).move_to(p))
        self.play(FadeIn(pieces), FadeOut(frame), FadeOut(grid), FadeOut(fbox), run_time=0.2)
        self.play(LaggedStart(*[ReplacementTransform(pieces[k], toks[k], path_arc=0.6) for k in range(12)], lag_ratio=0.05), run_time=0.6)
        # 4 · the instruction, word tokens; cross-attention from words to patch
        chips = word_chips()
        self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.1) for c in chips], lag_ratio=0.12), run_time=0.35)
        lay = layers()
        self.play(Create(attention()), LaggedStart(*[Create(l) for l in lay], lag_ratio=0.1), show(vla_cap()), run_time=0.55)
        # 5 · training: forward passes down the layers into the predicted
        # chunk, backprop back up them; the chunk closes on the demonstration
        # as the loss falls
        it, ps = ValueTracker(0.0), ValueTracker(0.0)
        self.remove(lay)
        self.add(always_redraw(lambda: layers(**pass_state(ps.get_value() % 1.0)[0])))
        self.add(always_redraw(lambda: pass_label(*pass_state(ps.get_value() % 1.0)[1:])))
        self.add(out_frame(0.0)[:-1])
        self.add(always_redraw(lambda: chunk(smooth01(it.get_value()))))
        self.add(always_redraw(lambda: loss_curve(it.get_value())))
        self.play(FadeIn(chunk_cap()), run_time=0.15)
        self.play(ps.animate.set_value(1.0), it.animate.set_value(0.8), run_time=0.9, rate_func=linear)
        self.play(it.animate.set_value(1.0), run_time=0.3)
        self.finish(S3())


def pass_state(f):
    """One training step, f 0..1: the forward pass runs down the layers into
    the predicted chunk, then the loss runs back up them."""
    if f < 0.5:
        x = f / 0.5
        return dict(lit=x * 4.4 - 0.6, out_lit=smooth01((x - 0.82) / 0.18)), "forward pass", math.sin(math.pi * x)
    if f < 0.56:
        return dict(out_lit=1.0 - smooth01((f - 0.5) / 0.06)), None, 0.0
    x = (f - 0.56) / 0.44
    # the loss leaves the chunk-vs-demo frame first (the ink arrow up), then
    # climbs the layers bottom to top
    return dict(back=3.6 - x * 4.2, out_back=smooth01(x / 0.08) * (1 - smooth01((x - 0.3) / 0.15))), "backprop", math.sin(math.pi * x)


def pass_label(name, a):
    if not name or a < 0.02:
        return VGroup()
    return fade(label(name, 12, PAL["copper"] if name.startswith("f") else PAL["ink"]).move_to([1.3, LAYER_Y[-1] - 0.32, 0]), a)


def train_idle(u):
    """Training steps repeating: the forward pass lights each layer in turn
    and the arrow into the action chunk, then backprop outlines them back up;
    the chunk holds on target and the loss tail flickers. u = 0 is S3()."""
    st, name, la = pass_state((u * 4) % 1.0)
    g = S3(flick=math.sin(math.tau * u))
    g.submobjects[6] = layers(**st)
    g.add(pass_label(name, la))
    return g


class IdleTrain(Scene):
    def construct(self):
        idle(self, train_idle, IDLE_T * 2)


class Act4(Base):
    """SIM2REAL. The VLA folds into a chip and flies into the arm's base; the
    twin draws in and is re-lit as the real shot."""
    def construct(self):
        s3 = S3()
        tr, st, crv, toks, chips, att, lay, vcap, outf, ccap = s3
        self.add(s3)
        p = ValueTracker(1.0)
        self.remove(tr)
        self.add(always_redraw(lambda: tracker(p.get_value())))
        # 1 · the network folds together into one chip
        chip = vla_tag(at=np.array([0.0, 0.25, 0]), s=2.0)
        net = VGroup(toks, chips, att, lay)
        self.play(FadeOut(VGroup(st, crv), shift=UP * 0.4), FadeOut(VGroup(outf, ccap), shift=DOWN * 0.4), FadeOut(vcap),
                  FadeTransform(net, chip), p.animate.set_value(1.4), run_time=0.75)
        # 2 · the twin draws in at the real shot's framing
        twin = shot("sim", 0.0, "trained")
        self.play(LaggedStart(*[Create(l) for l in twin[0]], lag_ratio=0.03), FadeIn(twin[1]), FadeIn(twin[2]), Create(twin[3]),
                  chip.animate.shift(UP * 1.25).scale(0.5), run_time=0.6)
        # 3 · the chip flies into the arm's base
        dest = fp(BASE_UV[0], BASE_UV[1], 0) + np.array([0.02, -0.26, 0])
        path = ArcBetweenPoints(chip.get_center(), dest, angle=1.0)
        tag = vla_tag()
        self.play(MoveAlongPath(chip, path), run_time=0.55)
        self.remove(chip)
        self.add(tag)
        self.play(Flash(dest, color=PAL["copper"], line_length=0.12, num_lines=10, flash_radius=0.3), run_time=0.3)
        # 4 · re-lit as real: the grid gives way front to back to the photo,
        # the model becomes the arm; the bar reaches "real"
        real = shot("real", 0.0, "trained")
        self.bring_to_back(real[0])
        self.play(LaggedStart(*[FadeOut(l) for l in reversed(list(twin[0]))], lag_ratio=0.03),
                  LaggedStart(*[FadeIn(m) for m in real[0]], lag_ratio=0.15),
                  ReplacementTransform(twin[2], real[2]), ReplacementTransform(twin[3], real[3]), ReplacementTransform(twin[1], real[1]),
                  Create(real[4]), p.animate.set_value(2.0), run_time=0.85)
        self.bring_to_front(real[1], real[2], real[3], tag)
        self.play(show(caption("sim2real · trained policy", CAP_Y)), FadeIn(waypoints(0.0)), run_time=0.35)
        self.finish(S4())


def grasp_burst(u):
    g = VGroup()
    f = ((u % 1.0) - 0.22) / 0.08
    if 0 <= f <= 1:
        c = fp(A0[0], A0[1], 0.2)
        for i in range(10):
            ang = i / 10 * math.tau
            r0, r1 = 0.22 + 0.12 * f, 0.3 + 0.14 * f
            g.add(Line([c[0] + r0 * math.cos(ang), c[1] + r0 * math.sin(ang), 0], [c[0] + r1 * math.cos(ang), c[1] + r1 * math.sin(ang), 0],
                       stroke_color=PAL["copper"], stroke_width=2, stroke_opacity=1 - f))
    return g


class IdleReal(Scene):
    def construct(self):
        idle(self, lambda u: VGroup(S4(u), grasp_burst(u)), IDLE_T * 2)
