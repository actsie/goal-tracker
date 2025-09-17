import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Pawgrammer branding banner
 * Displays at the top of the application to promote Pawgrammer
 */
export default function PawgrammerBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Emit banner hover state to global window event
  useEffect(() => {
    const event = new CustomEvent('bannerHover', { detail: { isHovered } });
    window.dispatchEvent(event);
  }, [isHovered]);

  if (!isVisible) return null;

  return (
    <div
      className="relative isolate flex items-center gap-x-6 overflow-hidden bg-gradient-to-r from-[#7866CC]/80
via-[#9B7EF7]/80 to-[#AF97F8]/80 px-6 py-2.5 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0
after:h-px after:bg-white/10 sm:px-3.5 sm:before:flex-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-[max(-7rem,calc(50%-52rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl"
      >
        <div
          style={{
            clipPath:
              'polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)',
          }}
          className="aspect-[577/310] w-[36.0625rem] bg-[#fcf3fa] opacity-40"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-[max(45rem,calc(50%+8rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl"
      >
        <div
          style={{
            clipPath:
              'polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)',
          }}
          className="aspect-[577/310] w-[36.0625rem] bg-[#fcf3fa] opacity-40"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm/6 text-gray-100">
          <strong className="font-semibold">Built with Pawgrammer</strong>
          <svg viewBox="0 0 2 2" aria-hidden="true" className="mx-2 inline size-0.5 fill-current">
            <circle r={1} cx={1} cy={1} />
          </svg>
          Make it yours, give it your spin - no heavy setup.
        </p>
        <a
          href="https://pawgrammer.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none rounded-full bg-white/10 px-3.5 py-1 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-white/20 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Build my version <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
      <div className="flex flex-1 justify-end">
        <button
          type="button"
          onClick={() => {
            setIsVisible(false);
            // Emit banner dismissed event
            const event = new CustomEvent('bannerDismissed');
            window.dispatchEvent(event);
          }}
          className="-m-3 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="sr-only">Dismiss</span>
          <X aria-hidden="true" className="h-5 w-5 text-gray-100" />
        </button>
      </div>
    </div>
  );
}