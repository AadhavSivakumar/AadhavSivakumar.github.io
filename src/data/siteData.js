// Root-relative, NOT absolute https://aadhavsivakumar.github.io/... URLs: these
// resolve against whatever origin is serving the app, so dev, `npm run preview`
// and production all exercise the same files. (They used to point at an
// /Images/ path that was renamed to /Media/ in Dec 2025, which 404'd every
// cover and icon in production for months.) `scripts/copy-static.mjs` is what
// puts these directories into dist/ at build time.
//
// Covers live in Media/web/projects — web-sized derivatives of the originals in
// Media/projects. Every .mp4 cover has a matching `<name>-poster.webp` next to
// it; ProjectCard derives the poster URL by that convention.
const baseProjectImagePath = '/Media/web/projects/';
const baseProjectPdfPath = '/projectpdf/';
const baseSkillImagePath = '/Media/skills/';
const deviconsBaseUrl = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/';

export const aboutMeData = {
  id: 'about-me-section',
  type: 'about',
  cardTitle: 'Aadhav Sivakumar',
  cardTeaser: "Hello! My name is Aadhav Sivakumar, and this website is meant to showcase projects I've worked on in the past and projects that I'm currently working on. Click to learn more.",
  imageUrl: '/Media/web/Gradpic.webp',
  modalTitle: 'Aadhav Sivakumar',
  modalContent: [
    { type: 'text', value: "Hello! My name is Aadhav Sivakumar, and this website is meant to showcase projects I've worked on in the past, and projects that I'm currently working on. You're also able to view my resume, an extended CV, or look through the different skills, software, and hardware I have worked with previously." },
    { type: 'text', value: "I'm an Edge AI Engineer on Roboflow's Solutions Research & Development team in New York, where I deploy production computer-vision systems on NVIDIA Jetson at pharmaceutical, food and automotive manufacturing sites, build the robotics demos Roboflow shows at GTC and CVPR, and work on synthetic data and vision-language-action models for robotic manipulation. Alongside that I'm a researcher in NYU Tandon's CREO lab. Before Roboflow I was a robotics researcher at NYU Tandon, where I earned my Master's in Mechatronics and Robotics and TA'd the Foundations of Robotics and Mathematics for Robotics courses with Professor Peng. Earlier I was a Robot Technician at Starship Technologies, working out of the Fordham University hub in the Bronx. I was born and raised in the Bay Area in California, and I went to undergrad at the University of California, Santa Cruz campus, where I studied Robotics Engineering with a minor in Electrical Engineering." },
    { type: 'text', value: "I believe that the most effective engineering happens at the intersection of rigorous theory and reliable application. My experiences, ranging from deep academic research to maintaining active robot fleets in the field, have taught me that building intelligent systems requires not just understanding the algorithms, but also the environmental and societal impact of new technologies. I am driven by the challenge of bridging this gap, ensuring that complex robots are robust, efficient, and capable of solving real-world problems." },
    { type: 'button', text: 'Connect on LinkedIn', link: 'https://www.linkedin.com/in/aadhav-s/' },
    { type: 'button', text: 'Connect on GitHub', link: 'https://github.com/AadhavSivakumar' }
  ]
};

