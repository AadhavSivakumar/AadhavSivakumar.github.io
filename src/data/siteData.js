const baseProjectImagePath = 'https://aadhavsivakumar.github.io/Images/projectcovers/';
const baseProjectPdfPath = 'https://aadhavsivakumar.github.io/projectpdf/';
const baseSkillImagePath = 'https://aadhavsivakumar.github.io/Images/skills/';
const deviconsBaseUrl = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/';

export const aboutMeData = {
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

export const majorProjectsData = [
  { id: 1, title: 'Project Millet', cardDescription: 'Developing a ROS-based autonomous drone utilizing a Pixhawk 6x for precise agricultural applications. This ongoing project focuses on implementing robust PID control for stable flight and targeted payload delivery.', imageUrl: baseProjectImagePath + 'Millet.webp', tags: ['C++', 'ROS', 'Pixhawk 6x', 'PID Control'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Developing a ROS-based autonomous drone utilizing a Pixhawk 6x for precise agricultural applications. This ongoing project focuses on implementing robust PID control for stable flight and targeted payload delivery, aiming to enhance farming efficiency.' }] },
  { id: 2, title: 'SoleGait Foot Sensor', cardDescription: 'Engineering an IoT-enabled foot sensor using an Arduino for real-time, high-fidelity gait analysis. This work-in-progress integrates custom communication protocols to provide actionable biometric data.', imageUrl: baseProjectImagePath + 'solegaitvidmute.mp4', tags: ['Python', 'Arduino', 'Comm Protocols'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Engineering an IoT-enabled foot sensor using an Arduino for real-time, high-fidelity gait analysis. This work-in-progress integrates custom communication protocols to provide actionable biometric data for healthcare and athletic performance.' }, { type: 'text', value: 'This project showcases my skills in embedded systems design, sensor integration, and data transmission. The goal is to create a low-cost, effective tool for physical therapists and athletes to monitor and improve gait patterns, preventing injuries and enhancing performance.' }, { type: 'embed', value: baseProjectPdfPath + 'Biomedical_devices_research_paper.pdf', title: 'Project Documentation (Coming Soon)' }] },
  { id: 3, title: 'Glass-2-Bot', cardDescription: 'Architected a telerobotic system integrating Google Glass with a robot arm, enabling intuitive remote object manipulation. Leveraged Python and AI vision to translate user gaze and gestures into precise robotic actions.', imageUrl: baseProjectImagePath + 'glass2bot.gif', tags: ['Google Glass', 'AI Vision', 'Python', 'Telerobotics'], status: 'Completed', modalContent: [{ type: 'text', value: 'Architected a telerobotic system integrating Google Glass with a robot arm, enabling intuitive remote object manipulation. Leveraged Python and AI vision to translate user gaze and gestures into precise robotic actions, demonstrating a novel human-robot interface.' }, { type: 'embed', value: baseProjectPdfPath + 'Adv__Mechatronics_Final_Report.pdf', title: 'Project Documentation PDF' }] },
  { id: 4, title: 'SMART compost sorting', cardDescription: 'Designed and implemented a robotic compost sorting system using a Franka Emika arm and depth-sensing AI vision. Developed within a ROS framework to automate the identification and separation of contaminants.', imageUrl: baseProjectImagePath + 'smartsort.gif', tags: ['Franka Emika Robot', 'AI Vision', 'ROS'], status: 'Completed', modalContent: [{ type: 'text', value: 'Designed and implemented a robotic compost sorting system using a Franka Emika arm and depth-sensing AI vision. Developed within a ROS framework, this project successfully automated the identification and separation of contaminants from organic waste streams.' }, { type: 'embed', value: baseProjectPdfPath + 'Capstone_final_report.pdf', title: 'Project Documentation (Coming Soon)' }] },
  { id: 5, title: 'Tactile Manipulation sensor', cardDescription: 'Designed and fabricated a novel tactile sensor on a flexible PCB using Altium Designer for advanced robotic manipulation. This sensor provides nuanced data on grip force and shear direction.', imageUrl: baseProjectImagePath + 'tacmanipHQ.gif', tags: ['C', 'Altium Designer'], status: 'Completed', modalContent: [{ type: 'text', value: "Designed and fabricated a novel tactile sensor on a flexible PCB using Altium Designer for advanced robotic manipulation. This sensor provides nuanced data on grip force and shear direction, enhancing a robot's ability to handle delicate objects." }, { type: 'button', text: 'View Organization', link: 'https://tml.engineering.ucsc.edu/' }, { type: 'button', text: 'View Previous Research', link: 'https://tml.engineering.ucsc.edu/research/dexterous-manipulation/' }] },
  { id: 6, title: 'Stockbot: Grocery Robotics', cardDescription: 'Developed a comprehensive simulation in Mujoco for an autonomous grocery restocking robot. Engineered kinematic models and path-planning algorithms in Python to optimize efficiency in a retail environment.', imageUrl: baseProjectImagePath + 'stockbot.gif', tags: ['Python', 'Mujoco', 'Kinematics'], status: 'Completed', modalContent: [{ type: 'text', value: 'Developed a comprehensive simulation in Mujoco for an autonomous grocery restocking robot. Engineered kinematic models and path-planning algorithms in Python to optimize efficiency and accuracy in a dynamic retail environment.' }, { type: 'text', value: "This project was a capstone for my undergraduate studies, showcasing the integration of advanced simulation with robotic control theory. The final system demonstrated a significant potential for reducing manual labor and improving inventory management in a simulated retail setting." }, { type: 'button', text: 'View Project', link: 'https://sites.google.com/ucsc.edu/stockbot/home' }] },
];

export const smallProjectsData = [
  { id: 'i', title: 'Point cloud visualization with 2D lidar', imageUrl: baseProjectImagePath + '2dlidar.mp4', tags: ['Python', 'Matplotlib', 'Lidar'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Interfaced an hls_lfcd lidar with Python to capture and visualize 2D point cloud data in real-time using Matplotlib, demonstrating foundational skills in sensor integration and data representation.' }] },
  { id: 'j', title: '3D space mapping with depth camera', imageUrl: baseProjectImagePath + '3dcamera.mp4', tags: ['Python', 'Open3D', 'Depth Camera'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Developing a system to capture and stitch together depth data from a camera to create a 3D map of an environment. This project explores point cloud processing and 3D reconstruction techniques.' }] },
  { id: 'g', title: 'CV controlled Desktop Robot arm', imageUrl: baseProjectImagePath + 'deskrobarm.png', tags: ['Python', 'AI Vision', 'Raspberry Pi'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Building a desktop robotic arm controlled by AI vision running on a Raspberry Pi. This project explores real-time object recognition and manipulation, creating an interactive and intelligent automated workspace assistant.' }] },
  { id: 'h', title: '3d Fruit Ninja Simulation', imageUrl: baseProjectImagePath + 'fruitninja.mp4', tags: ['Python', 'Webots'], status: 'In Progress', modalContent: [{ type: 'text', value: "Created a 3D simulation of the game 'Fruit Ninja' using Python, applying principles of physics-based modeling and 3D graphics to develop an interactive and engaging virtual experience." }] },
  { id: 'a', title: 'Sand Table', imageUrl: baseProjectImagePath + '2rplanarstraight.gif', tags: ['Parallax Propeller', 'C++', 'Kinematics'], status: 'Completed', modalContent: [{ type: 'text', value: 'Engineered a 2R planar manipulator controlled by a Parallax Propeller MCU to draw intricate patterns in sand. Applied C++ and kinematic principles to translate digital designs into precise, physical motion.' }, { type: 'embed', value: baseProjectPdfPath + 'Advanced_mechatronics_Project_2_report.pdf', title: 'Project Documentation (Coming Soon)' }] },
  { id: 'b', title: 'PONG', imageUrl: baseProjectImagePath + 'PONG.mp4', tags: ['Arduino', 'LED matrix'], status: 'Completed', modalContent: [{ type: 'text', value: 'Constructed a standalone version of the classic game PONG using an Arduino and an LED matrix. This project involved low-level hardware interfacing and efficient programming to create a responsive and engaging game.' }, { type: 'embed', value: baseProjectPdfPath + 'Advanced_Mechatronics_Project_1_report.pdf', title: 'Project Documentation (Coming Soon)' }] },
  { id: 'c', title: 'MATE ROV', imageUrl: baseProjectImagePath + 'MATEROV.jpeg', tags: ['C++', 'EAGLE', 'Ultrasonic'], status: 'Completed', modalContent: [{ type: 'text', value: 'Contributed to a competitive MATE ROV team by designing and building electronic subsystems for an underwater drone. Utilized EAGLE for PCB design and integrated ultrasonic sensors for complex subsea navigation and task execution.' }] },
  { id: 'd', title: 'Automated Dog Feeder', imageUrl: baseProjectImagePath + 'dogfeeder.webp', tags: ['C', 'Raspberry Pi'], status: 'Completed', modalContent: [{ type: 'text', value: "Designed and built an internet-enabled pet feeder powered by a Raspberry Pi and Firebase. This system allows for remote and scheduled feeding with precise portion control, ensuring a pet's dietary needs are met." }, { type: 'button', text: 'View on Instructables', link: 'https://www.instructables.com/Internet-Enabled-Raspberry-Pi-Pet-Feeder/' }] },
  { id: 'e', title: 'FPGA VGA Game', imageUrl: baseProjectImagePath + 'fpgaVGA.png', tags: ['Verilog', 'Basys 3 FPGA'], status: 'Completed', modalContent: [{ type: 'text', value: "Developed a 'Flappy Bird' style game on a Basys 3 FPGA using Verilog. This project involved designing digital logic circuits from the ground up to handle game state, player input, and VGA signal generation." }, { type: 'embed', value: '', title: 'Project Documentation (Coming Soon)' }] },
  { id: 'f', title: 'Mechatronics Competition', imageUrl: baseProjectImagePath + 'mechcomp.mp4', tags: ['STM32', 'C++', 'PID Control'], status: 'Completed', modalContent: [{ type: 'text', value: 'Built and programmed an autonomous robot on an STM32 platform for a mechatronics competition. Implemented C++ and fine-tuned PID control algorithms to achieve precise targeting and win a ping pong ball shooting tournament.' }, { type: 'embed', value: baseProjectPdfPath + 'ECE_118_Final_Project_Report.pdf', title: 'Project Documentation (Coming Soon)' }] },
];

export const resumeData = {
  id: 'resume-card',
  type: 'resume',
  title: 'View My Résumé',
  cardDescription: 'An up-to-date overview of my professional journey, technical skills, and key projects. Click to open the PDF.',
  imageUrl: 'https://placehold.co/600x400/F7F5F2/BFA181?text=View+R%C3%A9sum%C3%A9',
  modalTitle: 'My Résumé',
  modalContent: [
    { type: 'embed', value: 'https://drive.google.com/file/d/1YHd3-1T750Vm32hwAeqEM8gU9rqQbu7r/preview', title: "Aadhav Sivakumar's Resume" }
  ]
};

export const skillGroupsData = [
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
      { name: 'Firebase', imageUrl: baseSkillImagePath + 'firebase.png', description: "Google's platform for mobile/web app development with real-time databases, auth, and hosting." },
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
      { name: 'IMU', imageUrl: baseSkillImagePath + 'imu.svg', description: "Measures body's specific force, angular rate, and orientation using accelerometers/gyroscopes." },
      { name: 'Ultrasonic', imageUrl: baseSkillImagePath + 'ultrasonic_sensor.svg', description: 'Measures distance by emitting/receiving ultrasonic waves for object detection/avoidance.' },
      { name: 'Flex Sensor', imageUrl: baseSkillImagePath + 'flex_sensor.svg', description: 'Variable resistor that changes resistance when bent, used to detect flexing motions.' },
      { name: 'Capacitive', imageUrl: baseSkillImagePath + 'capacitive_sensor.svg', description: 'Detects changes in capacitance for touch sensing, proximity detection, liquid level sensing.' },
      { name: 'Piezoelectric', imageUrl: baseSkillImagePath + 'piezoelectric_sensor.svg', description: 'Generates electric charge from mechanical stress; used as pressure sensors, accelerometers.' },
      { name: 'Test Automation', imageUrl: 'https://api.iconify.design/mdi/play-box-multiple-outline.svg?color=var(--icon-resting-color)', description: 'Using software to execute pre-scripted tests for quality assurance and faster development cycles.' }
    ]
  }
];
