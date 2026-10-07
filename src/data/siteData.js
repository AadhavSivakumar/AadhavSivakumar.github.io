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
const baseExperiencePath = '/Media/web/experience/';   // the experience cards' videos (and their -poster.webp): clips of each organisation's own marketing video
const baseSkillImagePath = '/Media/skills/';
// each project's other media (the modal's gallery): web-sized copies of the
// originals in Media/projects/<dir>, the same sets /portfolio shows
const gal = (dir, names) => names.map(n => `/Media/web/gallery/${dir}/${n}`);

export const aboutMeData = {
  id: 'about-me-section',
  type: 'about',
  cardTitle: 'Aadhav Sivakumar',
  cardTeaser: "Robotics engineer. AI Engineer at Roboflow; graduate researcher in NYU Tandon's LAIR lab; MS Mechatronics & Robotics, NYU.",
  imageUrl: '/Media/web/Gradpic.webp',
  modalTitle: 'Aadhav Sivakumar',
  modalContent: [
    { type: 'text', value: "Hello! My name is Aadhav Sivakumar, and this website is meant to showcase projects I've worked on in the past, and projects that I'm currently working on. You're also able to view my resume, an extended CV, or look through the different skills, software, and hardware I have worked with previously." },
    { type: 'text', value: "I'm a robotics engineer working toward embodied AI — vision-language-action models, world models, reinforcement learning and simulation — from the vision side in. At Roboflow (Edge AI engineering team, New York, Jan–Sep 2026) I trained and shipped detection and segmentation models on NVIDIA Jetson for manufacturing lines, built the vision-guided xArm 5 demos Roboflow showed at NVIDIA GTC and CVPR 2026, generated synthetic training data with NVIDIA's Cosmos-based AnomalyGen, evaluated NVIDIA's Cosmos world models for on-device use, and proposed Detection-Grounded Action Models, a VLA built on a frozen perception stack. In parallel I was a graduate researcher in NYU Tandon's LAIR lab under Professor Christopher Clark, fine-tuning π0 and π0.5 policies and building a Gaussian-splat Real2Sim pipeline in Isaac Sim." },
    { type: 'text', value: "I earned my MS in Mechatronics and Robotics at NYU Tandon and TA'd Math for Robotics, Foundations of Robotics and Mechatronics there. Before that I was a Robot Technician at Starship Technologies, keeping a delivery-robot fleet running out of the Fordham University hub in the Bronx, and I did my BS in Robotics Engineering with a minor in Electrical Engineering at UC Santa Cruz, including tactile-sensing research in the Tactile Manipulation Lab. I grew up in the Bay Area." },
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
  // Rows in the order the owner asked for. `badge` names the lanyard card
  // (badgeCards.js) that hangs beside the row. `group` says which page the
  // row is on: 'industry' is the Experience page (Roboflow, Starship),
  // 'research' the Research page (NYU, UCSC) — two rows per page, each page
  // one screen. The card shows the summary and the first two bullets; the
  // whole entry opens in the modal.
  {
    id: 'exp-roboflow',
    group: 'industry',
    badge: 'Roboflow',
    video: baseExperiencePath + 'roboflow.mp4',
    // The owner's own work footage (their Drive folder, Sept 30), shown in the
    // modal: silent, web-sized; the screen recording cropped to the app.
    gallery: gal('x_roboflow', ['15.mp4', '1.mp4', '2.mp4', '13.mp4', '14.mp4', '11.mp4', '12.mp4', '5.mp4', '6.mp4', '10.mp4', '7.mp4', '8.mp4', '9.mp4']),
    org: 'Roboflow',
    role: 'AI Engineer',
    degree: 'Edge AI engineering team · Solutions R&D',
    location: 'New York, NY',
    period: 'Jan 2026 – Sep 2026',
    summary: 'Vision at the edge and the robotics built on it: detection and segmentation models trained and shipped on NVIDIA Jetson, vision-guided manipulation, synthetic data from NVIDIA\'s world models, and a proposal for VLAs grounded in detection.',
    bullets: [
      'Trained and shipped detection, instance-segmentation and keypoint models for production — including an RF-DETR-Seg part-presence model at 94.2% mAP@50 and 93.8% F1 over 11 classes, tuned through a 560-candidate neural architecture search and taken from ~5 to 9.5–11.5 FPS per stream with TensorRT.',
      'Proposed Detection-Grounded Action Models: a VLA whose learned vision encoder is replaced by a frozen detection, segmentation and depth stack emitting per-object tokens (class, mask, 3D pose, affordance keypoints) to a language-conditioned action decoder; wrote the v0.1 plan on an xArm 5 with GELLO teleoperation and ACT-style chunked actions.',
      'Evaluated NVIDIA\'s Cosmos world-model family — architecture, training scale, benchmarks, licensing — and planned its on-device evaluation on Jetson Thor and DGX Spark, including the distill-down deployment path.',
      'Co-led synthetic defect-data generation with NVIDIA\'s AnomalyGen (few-shot diffusion inpainting on a frozen Cosmos-Predict2 2B DiT with a DINOv2 mask encoder): owned defect injection, dataset packaging and train/eval scorecards, and established iteration count, not dataset size, as the dominant training variable.',
      'Designed a robot-control container for the edge stack, so an arm is driven directly from Roboflow Workflows — perception outputs mapped to motion commands — demonstrated as vision-guided pick-and-place on an xArm 5.',
      'Built the booth demos and enablement: a vision-guided xArm 5 pick-and-place demo for NVIDIA GTC 2026, the CVPR 2026 industrial demo kit, a public quality-control webinar, and study guides for the edge stack.',
      'Delivered industrial computer-vision systems end to end in healthcare manufacturing, food and beverage, poultry and automotive: camera and lens selection, deployment architecture, PLC and controls integration, commissioning and onsite support.',
      'Owned edge deployment across the Jetson Orin and Thor lines: BSP/JetPack image work on industrial carriers, a five-container device-manager stack, fleet networking, PoE camera networks, and on-device latency, memory and power profiling.',
      'Technical lead for a robot-arm partner\'s integration: root-caused offline and air-gapped inference failures and produced the onsite field kit — architecture diagrams, verified x86 and Jetson commands, the air-gap warm-up procedure.',
      'Specified a metrology-grade rivet and seam inspection rig for vehicles in motion (±1 mm over 1,524 mm): a sensor trade study across structured light, ToF, line-scan and monocular depth, then a 16.2 MP camera at 0.343 mm/px with cross-polarized lighting.',
    ],
    tags: ['RF-DETR', 'VLA', 'Cosmos', 'NVIDIA Jetson', 'TensorRT', 'xArm 5', 'LeRobot', 'PyTorch'],
  },
  {
    id: 'exp-starship',
    group: 'industry',
    badge: 'Starship',
    video: baseExperiencePath + 'starship.mp4',
    org: 'Starship Technologies',
    role: 'Robot Technician',
    degree: 'Fordham University hub',
    location: 'Bronx, NY',
    period: 'Aug 2025 – Jan 2026',
    summary: 'Kept a live fleet of autonomous sidewalk-delivery robots running: root-causing faults, repairing and calibrating perception sensors, and bringing new units into service.',
    bullets: [
      'Ran root-cause analysis on recurring hardware and software faults and put in long-term fixes that cut specific error rates and kept the fleet healthy.',
      'Wrote Python and Bash diagnostic scripts to triage faults in the field, cutting robot downtime by 50%.',
      'Calibrated camera and lidar sensors after repair and re-verified obstacle detection and localization before returning units to autonomous operation.',
      'Replaced components down to the board level — circuit boards, lidar and camera sensors, power systems — to restore full function.',
      'Assembled, tested and calibrated new robots to specification before they joined the active fleet.',
      'Ran preventive maintenance and pre-deployment inspections across the hub\'s fleet to sustain daily delivery operations.',
      'Documented recurring failure modes and escalated issues to the engineering teams with logs and reproduction steps.',
    ],
    tags: ['Fleet Robotics', 'Lidar & Camera Calibration', 'Root-Cause Analysis', 'Python', 'Bash'],
  },
  {
    id: 'exp-nyu',
    group: 'research',
    badge: 'NYU',
    video: baseExperiencePath + 'nyu-tandon.mp4',
    org: 'NYU Tandon School of Engineering',
    role: 'Graduate Robotics Researcher · LAIR',
    degree: 'MS, Mechatronics and Robotics · GPA 3.95',
    location: 'Brooklyn, NY',
    period: '2024 – 2026',
    summary: 'Robot learning in the LAIR lab, advised by Professor Christopher Clark — VLA fine-tuning, Real2Sim digital twins, teleoperation data — alongside the master\'s degree and three courses as a graduate TA.',
    bullets: [
      'Helped fine-tune π0 and π0.5 VLA policies (openpi / JAX) on bimanual teleoperation data, reaching 86.7% success on cube-in-box against 13% for an ACT baseline, with an evaluation protocol, a data-scaling sweep and out-of-distribution evals.',
      'Built an Isaac Sim Real2Sim pipeline that turns 3D Gaussian Splatting scans of the lab into simulation-ready digital twins, then used scripted planners to generate 1,000+ randomized demonstrations at 100% in-sim success.',
      'Built a bimanual SO-ARM101 teleoperation and data-collection pipeline on Jetson Orin Nano (LeRobot, Feetech servos, per-arm calibration, persistent device naming).',
      'Built and deployed a BlueROV2 for 3D reconstruction of underwater shipwrecks, with an Isaac Sim and OceanSim environment for mission planning.',
      'Contributed the technical write-up for the lab\'s Google TPU research award application (openpi, Tunix, vLLM on TPU).',
      'Graduate TA for Math for Robotics, Foundations of Robotics and Mechatronics (50+ students): wrote the UR10e MuJoCo kinematics final project and the STM32 (NUCLEO-H503RB) Mechatronics midterm practical.',
    ],
    tags: ['π0 / π0.5', 'Isaac Sim', 'Gaussian Splatting', 'LeRobot', 'openpi / JAX'],
    // the owner's own LAIR footage (Oct 6), in pipeline order: VR
    // teleoperation of the bimanual robot (4), the teleop view (1), a
    // simulated training demonstration (2), an ACT policy's successful
    // cube-in-box rollout (3); then the lab: setting up the SO-ARM101
    // stations (5) and the workstation (6), unboxing (7) and wiring (8) the
    // BlueROV2, and its OceanSim / Isaac Sim mission environment (9)
    gallery: gal('x_nyu', ['4.mp4', '1.mp4', '2.mp4', '3.mp4', '5.mp4', '6.mp4', '7.mp4', '8.mp4', '9.mp4']),
  },
  {
    id: 'exp-ucsc',
    group: 'research',
    badge: 'UCSC',
    video: baseExperiencePath + 'ucsc-baskin.mp4',
    org: 'University of California, Santa Cruz',
    role: 'Undergraduate Research Assistant · TML',
    degree: 'BS, Robotics Engineering · Minor in EE · GPA 3.8',
    location: 'Santa Cruz, CA',
    period: '2020 – 2024',
    summary: 'Soft-robotics sensing in the Tactile Manipulation Lab with Professor Tae Myung Huh, a vision-guided compost-sorting capstone, and Robotics Engineering with an electrical-engineering minor.',
    bullets: [
      'Tactile Manipulation Lab (Prof. Tae Myung Huh): engineered a complete sensing solution for a soft robotic end-effector — a flexible PCB with an Infineon (Cypress) CapSense chip under custom-molded, cured silicone, detecting both shear and normal forces — mounted on a robot arm so objects are sensed and grasped at the same time, with controlled pressure.',
      'Senior capstone, SMART compost sorting: OpenCV and DexNet tell compost from contaminant, and the depth camera\'s 3D output is mapped into the arm\'s joint space to pick contaminants out.',
      'Stockbot (Models of Robotic Manipulation): PID control on every joint of a 7-DOF Franka Panda for multi-item pick-and-place, with telemetry benchmarking cycle time and success against human trials.',
      'Set up the lab: laser cutters, robot arms, 3D and stereolithography printers, silicone molding, and a CUDA workstation (RTX 3090) for computer vision.',
      'Tutored and graded 100+ students in circuits, logic design and mechatronics, and taught a 3-credit electronics elective through the Sustainability Lab.',
    ],
    tags: ['Tactile Sensing', 'Soft Robotics', 'Capacitive Sensing', 'Altium Designer', 'OpenCV', 'Franka Panda', 'PID Control'],
    // the tactile-sensor footage (it was its own Additional Projects card until
    // Oct 6, the owner: "put everything from tactile manipulation sensor within
    // the undergraduate research assistant card")
    gallery: [baseProjectImagePath + 'tacmanipHQ.mp4', ...gal('e_tactilemanipulation', ['1.mp4', '2.webp', '3.webp', '4.mp4', '5.mp4'])],
    links: [
      { text: 'Tactile Manipulation Lab', link: 'https://tml.engineering.ucsc.edu/' },
      { text: 'Lab research: dexterous manipulation', link: 'https://tml.engineering.ucsc.edu/research/dexterous-manipulation/' },
    ],
  },
];

export const majorProjectsData = [
  { id: 'rl', title: 'Reinforcement Learning: Go2 Locomotion', cardDescription: 'A quadruped learning to walk: a PPO locomotion policy for the Unitree Go2 in Isaac Lab, shaped into a real gait with a hand-written PD torque controller, early termination, Raibert-heuristic foot placement, clearance and contact rewards, and randomised joint friction. NYU Reinforcement Learning and Optimal Control, with Nate Smurthwaite and Dana Sy-Ching.', imageUrl: baseProjectImagePath + 'rlgo2.mp4', tags: ['Isaac Lab', 'PPO', 'Unitree Go2', 'MPC'], gallery: gal('l_reinforcementlearning', ['2.mp4', '3.mp4', '4.mp4', '5.mp4', '6.webp']), status: 'Completed', modalContent: [{ type: 'text', value: "The final project of NYU's Reinforcement Learning and Optimal Control (ROB-GY 6323), built with Nate Smurthwaite and Dana Sy-Ching: a velocity-tracking locomotion policy for the Unitree Go2 quadruped, trained with PPO (rsl_rl) in Isaac Lab on NYU's HPC cluster." }, { type: 'text', value: "The base task rewards only velocity and yaw tracking, so the robot learned jerky micro-steps. Shaping it into a walk: a penalty on action rate; a hand-written PD controller with torque limits in place of the simulator's; early termination when the base drops too low, so failed episodes stop costing samples; the Raibert heuristic for a structured trot; penalties on body tilt, vertical bounce and joint velocity; foot-clearance and contact-force rewards; and stiction and viscous joint friction randomised per episode, for a policy that holds up off the simulator." }, { type: 'text', value: 'The course work behind it: trajectory optimisation (SQP) and model predictive control for a quadrotor, optimal control of a planar manipulator and a pendulum, and value iteration on a grid world.' }, { type: 'button', text: 'Go2 project on GitHub', link: 'https://github.com/AadhavSivakumar/rob6323_go2_project' }] },   // the course-work repo is PRIVATE (a 404 for visitors), so it is not linked
  { id: 4, title: 'SMART compost sorting', cardDescription: 'Robotic sorting for contaminated compost streams on the UC Santa Cruz campus: OpenCV and DexNet tell compost from contaminant, and transformation matrices map the depth camera\'s 3D output into the arm\'s joint space so it can pick contaminants out. Senior capstone.', imageUrl: baseProjectImagePath + 'smartsort.mp4', tags: ['OpenCV', 'DexNet', 'Depth Camera', 'Franka Emika Robot'], gallery: gal('d_SMARTcompost', ['1.mp4', '2.mp4', '3.mp4', '4.mp4', '5.mp4', '6.mp4', '7.mp4', '8.mp4']), status: 'Completed', modalContent: [{ type: 'text', value: 'A solution for contaminated compost streams on the UC Santa Cruz campus. OpenCV with DexNet decides compost versus contaminant, and a robot arm removes what does not belong.' }, { type: 'text', value: 'The depth camera\'s output is mapped into 3D space and, through transformation matrices, into the robot\'s joint space, so a detection in the image becomes a grasp. My senior capstone.' }, { type: 'embed', value: baseProjectPdfPath + 'Capstone_final_report.pdf', title: 'Project Documentation PDF' }] },
  { id: 6, title: 'Stockbot: Grocery Robotics', cardDescription: 'A grocery-restocking pick-and-place workcell on a 7-DOF Franka Panda: PID control on every joint, multi-item picking, and telemetry that benchmarks cycle time and task success against human trials. The final project for Models of Robotic Manipulation at UCSC.', imageUrl: baseProjectImagePath + 'stockbot.mp4', tags: ['Franka Panda', 'PID Control', 'Python', 'MuJoCo'], status: 'Completed', modalContent: [{ type: 'text', value: 'A multi-item pick-and-place testing environment for grocery restocking, built on a 7-degree-of-freedom Franka Panda with a PID-based feedback controller in each joint.' }, { type: 'text', value: 'The workcell logs and analyzes real-time performance telemetry — cycle times and task success rates — as a validation framework that benchmarks the system against human trials. The final project for ECE215, Models of Robotic Manipulation, at UC Santa Cruz.' }, { type: 'button', text: 'View Project', link: 'https://sites.google.com/ucsc.edu/stockbot/home' }] },
  { id: 'h', title: 'UR10e Kinematics in MuJoCo', cardDescription: "Forward and inverse kinematics — position and velocity — for a 6-DOF Universal Robots UR10e arm, simulated in MuJoCo with Python, then put to work as a 3D 'Fruit Ninja' in which the end effector strikes fruit. Created as the final project for Foundations of Robotics students while I was the course's TA at NYU.", imageUrl: baseProjectImagePath + 'fruitninja.mp4', tags: ['Python', 'MuJoCo', 'Kinematics', 'UR10e'], gallery: gal('h_ur10emujocosim', ['1.mp4', '2.mp4', '3.mp4', '4.mp4', '5.mp4']), status: 'In Progress', modalContent: [{ type: 'text', value: "Built a MuJoCo simulation of a 6-DOF Universal Robots UR10e arm in Python, implementing forward and inverse kinematics for both position and velocity. The same model then drives a 3D 'Fruit Ninja': fruit is spawned in the arm's workspace and the end effector is steered to strike it. MuJoCo handles control and collisions. I created it as the final project for Foundations of Robotics students while TA'ing the course at NYU." }, { type: 'button', text: 'View on GitHub', link: 'https://github.com/AadhavSivakumar/MujocoSim' }] },
];

export const smallProjectsData = [
  // The Roboflow webinar, first: it is the one piece of public speaking on
  // the site and it is about the current job. The cover is a 7.5 s loop cut
  // from the recording itself (Roboflow's YouTube, 3:03-3:10.5: the Lucid
  // camera's live detections and parts count, cropped above the face-cam).
  { id: 'k', title: 'Roboflow Webinar: Part-Presence Inspection', imageUrl: baseProjectImagePath + 'webinar.mp4', tags: ['RF-DETR-Seg', 'NVIDIA Jetson', 'Roboflow'], status: 'Completed', modalContent: [
    { type: 'text', value: 'A public Roboflow webinar on quality-control vision for manufacturing: checking that every component is present on an assembly, in real time, at the edge. It walks the whole pipeline — capturing images on the line, annotating parts and missing parts, training a custom model, running inference on NVIDIA Jetson, verifying part presence automatically and flagging what is missing for inspection.' },
    { type: 'text', value: 'The demo behind it is a two-camera inspection cell (a LUCID Triton and a Basler ace 2 on an NVIDIA Jetson) that verifies every component is present on an automotive intake manifold and carburetor kit, alerting through a custom HMI. Its RF-DETR-Seg model covers 11 classes, trained on 536 labeled images and 6,063 annotations (augmented to 1,238 images), and reaches 94.2% mAP@50, 94.2% precision and 93.4% recall.' },
    { type: 'text', value: 'Throughput went from ~5 FPS to 9.5–11.5 FPS per stream with TensorRT, a 432×432 input, sensor-side ROI cropping and cheaper mask visualization. The bench hardware was designed for it too: a single-axis belt-drive motion stage, telecentric lens selection with a coverage calculator, and coaxial lighting.' },
    // The recording, on Roboflow's YouTube channel ("Build a Missing Part
    // Detection System with Computer Vision"), from where the owner's link
    // starts (1:36). youtube-nocookie sets no cookies until it is played.
    { type: 'embed', value: 'https://www.youtube-nocookie.com/embed/MZzjyfUTV4E?start=96&rel=0', title: 'Build a Missing Part Detection System with Computer Vision (Roboflow webinar)' },
    { type: 'button', text: 'Watch on YouTube', link: 'https://www.youtube.com/watch?v=MZzjyfUTV4E&t=96s' },
  ] },
  { id: 3, title: 'Glass-2-Bot', cardDescription: 'Hands-free robot control from a Google Glass: 720p video streams from a Glass Explorer Edition to a Raspberry Pi, where object detection lets the wearer choose an item in real time, and a 3D-printed mobile manipulator drives to it and grasps it. The Advanced Mechatronics final project at NYU.', imageUrl: baseProjectImagePath + 'glass2bot.mp4', tags: ['Google Glass', 'Object Detection', 'Raspberry Pi', 'Arduino'], gallery: gal('c_glass2bot', ['1.mp4', '2.mp4', '3.mp4']), status: 'Completed', modalContent: [{ type: 'text', value: 'A hands-free interface for a mobile manipulator: 720p video streams from a (deprecated) Google Glass Explorer Edition to a Raspberry Pi, where object detection lets the wearer select an item in real time.' }, { type: 'text', value: 'The robot is a modified, 3D-printed open-source mobile manipulator with a dual-microcontroller architecture: the Raspberry Pi handles computer vision, and an Arduino programmed in C++ runs a state machine for autonomous navigation and grasping. The last project of the Advanced Mechatronics course at NYU.' }, { type: 'embed', value: baseProjectPdfPath + 'Adv__Mechatronics_Final_Report.pdf', title: 'Project Documentation PDF' }] },
  { id: 1, title: 'Project Millet', cardDescription: 'A 3D-SLAM drone with autonomous landing for orchard spraying, paired with a ground vehicle carrying the liquid payload. Master\'s project, in progress.', imageUrl: baseProjectImagePath + 'Millet.mp4', tags: ['Pixhawk', 'NVIDIA Jetson', 'RealSense', 'SLAM'], gallery: gal('a_millet', ['1.mp4', '2.mp4', '3.mp4', '4.mp4']), status: 'In Progress', modalContent: [{ type: 'text', value: 'A Pixhawk drone to test auto-administering pesticides through an orchard, working with a ground vehicle (UGV) that carries the liquid payload and a drone with a high-powered sprayer.' }, { type: 'text', value: 'A small drone for planning and a large one for experiments are both in development. An NVIDIA Jetson with an Intel RealSense 3D camera handles 3D SLAM, path planning, object recognition and autonomous landing. My master\'s project at NYU.' }] },
  { id: 2, title: 'SoleGait Foot Sensor', cardDescription: 'A smart shoe sole that tracks the gait and pressure of your foot as you walk or run. Won the Best Technical Design Award at NYU Tandon's 2025 Capstone Pitch Contest.', imageUrl: baseProjectImagePath + 'solegaitvidmute.mp4', tags: ['nRF54L15', 'Zephyr', 'IMU', 'MATLAB'], gallery: gal('b_solegait', ['1.mp4']), status: 'Completed', modalContent: [{ type: 'text', value: 'A smart shoe sole that tracks gait and foot pressure while walking or running. Force sensors feed an Arduino Uno, which streams force and gyroscope data over UART to a computer for a real-time MATLAB display.' }, { type: 'text', value: 'The sensing node was then ported to a Seeed XIAO nRF54L15 Sense running Zephyr under the nRF Connect SDK, streaming 104 Hz IMU data to a MATLAB viewer with a complementary filter for real-time 3D attitude. It won the Best Technical Design Award at NYU Tandon's 2025 Capstone Pitch Contest.' }, { type: 'embed', value: baseProjectPdfPath + 'Biomedical_devices_research_paper.pdf', title: 'Project Documentation PDF' }, { type: 'button', text: 'View on GitHub', link: 'https://github.com/AadhavSivakumar/SoleGait' }] },
  { id: 'rp', title: 'Robot Perception', imageUrl: baseProjectImagePath + 'robotperception.mp4', tags: ['OpenCV', 'Open3D', 'YOLO'], gallery: gal('m_robotperception', ['2.webp', '3.mp4', '4.webp', '5.webp']), status: 'Completed', modalContent: [{ type: 'text', value: "NYU's Robot Perception (ROB-GY 6203), the core algorithms written by hand: RANSAC plane fitting and ICP registration on point clouds (Open3D, KITTI scans), epipolar geometry and fundamental-matrix estimation from two photographs, multi-object tracking with YOLO detections and IoU association, marker-based pose estimation with a cube rendered onto the tag, visual place recognition over street-level images, and an autoencoder's latent space visualised with t-SNE." }, { type: 'text', value: "The final project maps a maze from a robot's own camera: edge detection finds the walls to its left, front and right, frame-to-frame motion tracks its heading and grid position, and the two together build an occupancy map of the maze." }, { type: 'button', text: 'View on GitHub', link: 'https://github.com/AadhavSivakumar/Robot-Perception' }] },
  // Cover: the SO-ARM101 as this site's robot animation draws it (TheRobotStudio's
  // CAD), a stand-in until the owner supplies footage of the real rig.
  { id: 'g', title: 'Bimanual SO-ARM101 Teleoperation', imageUrl: baseProjectImagePath + 'so101.webp', tags: ['LeRobot', 'Jetson Orin Nano', 'Feetech STS3215'], status: 'Completed', modalContent: [{ type: 'text', value: "A bimanual SO-ARM101 teleoperation and data-collection pipeline in NYU's LAIR lab, running on a Jetson Orin Nano: leader-follower teleoperation of two arms on LeRobot 0.5.2 and Feetech STS3215 servos, with per-arm calibration and persistent udev device names, so every arm comes back as itself after a reboot and recorded episodes land in the LeRobot dataset format, ready for imitation learning." }] },
  // PONG, the Sand Table and the ASL glove, combined at the owner's request
  // (Oct 6). Ids 'a', 'b', 'm' retired; this keeps 'b' (PONG's cover leads).
  { id: 'b', title: 'Advanced Mechatronics', imageUrl: baseProjectImagePath + 'PONG.mp4', tags: ['Arduino Mega', 'Parallax Propeller', 'Inverse Kinematics', 'BASIC Stamp 2', 'Fusion 360'], gallery: [baseProjectImagePath + '2rplanarstraight.mp4', ...gal('i_sandtable', ['1.mp4', '2.mp4', '3.mp4', '4.mp4', '5.mp4']), baseProjectImagePath + 'aslglove.webp'], status: 'Completed', modalContent: [
    { type: 'text', value: 'Three builds from the mechatronics sequence at NYU, each taken from concept to a working machine.' },
    { type: 'text', value: 'PONG — a portable Pong game on an Arduino Mega, with code optimized around LED-matrix mapping and memory limits, in a custom console chassis with ergonomic controllers designed in Fusion 360, laser-cut and 3D-printed — from validation to final testing in three weeks. Advanced Mechatronics, project 1.' },
    { type: 'text', value: 'Sand Table — a low-cost kinetic sand-art table: a 3D-printed 2R manipulator and a C state machine on a Parallax Propeller turn joystick input into stepper commands through inverse kinematics, for both user-drawn and autonomous patterns. The assembly was designed in Fusion 360 and the motion simulated in MATLAB before the arm links and wooden housing were fabricated. Advanced Mechatronics, project 2.' },
    { type: 'text', value: 'ASL Glove Interpreter — a glove that reads American Sign Language: flex sensors on each finger feed a BASIC Stamp 2, which recognizes every number, lets the signer enter multi-digit numbers and does basic arithmetic on them, showing the result on an LCD. The final project of Mechatronics.' },
    { type: 'button', text: 'PONG report (PDF)', link: baseProjectPdfPath + 'Advanced_Mechatronics_Project_1_report.pdf' },
    { type: 'button', text: 'Sand Table report (PDF)', link: baseProjectPdfPath + 'Advanced_mechatronics_Project_2_report.pdf' },
  ] },
  { id: 'n', title: 'Machine Learning & AI Instructor', imageUrl: baseProjectImagePath + 'mlinstructor.mp4', tags: ['Python', 'scikit-learn', 'TensorFlow'], status: 'Completed', modalContent: [{ type: 'text', value: "Taught NYU Tandon's K-12 IDEA program (summer 2025): an introductory AI and machine learning curriculum for beginners, from classical algorithms to modern neural networks — supervised learning (classification, regression), unsupervised learning (clustering, association) and the foundations of deep learning." }, { type: 'text', value: 'Students coded along in Python with scikit-learn and TensorFlow, and finished with a final project doing business analytics on real-world Kaggle datasets. Pictured: a class demo of vision on the edge — an Arduino Nicla Vision tracking an object on the device itself.' }] },
  // Replaced MATE ROV at the owner's request (Oct 5). From the Extended CV's
  // LAIR line. The cover is NOT the lab's own unit: it is a BlueROV2 photo by
  // Yoleeth on Wikimedia Commons, CC BY-SA 4.0 — credited in the modal, as
  // the licence requires; swap in the owner's own photo when there is one.
  { id: 'rov', title: 'Underwater Drone for Shipwreck Reconstruction', imageUrl: baseProjectImagePath + 'bluerov2.webp', tags: ['BlueROV2', 'Isaac Sim', 'OceanSim'], status: 'Completed', modalContent: [{ type: 'text', value: "Built and deployed a BlueROV2 underwater drone for 3D reconstruction of underwater shipwrecks in NYU Tandon's LAIR lab, with an Isaac Sim 5.0 and OceanSim simulation environment for planning each mission before the drone goes in the water." }, { type: 'text', value: 'Pictured: the BlueROV2 platform (photo by Yoleeth, CC BY-SA 4.0, via Wikimedia Commons).' }, { type: 'button', text: 'Photo source (CC BY-SA 4.0)', link: 'https://commons.wikimedia.org/wiki/File:BlueROV2_flying_with_ArduSub.jpg' }] },
  { id: 'd', title: 'Automated Dog Feeder', imageUrl: baseProjectImagePath + 'dogfeeder.webp', tags: ['C', 'Raspberry Pi'], status: 'Completed', modalContent: [{ type: 'text', value: "Designed and built an internet-enabled pet feeder powered by a Raspberry Pi and Firebase. This system allows for remote and scheduled feeding with precise portion control, ensuring a pet's dietary needs are met." }, { type: 'button', text: 'View on Instructables', link: 'https://www.instructables.com/Internet-Enabled-Raspberry-Pi-Pet-Feeder/' }] },
  { id: 'e', title: 'FPGA VGA Game', imageUrl: baseProjectImagePath + 'fpgaVGA.webp', tags: ['Verilog', 'Basys 3 FPGA'], status: 'Completed', modalContent: [{ type: 'text', value: "Developed a 'Flappy Bird' style game on a Basys 3 FPGA using Verilog. This project involved designing digital logic circuits from the ground up to handle game state, player input, and VGA signal generation." }] },
  { id: 'f', title: 'Mechatronics Competition', imageUrl: baseProjectImagePath + 'mechcomp.mp4', tags: ['STM32', 'SolidWorks', 'PID Control'], status: 'Completed', modalContent: [{ type: 'text', value: 'The final project of the mechatronics course at UC Santa Cruz: a ping-pong-ball-shooting robot, fully prototyped in SolidWorks and built with a laser cutter and power tools. It competed against the other teams in the class and scored the most points in a single round.' }, { type: 'embed', value: baseProjectPdfPath + 'ECE_118_Final_Project_Report.pdf', title: 'Project Documentation PDF' }] },
];

