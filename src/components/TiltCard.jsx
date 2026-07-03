import React from 'react';
import { motion } from 'motion/react';

// Shared interactive card: motion handles the scroll-into-view entrance,
// then the pointer takes over with a 3D tilt written straight to
// style.transform (motion leaves transform alone once the entrance settles).
export default function TiltCard({ className = '', delay = 0, maxRotate = 8, onClick, children, ...rest }) {
  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const rotateX = ((mouseY - rect.height / 2) / (rect.height / 2)) * -maxRotate;
    const rotateY = ((mouseX - rect.width / 2) / (rect.width / 2)) * maxRotate;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.transform = '';
  };

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