// ── Experience ───────────────────────────────────────────────────────────────
// Rendered by Experience.jsx. Written for a public page: industries and public
// events are named, customers and contract values are not, and nothing here
// describes internal infrastructure, unreleased product plans, or work the
// owner has flagged as needing clearance. Keep it that way.
export const experienceData = [
  {
    id: 'exp-roboflow',
    org: 'Roboflow',
    role: 'Edge AI Engineer, Solutions Research & Development',
    location: 'New York, NY',
    period: 'Present',
    summary: 'Bridging industrial machine vision and robot learning: production vision systems on NVIDIA Jetson at manufacturing sites, the robotics demos Roboflow shows at major conferences, and research pipelines from teleoperation hardware through VLA policy fine-tuning.',
    bullets: [
      'Deploy production computer-vision inspection systems on NVIDIA Jetson (AGX Orin, AGX Thor) at pharmaceutical, food and automotive manufacturing sites — encoder-triggered line-scan and area-scan GigE Vision cameras, industrial lighting, Allen-Bradley PLC integration over EtherNet/IP, and custom operator HMIs.',
      'Designed and built Roboflow\'s NVIDIA GTC 2026 and CVPR 2026 booth demos: vision-guided xArm 5 pick-and-place with RealSense on Jetson AGX Orin, a line-scan conveyor inspection station, real-time defect detection, and a multi-vendor camera kit — including every camera, optics, lighting and networking BOM.',
      'Trained and optimized an RF-DETR-Seg part-presence model to 94.2% mAP@50 and roughly doubled per-stream edge throughput with neural architecture search + TensorRT; presented it in a public webinar on quality-control vision.',
      'Robot learning: built a four-arm bimanual SO-ARM101 LeRobot teleoperation rig on Jetson and a GELLO leader arm for xArm 5 to collect imitation-learning data; fine-tune VLA policies (π0, ACT); automated multi-view RGB-D reconstruction with Open3D TSDF using robot kinematics as the pose source.',
      'Work on synthetic data generation for industrial defect detection with NVIDIA tooling (Isaac Sim / Replicator, Cosmos), evaluating generative defect models and building the train/eval pipeline around them.',
      'Technical lead for a collaborative-robot vendor integration that runs Roboflow inference fully offline and air-gapped on the robot after an online warm-up, with the field kit and runbooks for onsite engineering.',
      'Provision, network and support a fleet of Jetson edge devices across industrial carrier boards (Advantech, ASUS, Seeed) — JetPack/BSP work, Docker and container registries, Tailscale fleet networking, GigE Vision subnets, PoE and 10GbE.',
    ],
    tags: ['NVIDIA Jetson', 'TensorRT', 'RF-DETR', 'PyTorch', 'GigE Vision', 'LeRobot', 'Isaac Sim', 'ROS 2', 'Open3D'],
  },
  {
    id: 'exp-nyu',
    org: 'NYU Tandon School of Engineering',
    role: 'Robotics Researcher · MS, Mechatronics and Robotics',
    location: 'Brooklyn, NY',
    period: '2024 – 2026',
    summary: 'Research on vision-language-action models for robotic manipulation in the CREO lab, alongside the master\'s degree and teaching.',
    bullets: [
      'Research on vision-language-action models for robotic manipulation (xArm 5), including the inference and fine-tuning hardware analysis for the lab.',
      'Co-authored a Google TPU Research Award proposal on bimanual VLA fine-tuning and Real2Sim (Isaac Sim + 3D Gaussian Splatting), with an 86.7% π0 task-success preliminary result.',
      'Teaching assistant for Foundations of Robotics and Mathematics for Robotics; developed STM32-based exam and project specifications for the Mechatronics course.',
    ],
    tags: ['VLA', 'openpi / JAX', 'Isaac Sim', 'xArm 5', 'STM32'],
  },
  {
    id: 'exp-starship',
    org: 'Starship Technologies',
    role: 'Robot Technician',
    location: 'Bronx, NY',
    period: '2025',
    summary: 'Kept an active fleet of autonomous sidewalk-delivery robots running in the field at the Fordham University hub.',
    bullets: [
      'Field maintenance, diagnostics and repair on a live fleet of autonomous delivery robots — the hands-on side of keeping autonomy running in the real world.',
    ],
    tags: ['Autonomous Robots', 'Field Operations'],
  },
];

