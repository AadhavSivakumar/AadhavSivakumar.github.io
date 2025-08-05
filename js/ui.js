export function populateAboutMeCard(aboutMeData, cardObserver) {
    const aboutCardWrapper = document.querySelector('#about .about-card-wrapper');
    if (!aboutCardWrapper || !aboutMeData) return;
    aboutCardWrapper.innerHTML = '';

    const SVG_NS = "http://www.w3.org/2000/svg";
    const CONTAINER_WIDTH = 300;
    const CONTAINER_HEIGHT = 420;
    const NUM_TOTAL_WAVES_PER_SIDE = 50;
    const WAVE_AMPLITUDE = 12;
    const VERTICAL_SPACING = 12;
    const WAVE_CYCLE_WIDTH = 100;
    const PATH_TOTAL_WIDTH = CONTAINER_WIDTH * 2;

    const createSvgWaveContainer = (isLeftWave) => {
        const container = document.createElement('div');
        container.className = `svg-sine-wave-container ${isLeftWave ? 'left-wave' : 'right-wave'}`;

        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute('viewBox', `0 0 ${CONTAINER_WIDTH} ${CONTAINER_HEIGHT}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        for (let i = 1; i < NUM_TOTAL_WAVES_PER_SIDE - 1; i++) {
            const path = document.createElementNS(SVG_NS, "path");
            let d = "";
            const startY = (CONTAINER_HEIGHT / 2) + (i - (NUM_TOTAL_WAVES_PER_SIDE - 1) / 2) * VERTICAL_SPACING;

            d = `M 0 ${startY}`;
            for (let xPos = 0; xPos < PATH_TOTAL_WIDTH; xPos += WAVE_CYCLE_WIDTH) {
                d += ` q ${WAVE_CYCLE_WIDTH/4} ${-WAVE_AMPLITUDE} ${WAVE_CYCLE_WIDTH/2} 0`;
                d += ` t ${WAVE_CYCLE_WIDTH/2} 0`;
            }
            path.setAttribute('d', d);

            const animationDuration = 3;
            const phaseShiftDegrees = 12;
            const delay = (i * phaseShiftDegrees / 360) * animationDuration;
            path.style.animationDelay = `-${delay}s`;

            svg.appendChild(path);
        }
        container.appendChild(svg);
        return container;
    };

    const leftWaveContainer = createSvgWaveContainer(true);
    const rightWaveContainer = createSvgWaveContainer(false);

    aboutCardWrapper.appendChild(leftWaveContainer);

    const card = document.createElement('div');
    card.className = 'major-project-card project-modal-trigger about-me-card';
    card.dataset.itemId = aboutMeData.id;
    card.dataset.itemType = aboutMeData.type;
    card.innerHTML = `
    <img src="${aboutMeData.imageUrl}" alt="Aadhav Sivakumar" onerror="this.onerror=null;this.src='https://placehold.co/480x420/F7F5F2/BFA181?text=Image+Not+Found';">
    <div class="project-content">
        <h4>${aboutMeData.cardTitle}</h4>
        <p>${aboutMeData.cardTeaser}</p>
    </div>`;
    aboutCardWrapper.appendChild(card);
    if (cardObserver) {
        cardObserver.observe(card);
    }

    aboutCardWrapper.appendChild(rightWaveContainer);
}

export function populateProjects(majorProjectsData, smallProjectsData, cardObserver) {
    const majorProjectsContainer = document.getElementById('major-projects-container');
    const smallProjectsContainer = document.getElementById('small-projects-container');

    if (!majorProjectsData || !smallProjectsData) return;
    [majorProjectsData, smallProjectsData].forEach((projectList, index) => {
        const container = index === 0 ? majorProjectsContainer : smallProjectsContainer;
        if (!container) return;

        projectList.forEach((project) => {
            const isMajor = index === 0;
            const card = document.createElement('div');
            card.className = `${isMajor ? 'major-project-card' : 'small-project-card'} project-modal-trigger`;
            card.dataset.itemId = project.id;
            card.dataset.itemType = isMajor ? 'major' : 'small';

            const isMp4 = project.imageUrl && project.imageUrl.toLowerCase().endsWith('.mp4');
            const isGif = !isMp4 && project.imageUrl && project.imageUrl.toLowerCase().endsWith('.gif');
            const imageClass = isGif ? 'is-gif' : '';

            const placeholder = isMajor ?
                'https://placehold.co/600x400/F7F5F2/BFA181?text=Image+Not+Found' :
                'https://placehold.co/400x400/F7F5F2/BFA181?text=Image';

            let mediaHtml = '';
            if (isMp4) {
                mediaHtml = `<video src="${project.imageUrl}" autoplay loop muted playsinline></video>`;
            } else {
                mediaHtml = `<img src="${project.imageUrl}" alt="${project.title}" class="${imageClass}" onerror="this.onerror=null;this.src='${placeholder}';">`;
            }

            let techTagsHtml = '';
            if (project.tags && project.tags.length > 0) {
                techTagsHtml = '<div class="project-tags-container">';
                const tagsToShow = isMajor ? project.tags : project.tags.slice(0, 3);
                tagsToShow.forEach(tag => {
                    techTagsHtml += `<span class="project-tag">${tag}</span>`;
                });
                if (!isMajor && project.tags.length > 3) {
                    techTagsHtml += `<span class="project-tag">...</span>`;
                }
                techTagsHtml += '</div>';
            }

            let statusTagHtml = '';
            if (project.status) {
                statusTagHtml = '<div class="project-status-container">';
                const statusClass = project.status.toLowerCase().replace(/ /g, '-');
                statusTagHtml += `<span class="project-tag status-${statusClass}">${project.status}</span>`;
                statusTagHtml += '</div>';
            }

            if (isMajor) {
                card.innerHTML = `
                ${mediaHtml}
                <div class="project-content">
                    <h4>${project.title}</h4>
                    <p>${project.cardDescription}</p>
                    ${techTagsHtml}
                    ${statusTagHtml}
                </div>`;
            } else {
                let cardDesc = 'A cool small project.';
                if (project.modalContent && project.modalContent.length > 0 && project.modalContent[0].type === 'text') {
                    cardDesc = project.modalContent[0].value.substring(0, 70) + (project.modalContent[0].value.length > 70 ? '...' : '');
                }
                card.innerHTML = `
                ${mediaHtml}
                <div class="small-project-content">
                    <h4>${project.title}</h4>
                    <p>${cardDesc}</p>
                    ${techTagsHtml}
                    ${statusTagHtml}
                </div>`;
            }

            container.appendChild(card);
            if (cardObserver) cardObserver.observe(card);
        });
    });
}

export function populateResumeCard(resumeData, cardObserver) {
    const resumeCardContainer = document.getElementById('resume-card-container');
    if (!resumeCardContainer || !resumeData) return;

    const card = document.createElement('div');
    card.className = 'major-project-card project-modal-trigger';
    card.dataset.itemId = resumeData.id;
    card.dataset.itemType = resumeData.type;

    const placeholder = 'https://placehold.co/600x400/F7F5F2/BFA181?text=R%C3%A9sum%C3%A9';
    const mediaHtml = `<img src="${resumeData.imageUrl}" alt="${resumeData.title}" onerror="this.onerror=null;this.src='${placeholder}';">`;

    card.innerHTML = `
    ${mediaHtml}
    <div class="project-content">
        <h4>${resumeData.title}</h4>
        <p>${resumeData.cardDescription}</p>
    </div>`;

    resumeCardContainer.appendChild(card);
    if (cardObserver) cardObserver.observe(card);
}

export function populateSkillGroups(skillGroupsData, cardObserver) {
    const skillGroupsContainer = document.getElementById('skill-groups-container');
    if (!skillGroupsContainer || !skillGroupsData) return;
    skillGroupsContainer.innerHTML = '';

    skillGroupsData.forEach(group => {
        const card = document.createElement('div');
        card.className = 'skill-group-card project-modal-trigger';
        card.dataset.itemId = group.id;
        card.dataset.itemType = 'skill-group';

        let skillsListHtml = '<div class="skill-group-card-tags-container">';
        const MAX_SKILLS_ON_CARD = 8;
        group.items.slice(0, MAX_SKILLS_ON_CARD).forEach(skill => {
            skillsListHtml += `<span class="project-tag">${skill.name}</span>`;
        });
        skillsListHtml += '</div>';

        let moreInfoHtml = '';
        if (group.items.length > MAX_SKILLS_ON_CARD) {
            moreInfoHtml = `<p class="skill-group-more-info">...and ${group.items.length - MAX_SKILLS_ON_CARD} more</p>`;
        }

        const cardImageSrc = group.cardImageUrl || 'https://placehold.co/80x80/F0F0F0/BFA181?text=SKILL';

        card.innerHTML = `
        <div class="skill-group-card-image-wrapper">
          <div role="img" aria-label="${group.title} icon" class="skill-group-card-image" style="-webkit-mask-image: url(${cardImageSrc}); mask-image: url(${cardImageSrc});"></div>
        </div>
        <h4 class="skill-group-card-title">${group.title}</h4>
        ${skillsListHtml}
        ${moreInfoHtml}
    `;
        skillGroupsContainer.appendChild(card);
        if (cardObserver) cardObserver.observe(card);
    });
}
