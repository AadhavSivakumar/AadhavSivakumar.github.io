import React from 'react';
import SkillGroupCard from './SkillGroupCard';
import SectionTitle from './SectionTitle';
import PageNext from './PageNext';
import { skillGroupsData } from '../data/siteData';

export default function Skills({ onCardClick, next }) {
  return (
    <section id="skills" className="page page--wide" aria-labelledby="skills-title">
      <SectionTitle id="skills-title">Technical Skills</SectionTitle>
      <div className="skill-groups-grid">
        {skillGroupsData.map((group, i) => (
          <SkillGroupCard key={group.id} group={group} index={i} onCardClick={onCardClick} />
        ))}
      </div>
      {next && <PageNext to={next.to} label={next.label} />}
    </section>
  );
}