export const majorProjectsData = [
  { id: 4, title: 'SMART compost sorting', cardDescription: 'Robotic compost sorting on a Franka Emika arm: RGB-D computer vision identifies contaminants in a waste stream and the arm removes them, all within a ROS framework. Undergraduate capstone.', imageUrl: baseProjectImagePath + 'smartsort.mp4', tags: ['Franka Emika Robot', 'Computer Vision', 'ROS'], status: 'Completed', modalContent: [{ type: 'text', value: 'Designed and implemented a robotic compost sorting system using a Franka Emika arm and depth-sensing AI vision. Developed within a ROS framework, this project successfully automated the identification and separation of contaminants from organic waste streams.' }, { type: 'embed', value: baseProjectPdfPath + 'Capstone_final_report.pdf', title: 'Project Documentation PDF' }] },
  { id: 3, title: 'Glass-2-Bot', cardDescription: 'Telerobotic manipulation driven by Google Glass: computer vision turns the wearer\'s gaze and gestures into arm commands for remote object manipulation. Python, real-time vision, human-robot interface design.', imageUrl: baseProjectImagePath + 'glass2bot.mp4', tags: ['Google Glass', 'Computer Vision', 'Python', 'Telerobotics'], status: 'Completed', modalContent: [{ type: 'text', value: 'Architected a telerobotic system integrating Google Glass with a robot arm, enabling intuitive remote object manipulation. Leveraged Python and AI vision to translate user gaze and gestures into precise robotic actions, demonstrating a novel human-robot interface.' }, { type: 'embed', value: baseProjectPdfPath + 'Adv__Mechatronics_Final_Report.pdf', title: 'Project Documentation PDF' }] },
  { id: 5, title: 'Tactile Manipulation sensor', cardDescription: 'A tactile sensor on a flexible PCB (Altium) for robotic manipulation, reporting grip force and shear direction for delicate grasping. Built with the Tactile Manipulation Lab at UCSC.', imageUrl: baseProjectImagePath + 'tacmanipHQ.mp4', tags: ['C', 'Altium Designer'], status: 'Completed', modalContent: [{ type: 'text', value: "Designed and fabricated a novel tactile sensor on a flexible PCB using Altium Designer for advanced robotic manipulation. This sensor provides nuanced data on grip force and shear direction, enhancing a robot's ability to handle delicate objects." }, { type: 'button', text: 'View Organization', link: 'https://tml.engineering.ucsc.edu/' }, { type: 'button', text: 'View Previous Research', link: 'https://tml.engineering.ucsc.edu/research/dexterous-manipulation/' }] },
  { id: 6, title: 'Stockbot: Grocery Robotics', cardDescription: 'MuJoCo simulation of an autonomous grocery-restocking robot: kinematic modelling and path planning in Python for a retail environment.', imageUrl: baseProjectImagePath + 'stockbot.mp4', tags: ['Python', 'Mujoco', 'Kinematics'], status: 'Completed', modalContent: [{ type: 'text', value: 'Developed a comprehensive simulation in Mujoco for an autonomous grocery restocking robot. Engineered kinematic models and path-planning algorithms in Python to optimize efficiency and accuracy in a dynamic retail environment.' }, { type: 'text', value: "This project was a capstone for my undergraduate studies, showcasing the integration of advanced simulation with robotic control theory. The final system demonstrated a significant potential for reducing manual labor and improving inventory management in a simulated retail setting." }, { type: 'button', text: 'View Project', link: 'https://sites.google.com/ucsc.edu/stockbot/home' }] },
  { id: 1, title: 'Project Millet', cardDescription: 'ROS-based autonomous drone on a Pixhawk 6x for precision agriculture: PID flight control and targeted payload delivery. In progress.', imageUrl: baseProjectImagePath + 'Millet.mp4', tags: ['C++', 'ROS', 'Pixhawk 6x', 'PID Control'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Developing a ROS-based autonomous drone utilizing a Pixhawk 6x for precise agricultural applications. This ongoing project focuses on implementing robust PID control for stable flight and targeted payload delivery, aiming to enhance farming efficiency.' }] },
  { id: 2, title: 'SoleGait Foot Sensor', cardDescription: 'Engineering an IoT-enabled foot sensor using an Arduino for real-time, high-fidelity gait analysis. This work-in-progress integrates custom communication protocols to provide actionable biometric data.', imageUrl: baseProjectImagePath + 'solegaitvidmute.mp4', tags: ['Python', 'Arduino', 'Comm Protocols'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Engineering an IoT-enabled foot sensor using an Arduino for real-time, high-fidelity gait analysis. This work-in-progress integrates custom communication protocols to provide actionable biometric data for healthcare and athletic performance.' }, { type: 'text', value: 'This project showcases my skills in embedded systems design, sensor integration, and data transmission. The goal is to create a low-cost, effective tool for physical therapists and athletes to monitor and improve gait patterns, preventing injuries and enhancing performance.' }, { type: 'embed', value: baseProjectPdfPath + 'Biomedical_devices_research_paper.pdf', title: 'Project Documentation PDF' }] },
];

export const smallProjectsData = [
  { id: 'i', title: 'Point cloud visualization with 2D lidar', imageUrl: baseProjectImagePath + '2dlidar.mp4', tags: ['Python', 'Matplotlib', 'Lidar'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Interfaced an hls_lfcd lidar with Python to capture and visualize 2D point cloud data in real-time using Matplotlib, demonstrating foundational skills in sensor integration and data representation.' }] },
  { id: 'j', title: '3D space mapping with depth camera', imageUrl: baseProjectImagePath + '3dcamera.mp4', tags: ['Python', 'Open3D', 'Depth Camera'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Developing a system to capture and stitch together depth data from a camera to create a 3D map of an environment. This project explores point cloud processing and 3D reconstruction techniques.' }] },
  { id: 'g', title: 'CV controlled Desktop Robot arm', imageUrl: baseProjectImagePath + 'deskrobarm.webp', tags: ['Python', 'Computer Vision', 'Raspberry Pi'], status: 'In Progress', modalContent: [{ type: 'text', value: 'Building a desktop robotic arm controlled by AI vision running on a Raspberry Pi. This project explores real-time object recognition and manipulation, creating an interactive and intelligent automated workspace assistant.' }] },
  { id: 'h', title: '3d Fruit Ninja Simulation', imageUrl: baseProjectImagePath + 'fruitninja.mp4', tags: ['Python', 'Webots'], status: 'In Progress', modalContent: [{ type: 'text', value: "Created a 3D simulation of the game 'Fruit Ninja' using Python, applying principles of physics-based modeling and 3D graphics to develop an interactive and engaging virtual experience." }] },
  { id: 'a', title: 'Sand Table', imageUrl: baseProjectImagePath + '2rplanarstraight.mp4', tags: ['Parallax Propeller', 'C++', 'Kinematics'], status: 'Completed', modalContent: [{ type: 'text', value: 'Engineered a 2R planar manipulator controlled by a Parallax Propeller MCU to draw intricate patterns in sand. Applied C++ and kinematic principles to translate digital designs into precise, physical motion.' }, { type: 'embed', value: baseProjectPdfPath + 'Advanced_mechatronics_Project_2_report.pdf', title: 'Project Documentation PDF' }] },
  { id: 'b', title: 'PONG', imageUrl: baseProjectImagePath + 'PONG.mp4', tags: ['Arduino', 'LED matrix'], status: 'Completed', modalContent: [{ type: 'text', value: 'Constructed a standalone version of the classic game PONG using an Arduino and an LED matrix. This project involved low-level hardware interfacing and efficient programming to create a responsive and engaging game.' }, { type: 'embed', value: baseProjectPdfPath + 'Advanced_Mechatronics_Project_1_report.pdf', title: 'Project Documentation PDF' }] },
  { id: 'c', title: 'MATE ROV', imageUrl: baseProjectImagePath + 'MATEROV.webp', tags: ['C++', 'EAGLE', 'Ultrasonic'], status: 'Completed', modalContent: [{ type: 'text', value: 'Contributed to a competitive MATE ROV team by designing and building electronic subsystems for an underwater drone. Utilized EAGLE for PCB design and integrated ultrasonic sensors for complex subsea navigation and task execution.' }] },
  { id: 'd', title: 'Automated Dog Feeder', imageUrl: baseProjectImagePath + 'dogfeeder.webp', tags: ['C', 'Raspberry Pi'], status: 'Completed', modalContent: [{ type: 'text', value: "Designed and built an internet-enabled pet feeder powered by a Raspberry Pi and Firebase. This system allows for remote and scheduled feeding with precise portion control, ensuring a pet's dietary needs are met." }, { type: 'button', text: 'View on Instructables', link: 'https://www.instructables.com/Internet-Enabled-Raspberry-Pi-Pet-Feeder/' }] },
  { id: 'e', title: 'FPGA VGA Game', imageUrl: baseProjectImagePath + 'fpgaVGA.webp', tags: ['Verilog', 'Basys 3 FPGA'], status: 'Completed', modalContent: [{ type: 'text', value: "Developed a 'Flappy Bird' style game on a Basys 3 FPGA using Verilog. This project involved designing digital logic circuits from the ground up to handle game state, player input, and VGA signal generation." }] },
  { id: 'f', title: 'Mechatronics Competition', imageUrl: baseProjectImagePath + 'mechcomp.mp4', tags: ['STM32', 'C++', 'PID Control'], status: 'Completed', modalContent: [{ type: 'text', value: 'Built and programmed an autonomous robot on an STM32 platform for a mechatronics competition. Implemented C++ and fine-tuned PID control algorithms to achieve precise targeting and win a ping pong ball shooting tournament.' }, { type: 'embed', value: baseProjectPdfPath + 'ECE_118_Final_Project_Report.pdf', title: 'Project Documentation PDF' }] },
];

// The four documents from the live /portfolio "Resume, CV, and Transcripts"
// section. Each opens the shared modal with a Google Drive preview embed.
export const resumeDocsData = [
  { id: 'doc-resume', title: 'Resume', embedUrl: 'https://drive.google.com/file/d/1JgvGUhWX4Na0Vs0gropdxC01tM2kRiXc/preview' },
  { id: 'doc-cv', title: 'Extended CV', embedUrl: 'https://drive.google.com/file/d/11WRObmZOizFs6jlhbsQlfv-9DkBqSq0N/preview' },
  { id: 'doc-ug-transcript', title: 'Undergraduate Transcript', badge: 'A', embedUrl: 'https://drive.google.com/file/d/1_QDb00FYIqoaMAUFQp8Ukwiw2WeaYVPg/preview' },
  { id: 'doc-grad-transcript', title: 'Graduate Transcript', badge: 'A+', embedUrl: 'https://drive.google.com/file/d/1wwtghhqCJjWordYjrPYAK1M2VDtH3Nc3/preview' },
];

export const skillGroupsData = [
  // Order is deliberate: the groups robotics / ML / CV roles are screened on
  // come first. Every item is something the owner has actually shipped with;
  // the stack was confirmed from their own resume material, not inferred.
  {
    id: 'ai-ml-data',
    title: 'Machine Learning & Computer Vision',
    cardImageUrl: 'https://api.iconify.design/mdi/brain.svg',
    items: [
      { name: 'PyTorch', imageUrl: deviconsBaseUrl + 'pytorch/pytorch-original.svg', description: 'Training and fine-tuning detection, segmentation and policy models; LoRA fine-tuning.' },
      { name: 'RF-DETR / YOLO / SAM', imageUrl: 'https://api.iconify.design/mdi/eye-check-outline.svg', description: 'Detection and segmentation: RF-DETR & RF-DETR-Seg, RT-DETR, YOLO11/v8/v9, SAM2/SAM3, DINOv2, ByteTrack.' },
      { name: 'Vision-Language-Action', imageUrl: 'https://api.iconify.design/mdi/robot-industrial-outline.svg', description: 'Robot policies: π0/π0.5 (openpi), OpenVLA, SmolVLA, GR00T, ACT, Diffusion Policy — data collection through fine-tuning.' },
      { name: 'JAX / Flax', imageUrl: 'https://api.iconify.design/mdi/function-variant.svg', description: 'openpi-based VLA fine-tuning.' },
      { name: 'OpenCV', imageUrl: deviconsBaseUrl + 'opencv/opencv-original.svg', description: 'Image processing, camera calibration (ChArUco / ArUco / AprilTag), visual servoing.' },
      { name: 'Open3D', imageUrl: 'https://api.iconify.design/mdi/cube-scan.svg', description: 'Point clouds, RGB-D fusion, multi-view TSDF reconstruction, 3D measurement.' },
      { name: 'Depth & 3D Perception', imageUrl: 'https://api.iconify.design/mdi/axis-arrow.svg', description: 'Stereo, ToF and structured-light depth; Depth Anything 3; monocular-vs-stereo metrology trade-offs.' },
      { name: 'Synthetic Data', imageUrl: 'https://api.iconify.design/mdi/shape-plus-outline.svg', description: 'Isaac Sim / Replicator domain randomization, Cosmos generative defect models, dataset packaging and evaluation.' },
      { name: 'Model Optimization', imageUrl: 'https://api.iconify.design/mdi/speedometer.svg', description: 'Neural architecture search, INT8/FP8/NVFP4 quantization, AWQ/GPTQ — for real-time inference on edge hardware.' },
      { name: 'Evaluation', imageUrl: 'https://api.iconify.design/mdi/chart-box-outline.svg', description: 'mAP, precision/recall, F1, PR curves; benchmark methodology for vision models.' },
      { name: 'LLM & Gen-AI', imageUrl: 'https://api.iconify.design/mdi/robot-outline.svg', description: 'Local and hosted LLMs (vLLM, llama.cpp, Ollama), agent sandboxes, OpenAI / Gemini / Claude APIs.' },
      { name: 'Python (Scientific)', imageUrl: deviconsBaseUrl + 'python/python-original.svg', description: 'NumPy/SciPy numerical work, data pipelines, ML tooling.' },
    ]
  },
  {
    id: 'edge-deployment',
    title: 'Edge AI & Deployment',
    cardImageUrl: 'https://api.iconify.design/mdi/chip.svg',
    items: [
      { name: 'NVIDIA Jetson', imageUrl: 'https://api.iconify.design/mdi/developer-board.svg', description: 'Orin Nano / NX / AGX and AGX Thor: JetPack 5–7, L4T flashing, BSP patching, device trees, power modes.' },
      { name: 'TensorRT', imageUrl: 'https://api.iconify.design/mdi/lightning-bolt-outline.svg', description: 'Engine building and optimization for real-time edge inference.' },
      { name: 'ONNX Runtime', imageUrl: 'https://api.iconify.design/mdi/graph-outline.svg', description: 'Portable model export and inference.' },
      { name: 'Roboflow Inference & Workflows', imageUrl: 'https://api.iconify.design/mdi/vector-polygon.svg', description: 'Model serving, Workflows pipelines, active learning, offline / air-gapped deployment.' },
      { name: 'Docker', imageUrl: deviconsBaseUrl + 'docker/docker-original.svg', description: 'Containerized edge stacks, nvidia-container-toolkit, OCI registries.' },
      { name: 'DGX Spark', imageUrl: 'https://api.iconify.design/mdi/server-outline.svg', description: 'GB10 / aarch64 development and local model serving.' },
      { name: 'Fleet Networking', imageUrl: 'https://api.iconify.design/mdi/lan.svg', description: 'Tailscale, GigE Vision subnets, jumbo frames, multi-NIC routing, PoE/UPOE, 10GbE and QSFP28 breakout.' },
      { name: 'Observability', imageUrl: 'https://api.iconify.design/mdi/monitor-dashboard.svg', description: 'Grafana / Loki, TimescaleDB, Redis, deployment monitoring dashboards.' },
      { name: 'Linux Systems', imageUrl: deviconsBaseUrl + 'linux/linux-original.svg', description: 'Ubuntu 22.04/24.04, drivers and kernels, systemd, udev, DKMS.' },
    ]
  },
  {
    id: 'robotics-control',
    title: 'Robotics & Control Systems',
    cardImageUrl: 'https://api.iconify.design/mdi/robot-industrial.svg',
    items: [
      { name: 'ROS 2', imageUrl: 'https://api.iconify.design/simple-icons/ros.svg', description: 'Jazzy / Humble; ROS-based drones and manipulators.' },
      { name: 'Robot Arms', imageUrl: 'https://api.iconify.design/mdi/robot-industrial-outline.svg', description: 'UFACTORY xArm 5, Franka Emika, Standard Bots RO1, SO-ARM101, GELLO leader arms.' },
      { name: 'Teleoperation & Data Collection', imageUrl: 'https://api.iconify.design/mdi/gamepad-variant-outline.svg', description: 'Bimanual LeRobot rigs, leader-follower arms, Dynamixel / Feetech servos, SpaceMouse and VR-controller teleop.' },
      { name: 'Hand-Eye Calibration', imageUrl: 'https://api.iconify.design/mdi/target.svg', description: 'ChArUco / ArUco / AprilTag camera-to-robot calibration.' },
      { name: 'Isaac Sim / Isaac Lab', imageUrl: 'https://api.iconify.design/mdi/cube-outline.svg', description: 'Simulation, Replicator synthetic data, URDF import, Real2Sim.' },
      { name: 'MuJoCo & Webots', imageUrl: 'https://api.iconify.design/mdi/cube-send.svg', description: 'Physics simulation for manipulation and mobile robots.' },
      { name: 'Kinematics', imageUrl: 'https://api.iconify.design/mdi/vector-line.svg', description: 'Forward/inverse kinematics and path planning.' },
      { name: 'PID Control', imageUrl: 'https://api.iconify.design/mdi/tune-variant.svg', description: 'Feedback control for flight, motion and servo systems.' },
      { name: 'Kalman Filtering', imageUrl: 'https://api.iconify.design/mdi/chart-bell-curve-cumulative.svg', description: 'State estimation and sensor fusion.' },
      { name: 'Pixhawk / PX4', imageUrl: 'https://api.iconify.design/mdi/quadcopter.svg', description: 'Pixhawk 6x autonomous drone flight control.' },
    ]
  },
  {
    id: 'machine-vision-hw',
    title: 'Machine Vision Hardware',
    cardImageUrl: 'https://api.iconify.design/mdi/camera-iris.svg',
    items: [
      { name: 'Industrial Cameras', imageUrl: 'https://api.iconify.design/mdi/camera-outline.svg', description: 'LUCID Triton / Triton2 / Helios, Basler ace2 / blaze, Orbbec, RealSense, ZED, Zivid, Photoneo — area-scan, line-scan and depth.' },
      { name: 'GigE Vision / GenICam', imageUrl: 'https://api.iconify.design/mdi/ethernet.svg', description: 'GigE (1–10G), USB3 Vision, CoaXPress, MIPI CSI-2, GMSL2; Arena SDK and pylon.' },
      { name: 'Line-Scan & Triggering', imageUrl: 'https://api.iconify.design/mdi/barcode-scan.svg', description: 'Encoder-triggered line-scan capture for moving product on conveyors and thermoforming lines.' },
      { name: 'Optics', imageUrl: 'https://api.iconify.design/mdi/circle-double.svg', description: 'FOV / DOF / MTF calculation, telecentric and varifocal lens selection, cross-polarization; built a lens calculator.' },
      { name: 'Industrial Lighting', imageUrl: 'https://api.iconify.design/mdi/lightbulb-on-outline.svg', description: 'Line, coaxial and IP67 lighting with strobe controllers; 24V and PoE power budgeting.' },
      { name: 'PLC Integration', imageUrl: 'https://api.iconify.design/mdi/connection.svg', description: 'Allen-Bradley over EtherNet/IP; controls-integration standards and installation runbooks.' },
    ]
  },
  {
    id: 'programming-software',
    title: 'Programming & Software Development',
    cardImageUrl: 'https://api.iconify.design/mdi/code-braces-box.svg',
    items: [
      { name: 'Python', imageUrl: deviconsBaseUrl + 'python/python-original.svg', description: 'Primary language for ML, robotics and tooling.' },
      { name: 'C', imageUrl: deviconsBaseUrl + 'c/c-original.svg', description: 'Embedded firmware, register-level MCU work.' },
      { name: 'C++', imageUrl: deviconsBaseUrl + 'cplusplus/cplusplus-original.svg', description: 'ROS nodes, control loops, performance-critical code.' },
      { name: 'JavaScript / React', imageUrl: deviconsBaseUrl + 'react/react-original.svg', description: 'Web tooling, dashboards, this site (React, Three.js / R3F).' },
      { name: 'Bash', imageUrl: deviconsBaseUrl + 'bash/bash-original.svg', description: 'Provisioning scripts, device automation, CI.' },
      { name: 'SQL', imageUrl: 'https://api.iconify.design/mdi/database-outline.svg', description: 'Relational and time-series data (TimescaleDB).' },
      { name: 'Verilog', imageUrl: 'https://api.iconify.design/mdi/chip.svg', description: 'FPGA digital design (Basys 3).' },
      { name: 'Java', imageUrl: deviconsBaseUrl + 'java/java-original.svg', description: 'Object-oriented development, Android.' },
      { name: 'MATLAB', imageUrl: deviconsBaseUrl + 'matlab/matlab-original.svg', description: 'Numerical computing, real-time sensor visualization.' },
      { name: 'Git & GitHub Actions', imageUrl: deviconsBaseUrl + 'git/git-original.svg', description: 'Version control and CI/CD.' },
      { name: 'LaTeX', imageUrl: 'https://api.iconify.design/mdi/format-text.svg', description: 'Technical writing, proposals, forms.' },
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
      { name: 'Nordic nRF54L15 / Zephyr', imageUrl: 'https://api.iconify.design/mdi/bluetooth.svg', description: 'Zephyr / nRF Connect SDK IMU firmware with real-time visualization.' },
      { name: 'STM32 (H5, CubeIDE, HAL)', imageUrl: baseSkillImagePath + 'STM32.webp', description: 'Affordable boards with STM32 MCUs (ARM Cortex-M) for prototyping and concept testing.' },
      { name: 'ESP32/8266', imageUrl: baseSkillImagePath + 'ESP32.jpg', description: 'Low-cost Wi-Fi & Bluetooth/BLE MCUs for IoT, home automation, and wireless sensors.' },
      { name: 'Infineon PSoC 4', imageUrl: baseSkillImagePath + 'psoc4.jpg', description: 'Programmable System-on-Chip with ARM Cortex-M0/M0+ and programmable analog/digital blocks.' },
      { name: 'Parallax Propeller', imageUrl: baseSkillImagePath + 'propeller.jpg', description: 'Multicore MCU with eight 32-bit cores for true parallel processing and deterministic timing.' },
      { name: 'Jetson Nano', imageUrl: baseSkillImagePath + 'jetsonnano.jpg', description: 'Small, powerful computer for accelerated AI in embedded apps like image classification.' },
      { name: 'Comm Protocols', imageUrl: 'https://api.iconify.design/mdi/serial-port.svg', description: 'Rules for data transmission (I2C, SPI, UART, CAN, Ethernet, Wi-Fi, Bluetooth).' },
      { name: 'Altium Designer', imageUrl: baseSkillImagePath + 'altium-designer.png', description: 'EDA software for PCB, FPGA, and embedded software design in a unified environment.' },
      { name: 'Autodesk EAGLE', imageUrl: baseSkillImagePath + 'EAGLE.jpg', description: 'EDA tool for schematic capture, PCB layout, auto-router, and CAM features.' },
      { name: 'ORcad x Capture', imageUrl: baseSkillImagePath + 'OrCADCapture.webp', description: 'Cadence EDA tools for designing ICs, SoCs, and PCBs.' },
      { name: 'Pspice/LTspice', imageUrl: baseSkillImagePath + 'LTspice.png', description: 'SPICE-based analog circuit and digital logic simulation program for design verification.' }
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
      { name: 'ATI Multi-Axis Force/Torque', imageUrl: 'https://api.iconify.design/mdi/axis-arrow.svg', description: 'Measures all six components of force/torque for robotics, haptics, product testing.' },
      { name: 'IMU', imageUrl: 'https://api.iconify.design/mdi/rotate-orbit.svg', description: "Measures body's specific force, angular rate, and orientation using accelerometers/gyroscopes." },
      { name: 'Ultrasonic', imageUrl: 'https://api.iconify.design/mdi/signal-distance-variant.svg', description: 'Measures distance by emitting/receiving ultrasonic waves for object detection/avoidance.' },
      { name: 'Flex Sensor', imageUrl: 'https://api.iconify.design/mdi/vector-curve.svg', description: 'Variable resistor that changes resistance when bent, used to detect flexing motions.' },
      { name: 'Capacitive', imageUrl: 'https://api.iconify.design/mdi/gesture-tap.svg', description: 'Detects changes in capacitance for touch sensing, proximity detection, liquid level sensing.' },
      { name: 'Piezoelectric', imageUrl: 'https://api.iconify.design/mdi/flash.svg', description: 'Generates electric charge from mechanical stress; used as pressure sensors, accelerometers.' },
      { name: 'Test Automation', imageUrl: 'https://api.iconify.design/mdi/play-box-multiple-outline.svg', description: 'Using software to execute pre-scripted tests for quality assurance and faster development cycles.' }
    ]
  }
];
