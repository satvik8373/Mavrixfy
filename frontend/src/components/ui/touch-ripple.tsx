import React, { useState, useEffect, useRef } from 'react';

interface RippleProps {
  color?: string;
  duration?: number;
  opacity?: number;
}

interface TouchRippleProps extends RippleProps {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

export const TouchRipple = ({
  children,
  color = 'rgba(255, 255, 255, 0.3)',
  duration = 600,
  opacity = 0.3,
  disabled = false,
  className = '',
}: TouchRippleProps) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextKey = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Add keyframe animation to document once
  useEffect(() => {
    // Check if the animation already exists
    if (!document.getElementById('touch-ripple-style')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'touch-ripple-style';
      styleElement.textContent = `
        @keyframes touch-ripple-animation {
          to {
            transform: scale(1);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(styleElement);
    }
    
    // Cleanup effect when component unmounts
    return () => {
      setRipples([]);
    };
  }, []);

  // Auto remove ripples after animation completes
  useEffect(() => {
    if (ripples.length === 0) return;
    
    const timeout = setTimeout(() => {
      setRipples((prevRipples) => prevRipples.slice(1));
    }, duration);
    
    return () => clearTimeout(timeout);
  }, [ripples, duration]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !containerRef.current) return;
    
    // Only handle touch or mouse left-click events
    if (e.pointerType !== 'touch' && e.pointerType !== 'mouse') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Get click position relative to the element
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate ripple size based on element's size
    const size = Math.max(rect.width, rect.height) * 2;
    
    // Add new ripple
    const newRipple = { x, y, size, id: nextKey.current };
    nextKey.current += 1;
    
    setRipples((prevRipples) => [...prevRipples, newRipple]);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onPointerDown={handlePointerDown}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Render ripples */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none scale-0"
          style={{
            top: ripple.y - ripple.size / 2,
            left: ripple.x - ripple.size / 2,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color,
            opacity: opacity,
            animation: `touch-ripple-animation ${duration}ms ease-out`,
          }}
        />
      ))}
      
      {/* Content */}
      {children}
    </div>
  );
};

export default TouchRipple; 