import React, { useState, useEffect, useRef } from 'react';

// ===================================================================
// I. DATA FOR THE PORTFOLIO
// ===================================================================

const majorProjectsData = [
    { id: 1, title: 'Project One', description: 'This is a more detailed description for the modal. It explains the project scope, the technologies used, and the outcome. Lorem ipsum dolor sit amet, consectetur adipiscing elit.', imageUrl: 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=2564&auto=format&fit=crop', link: '#'},
    { id: 2, title: 'Project Two', description: 'This is a more detailed description for the modal. It explains the project scope, the technologies used, and the outcome. Lorem ipsum dolor sit amet, consectetur adipiscing elit.', imageUrl: 'https://images.unsplash.com/photo-1555774698-0b77e0ab2329?q=80&w=2670&auto=format&fit=crop', link: '#'},
    { id: 3, title: 'Project Three', description: 'This is a more detailed description for the modal. It explains the project scope, the technologies used, and the outcome. Lorem ipsum dolor sit amet, consectetur adipiscing elit.', imageUrl: 'https://images.unsplash.com/photo-1581287053822-fd7bf4f4bf3f?q=80&w=2564&auto=format&fit=crop', link: '#'},
    { id: 4, title: 'Project Four', description: 'This is a more detailed description for the modal. It explains the project scope, the technologies used, and the outcome. Lorem ipsum dolor sit amet, consectetur adipiscing elit.', imageUrl: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=2670&auto=format&fit=crop', link: '#'},
];

const smallProjectsData = [
    { id: 'a', title: 'Project A', description: 'A short description for this small but cool project.', imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400' },
    { id: 'b', title: 'Project B', description: 'A short description for this small but cool project.', imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400' },
    { id: 'c', title: 'Project C', description: 'A short description for this small but cool project.', imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726a?w=400' },
    { id: 'd', title: 'Project D', description: 'A short description for this small but cool project.', imageUrl: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400' },
    { id: 'e', title: 'Project E', description: 'A short description for this small but cool project.', imageUrl: 'https://images.unsplash.com/photo-1571171637578-41bc2174d4c5?w=400' },
    { id: 'f', title: 'Project F', description: 'A short description for this small but cool project.', imageUrl: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400' },
    { id: 'g', title: 'Project G', description: 'A short description for this small but cool project.', imageUrl: 'https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?w=400' },
    { id: 'h', title: 'Project H', description: 'A short description for this small but cool project.', imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400' },
];

const skillsData = [
    { category: 'Languages', items: ['C', 'C++', 'Python', 'ROS', 'MATLAB', 'Verilog', 'Java', 'HTML/CSS', 'Javascript (Node.js & React)', 'SQL'] },
    { category: 'Boards', items: ['Arduino', 'Raspberry Pi', 'Digilent Basys 3 FPGA', 'STM32', 'ESP32', 'Parallax Propeller', 'BASIC Stamp 2'] },
    { category: 'Hardware', items: ['Franka Research 3 (7 DOF robotic arm)', 'NI DAQ', 'Google Glass', 'Bambu Lab printer', 'Glowforge'] },
    { category: 'Software', items: ['Solidworks', 'Altium', 'EAGLE', 'Fusion 360', 'Cadence', 'Robosuite', 'WeBots', 'PSpice', 'AutoCAD'] },
    { category: 'Sensors', items: ['ATI multi-axis force/torque', '9-axis IMU', 'Ultrasonic', 'flex', 'Capsense', 'piezoelectric'] },
    { category: 'Other Tools', items: ['AI image recognition', 'Communication protocols (SPI, I2C, UART)', 'IK', 'PID', 'Filtering', 'Driver Creation/Calibration', 'Telerobotics with TCP/UDP and 4-channel architecture', 'Statics and Dynamics'] }
];


// ===================================================================
// II. REUSABLE & HELPER COMPONENTS
// ===================================================================

const Section = ({ id, children, className = '' }) => {
    const sectionRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.unobserve(entry.target);
            }
        }, { threshold: 0.1 });

        const currentRef = sectionRef.current;
        if (currentRef) observer.observe(currentRef);
        return () => { if (currentRef) observer.unobserve(currentRef); };
    }, []);

    return <section id={id} ref={sectionRef} className={`${className} ${isVisible ? 'visible' : ''}`}>{children}</section>;
};

const ProjectCard = ({ project, type, onCardClick, isSelected }) => {
    const cardRef = useRef(null);
    const [isInView, setIsInView] = useState(false);

    const handleImageError = (e) => {
        e.target.onerror = null;
        e.target.src = type === 'major' ? 'https://placehold.co/600x400/F7F5F2/BFA181?text=Image+Not+Found' : 'https://placehold.co/400x400/F7F5F2/BFA181?text=Image';
    };

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true);
                observer.unobserve(entry.target);
            }
        }, { threshold: 0.1 });

        const currentRef = cardRef.current;
        if (currentRef) observer.observe(currentRef);
        return () => { if (currentRef) observer.unobserve(currentRef); };
    }, []);

    const cardClass = type === 'major' ? 'major-project-card' : 'small-project-card';

    const handleClick = () => {
        if (cardRef.current) {
            onCardClick(project, cardRef.current.getBoundingClientRect());
        }
    };

    return (
        <div
            ref={cardRef}
            className={`${cardClass} ${isInView ? 'in-view' : ''}`}
            onClick={handleClick}
            style={{ visibility: isSelected ? 'hidden' : 'visible' }}
        >
            <img src={project.imageUrl} alt={project.title} onError={handleImageError} />
            <div className={type === 'major' ? 'project-content' : 'small-project-content'}>
                <h4>{project.title}</h4>
                <p>{type === 'major' ? project.description.substring(0, 70) + '...' : project.description}</p>
                {type === 'major' && <a href="#" onClick={(e) => {e.stopPropagation(); handleClick()}}>View Case Study</a>}
            </div>
        </div>
    );
};

