import React from 'react';
import SkillGroupCard from './SkillGroupCard';
import { skillGroupsData } from '../data/siteData';
import { useInView } from '../hooks/useInView';

export default function Skills({ onCardClick }) {
  const [sectionRef, sectionInView] = useInView();

  return (
    <section id="skills" ref={sectionRef} className={sectionInView ? 'visible' : ''}>
      <h2 className="section-title">Technical Skills</h2>
      <div className="skill-groups-grid">
        {skillGroupsData.map(group => (
          <SkillGroupCard key={group.id} group={group} onCardClick={onCardClick} />
        ))}
      </div>
    </section>
  );
}
