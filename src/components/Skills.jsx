import React from 'react';
import SkillGroupCard from './SkillGroupCard';
import SectionTitle from './SectionTitle';
import PageNext from './PageNext';
import DocStrip from './DocStrip';
import { skillGroupsData } from '../data/siteData';

export default function Skills({ onCardClick, next }) {
  return (
    <section id="skills" className="page page--wide" aria-labelledby="skills-title">
      <SectionTitle id="skills-title">Skills &amp; Resume</SectionTitle>
      <div className="skill-groups-grid">
        {skillGroupsData.map((group, i) => (
          <SkillGroupCard key={group.id} group={group} index={i} onCardClick={onCardClick} />
        ))}
      </div>
      {/* the resume, CV and transcripts, in a strip under the skills: they
          were a page of their own (see DocStrip.jsx) */}
      <DocStrip onCardClick={onCardClick} />
      {next && <PageNext to={next.to} label={next.label} />}
    </section>
  );
}
