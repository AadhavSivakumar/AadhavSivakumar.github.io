import React from 'react';
import { motion } from 'motion/react';

// Shared interactive card: motion handles the scroll-into-view entrance and
// a clean lift on hover (the 3D tilt now lives on the lanyard badges only).
export default function LiftCard({ className = '', delay = 0, onClick, children, ...rest }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, scale: 1.015, transition: { duration: 0.25, delay: 0, ease: 'easeOut' } }}
      whileTap={{ scale: 0.985, transition: { duration: 0.15, delay: 0 } }}
      onClick={onClick}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
