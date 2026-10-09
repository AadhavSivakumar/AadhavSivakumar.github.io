import { snapshot } from './snapshot';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MotionConfig } from 'motion/react';
import Header from './components/Header';
import Hero from './components/Hero';
import Experience from './components/Experience';
import Projects from './components/Projects';
import Skills from './components/Skills';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Modal from './components/Modal';
import ScrollProgress from './components/ScrollProgress';
import TargetCursor from './components/reactbits/TargetCursor';
import Flourish3D from './components/Flourish3D';
import LeftFilm from './components/LeftFilm';
import WaveField from './components/WaveField';
import RobotDock from './components/RobotDock';
import { useTheme } from './hooks/useTheme';
import { startScrollSnap } from './scrollSnap';

// what the reticle's corners close on: everything that can be clicked
const CURSOR_TARGETS = 'a[href], button, [role="button"], [role="tab"], .cursor-target';

function App() {
  const { theme, toggleTheme } = useTheme();
  // Each flourish is one canvas doing its own projection, so the cost is CPU
  // maths rather than layout — but it is still a few thousand segments a frame
  // on every scroll. They are decoration, so on a low-core machine the cheapest
  // honest fix is not to draw them at all. The bar is 4 cores now (it was
  // more than 4): mid-range phones report exactly 4, the owner asked for the
  // animation on phones, and the renderer already paces itself — redraws at
  // twice their own cost, the settled loop skipping frames after a slow draw.
  const [canAfford3D] = useState(
    () => typeof navigator === 'undefined' || (navigator.hardwareConcurrency ?? 8) >= 4
  );
  const lastClickedCardRef = useRef(null);
  const lastMediaRef = useRef(null);   // the opened card's media record; the modal writes the close time into it
  const [modalState, setModalState] = useState({
    isOpen: false,
    itemData: null,
    itemType: null,
    cardRect: null,
    cardHTML: null,
    cardClass: '',
  });

  useEffect(() => {
    if (history.scrollRestoration) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  // Settle onto a page when the scroll has been still for two seconds, and
  // tell the side pieces when it has (see src/scrollSnap.js).
  // `?nosnap` turns the settle off, for screenshot harnesses that need the
  // page to stay exactly where they put it.
  useEffect(() => (new URLSearchParams(window.location.search).has('nosnap') ? undefined : startScrollSnap()), []);


  // the card's picture or video, where it is on screen and what it shows, so
  // the modal can fly it into its own media slot (and back on close)
  const mediaOf = el => {
    const m = el.querySelector('.exp-media video, .exp-media img, video, img');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return null;
    const isVideo = m.tagName === 'VIDEO';
    // a MEDIA-FIRST card (the small project cards: the picture is the card,
    // the title and tags float over it) — the flying picture would cover that
    // text, so the text and its scrim ride INSIDE the flyer: they stay as the
    // card lifts, fade as it grows, and fade back in as it lands on close
    let overlay = null, zk = 1;
    const txt = el.querySelector('.small-project-content');
    if (txt && el.classList.contains('small-project-card')) {
      const t = txt.getBoundingClientRect();
      const clone = txt.cloneNode(true);
      freezeStyles(txt, clone);
      Object.assign(clone.style, { position: 'absolute', left: `${t.left - r.left}px`, bottom: `${r.bottom - t.bottom}px`, width: `${t.width}px`, margin: '0', transform: 'none' });
      overlay = clone.outerHTML;
      // on a hovered card the text floats translateZ(30px) toward the viewer
      // under the tilt's perspective(900px), drawn that much larger: the
      // flyer's copy starts at that size and settles to 1 over the lift
      const tz = new DOMMatrixReadOnly(getComputedStyle(txt).transform === 'none' ? undefined : getComputedStyle(txt).transform).m43;
      if (tz > 0 && tz < 400) zk = 900 / (900 - tz);
    }
    // the card's clip holds still while the modal is up (hidden, it kept
    // playing and was 1-3 s elsewhere by the close); it is seeked to the
    // modal's time as the close starts and resumes after the landing
    if (isVideo) { m.__wasPlaying = !m.paused; m.pause(); }
    return { el: m, overlay, zk, shot: snapshot(m), rect: { top: r.top, left: r.left, width: r.width, height: r.height }, isVideo,
             src: isVideo ? (m.currentSrc || m.getAttribute('src')) : m.currentSrc || m.src, poster: isVideo ? m.poster : '', time: isVideo ? m.currentTime : 0,
             radius: cornersOf(m, el), backdrop: backdropOf(m) };
  };

  // Colours as rgba() strings motion can interpolate. Computed colours can
  // come back as `color(srgb …)` (color-mix tokens); a canvas pixel
  // normalises any of them.
  const px = useRef(null);
  const rgba = c => {
    if (!px.current) { const k = document.createElement('canvas'); k.width = k.height = 1; px.current = k.getContext('2d', { willReadFrequently: true }); }
    const g = px.current;
    g.clearRect(0, 0, 1, 1); g.fillStyle = 'rgba(0,0,0,0)'; g.fillStyle = c; g.fillRect(0, 0, 1, 1);
    const [R, G, B, A] = g.getImageData(0, 0, 1, 1).data;
    return [R, G, B, A / 255];
  };
  const css = ([R, G, B, A]) => `rgba(${R}, ${G}, ${B}, ${+A.toFixed(3)})`;
  const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); return a ? [0, 1, 2].map(i => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a) : [0, 0, 0, 0]; };
  const varColor = name => { const p = document.createElement('i'); p.style.cssText = `display:none;color:var(${name})`; document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return rgba(c); };
  // the colour a picture sits on in its card (seen through its transparent
  // pixels): its ancestors' backgrounds over the page's
  const backdropOf = m => {
    const layers = [];
    for (let n = m.parentElement; n && n !== document.body; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    return css(layers.reduceRight((acc, c) => over(c, acc), varColor('--background-color')));
  };
  // the picture's corners as drawn: its own radius, or the card's where it
  // runs to the card's edge and the card's clip rounds it (a major card's
  // cover has none of its own)
  const cornersOf = (m, card) => {
    const box = m.closest('.exp-media') || m, b = box.getBoundingClientRect(), c = card.getBoundingClientRect();
    const own = getComputedStyle(box), cs = getComputedStyle(card), bw = parseFloat(cs.borderTopWidth) || 0;
    const near = (a, z) => Math.abs(a - z) < 1.5;
    const L = near(b.left, c.left + bw), R = near(b.right, c.right - bw), T = near(b.top, c.top + bw), B = near(b.bottom, c.bottom - bw);
    const k = (o, cr, on) => `${Math.max(parseFloat(own[o]) || 0, on ? Math.max(0, (parseFloat(cs[cr]) || 0) - bw) : 0)}px`;
    return [k('borderTopLeftRadius', 'borderTopLeftRadius', T && L), k('borderTopRightRadius', 'borderTopRightRadius', T && R),
            k('borderBottomRightRadius', 'borderBottomRightRadius', B && R), k('borderBottomLeftRadius', 'borderBottomLeftRadius', B && L)].join(' ');
  };
  // one plain shadow as `rgba() x y blur spread`, the form every shadow in
  // Modal.jsx takes so motion can interpolate between them
  // (the first outer shadow of a list: a small card's picture carries a
  // faint inset rim as well)
  const shadowOf = s => {
    const outer = (s || '').split(/,(?![^(]*\))/).map(x => x.trim()).find(x => x && x !== 'none' && !x.includes('inset'));
    const m = outer && outer.match(/^((?:rgba?|color)\([^)]*\)|#\w+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?$/);
    return m ? `${css(rgba(m[1]))} ${m[2]}px ${m[3]}px ${m[4]}px ${m[5] || 0}px` : 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
  };

  // The card's markup with each direct child FROZEN at the place it has on
  // screen: a card's layout can come from rules scoped to its parent and
  // its position (the major projects' picture-left / picture-right grid),
  // which a detached copy does not match — the lifting copy showed its
  // picture and a blank white half where the text had dropped below the
  // clip (the owner: the lift should be the card itself rising).
  const FROZEN_PROPS = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
    'text-transform', 'text-shadow', 'color', '-webkit-text-fill-color', 'white-space', 'text-overflow',
    '-webkit-line-clamp', '-webkit-box-orient', 'display', 'overflow', 'background-color', 'background-image',
    'border-radius', 'border-top', 'border-right', 'border-bottom', 'border-left', 'padding', 'gap', 'opacity',
    // layout too: freezing `display: flex` without its direction laid the
    // title, text and tags out side by side in the copy
    'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'align-content', 'flex-grow', 'flex-shrink',
    'flex-basis', 'grid-template-columns', 'grid-template-rows', 'text-align', 'margin-top', 'margin-bottom',
    'margin-left', 'margin-right', 'min-width', 'max-width', 'mask-image', '-webkit-mask-image',
    'background-clip', '-webkit-background-clip', 'background-size', 'background-position'];
  const freezeStyles = (el, clone) => {
    const src = [el, ...el.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
    src.forEach((e, i) => {
      const k = dst[i]; if (!k || !k.style) return;
      const cs = getComputedStyle(e);
      for (const prop of FROZEN_PROPS) k.style.setProperty(prop, cs.getPropertyValue(prop));
      // a line clamp needs `display: -webkit-box`, which Firefox reports as
      // `flow-root`: frozen as reported, the copy's clamp let go and a two-line
      // description came out three lines on the first frame
      const clamp = cs.getPropertyValue('-webkit-line-clamp');
      if (clamp && clamp !== 'none') k.style.setProperty('display', '-webkit-box');
    });
  };
  const frozenHTML = card => {
    const box = card.getBoundingClientRect();
    const clone = card.cloneNode(true);
    // ...and every element's TYPE and paint frozen too (Oct 5; the owner:
    // "when I click on a card, all the text/fonts suddenly change"): the
    // card's fonts, sizes, colours and clamps come from rules scoped to its
    // grid and page, which the copy inside the modal does not match, so the
    // text visibly swapped style the moment it lifted — and swapped back
    // when it landed on close
    freezeStyles(card, clone);
    // each box pinned where it is, with !important: on a phone the experience
    // card's text column is `display: contents` (its children are the grid's)
    // and its video `position: relative !important`, so pinning only the
    // direct children left the copy laid out 12-24px off (Oct 8)
    const pin = (src, dst) => [...src.children].forEach((c, i) => {
      const k = dst.children[i]; if (!k) return;
      if (getComputedStyle(c).display === 'contents') { pin(c, k); return; }
      const r = c.getBoundingClientRect();
      const set = { position: 'absolute', left: `${r.left - box.left}px`, top: `${r.top - box.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', right: 'auto', bottom: 'auto' };
      for (const p in set) k.style.setProperty(p, set[p], 'important');
    });
    pin(card, clone);
    return clone.innerHTML;
  };

  // MEASURED AT REST, THEN HIDDEN (Oct 8; the owner: "a small weirdness
  // with graphics right at the start of the opening animation and right at
  // the end of the modal closing animation"). LiftCard has just put the
  // card's tilt back to zero WITHOUT its 0.3s transform transition (inline
  // `transition: none`) and recorded the pose it was drawn in; before, the
  // reset was animated and `animating-out` (scale 0.95) was added before
  // anything was measured, so the modal started from — and the close landed
  // on — the hovered, tilted outline, 2.5-5% too big, and the real card
  // appeared 6-15px smaller at the end of every desktop close. The modal
  // starts from the card at rest IN that pose (Modal.jsx) and the card is
  // hidden in the same frame as the modal's first paint (`hideCard`, from
  // the modal's lift), not here: an instant hide here could show a frame of
  // neither.
  const handleCardClick = useCallback((cardElement, itemData, itemType) => {
    // what is on screen: the hover's border and shadow — unless the screen
    // cannot hover, where a tap leaves `:hover` stuck on for a frame the card
    // never showed (the surface's first frame came up with a shadow)
    const look0 = getComputedStyle(cardElement);
    const hoverable = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const paint = hoverable ? { border: css(rgba(look0.borderTopColor)), shadow: look0.boxShadow } : { border: css(varColor('--hair')), shadow: 'none' };
    cardElement.style.transition = 'none';
    cardElement.style.transform = 'none';
    const rect = cardElement.getBoundingClientRect();
    lastClickedCardRef.current = cardElement;
    const media = mediaOf(cardElement);
    lastMediaRef.current = media;
    const small = cardElement.classList.contains('small-project-card');
    const cs = getComputedStyle(cardElement);
    const pose = cardElement.__tiltPose || { rx: 0, ry: 0, s: 1 };
    // the light under the pointer (SpotlightCard, `:hover::after`) rides on
    // the copy and fades over the lift instead of switching off
    const lit = hoverable && cardElement.matches(':hover') && /exp-card|major-project-card/.test(cardElement.className) && !cardElement.classList.contains('about-me-card');
    setModalState({
      isOpen: true,
      itemData,
      itemType,
      cardRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      // a copy of the card itself, so the modal can BE the card lifting off
      // the page and growing, rather than an empty surface
      cardHTML: frozenHTML(cardElement),
      cardClass: cardElement.className.replace('animating-out', ''),
      media,
      // the surface starts as the card looks — its pose, corners, border and
      // shadow (a small card's are its picture's) — and eases into the
      // modal's; on a media-first card it has no fill or border of its own
      look: {
        pose,
        radius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(v => `${parseFloat(v) || 0}px`).join(' '),
        border: paint.border,
        shadow: shadowOf(small && media && media.el ? getComputedStyle(media.el).boxShadow : paint.shadow),
        hair: css(varColor('--hair')),
        surface: css(varColor('--surface-color')),
        bare: small,
        light: lit ? { x: cardElement.style.getPropertyValue('--mouse-x'), y: cardElement.style.getPropertyValue('--mouse-y') } : null,
      },
    });
  }, []);
  const hideCard = useCallback(() => { lastClickedCardRef.current?.classList.add('animating-out'); }, []);

  // The close lands a copy of the card exactly over the real one; the real
  // card is revealed INSTANTLY underneath (its own un-hide transition — fade
  // and grow from 95% — ran after the copy vanished and read as a jump), and
  // the copy then fades out over it.
  const revealCard = useCallback(() => {
    const card = lastClickedCardRef.current;
    if (!card) return;
    // transform, opacity and visibility snap back (the copy is exactly over
    // the card); the hover's shadow and border keep their transitions, so a
    // card revealed under the pointer eases into its hover state
    card.style.transition = 'box-shadow 0.4s ease, background-color 0.4s ease, border-color 0.4s ease';
    card.classList.remove('animating-out');
    void card.offsetWidth;
    requestAnimationFrame(() => { card.style.transition = ''; });
  }, []);
  // the close starts: the card's clip goes to the modal's moment now, so the
  // seek has landed long before the card is revealed (seeking at the landing
  // showed a stale frame, then jumped)
  const syncCardClip = useCallback(t => {
    const m = lastMediaRef.current, v = m && m.el;
    if (!v || v.tagName !== 'VIDEO' || !isFinite(t)) return;
    try { v.pause(); const to = t % (v.duration || Infinity); if (Math.abs(v.currentTime - to) > 0.03) v.currentTime = to; } catch { /* not seekable */ }
  }, []);

  const handleModalClose = useCallback(() => {
    if (lastClickedCardRef.current) {
      const card = lastClickedCardRef.current;
      card.classList.remove('animating-out');
      // the card's clip resumes only now: through the settle it held the frame the landing still shows
      const v = lastMediaRef.current && lastMediaRef.current.el;
      if (v && v.tagName === 'VIDEO' && v.__wasPlaying) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
      // Return focus to the card that opened the modal. The card is hidden
      // (visibility) while the modal is up, so the browser had dropped focus to
      // <body> — without this a keyboard user is dumped back at the top of the
      // document every time they close something.
      requestAnimationFrame(() => card.focus?.({ preventScroll: true }));
      lastClickedCardRef.current = null;
    }
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    // reducedMotion="user" makes motion/react drop transform and layout
    // animations for anyone who asked the OS for less movement: the nav pill,
    // the theme-toggle swap, the hero, and the modal's lift/expand sequence.
    // It is set once here rather than component by component so a new
    // motion component cannot quietly opt out of it.
    <MotionConfig reducedMotion="user">
      <ScrollProgress />
      {/* React Bits' TargetCursor (the owner's settings: hoverDuration 0.9,
          the system cursor kept): a spinning reticle round the pointer whose
          corners close on whatever can be clicked. Mouse and trackpad only. */}
      <TargetCursor targetSelector={CURSOR_TARGETS} hoverDuration={0.9} hideDefaultCursor={false} />
      {/* Page-wide decorative flourishes: one canvas per side, fixed to the
          viewport behind all content, scrubbed by page scroll. NOT gated on
          width any more — they were invisible on every phone. The stage sizes
          itself from CSS and the renderer scales to match, so a phone gets a
          smaller and cheaper canvas rather than none at all. About.jsx keeps
          its own width gate for the lanyard, which genuinely cannot run
          there. */}
      <div className="page-flourish-layer" aria-hidden="true">
        {/* The hero's sine field lives here too, not in the hero: it is what
            the two pieces are made FROM. Scroll, and each row is cut at the
            centre — the left half flies straight into the camera, the right
            half into the motor. The field is drawn on every machine; the
            pieces stay gated. */}
        <WaveField />
      </div>
      {/* The pieces' own layer (RobotDock.jsx): behind everything on a
          desktop, a dock across the bottom of a phone. Separate from the
          field's layer so that on a phone it can sit ABOVE the content while
          the field stays behind it. */}
      <RobotDock>
        {/* the left stage is Manim clips now (LeftFilm.jsx, manim/left.py) */}
        <LeftFilm />
        {canAfford3D && <Flourish3D side="right" />}
      </RobotDock>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header theme={theme} toggleTheme={toggleTheme} />
      <main id="main">
        <Hero />
        {/* One screen each, in the owner's order: industry experience, research,
            major projects, additional projects, skills & resume, contact. Each
            page but the last ends in a down button to the next (`next`). The
            about card is in the contact page; the resume's documents are a
            strip on the skills page (they had a page of their own). */}
        <Experience id="experience" title="Experience" group="industry" onCardClick={handleCardClick} next={{ to: 'research', label: 'Research' }} />
        <Experience id="research" title="Research" group="research" onCardClick={handleCardClick} next={{ to: 'projects', label: 'Major Projects' }} />
        <Projects onCardClick={handleCardClick} />
        <Skills onCardClick={handleCardClick} next={{ to: 'contact', label: 'Get In Touch' }} />
        <Contact onCardClick={handleCardClick} />
      </main>
      <Footer />
      <Modal
        isOpen={modalState.isOpen}
        itemData={modalState.itemData}
        itemType={modalState.itemType}
        cardRect={modalState.cardRect}
        cardHTML={modalState.cardHTML}
        cardClass={modalState.cardClass}
        media={modalState.media}
        look={modalState.look}
        onLifted={hideCard}
        onCloseStart={syncCardClip}
        onLanding={revealCard}
        onClose={handleModalClose}
      />
    </MotionConfig>
  );
}

export default App;