const Modal = ({ animationState, setAnimationState }) => {
    const { project, rect } = animationState;

    // Effect to manage animation timings
    useEffect(() => {
        let timer;
        if (animationState.phase === 'opening') {
            timer = setTimeout(() => setAnimationState(s => ({...s, phase: 'open'})), 10);
        } else if (animationState.phase === 'closing') {
            timer = setTimeout(() => setAnimationState({ project: null, rect: null, phase: 'closed' }), 500); // This duration must match the CSS transition duration
        }
        return () => clearTimeout(timer);
    }, [animationState.phase, setAnimationState]);

    // Effect to handle the Escape key for closing the modal
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                setAnimationState(s => ({...s, phase: 'closing'}));
            }
        };
        if(animationState.phase === 'open') {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [animationState.phase, setAnimationState]);

    if (animationState.phase === 'closed') {
        return null;
    }

    const finalWidth = Math.min(800, window.innerWidth * 0.9);
    const finalHeight = Math.min(window.innerHeight * 0.9, 600);
    const finalTop = (window.innerHeight - finalHeight) / 2;
    const finalLeft = (window.innerWidth - finalWidth) / 2;

    const getStyle = () => {
        switch(animationState.phase) {
            case 'opening':
                return { top: `${rect?.top}px`, left: `${rect?.left}px`, width: `${rect?.width}px`, height: `${rect?.height}px` };
            case 'open':
                return { top: `${finalTop}px`, left: `${finalLeft}px`, width: `${finalWidth}px`, height: `${finalHeight}px` };
            case 'closing':
                return { top: `${rect?.top}px`, left: `${rect?.left}px`, width: `${rect?.width}px`, height: `${rect?.height}px` };
            default:
                return {};
        }
    };

    return (
        <div
            className={`modal-backdrop ${animationState.phase === 'open' ? 'visible' : ''}`}
            onClick={() => setAnimationState(s => ({...s, phase: 'closing'}))}
        >
            <div className="modal-animator" style={getStyle()} onClick={e => e.stopPropagation()}>
                <div className={`modal-content ${animationState.phase}`}>
                    <button className="modal-close" onClick={() => setAnimationState(s => ({...s, phase: 'closing'}))}>&times;</button>
                    <img src={project?.imageUrl} alt={project?.title} className="modal-image"/>
                    <div className={`modal-text-content ${animationState.phase}`}>
                        <h2>{project?.title}</h2>
                        <p>{project?.description}</p>
                        {project?.link && <a href={project.link} target="_blank" rel="noopener noreferrer" className="contact-button">View Project</a>}
                    </div>
                </div>
            </div>
        </div>
    );
};


