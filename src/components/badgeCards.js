// The lanyard badges: one per organisation, photo + the printed face.
// Imported by Experience.jsx (one badge hangs beside each row) and by the
// badge probe. Photos are Vite imports so they are bundled.
import dhsImg from '../../Media/lanyardimgs/DHS.jpg';
import ucscImg from '../../Media/lanyardimgs/UCSC.png';
import nyuImg from '../../Media/lanyardimgs/NYU.jpg';
import roboflowImg from '../../Media/lanyardimgs/Roboflow.png';
import starshipImg from '../../Media/lanyardimgs/Starship.jpg';
import researcherImg from '../../Media/lanyardimgs/Researcher.jpg';

export const badgeCards = [
  { side: 'left', slot: 2, image: dhsImg, badge: { name: 'Dublin High', role: 'High School', id: '2016-2020', exp: '2020' } },
  { side: 'left', slot: 1, image: ucscImg, badge: { name: 'UCSC', role: 'Undergraduate', id: '2020-2024', exp: '2024' } },
  { side: 'left', slot: 0, image: nyuImg, badge: { name: 'NYU', role: 'Graduate', id: '2024-2026', exp: '2026' } },
  { side: 'right', slot: 0, image: roboflowImg, badge: { name: 'Roboflow', role: 'Edge AI Engineer', id: 'Universe', exp: 'Present' } },
  { side: 'right', slot: 1, image: starshipImg, badge: { name: 'Starship', role: 'Robot Technician', id: 'Technician', exp: '2025' } },
  { side: 'right', slot: 2, image: researcherImg, badge: { name: 'Researcher', role: 'TML @ UCSC, CREO @ NYU', id: 'Research', exp: '2024/6' } },
];

export const badgeByName = Object.fromEntries(badgeCards.map(c => [c.badge.name, c]));
