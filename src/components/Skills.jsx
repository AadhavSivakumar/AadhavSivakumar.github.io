import React from 'react';
import SkillGroupCard from './SkillGroupCard';
import SectionTitle from './SectionTitle';
import { skillGroupsData } from '../data/siteData';

export default function Skills({ onCardClick }) {
  return (
    <section id="skills">
      <SectionTitle>Technical Skills</SectionTitle>
      <div className="skill-groups-grid">
        {skillGroupsData.map((group, i) => (
          <SkillGroupCard key={group.id} group={group} index={i} onCardClick={onCardClick} />
        ))}
      </div>
    </section>
  );
}
