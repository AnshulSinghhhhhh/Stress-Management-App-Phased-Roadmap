import React, { useState } from 'react';
import { Header, NavTab } from './components/Header';
import { CheckinPage } from './pages/CheckinPage';
import { ReliefLibraryPage } from './pages/ReliefLibraryPage';
import { TrendsBaselinePage } from './pages/TrendsBaselinePage';
import { SettingsPage } from './pages/SettingsPage';
import { CrisisModal } from './components/CrisisModal';
import { ReliefTimer } from './components/ReliefTimer';
import { CrisisResponse, ReliefTechniqueId } from './api/types';
import { Leaf } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('daily-pause');
  const [isCrisisModalOpen, setIsCrisisModalOpen] = useState(false);
  const [crisisData, setCrisisData] = useState<CrisisResponse | null>(null);
  const [activeReliefTechnique, setActiveReliefTechnique] = useState<ReliefTechniqueId | null>(
    null
  );

  const handleOpenCrisis = (data?: CrisisResponse | null) => {
    setCrisisData(data || null);
    setIsCrisisModalOpen(true);
  };

  const handleCloseCrisis = () => {
    setIsCrisisModalOpen(false);
  };

  const handleQuickRelief = (techniqueId?: string) => {
    const tech = (techniqueId as ReliefTechniqueId) || 'square_breathing';
    setActiveReliefTechnique(tech);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-on-surface antialiased selection:bg-secondary-container selection:text-primary">
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCrisis={() => handleOpenCrisis()}
        onQuickRelief={() => handleQuickRelief('square_breathing')}
      />

      {/* Main Responsive Canvas Lane */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-4">
        {activeTab === 'daily-pause' && (
          <CheckinPage
            onTriggerRelief={handleQuickRelief}
            onTriggerCrisisModal={handleOpenCrisis}
          />
        )}

        {activeTab === 'relief-library' && <ReliefLibraryPage />}

        {activeTab === 'trends-baseline' && <TrendsBaselinePage />}

        {activeTab === 'settings' && <SettingsPage />}
      </main>

      {/* Global Modals */}
      <CrisisModal
        isOpen={isCrisisModalOpen}
        onClose={handleCloseCrisis}
        crisisData={crisisData}
      />

      {activeReliefTechnique && (
        <ReliefTimer
          techniqueId={activeReliefTechnique}
          onClose={() => setActiveReliefTechnique(null)}
        />
      )}

      {/* Shared Minimal Web Footer matching Stitch design */}
      <footer className="w-full py-6 px-4 md:px-8 border-t border-outline-variant bg-surface mt-12">
        <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-on-surface-variant">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-full bg-secondary-container flex items-center justify-center text-primary">
              <Leaf className="w-3 h-3" />
            </div>
            <span className="font-headline font-semibold text-primary">Sanctuary</span>
            <span className="text-outline-variant">•</span>
            <span>End-to-end encrypted &amp; fully private. No ads, no data broker sharing.</span>
          </div>

          <div className="flex items-center space-x-6">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="hover:text-primary transition-colors"
            >
              Privacy &amp; Data Sovereignty
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trends-baseline')}
              className="hover:text-primary transition-colors"
            >
              Baseline Guide
            </button>
            <button
              type="button"
              onClick={() => handleOpenCrisis()}
              className="text-terracotta hover:underline font-medium transition-colors"
            >
              Emergency Resources (India 24/7)
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
