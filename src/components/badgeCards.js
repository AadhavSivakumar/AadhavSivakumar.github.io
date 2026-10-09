// The lanyard badges: one per organisation, photo + the printed face.
// WebP, at most 360px (the badge draws them at ~84px). The Dublin High and
// "Researcher" badges were never shown and are gone from the bundle.
// Imported by Experience.jsx (one badge hangs beside each row) and by the
// badge probe. Photos are Vite imports so they are bundled.
import ucscImg from '../../Media/lanyardimgs/UCSC.webp';
import nyuImg from '../../Media/lanyardimgs/NYU.webp';
import roboflowImg from '../../Media/lanyardimgs/Roboflow.png';
import starshipImg from '../../Media/lanyardimgs/Starship.webp';

// What each badge prints (the owner, Oct 9): the FRONT only the name and
// one year — the year it ran to, as a class year reads; the BACK the role
// (from its experienceData row), these exact dates (the Extended CV's; for
// the two universities the degree's, as the cards pair them) and a QR code to
// the site (siteQR.js).
export const badgeCards = [
  { side: 'left', slot: 1, image: ucscImg, badge: { name: 'UCSC', year: '2024', dates: 'Jun 2020 – Jun 2024' } },
  { side: 'left', slot: 0, image: nyuImg, badge: { name: 'NYU', year: '2026', dates: 'Aug 2024 – May 2026' } },
  { side: 'right', slot: 0, image: roboflowImg, badge: { name: 'Roboflow', year: '2026', dates: 'Jan 2026 – Sep 2026' } },
  { side: 'right', slot: 1, image: starshipImg, badge: { name: 'Starship', year: '2026', dates: 'Aug 2025 – Jan 2026' } },
];

export const badgeByName = Object.fromEntries(badgeCards.map(c => [c.badge.name, c]));
