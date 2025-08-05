let isAnimating = false;
let lastClickedCard = null;
let lastCardRect = null;
let portfolioData = null;

const modalBackdrop = document.querySelector('.modal-backdrop');
const modalAnimator = document.querySelector('.modal-animator');
const modalCloseBtn = document.querySelector('.modal-close');
const modalImageContainer = document.querySelector('.modal-image-container');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const modalLink = document.getElementById('modal-link');
const modalDynamicContentArea = document.getElementById('modal-dynamic-content-area');


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

    modalAnimator.classList.remove('project-modal', 'skill-group-modal', 'skill-modal', 'resume-modal', 'is-flipped', 'open');
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

    const modalFront = modalAnimator.querySelector('.modal-front');
    if (modalFront) {
        modalFront.innerHTML = card.innerHTML;
    }

    modalBackdrop.classList.add('visible');
    const cardRect = card.getBoundingClientRect();
    lastCardRect = cardRect;
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
        modalAnimator.classList.add('open', 'is-flipped');
    });

    const animationDurationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--animation-duration')) * 1000;
    setTimeout(() => { isAnimating = false; }, animationDurationMs);
};

const closeModal = () => {
    if (isAnimating || !lastClickedCard || !lastCardRect) return;
    isAnimating = true;

    modalAnimator.classList.remove('open');
    modalBackdrop.classList.remove('visible');

    setTimeout(() => {
        modalAnimator.classList.remove('is-flipped');
        modalAnimator.style.top = `${lastCardRect.top}px`;
        modalAnimator.style.left = `${lastCardRect.left}px`;
        modalAnimator.style.width = `${lastCardRect.width}px`;
        modalAnimator.style.height = `${lastCardRect.height}px`;
        modalAnimator.style.opacity = '0';
    }, 50);

    const animationDurationMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--animation-duration')) * 1000;
    setTimeout(() => {
        modalAnimator.classList.remove('visible');
        modalAnimator.style.opacity = '';

        if (lastClickedCard) {
            lastClickedCard.classList.remove('animating-out');
        }

        const modalFront = modalAnimator.querySelector('.modal-front');
        if (modalFront) modalFront.innerHTML = '';
        
        document.body.style.overflow = '';
        modalDynamicContentArea.innerHTML = '';
        modalDescription.textContent = '';
        modalDescription.style.display = 'none';
        modalLink.style.display = 'none';
        isAnimating = false;
        lastClickedCard = null;
        lastCardRect = null;
    }, animationDurationMs + 50);
};

export function initModal(data) {
    portfolioData = data;
    document.body.addEventListener('click', (e) => {
        const card = e.target.closest('.project-modal-trigger');
        if (card) {
            const itemId = card.dataset.itemId;
            const itemType = card.dataset.itemType;
            let itemData;

            if (itemType === 'major') itemData = portfolioData.majorProjectsData.find(p => p.id.toString() === itemId);
            else if (itemType === 'small') itemData = portfolioData.smallProjectsData.find(p => p.id.toString() === itemId);
            else if (itemType === 'skill-group') itemData = portfolioData.skillGroupsData.find(g => g.id === itemId);
            else if (itemType === 'about') itemData = portfolioData.aboutMeData;
            else if (itemType === 'resume') itemData = portfolioData.resumeData;

            if (itemData) openModal(card, itemData, itemType);
        }
    });
    modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    window.addEventListener('keydown', (e) => { if(e.key === 'Escape' && modalBackdrop.classList.contains('visible')) closeModal(); });
}
