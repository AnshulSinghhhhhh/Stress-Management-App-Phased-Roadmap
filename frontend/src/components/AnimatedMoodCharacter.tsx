import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMoodScaleDescriptor, SCALE_CONVENTION } from '../utils/moodScale';
import { DoodleSparkle } from './DoodleIcons';

interface AnimatedMoodCharacterProps {
  value: number; // 1 to 10
  className?: string;
}

export const AnimatedMoodCharacter: React.FC<AnimatedMoodCharacterProps> = ({
  value,
  className = '',
}) => {
  const descriptor = getMoodScaleDescriptor(value);

  // Character emotional state derived strictly from single source of truth
  const isHighTension = value <= 2;
  const isElevatedTension = value >= 3 && value <= 4;
  const isSteady = value >= 5 && value <= 6;
  const isCalm = value >= 7 && value <= 8;
  const isDeepCalm = value >= 9;

  // Blob base color
  const blobColor = isHighTension
    ? '#D89182' // warm terracotta stress
    : isElevatedTension
    ? '#E0A89B'
    : isSteady
    ? '#A7BBAE' // balanced sage
    : isCalm
    ? '#88A793' // calm sage
    : '#6D967B'; // deep serene restorative sage

  // Animation variants based on value
  const motionVariant: any = isHighTension
    ? {
        animate: {
          x: [-2, 2, -2, 2, 0],
          y: [-1, 1, -1, 1, 0],
          rotate: [-1.5, 1.5, -1, 1, 0],
          transition: { repeat: Infinity, duration: 0.35, ease: 'easeInOut' },
        },
      }
    : isElevatedTension
    ? {
        animate: {
          y: [-2, 2, -2],
          transition: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' },
        },
      }
    : isSteady
    ? {
        animate: {
          scale: [1, 1.025, 1],
          y: [-3, 3, -3],
          transition: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' },
        },
      }
    : isCalm
    ? {
        animate: {
          scale: [1, 1.04, 1],
          y: [-5, 5, -5],
          rotate: [-1, 1, -1],
          transition: { repeat: Infinity, duration: 3.2, ease: 'easeInOut' },
        },
      }
    : {
        animate: {
          scale: [1, 1.06, 1],
          y: [-7, 7, -7],
          rotate: [-2, 2, -2],
          transition: { repeat: Infinity, duration: 4.0, ease: 'easeInOut' },
        },
      };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center select-none py-2 ${className}`}
      data-testid="animated-mood-character-container"
    >
      {/* Floating Sparkles for High Calm */}
      <div className="relative w-40 h-36 flex items-center justify-center">
        {isDeepCalm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-2 -right-1 text-amber-500"
          >
            <DoodleSparkle className="w-6 h-6 text-amber-500 animate-spin" />
          </motion.div>
        )}
        {isDeepCalm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-1 -left-1 text-primary-dark"
          >
            <DoodleSparkle className="w-5 h-5 text-primary" />
          </motion.div>
        )}

        {/* Animated Blob SVG Body */}
        <motion.div
          key={descriptor.tone}
          {...motionVariant}
          className="relative w-32 h-32 flex items-center justify-center filter drop-shadow-md"
        >
          <svg viewBox="0 0 160 160" className="w-full h-full">
            {/* Hand-drawn sketchy outline and body */}
            <motion.path
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              d={
                isHighTension
                  ? 'M80 15 C125 15, 145 45, 145 80 C145 125, 115 145, 80 145 C40 145, 15 120, 15 80 C15 35, 45 15, 80 15 Z'
                  : isDeepCalm
                  ? 'M80 18 C130 14, 148 50, 146 82 C144 128, 120 144, 80 144 C38 144, 14 124, 14 80 C14 42, 40 22, 80 18 Z'
                  : 'M80 16 C126 16, 146 48, 146 80 C146 126, 118 144, 80 144 C38 144, 14 122, 14 80 C14 38, 42 16, 80 16 Z'
              }
              fill={blobColor}
              stroke="#292524"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Rosy Cheeks */}
            <circle cx="42" cy="94" r="7" fill="#E88A78" opacity={isHighTension ? '0.7' : '0.35'} />
            <circle cx="118" cy="94" r="7" fill="#E88A78" opacity={isHighTension ? '0.7' : '0.35'} />

            {/* Eyes */}
            {isHighTension ? (
              // Stressed / Wavy squint eyes
              <g stroke="#292524" strokeWidth="3.5" strokeLinecap="round">
                <path d="M48 68 L64 78 M64 68 L48 78" />
                <path d="M96 68 L112 78 M112 68 L96 78" />
                {/* Tension Sweat Drop */}
                <path d="M126 50 C126 46, 131 40, 131 40 C131 40, 136 46, 136 50 C136 53, 133 55, 131 55 C129 55, 126 53, 126 50 Z" fill="#60A5FA" stroke="#292524" strokeWidth="1.5" />
              </g>
            ) : isElevatedTension ? (
              // Tense focused dot eyes with brow
              <g stroke="#292524" strokeWidth="3" strokeLinecap="round" fill="#292524">
                <line x1="48" y1="64" x2="64" y2="68" />
                <line x1="112" y1="64" x2="96" y2="68" />
                <circle cx="56" cy="76" r="4.5" />
                <circle cx="104" cy="76" r="4.5" />
              </g>
            ) : isSteady ? (
              // Neutral steady dots
              <g fill="#292524">
                <circle cx="56" cy="74" r="5" />
                <circle cx="104" cy="74" r="5" />
                <circle cx="58" cy="72" r="1.5" fill="#FFFFFF" />
                <circle cx="106" cy="72" r="1.5" fill="#FFFFFF" />
              </g>
            ) : isCalm ? (
              // Happy curved eyes
              <g stroke="#292524" strokeWidth="3.5" strokeLinecap="round" fill="none">
                <path d="M48 74 C52 66, 60 66, 64 74" />
                <path d="M96 74 C100 66, 108 66, 112 74" />
              </g>
            ) : (
              // Deep calm peaceful closed eyes with smiling lashes
              <g stroke="#292524" strokeWidth="3.5" strokeLinecap="round" fill="none">
                <path d="M46 76 C52 82, 60 82, 66 76" />
                <path d="M94 76 C100 82, 108 82, 114 76" />
                <path d="M56 82 L56 86" strokeWidth="2.5" />
                <path d="M104 82 L104 86" strokeWidth="2.5" />
              </g>
            )}

            {/* Mouth */}
            {isHighTension ? (
              // Wavy trembling tense mouth
              <path
                d="M62 108 C68 102, 74 114, 80 106 C86 114, 92 102, 98 108"
                stroke="#292524"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
            ) : isElevatedTension ? (
              // Straight tight mouth
              <line
                x1="66"
                y1="106"
                x2="94"
                y2="106"
                stroke="#292524"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            ) : isSteady ? (
              // Gentle slight smile
              <path
                d="M66 102 C74 108, 86 108, 94 102"
                stroke="#292524"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
            ) : isCalm ? (
              // Warm friendly smile
              <path
                d="M62 98 C70 114, 90 114, 98 98"
                stroke="#292524"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              // Joyful open gentle curve
              <path
                d="M60 96 C68 116, 92 116, 100 96 Z"
                fill="#292524"
                stroke="#292524"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </motion.div>
      </div>

      {/* SINGLE Source of Truth Readout Badge */}
      <motion.div
        key={descriptor.category}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-2 space-y-1 max-w-md px-4"
        data-testid="mood-descriptor-single-source"
      >
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full border border-stone-800/60 bg-paper-card shadow-notebook">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: descriptor.accentColor }} />
          <span className="font-handwriting text-lg sm:text-xl font-bold text-on-surface">
            {descriptor.category}
          </span>
          <span className="text-sm font-semibold text-stone-600">
            ({value}/10)
          </span>
        </div>

        <p className="text-sm text-stone-700 leading-relaxed font-body pt-1">
          {descriptor.description}
        </p>
      </motion.div>
    </div>
  );
};
