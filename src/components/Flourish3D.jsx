import React, { useEffect, useRef } from 'react';
// `steps` must be imported and passed as a FUNCTION: anime v4.5 removed the
// string form (ease: 'steps(4)' hits the deprecated list in easings/eases/
// parser.js, warns, and silently falls back to linear).
import { animate, stagger, steps } from 'animejs';

// Page-wide decorative 3D flourishes — one per side, fixed to the viewport and
// scrubbed by page scroll. Unlike the old SVG storyboards these are built from
// HTML divs inside a real CSS 3D context (`perspective` + an unbroken
// `transform-style: preserve-3d` chain), so `translateZ` produces TRUE
// projective foreshortening. SVG cannot do this: translateZ on an SVG node is
// silently ignored (a measured ±150px gave a size ratio of exactly 1.0) and
// rotateY only yields a flat cos() x-squash.
//
//   LEFT  (AI / ML)    — "Conv Stack": three wireframe feature volumes that
//                        blow apart into their own faces and reassemble, an
//                        activation plane rippling on a 3D grid stagger, and a
//                        token row spread purely along Z.
//   RIGHT (Robotics)   — "Joint Module": a revolute actuator (bracket, motor
//                        can, stator, rotor, output flange + link arm) exploded
//                        along its own rotation axis, with a dashed centreline.
//
// Scroll drives the explode/assemble parameter and the camera yaw/pitch;
// anime.js drives the ambient life (rotor spin, kernel raster, activation
// ripple, idle yaw). The two never write the same element's transform.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Explode distance each box face travels along its own normal.
const FACE_EXPLODE = 74;
const TOP_EXPLODE = 60;

// The five visible faces of a wireframe box (the bottom is omitted — the camera
// is always pitched slightly down). Each face is placed by rotating to its own
// plane and then pushing out along that plane's normal, so "exploding" is just
// a larger translateZ — the faces separate in real depth, and the near ones
// visibly grow while the far ones shrink.
function boxFaces(w, h, d) {
  return [
    { key: 'front', W: w, H: h, rot: 'rotateY(0deg)', z: d / 2, op: 1, ex: FACE_EXPLODE },
    { key: 'back', W: w, H: h, rot: 'rotateY(180deg)', z: d / 2, op: 0.38, ex: FACE_EXPLODE },
    { key: 'right', W: d, H: h, rot: 'rotateY(90deg)', z: w / 2, op: 0.6, ex: FACE_EXPLODE },
    { key: 'left', W: d, H: h, rot: 'rotateY(-90deg)', z: w / 2, op: 0.6, ex: FACE_EXPLODE },
    { key: 'top', W: w, H: d, rot: 'rotateX(90deg)', z: h / 2, op: 0.76, ex: TOP_EXPLODE },
  ];
}

// A wireframe box. Faces carry their base depth + explode distance as data so
// the scroll handler can re-place them without React re-rendering.
function Box({ w, h, d, y = 0, x = 0, z = 0, extraClass = '' }) {
  return (
    <div className={`f3d__part ${extraClass}`} style={{ transform: `translate3d(${x}px, ${y}px, ${z}px)` }}>
      {boxFaces(w, h, d).map(f => (
        <div
          key={f.key}
          className="f3d__face"
          data-rot={f.rot}
          data-z={f.z}
          data-ex={f.ex}
          style={{
            width: `${f.W}px`,
            height: `${f.H}px`,
            marginLeft: `${-f.W / 2}px`,
            marginTop: `${-f.H / 2}px`,
            opacity: f.op,
            transform: `${f.rot} translateZ(${f.z}px)`,
          }}
        />
      ))}
    </div>
  );
}

// A flat ring (perfect CSS circle) — the module tilt turns it into a correctly
// eccentric perspective ellipse, and it re-shapes live as the camera pitches.
function Ring({ d, z = 0, op = 0.7, thick = 1, cls = '' }) {
  return (
    <div
      className={`f3d__ring ${cls}`}
      style={{
        width: `${d}px`,
        height: `${d}px`,
        marginLeft: `${-d / 2}px`,
        marginTop: `${-d / 2}px`,
        borderWidth: `${thick}px`,
        opacity: op,
        transform: `translateZ(${z}px)`,
      }}
    />
  );
}

