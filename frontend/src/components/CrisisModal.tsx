import React from 'react';
import { Phone, Shield, HeartHandshake, X } from 'lucide-react';
import { CrisisResponse } from '../api/types';
import { OFFICIAL_CRISIS_PAYLOAD } from '../api/client';

interface CrisisModalProps {
  isOpen: boolean;
  onClose: () => void;
  crisisData?: CrisisResponse | null;
}

export const CrisisModal: React.FC<CrisisModalProps> = ({
  isOpen,
  onClose,
  crisisData,
}) => {
  if (!isOpen) return null;

  const data = crisisData || OFFICIAL_CRISIS_PAYLOAD;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="crisis-modal-title"
      aria-describedby="crisis-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/45 backdrop-blur-md transition-opacity duration-300"
    >
      <div className="w-full max-w-xl bg-surfaceLowest border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-modal relative flex flex-col space-y-6">
        {/* Top Dismiss */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close crisis support modal"
          className="absolute top-5 right-5 p-2 rounded-full text-stone-700 hover:text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Warm Terracotta Accent (NEVER alarmist red) */}
        <div className="flex items-start space-x-4 pt-1">
          <div className="w-12 h-12 rounded-full bg-terracotta-container flex items-center justify-center text-terracotta-dark flex-shrink-0 shadow-sm">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-terracotta-container text-terracotta-dark font-semibold text-sm">
              <Shield className="w-4 h-4" />
              <span>Confidential &amp; 24/7 Human Care</span>
            </div>
            <h2
              id="crisis-modal-title"
              className="font-headline text-2xl font-semibold text-on-surface tracking-tight"
            >
              {data.copy?.headline || 'You are not alone. Support is here for you.'}
            </h2>
            <p
              id="crisis-modal-desc"
              className="text-sm text-stone-700 leading-relaxed"
            >
              {data.copy?.message ||
                'If you are feeling overwhelmed, compassionate professionals are ready to listen right now.'}
            </p>
          </div>
        </div>

        {/* Helpline Resource Cards */}
        <div className="space-y-3">
          {data.resources.map((resource) => (
            <div
              key={resource.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-surface-container-low border border-outline-variant hover:border-terracotta/40 transition-colors gap-3"
            >
              <div className="space-y-1 pr-2">
                <div className="flex items-center space-x-2">
                  <span className="font-headline text-base font-bold text-on-surface">
                    {resource.name}
                  </span>
                  <span className="text-sm px-2.5 py-0.5 rounded-full bg-surfaceLowest text-stone-700 font-medium border border-outline-variant">
                    {resource.provider}
                  </span>
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {resource.description}
                </p>
              </div>

              {/* Click-to-Call Primary Action in Terracotta Pill */}
              <a
                href={resource.tap_to_call}
                className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full bg-terracotta text-white font-semibold text-sm hover:bg-terracotta-dark shadow-xs active:scale-95 transition-all flex-shrink-0"
              >
                <Phone className="w-4 h-4" />
                <span>Call {resource.number}</span>
              </a>
            </div>
          ))}
        </div>

        {/* Calm Reassurance Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-outline-variant/60 gap-3">
          <p className="text-sm text-stone-700 text-center sm:text-left">
            Support is free, confidential, and multilingual across India.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-surface-container text-on-surface font-semibold text-sm hover:bg-surface-container-high transition-colors border border-outline-variant"
          >
            I am safe • Return to App
          </button>
        </div>
      </div>
    </div>
  );
};
