import React from 'react';
import ProjectCard from './ProjectCard';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';
import CoverPlaybackToggle from './CoverPlaybackToggle';
import { majorProjectsData, smallProjectsData } from '../data/siteData';

export default function Projects({ onCardClick }) {
  return (
    <>
      <section id="projects" aria-labelledby="projects-title">
        <SectionTitle id="projects-title">My Work</SectionTitle>
        {/* Ahead of the first cover, so the control for the motion is reachable
            before the motion itself. Governs both project sections. */}
        <CoverPlaybackToggle />
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

      <section id="additional-projects" aria-labelledby="additional-projects-title" style={{ paddingTop: 0 }}>
        <Reveal><h3 id="additional-projects-title">Additional Projects</h3></Reveal>
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
