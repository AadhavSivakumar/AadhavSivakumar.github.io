// Temporary harness: renders the badge FACE artwork to a plain 2D canvas at the
// aspect it actually occupies on the card, for both themes. The 3D scene needs
// WebGL, which this environment does not have; the artwork does not.
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { drawBadgeFace } from './components/Lanyard/Lanyard';
import { badgeCards } from './components/About';
import '../src/App.css';

const W = 1678, H = 1677;
const FRONT = { x: 0, y: 0, w: 0.5, h: 0.755 };
// what the front face looks like once the card's own aspect is applied
const OUT_W = 208, OUT_H = Math.round(208 * (2.25 / 1.6));

function Face({ card, siteDark }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, g = c.getContext('2d');
    const atlas = document.createElement('canvas');
    atlas.width = W; atlas.height = H;
    const ag = atlas.getContext('2d');
    const img = new Image();
    const paint = () => {
      ag.clearRect(0, 0, W, H);
      drawBadgeFace(ag, FRONT, card.badge, img.complete && img.naturalWidth ? img : null, W, H, siteDark);
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(atlas, FRONT.x * W, FRONT.y * H, FRONT.w * W, FRONT.h * H, 0, 0, c.width, c.height);
    };
    img.onload = paint; img.onerror = paint; img.src = card.image;
    paint();
  }, [card, siteDark]);
  return <canvas ref={ref} width={OUT_W} height={OUT_H}
    style={{ width: OUT_W, height: OUT_H, margin: 10, display: 'inline-block' }} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <div style={{ display: 'flex', gap: 24 }}>
    <div style={{ background: '#F7F5F2', padding: 14 }}>
      <div style={{ font: '13px Poppins', color: '#333' }}>light site → dark card</div>
      {badgeCards.map((c, i) => <Face key={i} card={c} siteDark={false} />)}
    </div>
    <div style={{ background: '#121212', padding: 14 }}>
      <div style={{ font: '13px Poppins', color: '#ddd' }}>dark site → pale card</div>
      {badgeCards.map((c, i) => <Face key={i} card={c} siteDark />)}
    </div>
  </div>
);