// LEFT — AI / ML. Feature volumes + activation plane + a token row that exists
// only because of perspective (identical CSS sizes, spread along Z).
function ConvStack() {
  const CELLS = 16; // 4x4 activation grid
  const TOKENS = 7;
  return (
    <>
      {/* hairline spine behind everything */}
      <div className="f3d__spine" />

      {/* three feature volumes, tapering wide+flat -> narrow+deep */}
      <Box w={100} h={100} d={18} y={-150} />
      <Box w={74} h={74} d={46} y={-24} />
      <Box w={44} h={44} d={72} y={84} />

      {/* Z-rails tying the activation plane back to the input volume's front
          face. A rotateY(90deg) ribbon lies ALONG the depth axis: its projected
          width is width*sin(yaw) — exactly zero when the camera faces it
          head-on, splaying open as the world turns. Nothing in 2D does that,
          which makes these the cheapest undeniable proof of real depth.
          Static-only: anime emits transform components in a fixed order and so
          can never reproduce a rotate-then-translate placement. */}
      <div className="f3d__part" style={{ transform: 'translate3d(0, -150px, 0)' }}>
        {[[-44, -44], [44, -44], [-44, 44], [44, 44]].map(([x, y], i) => (
          <div
            key={i}
            className="f3d__rail"
            style={{ transform: `translate3d(${x}px, ${y}px, 62px) rotateY(90deg)` }}
          />
        ))}
      </div>

      {/* activation plane floating in front of the input volume */}
      <div className="f3d__part f3d__actplane" style={{ transform: 'translate3d(0, -150px, 62px)' }}>
        {Array.from({ length: CELLS }, (_, i) => {
          const cx = i % 4;
          const cy = Math.floor(i / 4);
          return (
            <div
              key={i}
              className="f3d__cellwrap"
              style={{ transform: `translate3d(${(cx - 1.5) * 26}px, ${(cy - 1.5) * 26}px, 0)` }}
            >
              <div className="f3d__cell" />
            </div>
          );
        })}
        {/* convolution kernel that rasters across the grid */}
        <div className="f3d__kernel" />
      </div>

      {/* token row — identical sizes, spread purely along Z */}
      <div className="f3d__part" style={{ transform: 'translate3d(0, 172px, 0)' }}>
        {Array.from({ length: TOKENS }, (_, i) => (
          <div
            key={i}
            className="f3d__tokwrap"
            style={{ transform: `translate3d(${(i - 3) * 5}px, 0, ${(i - 3) * 32}px)` }}
          >
            <div className="f3d__token" />
          </div>
        ))}
      </div>
    </>
  );
}

