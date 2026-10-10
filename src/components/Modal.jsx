import { snapshot } from '../snapshot';
import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import GlassTag from './GlassTag';

const EXPAND_EASE = [0.22, 1, 0.36, 1];
// the CLOSE runs longer and evenly (the owner: "when the modal goes back into
// the card… it snaps back into place and the text reappears instantly"):
// EXPAND_EASE put ~80% of the shrink in its first 100ms, so the surface
// arrived almost at once and the card's text popped on. An in-out curve over
// 0.8s, the modal's text fading out over the first third and the card's text
// fading in over the second half, then a gentle landing.
const CLOSE_S = 0.8;
// the OPEN, as two beats (the owner: "have the card lift off the page, and
// then expand"): it was a 12px, 0.28s lift straight into an expand whose
// curve front-loads its motion, so the two ran together. Now the card rises
// 22px and grows 6% over LIFT_S, HOLDS for a beat, and the expand starts
// gently (an in-out curve). The surface, the card copy inside it and the
// flying media all run on these same numbers.
const LIFT_S = 0.42, LIFT_Y = 22, LIFT_K = 1.06, LIFT_EASE = [0.2, 0.8, 0.2, 1];
const OPEN_HOLD = 0.1, OPEN_S = 0.7, OPEN_EASE = [0.5, 0, 0.18, 1];
const CLOSE_EASE = [0.65, 0, 0.35, 1];
// the landing: the surface fades off the revealed card, THEN the flying
// picture cross-fades into the card's own (the same frame, paused). A new
// element cannot match a card's picture to the device pixel — on a 3x phone
// the card's layer draws it 2 px lower than its box says — so it hands over
// by a fade, not a cut. Over the surface, the fade would wash white.
const SETTLE_S = 0.25, FLY_OUT = { duration: 0.2, delay: 0.22, ease: 'easeInOut' };

// Content population: children stagger in once the modal is fully expanded,
// and stagger back out (quickly, in reverse) before it collapses.
const contentContainer = {
  hidden: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
  // in while the card copy is still fading (Oct 8: at 0.45 the copy was gone
  // 0.3 s into the expand and the content not yet there — 160-180 ms of
  // empty surface)
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } },
};
const contentItem = {
  hidden: { opacity: 0, y: 8, transition: { duration: 0.26, ease: 'easeOut' } },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EXPAND_EASE } },
};

function finalRect() {
  const width = Math.min(1280, window.innerWidth * 0.9);
  const height = Math.min(window.innerHeight * 0.9, 1080);
  return {
    top: (window.innerHeight - height) / 2,
    left: (window.innerWidth - width) / 2,
    width,
    height,
  };
}

// Open: lift (card rises off the page) -> expand (grows to modal size)
// -> open (content staggers in). Close runs the same steps in reverse:
// departing (content staggers out) -> collapse (shrinks back to the card)
// -> settle (drops back onto the page and hands off to the real card).
// every shadow here is ONE shadow written `rgba() x y blur spread` (App.jsx
// `shadowOf` reads the card's into the same form), or motion cannot
// interpolate between them and jumps
const NO_SHADOW = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
const clear = c => c && c.replace(/,\s*[\d.]+\)$/, ', 0)');

