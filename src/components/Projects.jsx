import React from 'react';
import ProjectCard from './ProjectCard';
import { majorProjectsData, smallProjectsData } from '../data/siteData';
import { useInView } from '../hooks/useInView';

export default function Projects({ onCardClick }) {
  const [sectionRef, sectionInView] = useInView();
  const [additionalRef, additionalInView] = useInView();

  return (
    <>
      <section id="projects" ref={sectionRef} className={sectionInView ? 'visible' : ''}>
        <h2 className="section-title">My Work</h2>
        <h3>Major Projects</h3>
        <div className="major-projects-grid">
          {majorProjectsData.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              isMajor={true}
              itemType="major"
              onCardClick={onCardClick}
            />
          ))}
        </div>
      </section>

      <section id="additional-projects" ref={additionalRef} className={additionalInView ? 'visible' : ''} style={{ paddingTop: 0 }}>
        <h3>Additional Projects</h3>
        <div className="small-projects-grid">
          {smallProjectsData.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              isMajor={false}
              itemType="small"
              onCardClick={onCardClick}
            />
          ))}
        </div>
      </section>
    </>
  );
}
