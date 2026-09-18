import React, { useState, useEffect } from 'react';
import { ReliefTechnique, ReliefTechniqueId } from '../api/types';
import { apiClient } from '../api/client';
import { ReliefTimer } from '../components/ReliefTimer';
import { Wind, Eye, Sparkles, Play, Clock, ShieldCheck, Heart } from 'lucide-react';

export const ReliefLibraryPage: React.FC = () => {
  const [techniques, setTechniques] = useState<ReliefTechnique[]>([]);
  const [activeTechniqueId, setActiveTechniqueId] = useState<ReliefTechniqueId | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    apiClient.getReliefTechniques().then(setTechniques);
  }, []);

  const getTechniqueIcon = (id: ReliefTechniqueId) => {
    switch (id) {
      case 'square_breathing':
        return <Wind className="w-6 h-6 text-primary" />;
      case 'grounding_54321':
        return <Eye className="w-6 h-6 text-primary" />;
      case 'somatic_pause':
        return <Sparkles className="w-6 h-6 text-primary" />;
    }
  };

  return (
    <div className="w-full max-w-[960px] mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Page Header */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <div className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-secondary-container/60 border border-outline-variant text-primary text-xs font-medium">
          <Heart className="w-3.5 h-3.5" />
          <span>Evidence-Based Somatic &amp; Attentional Relief</span>
        </div>
        <h1 className="font-headline text-3xl md:text-4xl text-on-surface font-medium tracking-tight">
          Restorative Relief Sanctuary
        </h1>
        <p className="text-sm md:text-base text-on-surface-variant">
          In-the-moment exercises designed to deactivate sympathetic fight-or-flight within 3 to 4 minutes.
        </p>
      </div>

      {/* Techniques Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {techniques.map((tech) => (
          <div
            key={tech.id}
            className="bg-surfaceLowest border border-outline-variant rounded-3xl p-6 shadow-resting hover:shadow-lift transition-all duration-300 flex flex-col justify-between space-y-6 group"
          >
            <div className="space-y-4">
              {/* Icon & Badge */}
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-secondary-container/70 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  {getTechniqueIcon(tech.id)}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium border border-outline-variant">
                    {tech.badge}
                  </span>
                  <div className="flex items-center space-x-1 text-xs text-outline">
                    <Clock className="w-3 h-3" />
                    <span>{tech.durationMinutes}m</span>
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5">
                <h3 className="font-headline text-xl font-medium text-on-surface group-hover:text-primary transition-colors">
                  {tech.title}
                </h3>
                <p className="text-xs font-medium text-primary">
                  {tech.subtitle}
                </p>
                <p className="text-xs text-on-surface-variant leading-relaxed pt-1">
                  {tech.description}
                </p>
              </div>
            </div>

            {/* Launch CTA */}
            <button
              type="button"
              onClick={() => setActiveTechniqueId(tech.id)}
              className="w-full py-2.5 px-4 rounded-full bg-surface-container hover:bg-primary text-on-surface hover:text-white font-medium text-xs sm:text-sm transition-all duration-200 inline-flex items-center justify-center space-x-2 border border-outline-variant group-hover:border-primary active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Begin Session</span>
            </button>
          </div>
        ))}
      </div>

      {/* Reassurance Banner */}
      <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
          <span>
            Clinically aligned protocols. Zero competition, zero streaks, purely for your peace of mind.
          </span>
        </div>
        <span className="text-outline">Free &amp; available 24/7</span>
      </div>

      {/* Active Modal Timer if launched */}
      {activeTechniqueId && (
        <ReliefTimer
          techniqueId={activeTechniqueId}
          onClose={() => setActiveTechniqueId(null)}
          onSessionFinished={() => setCompletedCount((c) => c + 1)}
        />
      )}
    </div>
  );
};
