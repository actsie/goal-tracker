import { useEffect, useState } from "react";

type NudgeState = "collapsed" | "open" | "hidden";

interface VideoNudgeProps {
  embedUrl?: string;
  storageKey?: string;
}

export default function VideoNudge({
  embedUrl = "https://www.youtube-nocookie.com/embed/pGNIEEcD3f8?rel=0&modestbranding=1&playsinline=1&autoplay=1",
  storageKey = "video_nudge_state",
}: VideoNudgeProps) {
  const [state, setState] = useState<NudgeState>("collapsed");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showBelowBanner, setShowBelowBanner] = useState(false);
  const [isAnimatingDown, setIsAnimatingDown] = useState(false);
  const [bannerHovered, setBannerHovered] = useState(false);
  const [videoWidgetHovered, setVideoWidgetHovered] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(storageKey)) as NudgeState | null;
    if (saved === "open" || saved === "collapsed" || saved === "hidden") setState(saved);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(storageKey, state);
  }, [state, storageKey]);

  // Listen for banner hover events and banner visibility
  useEffect(() => {
    const handleBannerHover = (event: any) => {
      console.log('Banner hover event received:', event.detail);
      setBannerHovered(event.detail.isHovered);
    };

    const handleBannerDismiss = () => {
      // Close video widget when banner is dismissed
      console.log('Banner dismissed - closing video widget');
      setIsAnimatingDown(false);
      setBannerHovered(false);
      setVideoWidgetHovered(false);
      setTimeout(() => setShowBelowBanner(false), 300);
    };

    window.addEventListener('bannerHover', handleBannerHover);
    window.addEventListener('bannerDismissed', handleBannerDismiss);

    return () => {
      window.removeEventListener('bannerHover', handleBannerHover);
      window.removeEventListener('bannerDismissed', handleBannerDismiss);
    };
  }, []);

  // Show below banner on page load, hide after 2 seconds
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const showTimer = setTimeout(() => {
      setShowBelowBanner(true);

      // Small delay to allow DOM to update, then trigger animation
      setTimeout(() => {
        setIsAnimatingDown(true);
      }, 50);

      const hideTimer = setTimeout(() => {
        setIsAnimatingDown(false);
        // Wait for slide-up animation to complete before hiding
        setTimeout(() => {
          setShowBelowBanner(false);
        }, 300); // Match transition duration
      }, 2000);

      return () => clearTimeout(hideTimer);
    }, 100);

    return () => clearTimeout(showTimer);
  }, []);

  // Show below banner on banner hover, hide 2 seconds after hover ends
  useEffect(() => {
    console.log('Hover effect triggered:', { bannerHovered, videoWidgetHovered, showBelowBanner, isAnimatingDown });
    let timer: NodeJS.Timeout | undefined;

    if (bannerHovered || videoWidgetHovered) {
      // Clear any existing timer
      if (timer) clearTimeout(timer);
      console.log('Setting video widget to show');
      setShowBelowBanner(true);

      // Small delay to allow DOM to update, then trigger animation
      setTimeout(() => {
        setIsAnimatingDown(true);
      }, 50);
    } else if (showBelowBanner) {
      // Only set timer if widget is currently showing
      console.log('Setting timer to hide video widget');
      timer = setTimeout(() => {
        console.log('Timer triggered - hiding video widget');
        setIsAnimatingDown(false);
        // Wait for slide-up animation to complete before hiding
        setTimeout(() => {
          setShowBelowBanner(false);
        }, 300); // Match transition duration
      }, 2000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [bannerHovered, videoWidgetHovered, showBelowBanner]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden"; // Prevent background scroll
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen]);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  if (state === "hidden") return null;

  return (
    <>
      {/* Below banner position */}
      <div
        className={`fixed left-1/2 transform -translate-x-1/2 top-[50px] z-40 transition-all duration-300 ease-in-out
${
          showBelowBanner && isAnimatingDown ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        } ${showBelowBanner ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onMouseEnter={() => setVideoWidgetHovered(true)}
        onMouseLeave={() => setVideoWidgetHovered(false)}
      >
        <div className="w-80 max-w-[90vw] sm:w-72 rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-start justify-between p-4">
            <div>
              <div className="text-sm font-semibold">Demo video</div>
              <p className="text-xs text-gray-600">See how this app was built & how to use it.</p>
            </div>
            <button
              onClick={() => {
                setIsAnimatingDown(false);
                setTimeout(() => setShowBelowBanner(false), 300);
              }}
              className="ml-3 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Thumbnail teaser with play button */}
          <button
            onClick={openModal}
            className="group relative mx-4 mb-3 aspect-video w-[calc(100%-2rem)] overflow-hidden rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors"
            aria-label="Play demo video"
          >
            {/* YouTube thumbnail background */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-80 group-hover:opacity-90 transition-opacity"
              style={{
                backgroundImage: 'url(https://img.youtube.com/vi/pGNIEEcD3f8/maxresdefault.jpg)'
              }}
            />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Duration badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              Demo Video
            </div>
          </button>

          <div className="flex justify-center p-3 pt-0">
            <button
              onClick={() => window.open("https://pawgrammer.com", "_blank", "noopener,noreferrer")}
              className="relative overflow-hidden rounded-full bg-gradient-to-r from-[#7866CC] via-[#9B7EF7] to-[#AF97F8] px-3.5 py-1 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#7866CC] focus:ring-offset-2"
              title="Build my version"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              <span className="relative z-10 flex items-center gap-2">
                <span>Build my version</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-2xl lg:max-w-4xl max-h-[80vh] bg-black rounded-lg overflow-hidden shadow-2xl mx-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(90vw, 720px)' }}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-colors text-lg"
              aria-label="Close video"
            >
              ✕
            </button>

            {/* Video container with 16:9 aspect ratio */}
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                title="Demo video"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}