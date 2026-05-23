import { useEffect, useRef, useState } from 'react';

export function useInView(options = {}) {
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.unobserve(el);
      }
    }, { threshold: options.threshold || 0.1 });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, inView];
}
