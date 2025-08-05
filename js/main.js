import { loadAndProcessData } from './data.js';
import { initTheme } from './theme.js';
import { initScrollAnimations, initIntersectionObservers, initGlassEffect } from './animations.js';
import { populateAboutMeCard, populateProjects, populateSkillGroups, populateResumeCard } from './ui.js';
import { initModal } from './modal.js';
import { initScrollControls } from './controls.js';

window.addEventListener('load', async () => {
    // Prevent browser from restoring scroll position and force to top
    if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const portfolioData = await loadAndProcessData();
    if (!portfolioData) {
        // Handle data loading failure, e.g., show an error message.
        document.body.innerHTML = '<p style="color: red; text-align: center; padding-top: 50px;">Failed to load portfolio data. Please try refreshing the page.</p>';
        return;
    }

    initTheme();

    const cardObserver = initIntersectionObservers();

    // Populate the UI with data
    populateAboutMeCard(portfolioData.aboutMeData, cardObserver);
    populateProjects(portfolioData.majorProjectsData, portfolioData.smallProjectsData, cardObserver);
    populateSkillGroups(portfolioData.skillGroupsData, cardObserver);
    populateResumeCard(portfolioData.resumeData, cardObserver);

    // Initialize interactive elements and animations
    initScrollAnimations();
    initGlassEffect();
    initModal(portfolioData);
    initScrollControls();
});