const LinkedInIcon = () => (<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="32" height="32"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" /></svg>);
const GitHubIcon = () => (<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="32" height="32"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>);


// ===================================================================
// III. PAGE STRUCTURE COMPONENTS
// ===================================================================

const Header = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={isScrolled ? 'scrolled' : ''}>
            <div className="logo"><a href="#hero">YN.</a></div>
            <nav>
                <a href="#about">About</a>
                <a href="#projects">Projects</a>
                <a href="#skills">Skills</a>
                <a href="#contact">Contact</a>
            </nav>
        </header>
    );
};

const AnimatedObjects = () => {
    const leftObjectRef = useRef(null);
    const rightObjectRef = useRef(null);
    const rafId = useRef();

    useEffect(() => {
        const handleScrollAnimations = () => {
            const scrollY = window.scrollY;
            const totalScrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = totalScrollableHeight > 0 ? scrollY / totalScrollableHeight : 0;

            if (rightObjectRef.current) {
                const d = window.innerHeight + rightObjectRef.current.offsetHeight;
                rightObjectRef.current.style.transform = `translateY(${scrollPercent * d - rightObjectRef.current.offsetHeight}px) rotate(${scrollPercent * 360}deg)`;
            }
            if (leftObjectRef.current) {
                leftObjectRef.current.style.transform = `translate(${70 * Math.sin(scrollY * 0.01)}px, ${-scrollY * 0.3}px) rotate(-${scrollPercent * 200}deg)`;
            }
        };
        const onScroll = () => { rafId.current = window.requestAnimationFrame(handleScrollAnimations); };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            if (rafId.current) window.cancelAnimationFrame(rafId.current);
            window.removeEventListener('scroll', onScroll);
        };
    }, []);

    return (<><div ref={leftObjectRef} className="animated-object left-object"></div><div ref={rightObjectRef} className="animated-object right-object"></div></>);
};

const Hero = () => (<section id="hero" className="visible"><h1>Your Name</h1><p>Creative Developer & Digital Designer</p></section>);

