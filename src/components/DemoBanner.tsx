import { useEffect, useState } from 'react';
import { X, Info } from 'lucide-react';

/**
 * Dismissible demo mode banner
 * Shows only in demo mode, persists dismissal in localStorage
 */
export default function DemoBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show banner if explicitly in demo mode OR if domain contains 'demo' or it's a deployment
    const isDemoEnvironment =
      (typeof window !== 'undefined' && (
        window.location.hostname.includes('demo') ||
        window.location.hostname.includes('vercel.app') ||
        window.location.hostname.includes('netlify.app') ||
        window.location.hostname.includes('github.io') ||
        window.location.hostname.includes('surge.sh') ||
        window.location.hostname === 'localhost'
      ));

    if (isDemoEnvironment) {
      const dismissed = localStorage.getItem('demo-banner-dismissed');
      if (dismissed !== 'true') {
        setShow(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('demo-banner-dismissed', 'true');
    setShow(false);
  };

  // Don't render if not demo mode or dismissed
  if (!show) return null;

  return (
    <div
      role="banner"
      aria-labelledby="demo-banner-title"
      className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <Info
            className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <div>
            <h2
              id="demo-banner-title"
              className="text-sm font-medium text-blue-900 mb-1"
            >
              Demo Mode Active
            </h2>
            <div className="space-y-2">
              <p className="text-sm text-blue-800 leading-relaxed">
                You can test creating goals, adding tasks, and using all features, but data may reset periodically. In the full app, all data is saved permanently in your browser.
              </p>
              <p className="text-sm text-red-700 font-medium leading-relaxed">
                ⚠️ Privacy Note: This demo may share data across users. Avoid entering sensitive personal information.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss demo banner"
          className="flex-shrink-0 rounded-md p-1 text-blue-600 hover:bg-blue-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Reset banner visibility (for testing/admin)
 */
export const resetDemoBanner = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('demo-banner-dismissed');
    window.location.reload();
  }
};