import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Dismissible demo mode toast notification
 * Shows only in demo mode, persists dismissal in localStorage
 */
export default function DemoBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show toast if explicitly in demo mode OR if domain contains 'demo' or it's a deployment
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
      // Show on every page load for demo environments
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
  };

  // Don't render if not demo mode or dismissed
  if (!show) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-[#7866CC]/90 via-[#9B7EF7]/90 to-[#AF97F8]/90 rounded-lg shadow-lg p-4 max-w-sm transition-all duration-300 animate-in slide-in-from-bottom-2 fade-in"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-white leading-relaxed">
            Demo mode: Data may reset periodically but remains private to your browser.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss demo notification"
          className="flex-shrink-0 rounded-md p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Reset toast visibility (for testing/admin)
 */
export const resetDemoBanner = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('demo-toast-dismissed');
    window.location.reload();
  }
};