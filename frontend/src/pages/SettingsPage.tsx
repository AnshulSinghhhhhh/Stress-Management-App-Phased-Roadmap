import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { WearableStatus, ConsentStatus } from '../api/types';
import {
  Watch,
  Download,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [wearables, setWearables] = useState<WearableStatus>({
    appleHealth: false,
    fitbit: false,
    googleFit: false,
  });
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getWearableStatus().then(setWearables);
    loadConsent();
  }, []);

  const loadConsent = async () => {
    try {
      const status = await apiClient.getConsentStatus();
      setConsentStatus(status);
    } catch (e) {
      console.error('Failed to load consent:', e);
    }
  };

  const handleToggleConsent = async (consentType: string, currentlyActive: boolean) => {
    setConsentLoading(true);
    try {
      if (currentlyActive) {
        await apiClient.revokeConsent(consentType);
      } else {
        await apiClient.grantConsent(consentType, '2.0.0');
      }
      await loadConsent();
    } catch (err) {
      console.error('Failed to toggle consent:', err);
    } finally {
      setConsentLoading(false);
    }
  };

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
      await apiClient.deleteUserAccount();
      setDeleteSuccessMsg('All account records and longitudinal history successfully erased.');
      setTimeout(() => {
        setShowDeleteModal(false);
        setDeleteConfirmationInput('');
        setDeleteSuccessMsg(null);
      }, 2000);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[960px] mx-auto px-4 md:px-6 py-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="font-headline text-2xl sm:text-3xl text-on-surface font-semibold tracking-tight">
          Settings &amp; Governance
        </h1>
        <p className="text-sm text-stone-700">
          Manage integrations, revisitable consent permissions, and data sovereignty.
        </p>
      </div>

      {/* Section 1: Wearable Integrations */}
      <section className="bg-surfaceLowest border border-outline-variant rounded-3xl p-6 sm:p-7 shadow-resting space-y-6">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary-dark flex-shrink-0">
            <Watch className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="font-headline text-lg sm:text-xl font-semibold text-on-surface">
              Wearable Integrations (Optional)
            </h2>
            <p className="text-sm text-stone-700 leading-relaxed">
              Sanctuary is built with a strict <span className="font-semibold text-primary-dark">no-wearable default</span>. The app is 100% complete and fully functional without any wearable connected. If linked, resting heart-rate delta is used solely to calibrate relief technique efficacy.
            </p>
          </div>
        </div>

        <div className="divide-y divide-outline-variant/50 pt-2">
          {/* Apple Health */}
          <div className="py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-on-surface">Apple Health</p>
              <p className="text-sm text-stone-700">Syncs resting heart rate (HRV/BPM) on check-in</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleWearable('appleHealth')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                wearables.appleHealth
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-stone-700 hover:bg-surface-container-high border border-outline-variant'
              }`}
            >
              {wearables.appleHealth ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Fitbit */}
          <div className="py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-on-surface">Fitbit</p>
              <p className="text-sm text-stone-700">OAuth 2.0 biometric sensor link</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleWearable('fitbit')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                wearables.fitbit
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-stone-700 hover:bg-surface-container-high border border-outline-variant'
              }`}
            >
              {wearables.fitbit ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Google Fit */}
          <div className="py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-on-surface">Google Fit</p>
              <p className="text-sm text-stone-700">Heart rate and restful sleep duration</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleWearable('googleFit')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                wearables.googleFit
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-stone-700 hover:bg-surface-container-high border border-outline-variant'
              }`}
            >
              {wearables.googleFit ? 'Connected' : 'Connect'}
            </button>
          </div>
        </div>
      </section>

      {/* Section 2: Privacy, Consent & Data Governance */}
      <section className="bg-surfaceLowest border border-outline-variant rounded-3xl p-6 sm:p-7 shadow-resting space-y-6">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary-dark flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="font-headline text-lg sm:text-xl font-semibold text-on-surface">
              Privacy, Consent &amp; Data Governance
            </h2>
            <p className="text-sm text-stone-700 leading-relaxed">
              In compliance with GDPR and India DPDP Act standards, all consent decisions are logged to an immutable audit trail (<code className="font-mono font-semibold text-primary-dark">consent_log</code>). You can review or revoke optional data permissions at any time.
            </p>
          </div>
        </div>

        <div className="divide-y divide-outline-variant/50 pt-1">
          {/* Terms & Health Privacy */}
          <div className="py-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-on-surface">Terms &amp; Health Privacy</span>
                <span className="text-sm px-2.5 py-0.5 rounded-full bg-secondary-container text-primary-dark font-semibold">Core Required</span>
              </div>
              <p className="text-sm text-stone-700">Active consent v2.0.0 — required to operate your account and emergency crisis safeguard.</p>
            </div>
            <div className="text-sm font-bold text-primary-dark px-3.5 py-1.5 bg-secondary-container/60 rounded-full border border-primary/20">
              Active
            </div>
          </div>

          {/* Wearable Biometrics Consent */}
          <div className="py-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-bold text-on-surface">Wearable Sensor Processing</p>
              <p className="text-sm text-stone-700">Authorizes processing of HRV/BPM resting deltas to calibrate relief efficacy.</p>
            </div>
            <button
              type="button"
              disabled={consentLoading}
              onClick={() => handleToggleConsent('wearable_data', !!consentStatus?.active_consents?.wearable_data)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                consentStatus?.active_consents?.wearable_data
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-stone-700 hover:bg-surface-container-high border border-outline-variant'
              }`}
            >
              {consentStatus?.active_consents?.wearable_data ? 'Granted' : 'Revoked / Opt-Out'}
            </button>
          </div>

          {/* Anonymous Analytics Consent */}
          <div className="py-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-bold text-on-surface">Anonymous Aggregated Research</p>
              <p className="text-sm text-stone-700">Contributes de-identified aggregate patterns to improve clinical scale accuracy.</p>
            </div>
            <button
              type="button"
              disabled={consentLoading}
              onClick={() => handleToggleConsent('anonymous_analytics', !!consentStatus?.active_consents?.anonymous_analytics)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                consentStatus?.active_consents?.anonymous_analytics
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-stone-700 hover:bg-surface-container-high border border-outline-variant'
              }`}
            >
              {consentStatus?.active_consents?.anonymous_analytics ? 'Granted' : 'Revoked / Opt-Out'}
            </button>
          </div>
        </div>

        {/* Collapsible Immutable Audit Trail */}
        <div className="pt-2 border-t border-outline-variant/50">
          <button
            type="button"
            onClick={() => setShowAuditTrail(!showAuditTrail)}
            className="w-full flex items-center justify-between text-sm font-semibold text-stone-700 hover:text-primary-dark transition-colors py-2"
          >
            <span className="inline-flex items-center space-x-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Immutable Consent Audit Log ({consentStatus?.history?.length || 0} events)</span>
            </span>
            {showAuditTrail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAuditTrail && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-outline-variant/60 bg-surface-container-low/50 animate-fade-in">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container border-b border-outline-variant text-stone-700">
                  <tr>
                    <th className="p-3 font-semibold">Consent Type</th>
                    <th className="p-3 font-semibold">Version</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {consentStatus?.history && consentStatus.history.length > 0 ? (
                    consentStatus.history.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-low">
                        <td className="p-3 font-mono text-sm text-on-surface font-medium">{item.consent_type}</td>
                        <td className="p-3 text-stone-700">{item.version}</td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-sm font-semibold ${
                              item.granted
                                ? 'bg-secondary-container text-primary-dark'
                                : 'bg-surface-container text-stone-700'
                            }`}
                          >
                            {item.granted ? 'Granted' : 'Revoked'}
                          </span>
                        </td>
                        <td className="p-3 text-stone-700 text-sm">
                          {item.granted_at ? new Date(item.granted_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-stone-700 italic">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Privacy & Data Sovereignty */}
      <section className="bg-surfaceLowest border border-outline-variant rounded-3xl p-6 sm:p-7 shadow-resting space-y-6">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary-dark flex-shrink-0">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="font-headline text-lg sm:text-xl font-semibold text-on-surface">
              Privacy &amp; Data Ownership
            </h2>
            <p className="text-sm text-stone-700 leading-relaxed">
              Per our non-negotiable architectural principles, you have absolute ownership of your mental health data. All reflection notes are encrypted, never indexed for advertising, and fully exportable or erasable on demand.
            </p>
          </div>
        </div>

        {/* Action 1: Export Data */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-bold text-on-surface">
              Download All My Data
            </p>
            <p className="text-sm text-stone-700">
              Exports full JSON package of all check-ins, baseline responses, and relief timestamps.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportData}
            disabled={exportLoading}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-all shadow-xs active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{exportLoading ? 'Packaging...' : 'Export JSON'}</span>
          </button>
        </div>

        {exportSuccess && (
          <div className="flex items-center space-x-2 text-sm text-primary-dark bg-secondary-container/60 px-4 py-2.5 rounded-xl border border-primary/20">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Data export successfully downloaded to your device.</span>
          </div>
        )}

        {/* Action 2: Irreversible Delete */}
        <div className="p-4 sm:p-5 rounded-2xl bg-terracotta-container/40 border border-terracotta/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-bold text-terracotta-dark">
              Delete My Account &amp; Data
            </p>
            <p className="text-sm text-stone-700">
              Permanently and irreversibly wipe all profile, check-in history, and baseline records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full bg-terracotta text-white text-sm font-semibold hover:bg-terracotta-dark transition-all shadow-xs active:scale-95 flex-shrink-0"
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
              className="absolute top-4 right-4 p-2 rounded-full text-stone-700 hover:text-on-surface hover:bg-surface-container"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-terracotta-dark">
              <div className="w-10 h-10 rounded-full bg-terracotta-container flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-terracotta-dark" />
              </div>
              <h3 className="font-headline text-lg font-bold text-on-surface">
                Permanently Delete Data?
              </h3>
            </div>

            <p className="text-sm text-stone-700 leading-relaxed">
              This action is immediate and cannot be undone. All check-ins, baseline assessments, and session logs will be permanently erased.
            </p>

            <div className="space-y-2 pt-1">
              <label className="block text-sm font-semibold text-stone-700">
                Type <span className="font-mono text-terracotta-dark font-bold">DELETE</span> to confirm:
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
              <p className="text-sm text-primary-dark font-bold">{deleteSuccessMsg}</p>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-full text-sm font-semibold text-stone-700 hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationInput !== 'DELETE' || deleteLoading}
                onClick={handleDeleteAccount}
                className="px-5 py-2.5 rounded-full bg-terracotta hover:bg-terracotta-dark text-white text-sm font-semibold disabled:opacity-40 transition-colors"
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
