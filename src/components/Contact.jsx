import React from 'react';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';
import AboutCard from './About';
import Dock from './reactbits/Dock';

const SOCIALS = [
  {
    label: 'LinkedIn Profile',
    href: 'https://www.linkedin.com/in/aadhav-s/',
    icon: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="40" height="40"><rect x="1.5" y="1.5" width="21" height="21" rx="2" fill="#fff" /><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" /></svg>
    ),
  },
  {
    label: 'GitHub Profile',
    href: 'https://github.com/AadhavSivakumar',
    icon: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="40" height="40"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
    ),
  },
  {
    label: 'Email',
    href: 'mailto:sivakumaadhav@gmail.com',
    // Gmail's own four-colour M (the owner: icons "the color of what they are")
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 48 48"><path fill="#4caf50" d="M45 16.2l-5 2.75-5 4.75V40h7c1.66 0 3-1.34 3-3V16.2z" /><path fill="#1e88e5" d="M3 16.2l3.61 1.71L13 23.7V40H6c-1.66 0-3-1.34-3-3V16.2z" /><path fill="#e53935" d="M35 11.2l-11 8.25-11-8.25-1 5.8 1 6.7 11 8.25 11-8.25 1-6.7z" /><path fill="#c62828" d="M3 12.3v3.9l10 7.5V11.2L9.88 8.86A4.3 4.3 0 0 0 7.3 8 4.3 4.3 0 0 0 3 12.3z" /><path fill="#fbc02d" d="M45 12.3v3.9l-10 7.5V11.2l3.12-2.34A4.3 4.3 0 0 1 40.7 8 4.3 4.3 0 0 1 45 12.3z" /></svg>
    ),
  },
  {
    label: 'X Profile',
    href: 'https://x.com/sivakumaadhav',
    icon: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="36" height="36"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
    ),
  },
];

// The profiles as React Bits' Dock: the marks magnify as the pointer passes
// along the row, each labelled on hover. Real links (adapted from upstream's
// role=button items).
const DOCK_ITEMS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/aadhav-s/', icon: SOCIALS[0].icon },
  { label: 'GitHub', href: 'https://github.com/AadhavSivakumar', icon: SOCIALS[1].icon },
  { label: 'Email', href: 'mailto:sivakumaadhav@gmail.com', icon: SOCIALS[2].icon },
  { label: 'X', href: 'https://x.com/sivakumaadhav', icon: SOCIALS[3].icon },
];

// The last page: the about card (portrait, name, the bio behind a click; it
// tilts like every card, React Bits' TiltedCard via LiftCard) beside the
// invitation and the links, which are a Dock. React Bits' ProfileCard was
// tried here on Oct 5 and dropped: its holographic shine is built for a dark
// cut-out portrait with texture maps, and on this photo it flooded the card
// with rainbow and white.
export default function Contact({ onCardClick }) {
  return (
    <section id="contact" className="page page--contact" aria-labelledby="contact-title">
      <SectionTitle id="contact-title">Get In Touch</SectionTitle>
      <div className="contact-layout">
        <AboutCard onCardClick={onCardClick} />
        <div className="contact-body">
          <Reveal delay={0.1}>
            <p>
              Open to roles in robot learning — VLAs, world models, sim-to-real. Based in
              New York and San Francisco. The fastest way to reach me is email.
            </p>
          </Reveal>
          <Dock items={DOCK_ITEMS} panelHeight={64} baseItemSize={48} magnification={68} distance={140} dockHeight={0} className="contact-dock" />
        </div>
      </div>
    </section>
  );
}