export default function Modal({ isOpen, itemData, itemType, cardRect, cardHTML, cardClass, media, look, closeRequest, onLifted, onCloseStart, onLanding, onClose }) {
  const [phase, setPhase] = useState('closed');
  const [pick, setPick] = useState(0);            // which gallery item is in the media slot
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  // Move focus INTO the dialog once it is open. Until this, focus stayed on
  // <body> (the trigger card gets visibility:hidden while the modal is up), so
  // a screen reader or keyboard user was never taken to the content at all.
  useEffect(() => {
    if (phase !== 'open') return;
    closeRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // Keep Tab inside the dialog. Without it, tabbing walks straight out into the
  // page behind the backdrop, which is still fully interactive.
  const trapTab = useCallback(e => {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const items = [...root.querySelectorAll(
      'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, []);
  const savedRect = useRef(null);
  const contentRef = useRef(null);
  const wrapRef = useRef(null);
  const flyVid = useRef(null);
  // where the modal's own media sits, in viewport px, once the modal is at its
  // final size (the content is laid out at that size from the start)
  const mediaTarget = () => {
    const el = contentRef.current && contentRef.current.querySelector('.modal-image');
    if (!el) return null;
    let x = 0, y = 0, n = el;
    while (n && n !== contentRef.current) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    const fr = finalRect();
    const sc = wrapRef.current ? wrapRef.current.scrollTop : 0;
    return { top: fr.top + y - sc, left: fr.left + x, width: el.offsetWidth, height: el.offsetHeight };
  };
  // its corners, which the flyer takes on as it arrives (and leaves from)
  const mediaRadius = () => {
    const el = contentRef.current && contentRef.current.querySelector('.modal-image');
    const cs = el ? getComputedStyle(el) : null;
    return cs ? [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(v => `${parseFloat(v) || 0}px`).join(' ') : '8px 8px 8px 8px';
  };

  useEffect(() => {
    if (isOpen && cardRect && phase === 'closed') {
      savedRect.current = { ...cardRect };
      setPick(0);
      document.body.style.overflow = 'hidden';
      setPhase('lift');
    }
  }, [isOpen, cardRect, phase]);

  const closeFrom = useRef(null);
  // THE CLOSE FLIES A SNAPSHOT (the owner: "right when I click the close
  // button… there's a small flash/jitteryness"): the flyer used to be a NEW
  // <video>/<img> that had not decoded a frame yet — for a frame or two the
  // slot showed its #111 background (the flash), then the poster, then the
  // video at a different moment. The frame on screen at the click is drawn
  // to a canvas, cropped exactly as object-fit: cover crops it, and that
  // canvas is what flies back to the card.
  const closeShot = useRef(null);
  // what the flight LANDS on: the card's own picture — an <img> of the same
  // source, or a still of the card's clip once it has been seeked to the
  // modal's moment — under the modal's frame, which fades out on the way. The
  // card shows exactly these pixels when it is revealed; the modal's frame
  // (another encode, resampled) differed in texture, and a gallery item
  // landed as itself and swapped (Oct 8).
  const [closeBase, setCloseBase] = useState(null);
  const closeRadius = useRef(null);
  // the flight's target needs the content mounted: re-render once after the
  // first (lift) paint so the flyer starts with the lift, not after it
  const [, force] = useState(0);
  useLayoutEffect(() => {
    if (phase === 'lift') {
      force(x => x + 1);
      // the real card goes in the frame the modal first paints (App.jsx)
      if (onLifted) onLifted();
      return undefined;
    }
    if (phase === 'open' || phase === 'closed') flyVid.current = null;
    return undefined;
  }, [phase]);   // eslint-disable-line react-hooks/exhaustive-deps
  const handleClose = useCallback(() => {
    // where the modal's media is right now (it may have been scrolled)
    const el = contentRef.current && contentRef.current.querySelector('.modal-image');
    if (el) {
      const b = el.getBoundingClientRect(); closeFrom.current = { top: b.top, left: b.left, width: b.width, height: b.height };
      // the card's clip goes to this moment now, so it has landed long before the card shows
      if (media && el.tagName === 'VIDEO' && pick === 0) { media.time = el.currentTime; if (onCloseStart) onCloseStart(media.time); }
    }
    closeShot.current = el ? snapshot(el) : null;
    setCloseBase(null);
    const cm = media && media.el;
    if (cm && cm.tagName === 'VIDEO') {
      const grab = () => setCloseBase({ shot: snapshot(cm) });
      if (cm.seeking) cm.addEventListener('seeked', grab, { once: true }); else grab();
    } else if (cm) setCloseBase({ src: cm.currentSrc || cm.src });
    closeRadius.current = el ? mediaRadius() : null;
    flyVid.current = null;
    // straight to collapse: the content fades out WHILE the surface shrinks and
    // the card copy fades back in, instead of an empty modal waiting 260ms for
    // its content to leave first (the close "isn't fully smooth")
    setPhase((p) => (p === 'open' ? 'collapse' : p));
  }, [media, pick, onCloseStart]);   // eslint-disable-line react-hooks/exhaustive-deps

  // A close asked for from outside (the browser's Back, App.jsx): the same
  // close as the ×, once the modal is open — asked during the lift or the
  // expand, it waits for them.
  const closeAsked = useRef(0);
  useEffect(() => {
    if (!closeRequest || closeRequest === closeAsked.current) return;
    if (phase === 'open') { closeAsked.current = closeRequest; handleClose(); }
    else if (!isOpen) closeAsked.current = closeRequest;
  }, [closeRequest, phase, isOpen, handleClose]);

  // Give the content stagger-out a moment before collapsing the surface.
  useEffect(() => {
    if (phase !== 'departing') return;
    const t = setTimeout(() => setPhase('collapse'), 260);
    return () => clearTimeout(t);
  }, [phase]);

  // NB: Escape cannot be caught while focus is inside one of the embedded
  // Google Drive iframes — a cross-origin frame receives the key and the parent
  // never sees it. Verified. The user is not stuck (Shift+Tab returns focus to
  // this document, and the close button is always reachable), but it is why
  // this handler cannot be the only way out.
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') handleClose();
      const n = itemData && itemData.gallery ? itemData.gallery.length + 1 : 0;
      if (n > 1 && phase === 'open' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) setPick(i => (i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose, itemData, phase]);

  if (phase === 'closed') return null;

  const r = savedRect.current;
  // THE CARD'S LOOK at the click (App.jsx): the pose its tilt had it in, its
  // corners, border and shadow. The surface starts as exactly that and eases
  // into the modal's — it used to snap flat, to 16px corners, a paler border
  // and an all-round halo on its first frame (Oct 8). A media-first card (the
  // small projects: the picture is the card) has no fill or border, so the
  // surface starts clear and takes its fill early in the expand; it used to
  // pop in, opaque, behind a tile that had none — and goes clear again as it
  // lands.
  const L = look || {};
  const P = L.pose || { rx: 0, ry: 0, s: 1 };
  const SURF = L.surface, HAIR = L.hair, bare = !!L.bare;
  const paintOf = (bg, bc) => (SURF ? { backgroundColor: bg, borderColor: bc } : {});
  const cardPaint = paintOf(bare ? clear(SURF) : SURF, bare ? clear(HAIR) : L.border || HAIR);
  const restPaint = paintOf(bare ? clear(SURF) : SURF, bare ? clear(HAIR) : HAIR);
  const cardRadius = L.radius || '10px 10px 10px 10px';
  const level = { rotateX: 0, rotateY: 0 };
  const early = (d, at) => ({ duration: d, delay: at, ease: 'easeOut' });
  const expanded = {
    ...finalRect(),
    scale: 1, ...level,
    opacity: 1,
    boxShadow: 'rgba(0, 0, 0, 0.45) 0px 30px 80px 0px',
    borderRadius: '16px 16px 16px 16px',
    ...paintOf(SURF, HAIR),
    transition: bare
      ? { duration: OPEN_S, ease: OPEN_EASE, delay: OPEN_HOLD, backgroundColor: early(OPEN_S * 0.4, OPEN_HOLD), borderColor: early(OPEN_S * 0.4, OPEN_HOLD) }
      : { duration: OPEN_S, ease: OPEN_EASE, delay: OPEN_HOLD },
  };
  const lifted = {
    top: r.top - LIFT_Y,
    left: r.left,
    width: r.width,
    height: r.height,
    scale: LIFT_K, ...level,
    opacity: 1,
    boxShadow: 'rgba(0, 0, 0, 0.32) 0px 34px 60px 0px',
    borderRadius: cardRadius,
    ...cardPaint,
    transition: { duration: LIFT_S, ease: LIFT_EASE },
  };
  const landed = { top: r.top, left: r.left, width: r.width, height: r.height, scale: 1, ...level, boxShadow: NO_SHADOW, borderRadius: cardRadius, ...restPaint };
  const animatorTargets = {
    lift: lifted,
    expand: expanded,
    open: expanded,
    departing: expanded,
    // CLOSE: shrink straight onto the card's own rectangle (no lifted stop on
    // the way), the card copy inside at its true size, so the surface and the
    // copy arrive together and match the real card pixel for pixel; the
    // shadow fades as it lands (the resting card has none)
    collapse: { ...landed, opacity: 1,
      transition: bare
        ? { duration: CLOSE_S, ease: CLOSE_EASE, backgroundColor: early(CLOSE_S * 0.4, CLOSE_S * 0.6), borderColor: early(CLOSE_S * 0.4, CLOSE_S * 0.6) }
        : { duration: CLOSE_S, ease: CLOSE_EASE } },
    // already ON the card, which is revealed underneath (onLanding): a quick
    // fade, no movement. It names every property the collapse animated
    // (Oct 8): without left/width/height motion treated them as removed,
    // finished a fallback at once, and the modal unmounted 8-73 ms after the
    // reveal instead of fading over 0.35 s — the close ended on a cut.
    settle: { ...landed, opacity: 0, transition: { duration: SETTLE_S, ease: 'easeOut' } },
  };

  const advance = () => {
    if (phase === 'lift') setPhase('expand');
    else if (phase === 'expand') setPhase('open');
    else if (phase === 'collapse') { if (onLanding) onLanding(); setPhase('settle'); }
    else if (phase === 'settle') {
      document.body.style.overflow = '';
      setPhase('closed');
      onClose();
    }
  };

  let modalTypeClass = 'project-modal';
  if (itemType === 'skill-group') modalTypeClass = 'skill-group-modal';
  else if (itemType === 'skill') modalTypeClass = 'skill-modal';
  else if (itemType === 'resume') modalTypeClass = 'resume-modal';

  const renderContent = () => {
    if (!itemData) return null;

    if (itemType === 'skill-group') {
      return (
        <>
          <motion.div variants={contentItem} className="modal-image-container" style={{ display: itemData.cardImageUrl ? 'block' : 'none' }}>
            <span role="img" aria-label={itemData.title} className="modal-image skill-icon-mono skill-icon-mono--head" style={{ WebkitMaskImage: `url(${itemData.cardImageUrl})`, maskImage: `url(${itemData.cardImageUrl})` }} />
          </motion.div>
          <div className="modal-text-content">
            <motion.h2 id="modal-title" variants={contentItem}>{itemData.title}</motion.h2>
            <div className="modal-skill-group-items-container">
              {itemData.items.map((skill, i) => {
                // The icons are self-hosted (Media/web/icons). The monochrome
                // ones (Iconify's mdi-- / simple-icons--) are drawn as a MASK
                // filled with the theme's icon colour — they used to be
                // coloured by a query to the Iconify API; the coloured logos
                // (devicon--, photos) stay images.
                const mono = /\/icons\/(mdi|simple-icons)--/.test(skill.imageUrl);
                return (
                  <motion.div key={i} variants={contentItem} className="skill-group-item">
                    {mono
                      ? <span role="img" aria-label={skill.name} className="skill-group-item-image skill-icon-mono" style={{ WebkitMaskImage: `url(${skill.imageUrl})`, maskImage: `url(${skill.imageUrl})` }} />
                      : <img src={skill.imageUrl} alt={skill.name} className="skill-group-item-image" loading="lazy" />}
                    <div className="skill-group-item-text">
                      <h3 className="skill-group-item-name">{skill.name}</h3>
                      <p className="skill-group-item-description">{skill.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    const title = itemData.title || itemData.modalTitle;
    const isResume = itemType === 'resume';
    const isMp4 = itemData.imageUrl?.toLowerCase().endsWith('.mp4');

    // THE GALLERY (the owner: "I can't scroll through the other pieces of
    // media associated with each project, like I can at /portfolio"): the
    // cover first, then `gallery` — web-sized copies of the originals under
    // Media/web/gallery/. The picked item fills the media slot (it stays
    // `.modal-image`, which the flight measures); thumbnails, arrows and the
    // arrow keys step through it. Items other than the cover are fitted, not
    // cropped: many are portrait phone clips.
    const items = !isResume && itemData.imageUrl ? [itemData.imageUrl, ...(itemData.gallery || [])] : [];
    const cur = items[Math.min(pick, items.length - 1)];
    const isVid = u => /\.(mp4|webm)$/i.test(u);
    const posterOf = u => u.replace(/\.(mp4|webm)$/i, '-poster.webp');
    let mediaEl = null;
    // An entry with no cover (an Experience row) gets no media block at all —
    // an <img> with no src fell through to the "Img Error" placeholder.
    if (cur) {
      const fit = pick > 0 ? ' modal-image--fit' : '';
      mediaEl = isVid(cur)
        // `muted` is required or the browser blocks the autoplay outright.
        ? <video key={cur} src={cur} poster={posterOf(cur)} className={`modal-image${fit}`} controls autoPlay loop muted playsInline
            // the card's own clip continues where the flying copy is, not from 0
            // (Oct 6; the owner: the video "jarringly jumps to a different point")
            onLoadedMetadata={pick === 0 && media && media.isVideo ? (e => {
              const t = flyVid.current ? flyVid.current.currentTime : media.time;
              if (t && isFinite(t)) { try { e.currentTarget.currentTime = t % (e.currentTarget.duration || Infinity); } catch { /* not seekable yet */ } }
            }) : undefined} />
        : <img key={cur} src={cur} alt={title} className={`modal-image${fit}`}
            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x400/F7F5F2/BFA181?text=Img+Error'; }} />;
    }
    const step = d => setPick(i => (i + d + items.length) % items.length);
    const gallery = items.length > 1 && (
      <div className="modal-gallery">
        <button className="modal-gallery-arrow" onClick={() => step(-1)} aria-label="Previous media">‹</button>
        <div className="modal-gallery-strip" role="tablist" aria-label="Project media">
          {items.map((u, i) => (
            <button key={u} role="tab" aria-selected={i === pick} aria-label={`Media ${i + 1} of ${items.length}`}
              className={`modal-gallery-thumb${i === pick ? ' is-on' : ''}`} onClick={() => setPick(i)}>
              <img src={isVid(u) ? posterOf(u) : u} alt="" loading="lazy" />
              {isVid(u) && <span className="modal-gallery-play" aria-hidden="true">▶</span>}
            </button>
          ))}
        </div>
        <button className="modal-gallery-arrow" onClick={() => step(1)} aria-label="Next media">›</button>
        <span className="modal-gallery-count">{pick + 1} / {items.length}</span>
      </div>
    );

    return (
      <>
        {mediaEl && (
          <motion.div variants={contentItem} className="modal-image-container">
            {mediaEl}
            {gallery}
          </motion.div>
        )}
        <div className="modal-text-content">
          <motion.h2 id="modal-title" variants={contentItem}>{title}</motion.h2>
          {itemData.modalContent?.map((content, i) => {
            if (content.type === 'text') {
              return <motion.p key={i} variants={contentItem} className="modal-dynamic-text">{content.value}</motion.p>;
            } else if (content.type === 'button') {
              return (
                <motion.a key={i} variants={contentItem} href={content.link} className="modal-dynamic-button" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block' }}>
                  {content.text}
                </motion.a>
              );
            } else if (content.type === 'embed') {
              // An embed with no src rendered as a large empty bordered box.
              if (!content.value) return null;
              return (
                <motion.iframe
                  key={i}
                  variants={contentItem}
                  src={content.value}
                  title={content.title || 'Embedded Content'}
                  className="modal-dynamic-embed"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  id={isResume ? 'resume-modal-iframe' : undefined}
                />
              );
            } else if (content.type === 'meta') {
              return <motion.p key={i} variants={contentItem} className="modal-meta">{content.value}</motion.p>;
            } else if (content.type === 'list') {
              // `ordered` numbers the items: a project's pipeline steps, which its gallery clips are labelled by
              const List = content.ordered ? motion.ol : motion.ul;
              return (
                <List key={i} variants={contentItem} className="modal-dynamic-list">
                  {content.items.map((item, j) => <li key={j}>{item}</li>)}
                </List>
              );
            } else if (content.type === 'tags') {
              return (
                <motion.div key={i} variants={contentItem} className="project-tags-container modal-tags">
                  {content.items.map((t, j) => <GlassTag key={j}>{t}</GlassTag>)}
                </motion.div>
              );
            } else if (content.type === 'video') {
              return (
                <motion.video key={i} variants={contentItem} className="modal-dynamic-video" src={content.value}
                  poster={content.value.replace(/\.mp4$/i, '-poster.webp')} autoPlay muted loop playsInline controls />
              );
            } else if (content.type === 'image') {
              return (
                <motion.img key={i} variants={contentItem} src={content.value} alt={content.alt || ''} className="modal-dynamic-image" />
              );
            }
            return null;
          })}
        </div>
      </>
    );
  };

  const backdropOn = phase === 'lift' || phase === 'expand' || phase === 'open';
  // The GHOST: the clicked card's own markup, at the card's size, filling the
  // surface while it lifts, then scaling up with it and fading out as the
  // real content fades in — and back again on close. The card turns into the
  // modal instead of an empty panel appearing and filling. (The owner: "don't
  // have the content just disappear and reappear. The card should lift off the
  // page and turn into the modal.")
  const ghostOn = phase === 'lift' || phase === 'collapse' || phase === 'settle';
  const fr = finalRect();
  // on open the copy grows with the surface; on close it is at its TRUE size
  // from the start (the surface shrinks onto it), so the two never disagree
  const ghostScale = phase === 'expand' || phase === 'open' || phase === 'departing' ? Math.min(fr.width / r.width, fr.height / r.height) : 1;
  const contentOn = phase === 'expand' || phase === 'open';
  // THE SHARED MEDIA: a copy of the card's picture/video flies from the card's
  // media rectangle to the modal's (open) and back (close), still playing,
  // while both the card copy's media and the modal's own are hidden. (The
  // owner: "The video section from the card should just transition into the
  // video section of the modal, not just disappear and reappear.")
  // It stays through the SETTLE (Oct 8): it used to go as the collapse ended,
  // while the opaque surface and the copy (whose media is hidden) still
  // covered the card — a blank slot for a frame or two, a wash once the
  // settle really ran. Now it holds the landed frame, opaque, over the card's
  // own (paused on that same frame, App.jsx) and goes with the surface.
  const closing = phase === 'collapse' || phase === 'settle';
  const flying = !!media && (phase === 'lift' || phase === 'expand' || closing);
  const tgt = flying ? mediaTarget() : null;
  // the flight runs on the SURFACE's clock, not its own: during the lift it
  // rises and scales with the card, during the expand it grows on the same
  // ease (the owner: "the gif/video and the modal itself are expanding at
  // different times"). The lift is a TRANSFORM about the card's centre, as
  // the surface's is, starting from the pose the card was tilted in: done
  // with width/height, a small card's text riding in the flyer stayed its
  // size while the picture grew 6% under it.
  const m0 = media && media.rect;
  const box = b => b && { top: b.top, left: b.left, width: b.width, height: b.height };
  const origin = m0 ? { originX: (r.left + r.width / 2 - m0.left) / m0.width, originY: (r.top + r.height / 2 - m0.top) / m0.height } : {};
  const cardSide = media ? { borderRadius: media.radius, ...(SURF ? { backgroundColor: media.backdrop } : {}) } : {};
  const modalSide = r0 => ({ borderRadius: r0 || '8px 8px 8px 8px', ...(SURF ? { backgroundColor: SURF } : {}) });
  const flat = { y: 0, scale: 1, ...level };
  const flyFrom = closing
    ? { ...box(closeFrom.current || tgt), ...flat, opacity: 1, ...modalSide(closeRadius.current) }
    : { ...box(m0), y: 0, scale: P.s, rotateX: P.rx, rotateY: P.ry, ...cardSide };
  const flyTo = closing ? { ...box(m0), ...flat, opacity: phase === 'settle' ? 0 : 1, ...cardSide }
    : phase === 'lift' ? { ...box(m0), y: -LIFT_Y, scale: LIFT_K, ...level, ...cardSide }
    : tgt && { ...box(tgt), ...flat, ...modalSide(mediaRadius()) };
  const flyTransition = phase === 'settle' ? { default: { duration: 0 }, opacity: FLY_OUT } : phase === 'collapse' ? { duration: CLOSE_S, ease: CLOSE_EASE } : phase === 'lift' ? { duration: LIFT_S, ease: LIFT_EASE } : { duration: OPEN_S, ease: OPEN_EASE, delay: OPEN_HOLD };
  const flyerOn = !!(flying && flyFrom && flyTo);

  return (
    <>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: backdropOn ? 1 : 0 }}
        // paced with the card, not ahead of it (the owner: "the background
        // darkens too much too fast"): it eases in across the lift and the
        // expand, and eases out with the close
        transition={backdropOn ? { duration: LIFT_S + OPEN_HOLD + OPEN_S, ease: [0.4, 0, 0.2, 1] } : { duration: CLOSE_S * 0.9, ease: [0.4, 0, 0.2, 1] }}
        style={{ pointerEvents: phase === 'open' ? 'auto' : 'none' }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={trapTab}
        className={`modal-animator ${modalTypeClass}`}
        style={{ transformPerspective: 900 }}
        initial={{ ...r, scale: P.s, rotateX: P.rx, rotateY: P.ry, opacity: 1, boxShadow: L.shadow || NO_SHADOW, borderRadius: cardRadius, ...cardPaint }}
        variants={animatorTargets}
        animate={phase}
        // the settle ends when the flying picture has handed over (below), if there is one
        onAnimationComplete={def => { if (def === phase && !(phase === 'settle' && flyerOn)) advance(); }}
      >
        {cardHTML && (
          <motion.div
            className={`modal-ghost ${cardClass || ''}`}
            aria-hidden="true"
            // its size goes in as variables the CSS applies with !important:
            // a phone's `.exp-card { height: auto !important }` beat the inline
            // height, and a box whose children are all pinned is 0 tall when
            // auto — its overflow clip hid the whole copy's text
            style={{ '--gw': `${r.width}px`, '--gh': `${r.height}px`, transformOrigin: '0 0' }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: ghostOn ? 1 : 0, scale: ghostScale }}
            // the scale runs on the SAME clock as the surface (0.6 open, 0.55
            // close) so the copy never over- or under-fills it; on close it
            // fades in at once, as the content fades out
            transition={phase === 'collapse' || phase === 'settle'
              ? { opacity: { duration: CLOSE_S * 0.5, delay: CLOSE_S * 0.4, ease: 'easeInOut' }, scale: { duration: 0 } }
              // leaving on the expand: out quickly as the surface starts to grow, so
              // the growing media does not slide over text still fading
              : { opacity: { duration: 0.28, delay: ghostOn ? 0.15 : OPEN_HOLD + 0.04 }, scale: { duration: OPEN_S, ease: OPEN_EASE, delay: OPEN_HOLD } }}
            dangerouslySetInnerHTML={{ __html: cardHTML }}
          />
        )}
        <div className={`modal-content${flying ? ' is-flying' : ''}`} ref={contentRef} style={{ width: fr.width, height: fr.height }}>
          <motion.button
            className="modal-close"
            ref={closeRef}
            onClick={handleClose}
            aria-label="Close modal"
            initial={{ opacity: 0 }}          // mounted hidden: without it the × flashed on the lifting card's corner
            animate={{ opacity: phase === 'open' ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          >
            &times;
          </motion.button>
          <motion.div
            ref={wrapRef}
            className="modal-content-wrapper"
            variants={contentContainer}
            initial="hidden"
            animate={contentOn ? 'show' : 'hidden'}
          >
            {renderContent()}
          </motion.div>
        </div>
      </motion.div>
      {flyerOn && (
        <motion.div
          key={closing ? 'fly-close' : 'fly-open'}
          className="modal-flyer"
          style={{ transformPerspective: 900, ...origin }}
          initial={flyFrom}
          animate={flyTo}
          transition={flyTransition}
          onAnimationComplete={() => { if (phase === 'settle') advance(); }}
        >
          {closing && (closeShot.current || closeBase)
            ? <>
                {closeBase && closeBase.shot && <div className="modal-flyer-shot" ref={d => { if (d && !d.firstChild) d.appendChild(closeBase.shot); }} />}
                {closeBase && closeBase.src && <img className="modal-flyer-shot" src={closeBase.src} alt="" />}
                {closeShot.current && (
                  <motion.div className="modal-flyer-shot" ref={d => { if (d && !d.firstChild) d.appendChild(closeShot.current); }}
                    initial={{ opacity: 1 }} animate={{ opacity: closeBase && (closeBase.src || closeBase.shot) ? 0 : 1 }}
                    transition={{ duration: CLOSE_S * 0.35, delay: CLOSE_S * 0.4, ease: 'easeInOut' }} />
                )}
              </>
            : <>
                {/* the card's frame as a still, on screen from the first
                    paint (Oct 6: a fresh <video> flashed black/poster before
                    its first frame) */}
                {media.shot && <div className="modal-flyer-shot" ref={d => { if (d && !d.firstChild) d.appendChild(media.shot); }} />}
                {media.isVideo
                  ? <video className="flyer-live" style={{ opacity: media.shot ? 0 : 1 }}
                      ref={v => { if (v && !flyVid.current) { flyVid.current = v; try { v.currentTime = media.time || 0; } catch {} } }}
                      onPlaying={e => { e.currentTarget.style.opacity = 1; }}
                      src={media.src} poster={media.poster} autoPlay muted loop playsInline />
                  : <img src={media.src} alt="" />}
              </>}
          {media.overlay && (
            // the card's own text and scrim, riding with the picture (see
            // App.jsx mediaOf): held through the lift, gone as the expand
            // starts, and back over the last stretch of the close so the
            // card lands whole and is revealed without a pop
            <motion.div
              className="flyer-overlay"
              aria-hidden="true"
              // the hovered card drew this text a little larger (it floats
              // toward the viewer under the tilt's perspective, `zk`): it
              // starts at that size and settles to its own over the lift
              style={origin}
              initial={closing ? { opacity: 0, scale: 1 } : { opacity: 1, scale: media.zk || 1 }}
              animate={{ opacity: phase === 'lift' || closing ? 1 : 0, scale: 1 }}
              transition={phase === 'collapse' ? { duration: CLOSE_S * 0.4, delay: CLOSE_S * 0.55, ease: 'easeOut' }
                : phase === 'settle' ? { duration: 0 }
                : phase === 'lift' ? { opacity: { duration: 0 }, scale: { duration: LIFT_S, ease: LIFT_EASE } }
                : { duration: 0.22, delay: OPEN_HOLD, ease: 'easeIn' }}
              dangerouslySetInnerHTML={{ __html: media.overlay }}
            />
          )}
        </motion.div>
      )}
    </>
  );
}
