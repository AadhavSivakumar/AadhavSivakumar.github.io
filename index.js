
window.addEventListener('load', () => {
    // Prevent browser from restoring scroll position and force to top
    if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const aboutMeData = {
        id: 'about-me-section',
        type: 'about',
        cardTitle: 'About Me',
        cardTeaser: 'A glimpse into my life experiences, skills, and the passions that drive my engineering pursuits. Click to learn more.',
        imageUrl: 'https://aadhavsivakumar.github.io/Images/frontpagepfp.JPG',
        modalTitle: 'Aadhav Sivakumar',
        modalContent: [
            { type: 'text', value: "Hello! I'm Aadhav Sivakumar, a Robotics and Embedded Systems Engineer with a Master's in Mechatronics and Robotics from NYU Tandon and a Bachelor's from UC Santa Cruz. I specialize in designing and developing intelligent systems, from autonomous drones and telerobotic interfaces to advanced sensor technologies. My work is driven by a passion for solving complex challenges at the intersection of hardware and software." },
            { type: 'text', value: "I thrive on developing cutting-edge solutions and have hands-on experience with the full project lifecycle, from conceptualization and PCB design to firmware development and AI integration. Beyond my core engineering work, I enjoy playing volleyball and biking, activities that fuel my creativity and problem-solving mindset." },
            { type: 'button', text: 'Connect on LinkedIn', link: 'https://www.linkedin.com/in/aadhav-s/' },
            { type: 'button', text: 'Connect on GitHub', link: 'https://github.com/AadhavSivakumar' },
            { type: 'text', value: "Feel free to explore my projects or reach out if you'd like to collaborate!" }
        ]
    };
    const baseProjectImagePath = 'https://aadhavsivakumar.github.io/Images/projectcovers/';
    const baseProjectPdfPath = 'https://aadhavsivakumar.github.io/projectpdf/';
    const majorProjectsData = [
        { id: 1, title: 'Project Millet', cardDescription: 'Developing a ROS-based autonomous drone utilizing a Pixhawk 6x for precise agricultural applications. This ongoing project focuses on implementing robust PID control for stable flight and targeted payload delivery.', imageUrl: baseProjectImagePath+'Millet.webp', tags: ['C++', 'ROS', 'Pixhawk 6x', 'PID Control'], status: 'In Progress', modalContent: [{type: 'text', value: 'Developing a ROS-based autonomous drone utilizing a Pixhawk 6x for precise agricultural applications. This ongoing project focuses on implementing robust PID control for stable flight and targeted payload delivery, aiming to enhance farming efficiency.'}] },
        { id: 2, title: 'SoleGait Foot Sensor', cardDescription: 'Engineering an IoT-enabled foot sensor using an Arduino for real-time, high-fidelity gait analysis. This work-in-progress integrates custom communication protocols to provide actionable biometric data.', imageUrl: baseProjectImagePath+'solegaitvidmute.mp4', tags: ['Python', 'Arduino', 'Comm Protocols'], status: 'In Progress', modalContent: [{type: 'text', value: 'Engineering an IoT-enabled foot sensor using an Arduino for real-time, high-fidelity gait analysis. This work-in-progress integrates custom communication protocols to provide actionable biometric data for healthcare and athletic performance.'}, {type: 'text', value: 'This project showcases my skills in embedded systems design, sensor integration, and data transmission. The goal is to create a low-cost, effective tool for physical therapists and athletes to monitor and improve gait patterns, preventing injuries and enhancing performance.'}, {type: 'embed', value: baseProjectPdfPath+'Biomedical_devices_research_paper.pdf', title: 'Project Documentation (Coming Soon)'}] },
        { id: 3, title: 'Glass-2-Bot', cardDescription: 'Architected a telerobotic system integrating Google Glass with a robot arm, enabling intuitive remote object manipulation. Leveraged Python and AI vision to translate user gaze and gestures into precise robotic actions.', imageUrl: baseProjectImagePath+'glass2bot.gif', tags: ['Google Glass', 'AI Vision', 'Python', 'Telerobotics'], status: 'Completed', modalContent: [{type: 'text', value: 'Architected a telerobotic system integrating Google Glass with a robot arm, enabling intuitive remote object manipulation. Leveraged Python and AI vision to translate user gaze and gestures into precise robotic actions, demonstrating a novel human-robot interface.'}, {type: 'embed', value: baseProjectPdfPath+'Adv__Mechatronics_Final_Report.pdf', title: 'Project Documentation PDF'}] },
        { id: 4, title: 'SMART compost sorting', cardDescription: 'Designed and implemented a robotic compost sorting system using a Franka Emika arm and depth-sensing AI vision. Developed within a ROS framework to automate the identification and separation of contaminants.', imageUrl: baseProjectImagePath + 'smartsort.gif', tags:['Franka Emika Robot', 'AI Vision', 'ROS'], status: 'Completed', modalContent: [{type: 'text', value: 'Designed and implemented a robotic compost sorting system using a Franka Emika arm and depth-sensing AI vision. Developed within a ROS framework, this project successfully automated the identification and separation of contaminants from organic waste streams.'}, {type: 'embed', value: baseProjectPdfPath+'Capstone_final_report.pdf', title: 'Project Documentation (Coming Soon)'}] },
        { id: 5, title: 'Tactile Manipulation sensor', cardDescription: 'Designed and fabricated a novel tactile sensor on a flexible PCB using Altium Designer for advanced robotic manipulation. This sensor provides nuanced data on grip force and shear direction.', imageUrl: baseProjectImagePath+'tacmanipHQ.gif', tags: ['C', 'Altium Designer'], status: 'Completed', modalContent: [{type: 'text', value: 'Designed and fabricated a novel tactile sensor on a flexible PCB using Altium Designer for advanced robotic manipulation. This sensor provides nuanced data on grip force and shear direction, enhancing a robot\'s ability to handle delicate objects.'}, {type: 'button', text: 'View Organization', link: 'https://tml.engineering.ucsc.edu/'}, {type: 'button', text: 'View Previous Research', link: 'https://tml.engineering.ucsc.edu/research/dexterous-manipulation/'}] },
        { id: 6, title: 'Stockbot: Grocery Robotics', cardDescription: 'Developed a comprehensive simulation in Mujoco for an autonomous grocery restocking robot. Engineered kinematic models and path-planning algorithms in Python to optimize efficiency in a retail environment.', imageUrl: baseProjectImagePath + 'stockbot.gif', tags:['Python', 'Mujoco', 'Kinematics'], status: 'Completed', modalContent: [{type: 'text', value: 'Developed a comprehensive simulation in Mujoco for an autonomous grocery restocking robot. Engineered kinematic models and path-planning algorithms in Python to optimize efficiency and accuracy in a dynamic retail environment.'}, { type: 'text', value: "This project was a capstone for my undergraduate studies, showcasing the integration of advanced simulation with robotic control theory. The final system demonstrated a significant potential for reducing manual labor and improving inventory management in a simulated retail setting." }, {type: 'button', text: 'View Project', link: 'https://sites.google.com/ucsc.edu/stockbot/home'}] },
    ];

    const smallProjectsData = [
        { id: 'i', title: 'Point cloud visualization with 2D lidar', imageUrl: baseProjectImagePath+'2dlidar.mp4', tags: ['Python', 'Matplotlib', 'Lidar'], status: 'In Progress', modalContent: [{type: 'text', value: 'Interfaced an hls_lfcd lidar with Python to capture and visualize 2D point cloud data in real-time using Matplotlib, demonstrating foundational skills in sensor integration and data representation.'}] },
        { id: 'j', title: '3D space mapping with depth camera', imageUrl: baseProjectImagePath+'3dcamera.mp4', tags: ['Python', 'Open3D', 'Depth Camera'], status: 'In Progress', modalContent: [{type: 'text', value: 'Developing a system to capture and stitch together depth data from a camera to create a 3D map of an environment. This project explores point cloud processing and 3D reconstruction techniques.'}] },
        { id: 'g', title: 'CV controlled Desktop Robot arm', imageUrl: baseProjectImagePath+'deskrobarm.png', tags: ['Python', 'AI Vision', 'Raspberry Pi'], status: 'In Progress', modalContent: [{type: 'text', value: 'Building a desktop robotic arm controlled by AI vision running on a Raspberry Pi. This project explores real-time object recognition and manipulation, creating an interactive and intelligent automated workspace assistant.'}] },
        { id: 'h', title: '3d Fruit Ninja Simulation', imageUrl: baseProjectImagePath+'fruitninja.mp4', tags: ['Python', 'Webots'], status: 'In Progress', modalContent: [{type: 'text', value: "Created a 3D simulation of the game 'Fruit Ninja' using Python, applying principles of physics-based modeling and 3D graphics to develop an interactive and engaging virtual experience."}] },
        { id: 'a', title: 'Sand Table', imageUrl: baseProjectImagePath+'2rplanarstraight.gif', tags: ['Parallax Propeller', 'C++', 'Kinematics'], status: 'Completed', modalContent: [{type: 'text', value: 'Engineered a 2R planar manipulator controlled by a Parallax Propeller MCU to draw intricate patterns in sand. Applied C++ and kinematic principles to translate digital designs into precise, physical motion.'}, {type: 'embed', value: baseProjectPdfPath+'Advanced_mechatronics_Project_2_report.pdf', title: 'Project Documentation (Coming Soon)'}] },
        { id: 'b', title: 'PONG', imageUrl: baseProjectImagePath+'PONG.mp4', tags: ['Arduino', 'LED matrix'], status: 'Completed', modalContent: [{type: 'text', value: 'Constructed a standalone version of the classic game PONG using an Arduino and an LED matrix. This project involved low-level hardware interfacing and efficient programming to create a responsive and engaging game.'}, {type: 'embed', value: baseProjectPdfPath+'Advanced_Mechatronics_Project_1_report.pdf', title: 'Project Documentation (Coming Soon)'}] },
        { id: 'c', title: 'MATE ROV', imageUrl: baseProjectImagePath+'MATEROV.jpeg', tags: ['C++', 'EAGLE', 'Ultrasonic'], status: 'Completed', modalContent: [{type: 'text', value: 'Contributed to a competitive MATE ROV team by designing and building electronic subsystems for an underwater drone. Utilized EAGLE for PCB design and integrated ultrasonic sensors for complex subsea navigation and task execution.'}] },
        { id: 'd', title: 'Automated Dog Feeder', imageUrl: baseProjectImagePath+'dogfeeder.webp', tags: ['C', 'Raspberry Pi'], status: 'Completed', modalContent: [{type: 'text', value: 'Designed and built an internet-enabled pet feeder powered by a Raspberry Pi and Firebase. This system allows for remote and scheduled feeding with precise portion control, ensuring a pet\'s dietary needs are met.'}, {type: 'button', text: 'View on Instructables', link: 'https://www.instructables.com/Internet-Enabled-Raspberry-Pi-Pet-Feeder/'}] },
        { id: 'e', title: 'FPGA VGA Game', imageUrl: baseProjectImagePath+'fpgaVGA.png', tags: ['Verilog', 'Basys 3 FPGA'], status: 'Completed', modalContent: [{type: 'text', value: "Developed a 'Flappy Bird' style game on a Basys 3 FPGA using Verilog. This project involved designing digital logic circuits from the ground up to handle game state, player input, and VGA signal generation."}, {type: 'embed', value: '', title: 'Project Documentation (Coming Soon)'}] },
        { id: 'f', title: 'Mechatronics Competition', imageUrl: baseProjectImagePath+'mechcomp.mp4', tags: ['STM32', 'C++', 'PID Control'], status: 'Completed', modalContent: [{type: 'text', value: 'Built and programmed an autonomous robot on an STM32 platform for a mechatronics competition. Implemented C++ and fine-tuned PID control algorithms to achieve precise targeting and win a ping pong ball shooting tournament.'}, {type: 'embed', value: baseProjectPdfPath+'ECE_118_Final_Project_Report.pdf', title: 'Project Documentation (Coming Soon)'}] },
    ];

    const resumeData = {
        id: 'resume-card',
        type: 'resume',
        title: 'View My Résumé',
        cardDescription: 'An up-to-date overview of my professional journey, technical skills, and key projects. Click to open the PDF.',
        imageUrl: 'https://placehold.co/600x400/F7F5F2/BFA181?text=View+R%C3%A9sum%C3%A9',
        modalTitle: 'My Résumé',
        modalContent: [
            { type: 'embed', value: 'https://aadhavsivakumar.github.io/Resume/Aadhav_Sivakumar_Resume_20250616_2.pdf', title: 'Aadhav Sivakumar\'s Resume' }
        ]
    };

    const baseSkillImagePath = 'https://aadhavsivakumar.github.io/Images/skills/';
    const deviconsBaseUrl = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/';


    const skillGroupsData = [
        {
            id: 'programming-software',
            title: 'Programming & Software Development',
            cardImageUrl: 'https://api.iconify.design/mdi/code-braces-box.svg',
            items: [
                { name: 'C', imageUrl: deviconsBaseUrl + 'c/c-original.svg', description: 'A powerful, general-purpose language for system programming, embedded systems, and performance-critical applications.' },
                { name: 'C++', imageUrl: deviconsBaseUrl + 'cplusplus/cplusplus-original.svg', description: 'An extension of C with object-oriented features, used in game engines, OS, and complex software.' },
                { name: 'Python', imageUrl: deviconsBaseUrl + 'python/python-original.svg', description: 'High-level, versatile language for web dev, data science, AI, scripting, and automation.' },
                { name: 'Java', imageUrl: deviconsBaseUrl + 'java/java-original.svg', description: 'Class-based, object-oriented language for enterprise apps, Android development, and large systems.' },
                { name: 'HTML5', imageUrl: deviconsBaseUrl + 'html5/html5-original.svg', description: 'Standard markup language for creating web pages and applications with rich multimedia and graphics.' },
                { name: 'CSS3', imageUrl: deviconsBaseUrl + 'css3/css3-original.svg', description: 'Styling language for web documents, enabling animations, transitions, and responsive design.' },
                { name: 'JavaScript', imageUrl: deviconsBaseUrl + 'javascript/javascript-original.svg', description: 'Essential for interactive web content; also used in non-browser environments via Node.js.' },
                { name: 'React', imageUrl: deviconsBaseUrl + 'react/react-original.svg', description: 'A JavaScript library for building user interfaces, widely used for creating single-page applications and dynamic UIs.' },
                { name: 'SQL', imageUrl: deviconsBaseUrl + 'postgresql/postgresql-original.svg', description: 'Language for managing and querying data in relational database management systems (RDBMS).' },
                { name: 'Verilog', imageUrl: baseSkillImagePath + 'verilog.png', description: 'Hardware description language (HDL) for modeling electronic systems like FPGAs and ASICs.' },
                { name: 'ROS', imageUrl: baseSkillImagePath + 'ROS.png', description: 'Flexible framework for writing robot software, simplifying complex robot behavior development.' },
                { name: 'Firebase', imageUrl: baseSkillImagePath + 'firebase.png', description: 'Google\'s platform for mobile/web app development with real-time databases, auth, and hosting.' },
                { name: 'Android Studio', imageUrl: baseSkillImagePath + 'AndroidStudio.png', description: 'Official IDE for Android app development, built on IntelliJ IDEA for coding, debugging, and testing.' }
            ]
        },
        {
            id: 'robotics-control',
            title: 'Robotics & Control Systems',
            cardImageUrl: 'https://api.iconify.design/mdi/robot-industrial.svg',
            items: [
                { name: 'Franka Emika Robot', imageUrl: baseSkillImagePath + 'Franka-Emika-Panda-robot.png', description: 'Collaborative 7-DOF robot arm for research and industry, with sensitive torque sensors.' },
                { name: 'Pixhawk 6x', imageUrl: baseSkillImagePath + 'pixhawk.png', description: 'Advanced autopilot flight controller for drones and unmanned vehicles, based on FMUv6X standard.' },
                { name: 'Kinematics', imageUrl: 'https://api.iconify.design/mdi/axis-arrow-lock.svg?color=var(--icon-resting-color)', description: 'Describing motion of objects and systems; crucial in robotics for arm positions and trajectories.' },
                { name: 'PID Control', imageUrl: 'https://api.iconify.design/mdi/tune-variant.svg?color=var(--icon-resting-color)', description: 'Feedback mechanism for industrial control and robotics, correcting errors based on P, I, D terms.' },
                { name: 'Kalman Filtering', imageUrl: 'https://api.iconify.design/mdi/filter-outline.svg?color=var(--icon-resting-color)', description: 'Algorithm for producing accurate estimates from noisy measurements over time.' },
                { name: 'Telerobotics', imageUrl: 'https://api.iconify.design/mdi/gamepad-variant-outline.svg?color=var(--icon-resting-color)', description: 'Controlling semi-autonomous robots from a distance using wireless or tethered connections.' },
                { name: 'Webots', imageUrl: baseSkillImagePath + 'webots.png', description: 'Open-source robot simulator for modeling, programming, and simulating robots.' }
            ]
        },
        {
            id: 'electronics-embedded',
            title: 'Electronics & Embedded Systems',
            cardImageUrl: 'https://api.iconify.design/mdi/chip.svg',
            items: [
                { name: 'NI DAQ', imageUrl: baseSkillImagePath + 'NIDAQ.jpg', description: 'National Instruments hardware for measuring electrical/physical phenomena and converting to digital data.' },
                { name: 'Oscilloscope', imageUrl: baseSkillImagePath + 'oscilloscope.jpg', description: 'Instrument for observing varying signal voltages, crucial for debugging electronic circuits.' },
                { name: 'LED Matrix', imageUrl: baseSkillImagePath + 'matrixheart.jpg', description: '2D array of LEDs for displaying patterns, characters, or animations via individual control.' },
                { name: 'Arduino', imageUrl: baseSkillImagePath + 'Arduino.jpg', description: 'Open-source platform for interactive objects, popular for prototyping and education.' },
                { name: 'Raspberry Pi', imageUrl: baseSkillImagePath + 'raspberrypi.webp', description: 'Small single-board computers for robotics, IoT, home automation, and education.' },
                { name: 'Basys 3 FPGA', imageUrl: baseSkillImagePath + 'Basys3.webp', description: 'Entry-level FPGA board with Artix-7, used for learning digital logic with Verilog/VHDL.' },
                { name: 'STM32 Nucleo', imageUrl: baseSkillImagePath + 'STM32.webp', description: 'Affordable boards with STM32 MCUs (ARM Cortex-M) for prototyping and concept testing.' },
                { name: 'ESP32/8266', imageUrl: baseSkillImagePath + 'ESP32.jpg', description: 'Low-cost Wi-Fi & Bluetooth/BLE MCUs for IoT, home automation, and wireless sensors.' },
                { name: 'Infineon PSoC 4', imageUrl: baseSkillImagePath + 'psoc4.jpg', description: 'Programmable System-on-Chip with ARM Cortex-M0/M0+ and programmable analog/digital blocks.' },
                { name: 'Parallax Propeller', imageUrl: baseSkillImagePath + 'propeller.jpg', description: 'Multicore MCU with eight 32-bit cores for true parallel processing and deterministic timing.' },
                { name: 'Jetson Nano', imageUrl: baseSkillImagePath + 'jetsonnano.jpg', description: 'Small, powerful computer for accelerated AI in embedded apps like image classification.' },
                { name: 'Comm Protocols', imageUrl: 'https://api.iconify.design/mdi/serial-port.svg?color=var(--icon-resting-color)', description: 'Rules for data transmission (I2C, SPI, UART, CAN, Ethernet, Wi-Fi, Bluetooth).' },
                { name: 'Altium Designer', imageUrl: baseSkillImagePath + 'altium-designer.png', description: 'EDA software for PCB, FPGA, and embedded software design in a unified environment.' },
                { name: 'Autodesk EAGLE', imageUrl: baseSkillImagePath + 'EAGLE.jpg', description: 'EDA tool for schematic capture, PCB layout, auto-router, and CAM features.' },
                { name: 'ORcad x Capture', imageUrl: baseSkillImagePath + 'OrCADCapture.webp', description: 'Cadence EDA tools for designing ICs, SoCs, and PCBs.' },
                { name: 'Pspice/LTspice', imageUrl: baseSkillImagePath + 'LTspice.png', description: 'SPICE-based analog circuit and digital logic simulation program for design verification.' }
            ]
        },
        {
            id: 'ai-ml-data',
            title: 'AI, Machine Learning & Data',
            cardImageUrl: 'https://api.iconify.design/mdi/brain.svg',
            items: [
                { name: 'AI Vision', imageUrl: 'https://api.iconify.design/mdi/eye-check-outline.svg?color=var(--icon-resting-color)', description: 'Enabling computers to "see" and interpret visual information like images and videos.' },
                { name: 'Gen AI API', imageUrl: 'https://api.iconify.design/mdi/robot-confused-outline.svg?color=var(--icon-resting-color)', description: 'Using Generative AI APIs (ChatGPT, Gemini, Claude) for content generation, chatbots, etc.' },
                { name: 'MATLAB', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Matlab_Logo.png/667px-Matlab_Logo.png', description: 'Numerical computing environment for data analysis, algorithm development, simulation.' },
                { name: 'Python (AI/Data Focus)', imageUrl: deviconsBaseUrl + 'python/python-original.svg', description: 'Widely used in AI/ML for its extensive libraries (TensorFlow, PyTorch, scikit-learn).' }
            ]
        },
        {
            id: 'design-fabrication',
            title: 'Design & Fabrication',
            cardImageUrl: 'https://api.iconify.design/mdi/printer-3d-nozzle-outline.svg',
            items: [
                { name: 'Google Glass', imageUrl: baseSkillImagePath + 'googleglass.jpg', description: 'Optical head-mounted display for hands-free info access and AR applications.' },
                { name: 'Bambu Lab Printer', imageUrl: baseSkillImagePath + 'bambu.webp', description: 'High-speed 3D printers with multi-material support (AMS) and advanced features.' },
                { name: 'Glowforge', imageUrl: baseSkillImagePath + 'glowforge.webp', description: 'Desktop laser cutter/engraver for precise designs on wood, acrylic, leather, etc.' },
                { name: 'SolidWorks', imageUrl: baseSkillImagePath + 'SOLIDWORKS.webp', description: 'CAD/CAE software for designing, simulating, and manufacturing products.' },
                { name: 'Fusion 360', imageUrl: baseSkillImagePath + 'fusion360.png', description: 'Cloud-based 3D CAD, CAM, CAE, PCB platform for product design and manufacturing.' },
                { name: 'AutoCAD', imageUrl: baseSkillImagePath + 'autocad.png', description: 'Commercial CAD and drafting software for 2D/3D design and documentation.' }
            ]
        },
        {
            id: 'sensors-tools',
            title: 'Sensors & Specialized Tools',
            cardImageUrl: 'https://api.iconify.design/mdi/leak.svg',
            items: [
                { name: 'ATI Multi-Axis Force/Torque', imageUrl: baseSkillImagePath + 'ati_force_torque.svg', description: 'Measures all six components of force/torque for robotics, haptics, product testing.' },
                { name: 'IMU', imageUrl: baseSkillImagePath + 'imu.svg', description: 'Measures body\'s specific force, angular rate, and orientation using accelerometers/gyroscopes.' },
                { name: 'Ultrasonic', imageUrl: baseSkillImagePath + 'ultrasonic_sensor.svg', description: 'Measures distance by emitting/receiving ultrasonic waves for object detection/avoidance.' },
                { name: 'Flex Sensor', imageUrl: baseSkillImagePath + 'flex_sensor.svg', description: 'Variable resistor that changes resistance when bent, used to detect flexing motions.' },
                { name: 'Capacitive', imageUrl: baseSkillImagePath + 'capacitive_sensor.svg', description: 'Detects changes in capacitance for touch sensing, proximity detection, liquid level sensing.' },
                { name: 'Piezoelectric', imageUrl: baseSkillImagePath + 'piezoelectric_sensor.svg', description: 'Generates electric charge from mechanical stress; used as pressure sensors, accelerometers.' },
                { name: 'Test Automation', imageUrl: 'https://api.iconify.design/mdi/play-box-multiple-outline.svg?color=var(--icon-resting-color)', description: 'Using software to execute pre-scripted tests for quality assurance and faster development cycles.' }
            ]
        }
    ];


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
        if (!aboutCardWrapper) return;
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
        if (!resumeCardContainer) return;

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
        if (!skillGroupsContainer) return;
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