// The resume, extended CV and both transcripts are PDFs in this repo
// (Resume/), served from the site itself and shown as page images (`pages`,
// from scripts/pdf-previews.mjs). The transcripts are REDACTED copies (student
// IDs, birth date removed from the file, not just covered); `tab` is the
// viewer's short label.
export const resumeDocsData = [
  { id: 'doc-resume', title: 'Resume', embedUrl: '/Resume/Aadhav_Sivakumar_Resume.pdf', pages: ['/Resume/preview/resume-1.webp'] },
  { id: 'doc-cv', title: 'Extended CV', embedUrl: '/Resume/Aadhav_Sivakumar_Extended_CV.pdf', pages: ['/Resume/preview/cv-1.webp', '/Resume/preview/cv-2.webp', '/Resume/preview/cv-3.webp', '/Resume/preview/cv-4.webp', '/Resume/preview/cv-5.webp', '/Resume/preview/cv-6.webp', '/Resume/preview/cv-7.webp'] },
  { id: 'doc-ug-transcript', title: 'Undergraduate Transcript', tab: 'UCSC transcript', embedUrl: '/Resume/Aadhav_Sivakumar_Transcript_UCSC.pdf', pages: [1, 2, 3, 4, 5, 6, 7].map(n => `/Resume/preview/ucsc-${n}.webp`) },
  { id: 'doc-grad-transcript', title: 'Graduate Transcript', tab: 'NYU transcript', embedUrl: '/Resume/Aadhav_Sivakumar_Transcript_NYU.pdf', pages: ['/Resume/preview/nyu-1.webp'] },
];

