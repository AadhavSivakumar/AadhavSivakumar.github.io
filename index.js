

window.addEventListener('load', async () => {
    // Prevent browser from restoring scroll position and force to top
    if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const header = document.querySelector('header');
    const leftObject = document.querySelector('.left-object');
    const rightObject = document.querySelector('.right-object');
    const sections = document.querySelectorAll('main > section');
    const aboutCardWrapper = document.querySelector('#about .about-card-wrapper');
    const majorProjectsContainer = document.getElementById('major-projects-container');
    const smallProjectsContainer = document.getElementById('small-projects-container');
    const resumeCardContainer = document.getElementById('resume-card-container');
    const skillGroupsContainer = document.getElementById('skill-groups-container');
    const themeToggleButton = document.getElementById('theme-toggle');

    const modalBackdrop = document.querySelector('.modal-backdrop');
    const modalAnimator = document.querySelector('.modal-animator');
    const modalCloseBtn = document.querySelector('.modal-close');
    const modalImageContainer = document.querySelector('.modal-image-container');
    const modalTitle = document.getElementById('modal-title');
    const modalDescription = document.getElementById('modal-description');
    const modalLink = document.getElementById('modal-link');
    const modalDynamicContentArea = document.getElementById('modal-dynamic-content-area');


    let isAnimating = false;
    let lastClickedCard = null;
    let lastCardRect = null;
    let cardObserver;

    let aboutMeData, majorProjectsData, smallProjectsData, resumeData, skillGroupsData;

    const loadData = async () => {
        try {
            const [projectsIndex, skillsIndex] = await Promise.all([
                fetch('data/projects.json').then(res => res.ok ? res.json() : Promise.reject(res)),
                fetch('data/skills.json').then(res => res.ok ? res.json() : Promise.reject(res))
            ]);

            const majorProjectPromises = projectsIndex.major.map(url => fetch(url).then(res => res.ok ? res.json() : Promise.reject(res)));
            const smallProjectPromises = projectsIndex.small.map(url => fetch(url).then(res => res.ok ? res.json() : Promise.reject(res)));
            const skillGroupPromises = skillsIndex.map(url => fetch(url).then(res => res.ok ? res.json() : Promise.reject(res)));

            const baseProjectImagePath = 'https://aadhavsivakumar.github.io/Images/projectcovers/';
            const baseProjectPdfPath = 'https://aadhavsivakumar.github.io/projectpdf/';

            const processProjectData = (projects) => {
                if (!projects) return [];
                return projects.map(p => {
                    const project = { ...p };
                    if (project.imageFile) {
                        project.imageUrl = baseProjectImagePath + project.imageFile;
                    }
                    if (project.modalContent) {
                        project.modalContent = project.modalContent.map(item => {
                            if (item.type === 'embed' && item.file) {
                                return { ...item, value: baseProjectPdfPath + item.file };
                            }
                            return item;
                        });
                    }
                    return project;
                });
            };

            [
                aboutMeData,
                resumeData,
                skillGroupsData,
                majorProjectsData,
                smallProjectsData,
            ] = await Promise.all([
                fetch('data/about.json').then(res => res.ok ? res.json() : Promise.reject(res)),
                fetch('data/resume.json').then(res => res.ok ? res.json() : Promise.reject(res)),
                Promise.all(skillGroupPromises),
                Promise.all(majorProjectPromises).then(processProjectData),
                Promise.all(smallProjectPromises).then(processProjectData),
            ]);
        } catch (error) {
            console.error("Failed to load portfolio data:", error);
            // You could display an error message to the user on the page here
        }
    };


    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeToggleButton) {
            themeToggleButton.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
        localStorage.setItem('theme', theme);
        if (modalAnimator.classList.contains('visible') && modalAnimator.classList.contains('skill-group-modal')) {
            const skillItems = modalDynamicContentArea.querySelectorAll('.skill-group-item-image');
            skillItems.forEach(img => {
                const imgEl = img;
                if (imgEl.src.includes('iconify.design') && imgEl.src.includes('color=')) {
                    let newSrc = imgEl.src;
                    if (imgEl.src.includes('color=var(--icon-resting-color)')) {
                        const iconRestingColorValue = getComputedStyle(document.documentElement).getPropertyValue('--icon-resting-color').trim().replace('#','');
                        newSrc = imgEl.src.replace('color=var(--icon-resting-color)', `color=${iconRestingColorValue}`);
                    } else if (!imgEl.src.match(/color=([a-f0-9]{3,6}|var\\(--accent-color\\)|var\\(--primary-color\\)|var\\(--secondary-color\\))/i)) {
                        const defaultIconColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim().replace('#','');
                        newSrc += (newSrc.includes('?') ? '&' : '?') + `color=${defaultIconColor}`;
                    }
                    imgEl.src = newSrc;
                }
            });
        }
    };

    const initTheme = () => {
        let currentTheme = localStorage.getItem('theme');
        if (!currentTheme) {
            currentTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        applyTheme(currentTheme);
        if (themeToggleButton) {
            themeToggleButton.addEventListener('click', () => {
                let newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
                applyTheme(newTheme);
            });
        }
    };


    const populateAboutMeCard = () => {
        if (!aboutCardWrapper || !aboutMeData) return;
        aboutCardWrapper.innerHTML = '';

        const SVG_NS = "http://www.w3.org/2000/svg";
        const CONTAINER_WIDTH = 300;
        const CONTAINER_HEIGHT = 420;
        // To change the number of waves, adjust this value.
        // The number of visible waves will be NUM_TOTAL_WAVES_PER_SIDE - 2 (to account for clipped top/bottom edges).
        const NUM_TOTAL_WAVES_PER_SIDE = 50; // Results in 25 visible waves.
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

                const animationDuration = 3; // From CSS: animation-duration: 5s;
                const phaseShiftDegrees = 12; // A slight offset
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
        // Observe the newly created card
        if (cardObserver) {
            cardObserver.observe(card);
        }

        aboutCardWrapper.appendChild(rightWaveContainer);
    };


    const populateProjects = () => {
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

                // Tech Tags
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

                // Status Tag
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
    };

    const populateResumeCard = () => {
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
    };

    const populateSkillGroups = () => {
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
    };


    const handleScrollAnimations = () => {
        const scrollY = window.scrollY;
        const totalScrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = totalScrollableHeight > 0 ? scrollY / totalScrollableHeight : 0;
        if (header) {
            header.classList.toggle('scrolled', scrollY > 50);
        }

        if (rightObject) {
            const arrowIcon = rightObject.querySelector('svg');
            const squareTravelDistance = window.innerHeight;
            const squareY = scrollPercent * squareTravelDistance;
            const squareRotation = scrollPercent * 360;
            rightObject.style.transform = `translateY(${squareY - rightObject.offsetHeight}px) rotate(${squareRotation}deg)`;
            if (arrowIcon) {
                arrowIcon.style.transform = `rotate(${-squareRotation}deg)`;
            }
        }
        if (leftObject) {
            const arrowIcon = leftObject.querySelector('svg');
            const initialTopVh = 85;
            const initialTopPx = window.innerHeight * (initialTopVh / 100);
            const objectHeight = leftObject.offsetHeight;

            const totalUpwardTravelDistance = initialTopPx + objectHeight;

            const triangleY = -scrollPercent * totalUpwardTravelDistance;
            const triangleRotation = scrollPercent * 720;

            leftObject.style.transform = `translateY(${triangleY}px) rotate(${triangleRotation}deg)`;
            if (arrowIcon) {
                arrowIcon.style.transform = `rotate(${-triangleRotation}deg)`;
            }
        }
    };

    const setupIntersectionObservers = () => {
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    sectionObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        sections.forEach(section => sectionObserver.observe(section));

        cardObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    // cardObserver.unobserve(entry.target); // Optional: unobserve after first animation
                }
            });
        }, { threshold: 0.1 });

        // Note: The about-me-card is now observed within populateAboutMeCard
        // Other cards are observed when populated in their respective functions.
    };

    const openModal = (card, itemData, itemType) => {
        if (isAnimating) return;
        isAnimating = true;
        lastClickedCard = card;
        document.body.style.overflow = 'hidden';

        modalDynamicContentArea.innerHTML = '';
        modalDescription.textContent = '';
        modalDescription.style.display = 'none';
        modalLink.style.display = 'none';
        modalImageContainer.innerHTML = ''; // Clear previous media content

        modalTitle.textContent = itemData.title || itemData.modalTitle || itemData.name;

        modalAnimator.classList.remove('project-modal', 'skill-group-modal', 'skill-modal', 'resume-modal');
        if (itemType === 'skill-group') {
            modalAnimator.classList.add('skill-group-modal');
            let groupCardImageSrc = itemData.cardImageUrl || 'https://placehold.co/80x80/F0F0F0/BFA181?text=SKILL';

            const img = document.createElement('img');
            img.src = groupCardImageSrc;
            img.alt = itemData.title;
            img.className = 'modal-image';
            img.onerror = function() {
                this.onerror=null;
                this.src='https://placehold.co/800x400/F7F5F2/BFA181?text=Img+Error';
            };
            modalImageContainer.appendChild(img);
            modalImageContainer.style.display = itemData.cardImageUrl ? 'block' : 'none';

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'modal-skill-group-items-container';
            itemData.items.forEach(skillItem => {
                const itemEl = document.createElement('div');
                itemEl.className = 'skill-group-item';
                let skillItemImageSrc = skillItem.imageUrl;
                if (skillItemImageSrc.includes('iconify.design')) {
                    const iconRestingColorValue = getComputedStyle(document.documentElement).getPropertyValue('--icon-resting-color').trim().replace('#','');
                    if (skillItemImageSrc.includes('?')) {
                        skillItemImageSrc += `&color=${iconRestingColorValue}`;
                    } else {
                        skillItemImageSrc += `?color=${iconRestingColorValue}`;
                    }
                }


                itemEl.innerHTML = `
                  <img src="${skillItemImageSrc}" alt="${skillItem.name}" class="skill-group-item-image" onerror="this.onerror=null;this.src='https://placehold.co/60x60/F7F5F2/BFA181?text=?';">
                  <div class="skill-group-item-text">
                      <h4 class="skill-group-item-name">${skillItem.name}</h4>
                      <p class="skill-group-item-description">${skillItem.description}</p>
                  </div>`;
                itemsContainer.appendChild(itemEl);
            });
            modalDynamicContentArea.appendChild(itemsContainer);

        } else if (itemType === 'about' || itemType === 'major' || itemType === 'small' || itemType === 'resume') {

            if (itemType === 'resume') {
                modalAnimator.classList.add('resume-modal');
                modalImageContainer.style.display = 'none';
            } else {
                modalAnimator.classList.add('project-modal');
                const isMp4 = itemData.imageUrl && itemData.imageUrl.toLowerCase().endsWith('.mp4');
                if (isMp4) {
                    const video = document.createElement('video');
                    video.src = itemData.imageUrl;
                    video.className = 'modal-image';
                    video.controls = true;
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = false;
                    video.onerror = () => {
                        modalImageContainer.innerHTML = '<p style="color: var(--primary-color); text-align: center; padding: 20px;">Error loading video.</p>';
                    };
                    modalImageContainer.appendChild(video);
                } else {
                    const img = document.createElement('img');
                    img.src = itemData.imageUrl;
                    img.alt = itemData.title || itemData.modalTitle;
                    img.className = 'modal-image';
                    img.onerror = function() {
                        this.onerror=null;
                        this.src='https://placehold.co/800x400/F7F5F2/BFA181?text=Img+Error';
                    };
                    modalImageContainer.appendChild(img);
                }
                modalImageContainer.style.display = 'block';
            }

            let hasCustomButtons = false;
            let rootLink = itemData.link;

            if (itemData.modalContent && Array.isArray(itemData.modalContent)) {
                itemData.modalContent.forEach(contentItem => {
                    let el;
                    if (contentItem.type === 'text') {
                        el = document.createElement('p');
                        el.className = 'modal-dynamic-text';
                        el.textContent = contentItem.value;
                    } else if (contentItem.type === 'image') {
                        el = document.createElement('img');
                        el.src = contentItem.value;
                        el.alt = contentItem.alt || 'Modal content image';
                        el.className = 'modal-dynamic-image';
                        el.onerror = function() { this.src='https://placehold.co/600x400/cccccc/333333?text=Img+Error'; this.alt='Error loading image'; };
                    } else if (contentItem.type === 'button') {
                        el = document.createElement('a');
                        el.href = contentItem.link;
                        el.textContent = contentItem.text;
                        el.className = 'modal-dynamic-button';
                        el.target = '_blank';
                        el.rel = 'noopener noreferrer';
                        hasCustomButtons = true;
                    } else if (contentItem.type === 'embed') {
                        el = document.createElement('iframe');
                        el.src = contentItem.value;
                        el.title = contentItem.title || 'Embedded Content';
                        el.className = 'modal-dynamic-embed';
                        el.setAttribute('frameborder', '0');
                        el.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
                        el.setAttribute('allowfullscreen', '');
                        if (itemType === 'resume') {
                            el.id = 'resume-modal-iframe';
                        }
                    }
                    if (el) modalDynamicContentArea.appendChild(el);
                });
            }
            if (!hasCustomButtons && rootLink && (itemType === 'major' || itemType === 'small')) {
                modalLink.href = rootLink;
                modalLink.style.display = 'inline-block';
                modalLink.textContent = "View Project";
            } else {
                modalLink.style.display = 'none';
            }
        } else if (itemType === 'skill') {
            modalAnimator.classList.add('skill-modal');
            modalImageContainer.style.display = 'none';
            modalDescription.textContent = itemData.description || '';
            modalDescription.style.display = modalDescription.textContent ? 'block' : 'none';
        }

        modalBackdrop.classList.add('visible');
        const cardRect = card.getBoundingClientRect();
        lastCardRect = cardRect; // Cache the card's position and size
        modalAnimator.classList.add('visible');
        if (lastClickedCard) lastClickedCard.classList.add('animating-out');

        let finalWidth, finalHeight, finalTop, finalLeft;
        finalWidth = Math.min(1280, window.innerWidth * 0.9);
        finalHeight = Math.min(window.innerHeight * 0.9, 1080);
        finalTop = (window.innerHeight - finalHeight) / 2;
        finalLeft = (window.innerWidth - finalWidth) / 2;

        modalAnimator.classList.add('no-transition');
        modalAnimator.style.top = `${cardRect.top}px`;
        modalAnimator.style.left = `${cardRect.left}px`;
        modalAnimator.style.width = `${cardRect.width}px`;
        modalAnimator.style.height = `${cardRect.height}px`;
        void modalAnimator.offsetHeight;
        modalAnimator.classList.remove('no-transition');

        requestAnimationFrame(() => {
            modalAnimator.style.top = `${finalTop}px`;
            modalAnimator.style.left = `${finalLeft}px`;
            modalAnimator.style.width = `${finalWidth}px`;
            modalAnimator.style.height = `${finalHeight}px`;
            modalAnimator.classList.add('open');
        });

        const animationDurationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--animation-duration')) * 1000;
        setTimeout(() => { isAnimating = false; }, animationDurationMs);
    };

    const closeModal = () => {
        if (isAnimating || !lastClickedCard || !lastCardRect) return;
        isAnimating = true;

        // Animate the modal content and backdrop fading out
        modalAnimator.classList.remove('open');
        modalBackdrop.classList.remove('visible');

        // Set the target position for the modal to shrink back to
        modalAnimator.style.top = `${lastCardRect.top}px`;
        modalAnimator.style.left = `${lastCardRect.left}px`;
        modalAnimator.style.width = `${lastCardRect.width}px`;
        modalAnimator.style.height = `${lastCardRect.height}px`;

        // Animate opacity to 0. We can't just remove the 'visible' class, as that
        // would also apply 'visibility: hidden' instantly, killing the animation.
        // Instead, we leave '.visible' on for the animation's duration and override opacity.
        modalAnimator.style.opacity = '0';

        const animationDurationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--animation-duration')) * 1000;
        setTimeout(() => {
            // After the animation, hide the element properly and reset its state for next time.
            modalAnimator.classList.remove('visible');
            modalAnimator.style.opacity = ''; // Clear inline style

            if (lastClickedCard) {
                lastClickedCard.classList.remove('animating-out');
            }
            document.body.style.overflow = '';
            modalDynamicContentArea.innerHTML = '';
            modalDescription.textContent = '';
            modalDescription.style.display = 'none';
            modalLink.style.display = 'none';
            isAnimating = false;
            lastClickedCard = null;
            lastCardRect = null;
        }, animationDurationMs);
    };

    const setupModalTriggers = () => {
        document.body.addEventListener('click', (e) => {
            const card = e.target.closest('.project-modal-trigger');
            if (card) {
                const itemId = card.dataset.itemId;
                const itemType = card.dataset.itemType;
                let itemData;

                if (itemType === 'major') itemData = majorProjectsData.find(p => p.id.toString() === itemId);
                else if (itemType === 'small') itemData = smallProjectsData.find(p => p.id.toString() === itemId);
                else if (itemType === 'skill-group') itemData = skillGroupsData.find(g => g.id === itemId);
                else if (itemType === 'about') itemData = aboutMeData;
                else if (itemType === 'resume') itemData = resumeData;

                if (itemData) openModal(card, itemData, itemType);
            }
        });
        modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
        if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
        window.addEventListener('keydown', (e) => { if(e.key === 'Escape' && modalBackdrop.classList.contains('visible')) closeModal(); });
    };

    const setupScrollControls = () => {
        const scrollUpBtn = document.getElementById('scroll-up-btn');
        const scrollDownBtn = document.getElementById('scroll-down-btn');
        const pageSections = Array.from(document.querySelectorAll('main > section'));

        if (scrollDownBtn) {
            scrollDownBtn.addEventListener('click', () => {
                const currentScrollY = window.scrollY;
                const buffer = 2;
                let nextSection = pageSections.find(section => section.offsetTop > currentScrollY + buffer);

                // If the next natural section is 'about', skip it and go to 'projects' instead.
                // This primarily affects the first scroll from the top ('hero' section).
                if (nextSection && nextSection.id === 'about') {
                    nextSection = document.getElementById('projects');
                }

                if (nextSection) {
                    nextSection.scrollIntoView({ behavior: 'smooth' });
                } else {
                    // If no next section, scroll to footer
                    document.querySelector('footer').scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        if (scrollUpBtn) {
            scrollUpBtn.addEventListener('click', () => {
                const currentScrollY = window.scrollY;
                const buffer = 2;
                const prevSections = pageSections.filter(section => section.offsetTop < currentScrollY - buffer);
                if (prevSections.length > 0) {
                    let prevSection = prevSections[prevSections.length - 1];
                    // If scrolling up would land on 'about', go to 'hero' instead.
                    if (prevSection && prevSection.id === 'about') {
                        prevSection = document.getElementById('hero');
                    }
                    if (prevSection) {
                        prevSection.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }
    };

    const setupGlassEffect = () => {
        const cards = document.querySelectorAll('.major-project-card, .small-project-card, .skill-group-card, .about-me-card');

        cards.forEach(card => {
            const maxRotate = 8; // Max rotation in degrees

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();

                // 3D tilt effect logic
                const width = rect.width;
                const height = rect.height;
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const xCenter = width / 2;
                const yCenter = height / 2;

                const rotateX = ((mouseY - yCenter) / yCenter) * -maxRotate;
                const rotateY = ((mouseX - xCenter) / xCenter) * maxRotate;

                // Apply a 3D transform. The scale gives it a 'lift' effect.
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
            });

            card.addEventListener('mouseleave', () => {
                // Resetting the inline style will make the card fall back to its CSS-defined transform,
                // which will be smoothly animated by the transition property.
                card.style.transform = '';
            });
        });
    };

    await loadData();
    setupIntersectionObservers();
    initTheme();
    populateAboutMeCard();
    populateProjects();
    populateSkillGroups();
    populateResumeCard();

    let scrollRaf;
    window.addEventListener('scroll', () => {
        if (scrollRaf) window.cancelAnimationFrame(scrollRaf);
        scrollRaf = window.requestAnimationFrame(handleScrollAnimations);
    }, { passive: true });



    setupModalTriggers();
    setupScrollControls();
    setupGlassEffect();

});