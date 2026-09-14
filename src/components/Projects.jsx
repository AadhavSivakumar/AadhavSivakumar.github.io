import React from 'react';
import ProjectCard from './ProjectCard';
import SectionTitle from './SectionTitle';
import CoverPlaybackToggle from './CoverPlaybackToggle';
import { majorProjectsData, smallProjectsData } from '../data/siteData';

export default function Projects({ onCardClick }) {
  return (
    <>
      {/* Two pages, each one screen: the four major projects four across, then
          every additional project in a compact grid. */}
      <section id="projects" className="page page--wide" aria-labelledby="projects-title">
        <SectionTitle id="projects-title">Major Projects</SectionTitle>
        {/* Ahead of the first cover, so the control for the motion is reachable
            before the motion itself. Governs both project pages. */}
        <CoverPlaybackToggle />
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

      <section id="additional-projects" className="page page--wide" aria-labelledby="additional-projects-title">
        <SectionTitle id="additional-projects-title">Additional Projects</SectionTitle>
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
