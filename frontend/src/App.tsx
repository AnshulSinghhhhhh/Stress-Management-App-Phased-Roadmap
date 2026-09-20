import React, { useState } from 'react';
import { Header, NavTab } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ReliefLibraryPage } from './pages/ReliefLibraryPage';
import { TrendsBaselinePage } from './pages/TrendsBaselinePage';
import { SettingsPage } from './pages/SettingsPage';
import { CheckinModal } from './components/CheckinModal';
import { CrisisModal } from './components/CrisisModal';
import { ReliefTimer } from './components/ReliefTimer';
import { CrisisResponse, ReliefTechniqueId } from './api/types';
import { Leaf } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
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

  const handleCheckinSuccess = () => {
    setRefreshCounter((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-on-surface antialiased selection:bg-secondary-container selection:text-primary">
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCrisis={() => handleOpenCrisis()}
        onQuickRelief={() => handleQuickRelief('square_breathing')}
        onOpenCheckin={() => setIsCheckinModalOpen(true)}
      />

      {/* Main Responsive Canvas Lane */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-4">
        {activeTab === 'dashboard' && (
          <DashboardPage
            onOpenCheckin={() => setIsCheckinModalOpen(true)}
            onTriggerRelief={handleQuickRelief}
            refreshTrigger={refreshCounter}
          />
        )}

        {activeTab === 'relief-library' && <ReliefLibraryPage />}

        {activeTab === 'trends-baseline' && (
          <TrendsBaselinePage onTriggerRelief={handleQuickRelief} />
        )}

        {activeTab === 'settings' && <SettingsPage />}
      </main>

      {/* Single Check-In Flow Modal */}
      <CheckinModal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        onSuccess={handleCheckinSuccess}
        onTriggerRelief={handleQuickRelief}
        onTriggerCrisisModal={handleOpenCrisis}
      />

      {/* Global Crisis Resources Modal */}
      <CrisisModal
        isOpen={isCrisisModalOpen}
        onClose={handleCloseCrisis}
        crisisData={crisisData}
      />

      {/* Somatic Relief Session Timer */}
      {activeReliefTechnique && (
        <ReliefTimer
          techniqueId={activeReliefTechnique}
          onClose={() => setActiveReliefTechnique(null)}
        />
      )}

      {/* Shared Minimal Web Footer */}
      <footer className="w-full py-6 px-4 md:px-8 border-t border-outline-variant bg-surface mt-12">
        <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-stone-700">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center text-primary-dark">
              <Leaf className="w-3.5 h-3.5" />
            </div>
            <span className="font-headline font-bold text-primary-dark">Sanctuary</span>
            <span className="text-outline-variant">•</span>
            <span>Private &amp; local-first. No ads, no tracking.</span>
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
