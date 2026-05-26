import React, { useRef, useState } from 'react';
import ShuffleIcon from '@mui/icons-material/Shuffle';
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
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

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

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    toggleShuffle();
  };

  const handleLongPress = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    longPressTriggeredRef.current = true;
    smartShuffle();
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsPressed(true);

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      handleLongPress(e);
    }, 550);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsPressed(false);
    clearLongPressTimer();
  };

  const handlePointerCancel = () => {
    setIsPressed(false);
    clearLongPressTimer();
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
      type="button"
      size="icon"
      variant={variant}
      aria-label={shuffleMode === 'off' ? 'Turn shuffle on' : shuffleMode === 'normal' ? 'Turn smart shuffle on' : 'Turn shuffle off'}
      aria-pressed={isShuffled}
      title={shuffleMode === 'smart' ? 'Smart shuffle on' : isShuffled ? 'Shuffle on' : 'Shuffle off'}
      className={cn(
        config.button,
        'rounded-full flex items-center justify-center transition-all duration-200 touch-target select-none',
        isShuffled ? 'text-current' : 'text-muted-foreground hover:text-foreground',
        isPressed && 'scale-95',
        className
      )}
      style={{
        color: isShuffled ? getModeColor() : undefined,
      }}
      onClick={handleShuffleToggle}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerCancel}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ShuffleIcon className={config.icon} />
    </Button>
  );
};

export default ShuffleButton;
