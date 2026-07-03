import React from 'react';
import SkillGroupCard from './SkillGroupCard';
import Reveal from './Reveal';
import { skillGroupsData } from '../data/siteData';

export default function Skills({ onCardClick }) {
  return (
    <section id="skills">
      <Reveal><h2 className="section-title">Technical Skills</h2></Reveal>
      <div className="skill-groups-grid">
        {skillGroupsData.map((group, i) => (
          <SkillGroupCard key={group.id} group={group} index={i} onCardClick={onCardClick} />
        ))}
      </div>
    </section>
  );
}