// RIGHT — robotics. A revolute joint exploded along its own axis. The module
// wrapper lays that axis up-and-back into the screen, so exploding separates
// the parts in depth as well as on screen.
function JointModule() {
  const HEX = 6;
  const COILS = 8;
  const SPOKES = 6;
  return (
    <div className="f3d__module">
      {/* dashed centreline — the signature of a real exploded engineering view */}
      <div className="f3d__axiswrap">
        <div className="f3d__axis" />
      </div>

      {/* 1 · base bracket (the datum — never moves) */}
      <div className="f3d__part f3d__seat" data-sz="0" data-ez="0" style={{ transform: 'translate3d(0,0,0)' }}>
        <Box w={104} h={78} d={24} />
      </div>

      {/* 2 · motor can — a real hexagonal prism */}
      <div className="f3d__part f3d__seat" data-sz="44" data-ez="126" style={{ transform: 'translate3d(0,0,44px)' }}>
        {Array.from({ length: HEX }, (_, k) => (
          <div
            key={k}
            className="f3d__hexside"
            style={{ transform: `rotateZ(${k * 60}deg) translateX(41.6px) rotateY(90deg)` }}
          />
        ))}
      </div>

      {/* 3 · stator ring + windings */}
      <div className="f3d__part f3d__seat" data-sz="84" data-ez="206" style={{ transform: 'translate3d(0,0,84px)' }}>
        <Ring d={74} z={-9} op={0.55} />
        <Ring d={74} z={9} op={0.55} />
        {Array.from({ length: COILS }, (_, k) => (
          <div
            key={k}
            className="f3d__coil"
            style={{ transform: `rotateZ(${k * 45}deg) translateX(33px) rotateY(90deg)` }}
          />
        ))}
      </div>

      {/* 4 · rotor — spins continuously on its own nested wrapper */}
      <div className="f3d__part f3d__seat" data-sz="110" data-ez="286" style={{ transform: 'translate3d(0,0,110px)' }}>
        <div className="f3d__rotor">
          <Ring d={52} z={-7} op={0.8} />
          <Ring d={52} z={7} op={0.8} />
          {Array.from({ length: SPOKES }, (_, k) => (
            <div key={k} className="f3d__spoke" style={{ transform: `rotateZ(${k * 60}deg)` }} />
          ))}
        </div>
      </div>

      {/* 5 · output flange + articulating link arm */}
      <div className="f3d__part f3d__seat" data-sz="132" data-ez="360" style={{ transform: 'translate3d(0,0,132px)' }}>
        <Ring d={44} op={0.85} thick={1.5} />
        <div className="f3d__pivot">
          <Box w={20} h={98} d={15} y={-56} z={8} />
          <div className="f3d__toolwrap" style={{ transform: 'translate3d(0,-108px,8px)' }}>
            <Ring d={18} op={0.9} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Flourish3D({ side = 'left' }) {
  const ref = useRef(null);
  const isLeft = side === 'left';

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const world = root.querySelector('.f3d__world');
    const faces = Array.from(root.querySelectorAll('.f3d__face'));
    const seats = Array.from(root.querySelectorAll('.f3d__seat'));

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- scroll: explode/assemble + camera -------------------------------
    // k = 0 fully seated, 1 fully exploded. Two smooth cycles across the page
    // so the assembly breathes apart and back together as you scroll.
    const place = k => {
      for (const el of faces) {
        el.style.transform = `${el.dataset.rot} translateZ(${(+el.dataset.z + +el.dataset.ex * k).toFixed(1)}px)`;
      }
      for (const el of seats) {
        const sz = +el.dataset.sz;
        const ez = +el.dataset.ez;
        el.style.transform = `translate3d(0,0,${(sz + (ez - sz) * k).toFixed(1)}px)`;
      }
    };

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      const k = 0.5 - 0.5 * Math.cos(p * TAU * 2);
      place(k);
      // Camera. Yaw deliberately crosses 0 so every box's left/right side wall
      // foreshortens to nothing and swaps over — a tell no 2D fake can produce.
      const yaw = (isLeft ? 1 : -1) * (26 - p * 48);
      const pitch = 7 + p * 9;
      if (world) world.style.transform = `rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`;
    };

    if (reduce) {
      place(0.5); // a composed, half-exploded static view
      if (world) world.style.transform = `rotateX(9deg) rotateY(${isLeft ? 20 : -20}deg)`;
      return;
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // --- anime.js: ambient life ------------------------------------------
    const q = s => Array.from(root.querySelectorAll(s));
    const anims = [
      // slow idle yaw so the piece lives even when the page is still
      animate(q('.f3d__idle'), {
        rotateY: [(isLeft ? -1 : 1) * 7, (isLeft ? 1 : -1) * 7],
        duration: 9000, loop: true, alternate: true, ease: 'inOutSine',
      }),
    ];

    if (isLeft) {
      anims.push(
        // spherical ripple through the activation plane (anime.js grid stagger)
        animate(q('.f3d__cell'), {
          translateZ: [0, 15],
          opacity: [0.3, 1],
          scale: [0.72, 1.06],
          delay: stagger(90, { grid: [4, 4], from: 'center' }),
          duration: 1400, loop: true, alternate: true, ease: 'inOutQuad',
        }),
        // the kernel rasters the grid with a stepped stride (a real convolution)
        animate(q('.f3d__kernel'), {
          translateX: [-39, 39],
          translateY: [-39, 39],
          duration: 5200, loop: true, alternate: true, ease: steps(4),
        }),
        // token row breathes in depth
        animate(q('.f3d__token'), {
          opacity: [0.35, 0.95],
          scale: [0.85, 1.08],
          delay: stagger(110, { from: 'center' }),
          duration: 1600, loop: true, alternate: true, ease: 'inOutSine',
        })
      );
    } else {
      anims.push(
        animate(q('.f3d__rotor'), { rotateZ: 360, duration: 4200, loop: true, ease: 'linear' }),
        // the link arm articulates like a joint under load
        animate(q('.f3d__pivot'), {
          rotateZ: [-16, 16],
          duration: 5200, loop: true, alternate: true, ease: 'inOutSine',
        }),
        animate(q('.f3d__coil'), {
          opacity: [0.25, 0.7],
          delay: stagger(70),
          duration: 1500, loop: true, alternate: true, ease: 'inOutSine',
        })
      );
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      anims.forEach(a => a && a.revert && a.revert());
    };
  }, [isLeft]);

  return (
    <div className={`f3d f3d--${side}`} ref={ref} aria-hidden="true">
      <div className="f3d__world">
        <div className="f3d__idle">{isLeft ? <ConvStack /> : <JointModule />}</div>
      </div>
    </div>
  );
}
