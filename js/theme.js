function applyTheme(theme) {
    const themeToggleButton = document.getElementById('theme-toggle');
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggleButton) {
        themeToggleButton.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    localStorage.setItem('theme', theme);

    const modalAnimator = document.querySelector('.modal-animator');
    if (modalAnimator && modalAnimator.classList.contains('visible') && modalAnimator.classList.contains('skill-group-modal')) {
        const modalDynamicContentArea = document.getElementById('modal-dynamic-content-area');
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
}

export function initTheme() {
    const themeToggleButton = document.getElementById('theme-toggle');
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
}
