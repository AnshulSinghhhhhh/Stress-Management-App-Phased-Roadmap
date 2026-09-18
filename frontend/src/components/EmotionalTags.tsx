import React from 'react';
import { Check } from 'lucide-react';

export const DEFAULT_TAGS = [
  'Calm',
  'Grateful',
  'Focused',
  'Hopeful',
  'Tired',
  'Restless',
  'Anxious',
  'Overwhelmed',
];

interface EmotionalTagsProps {
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export const EmotionalTags: React.FC<EmotionalTagsProps> = ({
  selectedTags,
  onToggleTag,
}) => {
  return (
    <section className="bg-surfaceLowest border border-outline-variant rounded-2xl p-6 shadow-resting space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-headline text-lg text-on-surface font-medium">
            Emotional texture
          </h3>
          <p className="text-xs text-on-surface-variant">
            Tap any that apply to this moment
          </p>
        </div>
        <span className="text-xs text-outline font-medium">
          {selectedTags.length > 0 ? `${selectedTags.length} selected` : 'None selected'}
        </span>
      </div>

      {/* Pill Selector Cloud */}
      <div className="flex flex-wrap gap-2.5 pt-1">
        {DEFAULT_TAGS.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              aria-pressed={isSelected}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-secondary-container border border-primary text-on-surface shadow-sm'
                  : 'bg-surface border border-outline-variant text-on-surface-variant hover:border-primary hover:text-on-surface'
              }`}
            >
              {isSelected && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>{tag}</span>
                  <Check className="w-3.5 h-3.5 text-primary" />
                </>
              )}
              {!isSelected && <span>{tag}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};
