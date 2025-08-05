let scrollRaf;

function handleScrollAnimations() {
    const header = document.querySelector('header');
    const leftObject = document.querySelector('.left-object');
    const rightObject = document.querySelector('.right-object');

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
}

export function initScrollAnimations() {
    window.addEventListener('scroll', () => {
        if (scrollRaf) window.cancelAnimationFrame(scrollRaf);
        scrollRaf = window.requestAnimationFrame(handleScrollAnimations);
    }, { passive: true });
}

export function initIntersectionObservers() {
    const sections = document.querySelectorAll('main > section');
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                sectionObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    sections.forEach(section => sectionObserver.observe(section));

    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, { threshold: 0.1 });

    return cardObserver;
}

export function initGlassEffect() {
    const cards = document.querySelectorAll('.major-project-card, .small-project-card, .skill-group-card, .about-me-card');

    cards.forEach(card => {
        const maxRotate = 8;

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const xCenter = width / 2;
            const yCenter = height / 2;

            const rotateX = ((mouseY - yCenter) / yCenter) * -maxRotate;
            const rotateY = ((mouseX - xCenter) / xCenter) * maxRotate;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}
