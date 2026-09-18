import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { WearableStatus } from '../api/types';
import {
  Watch,
  Download,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  X,
  ExternalLink,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [wearables, setWearables] = useState<WearableStatus>({
    appleHealth: false,
    fitbit: false,
    googleFit: false,
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getWearableStatus().then(setWearables);
  }, []);

  const handleToggleWearable = async (key: 'appleHealth' | 'fitbit' | 'googleFit') => {
    const updated = await apiClient.updateWearableStatus({
      [key]: !wearables[key],
    });
    setWearables(updated);
  };

  const handleExportData = async () => {
    setExportLoading(true);
    setExportSuccess(false);
    try {
      const data = await apiClient.exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sanctuary_data_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationInput !== 'DELETE') return;
    setDeleteLoading(true);
    try {
      const res = await apiClient.deleteUserData('DELETE');
      setDeleteSuccessMsg(res.message);
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    } catch (err: any) {
      console.error('Delete failed:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-headline text-3xl text-on-surface font-medium tracking-tight">
          Settings &amp; Data Sovereignty
        </h1>
        <p className="text-sm text-on-surface-variant">
          Control your biometric integrations, privacy preferences, and personal data records.
        </p>
      </div>

      {/* Section 1: Wearables & Hardware Biometrics */}
      <section className="bg-surfaceLowest border border-outline-variant rounded-3xl p-6 sm:p-7 shadow-resting space-y-5">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary flex-shrink-0">
            <Watch className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="font-headline text-lg font-medium text-on-surface">
              Wearable Integrations (Optional)
            </h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Sanctuary is built with a strict <span className="font-medium text-primary">no-wearable default</span>. The app is 100% complete and fully functional without any wearable connected. If linked, resting heart-rate delta is used solely to calibrate relief technique efficacy.
            </p>
          </div>
        </div>

        <div className="divide-y divide-outline-variant/40 pt-2">
          {/* Apple Health */}
          <div className="py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface">Apple Health</p>
              <p className="text-xs text-outline">Syncs resting heart rate (HRV/BPM) on check-in</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleWearable('appleHealth')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                wearables.appleHealth
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container/80 border border-outline-variant'
              }`}
            >
              {wearables.appleHealth ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Fitbit */}
          <div className="py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface">Fitbit</p>
              <p className="text-xs text-outline">OAuth 2.0 biometric sensor link</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleWearable('fitbit')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                wearables.fitbit
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container/80 border border-outline-variant'
              }`}
            >
              {wearables.fitbit ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Google Fit */}
          <div className="py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface">Google Fit</p>
              <p className="text-xs text-outline">Heart rate and restful sleep duration</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleWearable('googleFit')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                wearables.googleFit
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container/80 border border-outline-variant'
              }`}
            >
              {wearables.googleFit ? 'Connected' : 'Connect'}
            </button>
          </div>
        </div>
      </section>

      {/* Section 2: Privacy & Data Sovereignty */}
      <section className="bg-surfaceLowest border border-outline-variant rounded-3xl p-6 sm:p-7 shadow-resting space-y-6">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="font-headline text-lg font-medium text-on-surface">
              Privacy &amp; Data Ownership
            </h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Per our non-negotiable architectural principles, you have absolute ownership of your mental health data. All reflection notes are encrypted, never indexed for advertising, and fully exportable or erasable on demand.
            </p>
          </div>
        </div>

        {/* Action 1: Export Data */}
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-on-surface">
              Download All My Data
            </p>
            <p className="text-xs text-outline">
              Exports full JSON package of all check-ins, baseline responses, and relief timestamps.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportData}
            disabled={exportLoading}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-medium transition-all shadow-xs active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{exportLoading ? 'Packaging...' : 'Export JSON'}</span>
          </button>
        </div>

        {exportSuccess && (
          <div className="flex items-center space-x-2 text-xs text-primary bg-secondary-container/60 px-4 py-2.5 rounded-xl border border-primary/20">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Data export successfully downloaded to your device.</span>
          </div>
        )}

        {/* Action 2: Irreversible Delete */}
        <div className="p-4 rounded-2xl bg-terracotta-container/40 border border-terracotta/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-terracotta">
              Delete My Account &amp; Data
            </p>
            <p className="text-xs text-on-surface-variant">
              Permanently and irreversibly wipe all profile, check-in history, and baseline records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full bg-terracotta text-white text-xs sm:text-sm font-medium hover:bg-terracotta-dark transition-all shadow-xs active:scale-95 flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Everything</span>
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal (Double Opt-In) */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-surfaceLowest border border-outline-variant rounded-3xl p-6 shadow-modal relative space-y-4">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-terracotta">
              <div className="w-10 h-10 rounded-full bg-terracotta-container flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-headline text-lg font-medium text-on-surface">
                Permanently Delete Data?
              </h3>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              This action is immediate and cannot be undone. All check-ins, baseline assessments, and session logs will be permanently erased.
            </p>

            <div className="space-y-2 pt-1">
              <label className="block text-xs font-medium text-on-surface-variant">
                Type <span className="font-mono text-terracotta font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-xl bg-surface border border-outline-variant p-3 text-sm text-on-surface focus:outline-none focus:border-terracotta"
              />
            </div>

            {deleteSuccessMsg && (
              <p className="text-xs text-primary font-medium">{deleteSuccessMsg}</p>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-full text-xs font-medium text-on-surface-variant hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationInput !== 'DELETE' || deleteLoading}
                onClick={handleDeleteAccount}
                className="px-5 py-2 rounded-full bg-terracotta hover:bg-terracotta-dark text-white text-xs font-medium disabled:opacity-40 transition-colors"
              >
                {deleteLoading ? 'Erasing...' : 'Confirm Permanent Erasure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
