import { useEffect, useRef } from 'react';

interface SplashScreenProps {
  onComplete?: () => void; // Made optional since we control timing externally
}

const SplashScreen = ({}: SplashScreenProps) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950"
      aria-label="Mavrixfy splash screen"
    >
      {/* Container for perfect centering with GPU acceleration */}
      <div 
        className="relative w-32 h-32 md:w-40 md:h-40 transform transition-transform duration-500 ease-out scale-100"
      >
        {/* Optimized logo with fade-in animation */}
        <img
          src="/mavrixfy.png"
          alt="Mavrixfy"
          className="absolute inset-0 w-full h-full object-contain animate-fade-in"
          aria-label="Mavrixfy logo"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
};

export default SplashScreen;
