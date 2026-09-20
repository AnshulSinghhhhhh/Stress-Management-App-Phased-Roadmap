import React from 'react';

/**
 * Hand-drawn doodle icons & notebook styling accents.
 * Replaces generic Lucide icons on decorative headers and emphasis elements.
 */

interface DoodleProps {
  className?: string;
  color?: string;
}

export const PaperTape: React.FC<{ className?: string; color?: string; angle?: number }> = ({
  className = '',
  color = 'rgba(254, 240, 199, 0.75)',
  angle = -1.5,
}) => (
  <div
    className={`inline-block pointer-events-none select-none ${className}`}
    style={{ transform: `rotate(${angle}deg)` }}
  >
    <svg
      width="84"
      height="22"
      viewBox="0 0 84 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-xs"
    >
      <path
        d="M2.5 4.5L0 8.5L3 12.5L0.5 16.5L2 20.5L81.5 21L83.5 17L81 13L84 9L81.5 4.5L83.5 1L3 1.5L2.5 4.5Z"
        fill={color}
        stroke="rgba(41, 37, 36, 0.25)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

export const DoodleSquiggle: React.FC<DoodleProps> = ({
  className = 'w-28 h-3 text-primary',
  color = 'currentColor',
}) => (
  <svg
    viewBox="0 0 120 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    preserveAspectRatio="none"
  >
    <path
      d="M2 7C14 2 26 11 38 6C50 1 62 10 74 5C86 1 98 10 110 5C114 3 118 6 118 6"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const DoodleStar: React.FC<DoodleProps & { size?: number }> = ({
  className = 'w-5 h-5 text-amber-500',
  color = 'currentColor',
  size = 20,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 2L13.5 8.5L20 10L14.5 13.5L16 20L11 16L6 20L7.5 13.5L2 10L8.5 8.5L12 2Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="rgba(251, 191, 36, 0.2)"
    />
  </svg>
);

export const DoodleSparkle: React.FC<DoodleProps> = ({
  className = 'w-4 h-4 text-primary',
  color = 'currentColor',
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M8 1V15M1 8H15M3.5 3.5L12.5 12.5M3.5 12.5L12.5 3.5"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const DoodleCheck: React.FC<DoodleProps> = ({
  className = 'w-5 h-5 text-primary-dark',
  color = 'currentColor',
}) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M3.5 10.5L8 15L16.5 4.5"
      stroke={color}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const DoodlePin: React.FC<DoodleProps> = ({
  className = 'w-5 h-5 text-terracotta',
  color = 'currentColor',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="7" r="5" fill={color} stroke="#292524" strokeWidth="1.5" />
    <path d="M12 12V21" stroke="#292524" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="10.5" cy="5.5" rx="1.5" ry="1" fill="#FFFFFF" opacity="0.6" />
  </svg>
);
