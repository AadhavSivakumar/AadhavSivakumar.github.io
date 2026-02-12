import React from 'react';

export default function SineWave({ isLeft }) {
  const containerWidth = 300;
  const containerHeight = 420;
  const numWaves = 50;
  const amplitude = 12;
  const spacing = 12;
  const waveCycleWidth = 100;
  const pathTotalWidth = containerWidth * 2;
  const animationDuration = 3;
  const phaseShiftDegrees = 12;

  const paths = [];
  for (let i = 1; i < numWaves - 1; i++) {
    let d = '';
    const startY = (containerHeight / 2) + (i - (numWaves - 1) / 2) * spacing;
    d = `M 0 ${startY}`;
    for (let xPos = 0; xPos < pathTotalWidth; xPos += waveCycleWidth) {
      d += ` q ${waveCycleWidth / 4} ${-amplitude} ${waveCycleWidth / 2} 0`;
      d += ` t ${waveCycleWidth / 2} 0`;
    }
    const delay = (i * phaseShiftDegrees / 360) * animationDuration;
    paths.push(
      <path key={i} d={d} style={{ animationDelay: `-${delay}s` }} />
    );
  }

  return (
    <div className={`svg-sine-wave-container ${isLeft ? 'left-wave' : 'right-wave'}`}>
      <svg
        viewBox={`0 0 ${containerWidth} ${containerHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {paths}
      </svg>
    </div>
  );
}
