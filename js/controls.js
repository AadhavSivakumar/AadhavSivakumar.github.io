export function initScrollControls() {
    const scrollUpBtn = document.getElementById('scroll-up-btn');
    const scrollDownBtn = document.getElementById('scroll-down-btn');
    const pageSections = Array.from(document.querySelectorAll('main > section'));

    if (scrollDownBtn) {
        scrollDownBtn.addEventListener('click', () => {
            const currentScrollY = window.scrollY;
            const buffer = 2;
            let nextSection = pageSections.find(section => section.offsetTop > currentScrollY + buffer);

            if (nextSection && nextSection.id === 'about') {
                nextSection = document.getElementById('projects');
            }

            if (nextSection) {
                nextSection.scrollIntoView({ behavior: 'smooth' });
            } else {
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
}
