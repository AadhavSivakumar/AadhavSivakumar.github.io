import React from 'react';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';
import useScrollReveal from '../hooks/useScrollReveal';
import { experienceData } from '../data/siteData';

// Work and research history. Rendered inline — role, organisation, period,
// then the bullets — because this is the section a recruiter reads, and it
// should not be behind a click. Content lives in siteData.experienceData and is
// written for a public page (see the note there).
function ExperienceCard({ item, index }) {
  const ref = useScrollReveal({ y: 30, delay: index * 0.08, duration: 650, amount: 0.15 });
  return (
    <article ref={ref} className="exp-card" aria-labelledby={`${item.id}-role`}>
      {/* A <div>, not a <header>: App.css styles the bare `header` element as
          the fixed site header (position: fixed; top: 0), so a <header> inside
          a card is torn out of it and pinned to the top of the page. */}
      <div className="exp-head">
        <div>
          <h3 id={`${item.id}-role`} className="exp-role">{item.role}</h3>
          <p className="exp-org">
            <span className="exp-org-name">{item.org}</span>
            {item.location && <span className="exp-sep" aria-hidden="true">·</span>}
            {item.location && <span className="exp-loc">{item.location}</span>}
          </p>
        </div>
        <p className="exp-period">{item.period}</p>
      </div>
      {item.summary && <p className="exp-summary">{item.summary}</p>}
      <ul className="exp-bullets">
        {item.bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      {item.tags?.length > 0 && (
        <div className="project-tags-container exp-tags">
          {item.tags.map((t, i) => <span key={i} className="project-tag">{t}</span>)}
        </div>
      )}
    </article>
  );
}

export default function Experience() {
  return (
    <section id="experience" aria-labelledby="experience-title">
      <SectionTitle id="experience-title">Experience</SectionTitle>
      <Reveal delay={0.1}>
        <p className="exp-intro">
          Edge AI engineer bridging industrial machine vision and robot learning — production
          vision systems on NVIDIA Jetson at manufacturing sites, and research pipelines from
          teleoperation hardware through vision-language-action policy fine-tuning.
        </p>
      </Reveal>
      <div className="exp-list">
        {experienceData.map((item, i) => <ExperienceCard key={item.id} item={item} index={i} />)}
      </div>
    </section>
  );
}