export const skillGroupsData = [
  // Order is deliberate: the groups robotics / ML / CV roles are screened on
  // come first. Every item is something the owner has actually shipped with;
  // the stack was confirmed from their own resume material, not inferred.
  {
    id: 'robot-learning',
    title: 'Robot Learning: VLAs & World Models',
    cardImageUrl: '/Media/web/icons/mdi--robot-happy-outline.svg',
    items: [
      { name: 'π0 / π0.5 (openpi)', imageUrl: '/Media/web/icons/mdi--robot-industrial-outline.svg', description: 'Fine-tuned π0 and π0.5 on bimanual teleoperation data: 86.7% cube-in-box success against 13% for an ACT baseline, with data-scaling and out-of-distribution evals.' },
      { name: 'NVIDIA Cosmos', imageUrl: '/Media/web/icons/mdi--earth.svg', description: 'World models: evaluated the Cosmos family for on-device use on Jetson Thor and DGX Spark; generated synthetic defect data with AnomalyGen on Cosmos-Predict2.' },
      { name: 'Isaac Sim / Isaac Lab', imageUrl: '/Media/web/icons/mdi--cube-outline.svg', description: 'Real2Sim digital twins and 1,000+ randomized scripted demonstrations; OceanSim for underwater mission planning.' },
      { name: '3D Gaussian Splatting', imageUrl: '/Media/web/icons/mdi--blur.svg', description: 'Scans of the lab turned into simulation-ready digital twins.' },
      { name: 'LeRobot', imageUrl: '/Media/web/icons/mdi--database-arrow-right-outline.svg', description: 'Bimanual SO-ARM101 teleoperation and data collection on Jetson Orin Nano; LeRobot dataset format.' },
      { name: 'ACT & GR00T', imageUrl: '/Media/web/icons/mdi--transit-connection-variant.svg', description: 'Chunked-action imitation-learning baselines and generalist robot policies.' },
      { name: 'JAX', imageUrl: '/Media/web/icons/mdi--function-variant.svg', description: 'openpi-based VLA fine-tuning.' },
      { name: 'Teleoperation', imageUrl: '/Media/web/icons/mdi--gamepad-variant-outline.svg', description: 'A GELLO leader arm for the xArm 5 (Dynamixel XL330 servos, xArm 7 STLs mapped onto xArm 5 kinematics) and bimanual leader-follower rigs.' },
      { name: 'MuJoCo', imageUrl: '/Media/web/icons/mdi--cube-send.svg', description: 'Kinematics and dynamics simulation; the UR10e final project for Foundations of Robotics.' },
      { name: 'Detection-Grounded Action Models', imageUrl: '/Media/web/icons/mdi--vector-polygon.svg', description: 'A VLA architecture proposal: frozen detection, segmentation and depth feeding per-object tokens to a language-conditioned action decoder.' },
    ]
  },
  {
    id: 'ai-ml-data',
    title: 'Machine Learning & Computer Vision',
    cardImageUrl: '/Media/web/icons/mdi--brain.svg',
    items: [
      { name: 'PyTorch', imageUrl: '/Media/web/icons/devicon--pytorch--pytorch-original.svg', description: 'Training and fine-tuning detection, segmentation and policy models; LoRA fine-tuning.' },
      { name: 'RF-DETR / YOLO / SAM2', imageUrl: '/Media/web/icons/mdi--eye-check-outline.svg', description: 'Detection, segmentation and keypoints: RF-DETR & RF-DETR-Seg (94.2% mAP@50 in production), YOLO, SAM2, DINOv2, Depth Anything.' },
      { name: 'TensorFlow & scikit-learn', imageUrl: '/Media/web/icons/mdi--chart-scatter-plot.svg', description: 'Taught supervised and unsupervised learning and neural networks with them in NYU\'s K-12 AI program.' },
      { name: 'OpenCV', imageUrl: '/Media/web/icons/devicon--opencv--opencv-original.svg', description: 'Image processing, camera calibration (ChArUco / ArUco / AprilTag), visual servoing.' },
      { name: 'Open3D', imageUrl: '/Media/web/icons/mdi--cube-scan.svg', description: 'Point clouds, RGB-D fusion, multi-view TSDF reconstruction, 3D measurement.' },
      { name: 'Depth & 3D Perception', imageUrl: '/Media/web/icons/mdi--axis-arrow.svg', description: 'Stereo, ToF and structured-light depth; Depth Anything 3; monocular-vs-stereo metrology trade-offs.' },
      { name: 'Synthetic Data', imageUrl: '/Media/web/icons/mdi--shape-plus-outline.svg', description: 'Isaac Sim / Replicator domain randomization, Cosmos generative defect models, dataset packaging and evaluation.' },
      { name: 'Model Optimization', imageUrl: '/Media/web/icons/mdi--speedometer.svg', description: 'Neural architecture search, INT8/FP8/NVFP4 quantization, AWQ/GPTQ — for real-time inference on edge hardware.' },
      { name: 'Evaluation', imageUrl: '/Media/web/icons/mdi--chart-box-outline.svg', description: 'mAP, precision/recall, F1, PR curves; benchmark methodology for vision models.' },
      { name: 'LLM & Gen-AI', imageUrl: '/Media/web/icons/mdi--robot-outline.svg', description: 'Local and hosted LLMs (vLLM, llama.cpp, Ollama), agent sandboxes, OpenAI / Gemini / Claude APIs.' },
      { name: 'Python (Scientific)', imageUrl: '/Media/web/icons/devicon--python--python-original.svg', description: 'NumPy/SciPy numerical work, data pipelines, ML tooling.' },
    ]
  },
  {
    id: 'edge-deployment',
    title: 'Edge AI & Deployment',
    cardImageUrl: '/Media/web/icons/mdi--chip.svg',
    items: [
      { name: 'NVIDIA Jetson', imageUrl: '/Media/web/icons/mdi--developer-board.svg', description: 'Orin Nano / NX / AGX and AGX Thor: JetPack 5–7, L4T flashing, BSP patching, device trees, power modes.' },
      { name: 'TensorRT', imageUrl: '/Media/web/icons/mdi--lightning-bolt-outline.svg', description: 'Engine building and optimization for real-time edge inference.' },
      { name: 'ONNX Runtime', imageUrl: '/Media/web/icons/mdi--graph-outline.svg', description: 'Portable model export and inference.' },
      { name: 'Roboflow Inference & Workflows', imageUrl: '/Media/web/icons/mdi--vector-polygon.svg', description: 'Model serving, Workflows pipelines, active learning, offline / air-gapped deployment.' },
      { name: 'Docker', imageUrl: '/Media/web/icons/devicon--docker--docker-original.svg', description: 'Containerized edge stacks, nvidia-container-toolkit, OCI registries.' },
      { name: 'DGX Spark', imageUrl: '/Media/web/icons/mdi--server-outline.svg', description: 'GB10 / aarch64 development and local model serving.' },
      { name: 'Fleet Networking', imageUrl: '/Media/web/icons/mdi--lan.svg', description: 'Tailscale, GigE Vision subnets, jumbo frames, multi-NIC routing, PoE/UPOE, 10GbE and QSFP28 breakout.' },
      { name: 'Observability', imageUrl: '/Media/web/icons/mdi--monitor-dashboard.svg', description: 'Grafana / Loki, TimescaleDB, Redis, deployment monitoring dashboards.' },
      { name: 'Linux Systems', imageUrl: '/Media/web/icons/simple-icons--linux.svg', description: 'Ubuntu 22.04/24.04, drivers and kernels, systemd, udev, DKMS.' },
    ]
  },
  {
    id: 'robotics-control',
    title: 'Robotics & Control Systems',
    cardImageUrl: '/Media/web/icons/mdi--robot-industrial.svg',
    items: [
      { name: 'ROS 2', imageUrl: '/Media/web/icons/simple-icons--ros.svg', description: 'Jazzy / Humble; ROS-based drones and manipulators.' },
      { name: 'Robot Arms', imageUrl: '/Media/web/icons/mdi--robot-industrial-outline.svg', description: 'UFACTORY xArm 5, Franka Research 3 and Panda, SO-ARM101, BlueROV2, GELLO leader arms.' },
      { name: 'Hand-Eye Calibration', imageUrl: '/Media/web/icons/mdi--target.svg', description: 'ChArUco / ArUco / AprilTag camera-to-robot calibration.' },
      { name: 'Webots', imageUrl: '/Media/web/icons/mdi--cube-send.svg', description: 'Physics simulation for mobile robots.' },
      { name: 'Kinematics', imageUrl: '/Media/web/icons/mdi--vector-line.svg', description: 'Forward/inverse kinematics and path planning.' },
      { name: 'PID Control', imageUrl: '/Media/web/icons/mdi--tune-variant.svg', description: 'Feedback control for flight, motion and servo systems.' },
      { name: 'Kalman Filtering', imageUrl: '/Media/web/icons/mdi--chart-bell-curve-cumulative.svg', description: 'State estimation and sensor fusion.' },
      { name: 'Pixhawk / PX4', imageUrl: '/Media/web/icons/mdi--quadcopter.svg', description: 'Pixhawk 6x autonomous drone flight control.' },
    ]
  },
  {
    id: 'machine-vision-hw',
    title: 'Machine Vision Hardware',
    cardImageUrl: '/Media/web/icons/mdi--camera-iris.svg',
    items: [
      { name: 'Industrial Cameras', imageUrl: '/Media/web/icons/mdi--camera-outline.svg', description: 'LUCID Triton / Triton2 / Helios, Basler ace2 / blaze, Orbbec, RealSense, ZED, Zivid, Photoneo — area-scan, line-scan and depth.' },
      { name: 'GigE Vision / GenICam', imageUrl: '/Media/web/icons/mdi--ethernet.svg', description: 'GigE (1–10G), USB3 Vision, CoaXPress, MIPI CSI-2, GMSL2; Arena SDK and pylon.' },
      { name: 'Line-Scan & Triggering', imageUrl: '/Media/web/icons/mdi--barcode-scan.svg', description: 'Encoder-triggered line-scan capture for moving product on conveyors and thermoforming lines.' },
      { name: 'Optics', imageUrl: '/Media/web/icons/mdi--circle-double.svg', description: 'FOV / DOF / MTF calculation, telecentric and varifocal lens selection, cross-polarization; built a lens calculator.' },
      { name: 'Industrial Lighting', imageUrl: '/Media/web/icons/mdi--lightbulb-on-outline.svg', description: 'Line, coaxial and IP67 lighting with strobe controllers; 24V and PoE power budgeting.' },
      { name: 'PLC Integration', imageUrl: '/Media/web/icons/mdi--connection.svg', description: 'Allen-Bradley over EtherNet/IP; controls-integration standards and installation runbooks.' },
    ]
  },
  {
    id: 'programming-software',
    title: 'Programming & Software Development',
    cardImageUrl: '/Media/web/icons/mdi--code-braces-box.svg',
    items: [
      { name: 'Python', imageUrl: '/Media/web/icons/devicon--python--python-original.svg', description: 'Primary language for ML, robotics and tooling.' },
      { name: 'C', imageUrl: '/Media/web/icons/devicon--c--c-original.svg', description: 'Embedded firmware, register-level MCU work.' },
      { name: 'C++', imageUrl: '/Media/web/icons/devicon--cplusplus--cplusplus-original.svg', description: 'ROS nodes, control loops, performance-critical code.' },
      { name: 'JavaScript / React', imageUrl: '/Media/web/icons/devicon--react--react-original.svg', description: 'Web tooling, dashboards, this site (React, Three.js / R3F).' },
      { name: 'Bash', imageUrl: '/Media/web/icons/devicon--bash--bash-original.svg', description: 'Provisioning scripts, device automation, CI.' },
      { name: 'SQL', imageUrl: '/Media/web/icons/mdi--database-outline.svg', description: 'Relational and time-series data (TimescaleDB).' },
      { name: 'Verilog', imageUrl: '/Media/web/icons/mdi--chip.svg', description: 'FPGA digital design (Basys 3).' },
      { name: 'Java', imageUrl: '/Media/web/icons/devicon--java--java-original.svg', description: 'Object-oriented development, Android.' },
      { name: 'MATLAB', imageUrl: '/Media/web/icons/devicon--matlab--matlab-original.svg', description: 'Numerical computing, real-time sensor visualization.' },
      { name: 'Git & GitHub Actions', imageUrl: '/Media/web/icons/devicon--git--git-original.svg', description: 'Version control and CI/CD.' },
      { name: 'LaTeX', imageUrl: '/Media/web/icons/mdi--format-text.svg', description: 'Technical writing, proposals, forms.' },
    ]
  },
  {
    id: 'electronics-embedded',
    title: 'Electronics, Embedded & Sensors',
    cardImageUrl: '/Media/web/icons/mdi--chip.svg',
    items: [
      { name: 'NI DAQ', imageUrl: baseSkillImagePath + 'NIDAQ.jpg', description: 'National Instruments hardware for measuring electrical/physical phenomena and converting to digital data.' },
      { name: 'Oscilloscope', imageUrl: baseSkillImagePath + 'oscilloscope.jpg', description: 'Instrument for observing varying signal voltages, crucial for debugging electronic circuits.' },
      { name: 'LED Matrix', imageUrl: baseSkillImagePath + 'matrixheart.jpg', description: '2D array of LEDs for displaying patterns, characters, or animations via individual control.' },
      { name: 'Arduino', imageUrl: baseSkillImagePath + 'Arduino.jpg', description: 'Open-source platform for interactive objects, popular for prototyping and education.' },
      { name: 'Raspberry Pi', imageUrl: baseSkillImagePath + 'raspberrypi.webp', description: 'Small single-board computers for robotics, IoT, home automation, and education.' },
      { name: 'Basys 3 FPGA', imageUrl: baseSkillImagePath + 'Basys3.webp', description: 'Entry-level FPGA board with Artix-7, used for learning digital logic with Verilog/VHDL.' },
      { name: 'Nordic nRF54L15 / Zephyr', imageUrl: '/Media/web/icons/mdi--bluetooth.svg', description: 'Zephyr / nRF Connect SDK IMU firmware with real-time visualization.' },
      { name: 'STM32 (H5, CubeIDE, HAL)', imageUrl: baseSkillImagePath + 'STM32.webp', description: 'Affordable boards with STM32 MCUs (ARM Cortex-M) for prototyping and concept testing.' },
      { name: 'ESP32/8266', imageUrl: baseSkillImagePath + 'ESP32.jpg', description: 'Low-cost Wi-Fi & Bluetooth/BLE MCUs for IoT, home automation, and wireless sensors.' },
      { name: 'Infineon PSoC 4', imageUrl: baseSkillImagePath + 'psoc4.jpg', description: 'Programmable System-on-Chip with ARM Cortex-M0/M0+ and programmable analog/digital blocks.' },
      { name: 'Parallax Propeller', imageUrl: baseSkillImagePath + 'propeller.jpg', description: 'Multicore MCU with eight 32-bit cores for true parallel processing and deterministic timing.' },
      { name: 'Jetson Nano', imageUrl: baseSkillImagePath + 'jetsonnano.jpg', description: 'Small, powerful computer for accelerated AI in embedded apps like image classification.' },
      { name: 'Comm Protocols', imageUrl: '/Media/web/icons/mdi--serial-port.svg', description: 'Rules for data transmission (I2C, SPI, UART, CAN, Ethernet, Wi-Fi, Bluetooth).' },
      { name: 'Altium Designer', imageUrl: baseSkillImagePath + 'altium-designer.png', description: 'EDA software for PCB, FPGA, and embedded software design in a unified environment.' },
      { name: 'Autodesk EAGLE', imageUrl: baseSkillImagePath + 'EAGLE.jpg', description: 'EDA tool for schematic capture, PCB layout, auto-router, and CAM features.' },
      { name: 'ORcad x Capture', imageUrl: baseSkillImagePath + 'OrCADCapture.webp', description: 'Cadence EDA tools for designing ICs, SoCs, and PCBs.' },
      { name: 'Pspice/LTspice', imageUrl: baseSkillImagePath + 'LTspice.png', description: 'SPICE-based analog circuit and digital logic simulation program for design verification.' },
      { name: 'ATI Multi-Axis Force/Torque', imageUrl: '/Media/web/icons/mdi--axis-arrow.svg', description: 'Measures all six components of force/torque for robotics, haptics, product testing.' },
      { name: 'IMU', imageUrl: '/Media/web/icons/mdi--rotate-orbit.svg', description: "Measures body's specific force, angular rate, and orientation using accelerometers/gyroscopes." },
      { name: 'Ultrasonic', imageUrl: '/Media/web/icons/mdi--signal-distance-variant.svg', description: 'Measures distance by emitting/receiving ultrasonic waves for object detection/avoidance.' },
      { name: 'Flex Sensor', imageUrl: '/Media/web/icons/mdi--vector-curve.svg', description: 'Variable resistor that changes resistance when bent, used to detect flexing motions.' },
      { name: 'Capacitive', imageUrl: '/Media/web/icons/mdi--gesture-tap.svg', description: 'Detects changes in capacitance for touch sensing, proximity detection, liquid level sensing.' },
      { name: 'Piezoelectric', imageUrl: '/Media/web/icons/mdi--flash.svg', description: 'Generates electric charge from mechanical stress; used as pressure sensors, accelerometers.' },
      { name: 'Test Automation', imageUrl: '/Media/web/icons/mdi--play-box-multiple-outline.svg', description: 'Using software to execute pre-scripted tests for quality assurance and faster development cycles.' }
    ]
  },
  {
    id: 'design-fabrication',
    title: 'Design & Fabrication',
    cardImageUrl: '/Media/web/icons/mdi--printer-3d-nozzle-outline.svg',
    items: [
      { name: 'Google Glass', imageUrl: baseSkillImagePath + 'googleglass.jpg', description: 'Optical head-mounted display for hands-free info access and AR applications.' },
      { name: 'Bambu Lab Printer', imageUrl: baseSkillImagePath + 'bambu.webp', description: 'High-speed 3D printers with multi-material support (AMS) and advanced features.' },
      { name: 'Glowforge', imageUrl: baseSkillImagePath + 'glowforge.webp', description: 'Desktop laser cutter/engraver for precise designs on wood, acrylic, leather, etc.' },
      { name: 'SolidWorks', imageUrl: baseSkillImagePath + 'SOLIDWORKS.webp', description: 'CAD/CAE software for designing, simulating, and manufacturing products.' },
      { name: 'Fusion 360', imageUrl: baseSkillImagePath + 'fusion360.png', description: 'Cloud-based 3D CAD, CAM, CAE, PCB platform for product design and manufacturing.' },
      { name: 'AutoCAD', imageUrl: baseSkillImagePath + 'autocad.png', description: 'Commercial CAD and drafting software for 2D/3D design and documentation.' }
    ]
  }
];
