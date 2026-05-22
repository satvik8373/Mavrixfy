import React, { useState, useRef } from 'react';
import { Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { Button } from './ui/button';

interface ShuffleButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'default';
  accentColor?: string;
}

export const ShuffleButton: React.FC<ShuffleButtonProps> = ({
  className,
  size = 'md',
  variant = 'ghost',
  accentColor = '#1ed760'
}) => {
  const { shuffleMode, toggleShuffle, smartShuffle } = usePlayerStore();
  const [isPressed, setIsPressed] = useState(false);

  const isShuffled = shuffleMode !== 'off';

  // Size configurations
  const sizeConfig = {
    sm: {
      button: 'h-8 w-8',
      icon: 'h-4 w-4'
    },
    md: {
      button: 'h-10 w-10',
      icon: 'h-5 w-5'
    },
    lg: {
      button: 'h-12 w-12 sm:h-14 sm:w-14',
      icon: 'h-6 w-6 sm:h-7 sm:w-7'
    }
  };

  const config = sizeConfig[size];

  const handleShuffleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Enhanced touch feedback
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    
    toggleShuffle();
  };

  const handleLongPress = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Long press for smart shuffle
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 200);
    
    smartShuffle();
  };

  // Touch handlers for better mobile experience
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsPressed(true);
    
    // Set up long press detection
    const timer = setTimeout(() => {
      handleLongPress(e as any);
    }, 500);
    touchTimerRef.current = timer;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsPressed(false);
    
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
      // If it was a short press, handle normal click
      handleShuffleToggle(e as any);
    }
  };

  const handleTouchCancel = () => {
    setIsPressed(false);
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const getModeColor = () => {
    switch (shuffleMode) {
      case 'normal':
        return accentColor;
      case 'smart':
        return '#ff6b35'; // Orange for smart shuffle
      default:
        return 'currentColor';
    }
  };

  return (
    <Button
      size="icon"
      variant={variant}
      className={cn(
        config.button,
        'rounded-full flex items-center justify-center transition-all duration-200 touch-target',
        isShuffled ? 'text-current' : 'text-muted-foreground hover:text-foreground',
        isPressed && 'scale-95',
        className
      )}
      style={{
        color: isShuffled ? getModeColor() : undefined,
      }}
      onClick={handleShuffleToggle}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onContextMenu={(e) => e.preventDefault()} // Prevent context menu on long press
    >
      <Shuffle className={config.icon} />
    </Button>
  );
};

export default ShuffleButton;