const About = () => {
    const handleImageError = (e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400/F7F5F2/BFA181?text=Image+Not+Found'; };
    return (
        <Section id="about">
            <div className="about-container">
                <div className="about-image"><img src="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=2680&auto=format&fit=crop" alt="Your headshot" onError={handleImageError}/></div>
                <div className="about-text"><h2 className="section-title" style={{ textAlign: 'left', marginBottom: '20px' }}>About Me</h2><p>Hello! I'm a passionate and results-driven creative professional with a knack for turning complex problems into beautiful, intuitive designs. Replace this text with your own biography.</p></div>
            </div>
        </Section>
    );
};

const Projects = ({ onCardClick, selectedProjectId }) => (
    <Section id="projects">
        <h2 className="section-title">My Work</h2>
        <h3>Major Projects</h3>
        <div className="major-projects-grid">{majorProjectsData.map(p => <ProjectCard key={p.id} project={p} type="major" onCardClick={onCardClick} isSelected={selectedProjectId === p.id} />)}</div>
        <h3>More Work</h3>
        <div className="small-projects-grid">{smallProjectsData.map(p => <ProjectCard key={p.id} project={p} type="small" onCardClick={onCardClick} isSelected={selectedProjectId === p.id} />)}</div>
    </Section>
);

const Skills = () => (<Section id="skills"><h2 className="section-title">Technical Skills</h2>{skillsData.map(({ category, items }) => (<div key={category} className="skill-category"><h3>{category}</h3><ul className="skill-list">{items.map(item => <li key={item}>{item}</li>)}</ul></div>))}</Section>);

const Contact = () => (<Section id="contact"><h2 className="section-title">Get In Touch</h2><p>I'm currently available for new opportunities. If you have a project in mind or just want to connect, I'd love to hear from you!</p><a href="mailto:your.email@example.com" className="contact-button">Say Hello</a><div className="social-links"><a href="#" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn Profile"><LinkedInIcon /></a><a href="#" target="_blank" rel="noopener noreferrer" aria-label="GitHub Profile"><GitHubIcon /></a></div></Section>);

const Footer = () => (<footer><p>© {new Date().getFullYear()} Your Name. All Rights Reserved.</p></footer>);


// ===================================================================
// IV. MAIN APP COMPONENT & STYLES
// ===================================================================

export default function App() {
    const [animationState, setAnimationState] = useState({ project: null, rect: null, phase: 'closed' });

    const handleCardClick = (project, rect) => {
        if (animationState.phase !== 'closed') return;

        setAnimationState({ project, rect, phase: 'opening' });
        document.body.style.overflow = 'hidden';
    };

    useEffect(() => {
        if (animationState.phase === 'closed') {
            document.body.style.overflow = 'unset';
        }
    }, [animationState.phase]);


    return (
        <>
            <style>{`
        /* FONT & THEME */
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Poppins:wght@300;400;600&display=swap');
        :root { --primary-color: #1a1a1a; --secondary-color: #555555; --background-color: #F7F5F2; --surface-color: #FFFFFF; --accent-color: #BFA181; }

        /* GLOBAL STYLES */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Poppins', sans-serif; background-color: var(--background-color); color: var(--primary-color); line-height: 1.7; overflow-x: hidden; }
        h1, h2, h3, h4 { font-family: 'Playfair Display', serif; font-weight: 700; }
        a { color: var(--accent-color); text-decoration: none; transition: color 0.3s ease; }
        a:hover { color: var(--primary-color); }

        /* ANIMATED OBJECTS & HEADER */
        .animated-object { position: fixed; background-color: var(--accent-color); opacity: 0.5; z-index: 1; transition: transform 0.1s linear; will-change: transform; }
        .left-object { width: 80px; height: 80px; border-radius: 50%; left: 10vw; top: 85vh; }
        .right-object { width: 100px; height: 100px; right: 8vw; top: 0; transform: translateY(-100%); }
        header { position: fixed; width: 100%; top: 0; left: 0; padding: 20px 5%; display: flex; justify-content: space-between; align-items: center; z-index: 1000; transition: background-color 0.5s ease, box-shadow 0.5s ease; }
        header.scrolled { background-color: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        header .logo { font-size: 1.5rem; }
        header nav a { margin-left: 30px; }

        /* SECTION & CARD STYLES */
        section { padding: 100px 5%; max-width: 1200px; margin: 0 auto; opacity: 0; transform: translateY(30px); transition: opacity 0.8s ease, transform 0.8s ease; position: relative; z-index: 10; }
        section.visible { opacity: 1; transform: translateY(0); }
        .section-title { font-size: 3rem; margin-bottom: 40px; text-align: center; }
        #hero { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background-color: transparent; }
        #hero h1 { font-size: clamp(2.5rem, 6vw, 6rem); margin-bottom: 20px; }
        #hero p { font-size: clamp(1rem, 2vw, 1.25rem); color: var(--secondary-color); font-family: 'Poppins'; }
        #about .about-container { display: flex; align-items: center; gap: 50px; flex-wrap: wrap; }
        #about .about-image { flex-basis: 35%; min-width: 280px; }
        #about .about-image img { width: 100%; border-radius: 10px; }
        #about .about-text { flex-basis: 65%; min-width: 300px; flex-grow: 1; }
        #projects h3 { font-size: 1.8rem; margin-top: 60px; margin-bottom: 20px; text-align: center; color: var(--secondary-color); font-family: 'Poppins'; font-weight: 400; }

        .major-project-card, .small-project-card { cursor: pointer; transition: opacity 0.6s ease-out, transform 0.6s ease-out, box-shadow 0.3s ease; }
        .major-project-card:nth-child(odd), .small-project-card:nth-child(odd) { transform: translateX(-50px); }
        .major-project-card:nth-child(even), .small-project-card:nth-child(even) { transform: translateX(50px); }
        .major-project-card.in-view, .small-project-card.in-view { opacity: 1; transform: translateX(0); }
        .major-project-card:hover { transform: translateY(-10px) !important; box-shadow: 0 15px 30px rgba(0,0,0,0.1); }
        .small-project-card:hover { transform: translateY(-5px) !important; box-shadow: 0 10px 20px rgba(0,0,0,0.08); }

        .major-projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; }
        .major-project-card { background-color: var(--surface-color); border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
        .major-project-card img { width: 100%; height: 300px; object-fit: cover; }
        .major-project-card .project-content { padding: 25px; }
        .major-project-card h4 { font-size: 1.7rem; }
        .major-project-card p { color: var(--secondary-color); }
        .small-projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 25px; }
        .small-project-card { background-color: var(--surface-color); border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.05); overflow: hidden; }
        .small-project-card img { width: 100%; height: 150px; object-fit: cover; display: block; }
        .small-project-content { padding: 15px; }
        .small-project-content h4 { font-family: 'Poppins'; font-weight: 600; font-size: 1.1rem; margin-bottom: 5px; }
        .small-project-content p { font-size: 0.9rem; color: var(--secondary-color); }
        
        /* SKILLS, CONTACT & FOOTER */
        .skill-category { margin-bottom: 30px; }
        .skill-category h3 { color: var(--primary-color); font-size: 1.25rem; font-family: 'Poppins', sans-serif; font-weight: 600; margin-bottom: 15px; border-bottom: 2px solid rgba(191, 161, 129, 0.2); padding-bottom: 8px; }
        .skill-list { list-style-type: none; padding: 0; columns: 2; gap: 10px; }
        .skill-list li { padding: 5px 0 5px 25px; position: relative; color: var(--secondary-color); font-size: 1rem; }
        .skill-list li::before { content: '▹'; position: absolute; left: 0; top: 5px; color: var(--accent-color); font-weight: bold; }
        #contact { text-align: center; }
        #contact p { max-width: 600px; margin: 0 auto 40px; color: var(--secondary-color); }
        .contact-button { display: inline-block; padding: 15px 30px; background-color: var(--accent-color); color: var(--surface-color); border-radius: 5px; font-weight: 600; transition: transform 0.3s ease, background-color 0.3s ease; }
        .contact-button:hover { transform: scale(1.05); background-color: var(--primary-color); color: var(--surface-color); }
        .social-links { margin-top: 40px; display: flex; justify-content: center; gap: 25px; }
        footer { text-align: center; padding: 40px 5%; color: var(--secondary-color); font-size: 0.9rem; border-top: 1px solid #ddd; margin-top: 50px; position: relative; z-index: 10; }

        /* MODAL STYLES */
        .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); z-index: 2000; opacity: 0; transition: opacity 0.5s ease-in-out; }
        .modal-backdrop.visible { opacity: 1; }
        .modal-animator { position: fixed; background-color: var(--surface-color); border-radius: 10px; z-index: 2001; overflow: hidden; transition: all 0.5s ease-in-out; }
        .modal-content { width: 100%; height: 100%; display: flex; flex-direction: column; }
        .modal-text-content { padding: 25px; flex-grow: 1; overflow-y: auto; opacity: 0; transition: opacity 0.3s 0.2s ease-in-out; }
        .modal-content.open .modal-text-content { opacity: 1; }

        .modal-image { width: 100%; height: 50%; object-fit: cover; flex-shrink: 0; }
        .modal-close { position: absolute; top: 15px; right: 20px; background: none; border: none; font-size: 2.5rem; cursor: pointer; line-height: 1; z-index: 2; color: white; mix-blend-mode: difference;}
        .modal-text-content h2 { margin-bottom: 15px; font-size: 2.5rem; }
        .modal-text-content p { margin-bottom: 25px; }
        
        /* RESPONSIVE DESIGN */
        @media (max-width: 768px) { 
            #about .about-container { text-align: center; justify-content: center; } 
            .skill-list { columns: 1; } 
            header nav a { margin-left: 15px; }
            .section-title { font-size: 2.5rem; }
            .modal-content { padding: 20px; }
            .modal-content h2 { font-size: 2rem; }
        }
      `}</style>
            <AnimatedObjects />
            <Header />
            <main>
                <Hero />
                <About />
                <Projects onCardClick={handleCardClick} selectedProjectId={animationState.project?.id} />
                <Skills />
                <Contact />
            </main>
            <Footer />
            <Modal animationState={animationState} setAnimationState={setAnimationState} />
        </>
    );
}
