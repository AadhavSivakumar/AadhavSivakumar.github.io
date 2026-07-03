import React from 'react';
import { motion } from 'motion/react';

// Fade-and-rise on scroll into view. Wraps section headings, paragraphs and
// other one-off elements; cards use LiftCard instead.
export default function Reveal({ children, delay = 0, y = 28, className, ...rest }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
