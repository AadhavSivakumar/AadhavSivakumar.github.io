import React from 'react';
import ProjectCard from './ProjectCard';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';
import { majorProjectsData, smallProjectsData } from '../data/siteData';

export default function Projects({ onCardClick }) {
  return (
    <>
      <section id="projects">
        <SectionTitle>My Work</SectionTitle>
        <Reveal delay={0.1}><h3>Major Projects</h3></Reveal>
        <div className="major-projects-grid">
          {majorProjectsData.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={i}
              isMajor={true}
              itemType="major"
              onCardClick={onCardClick}
            />
          ))}
        </div>
      </section>

      <section id="additional-projects" style={{ paddingTop: 0 }}>
        <Reveal><h3>Additional Projects</h3></Reveal>
        <div className="small-projects-grid">
          {smallProjectsData.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={i}
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
