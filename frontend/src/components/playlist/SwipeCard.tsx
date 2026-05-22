import { useRef, ReactNode } from 'react';

interface SwipeCardProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  children: ReactNode;
}

export function SwipeCard({ onSwipeLeft, onSwipeRight, children }: SwipeCardProps) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const currentX = useRef<number | null>(null);
  const currentY = useRef<number | null>(null);
  const wasSwiped = useRef(false);

  const SWIPE_THRESHOLD = 60; // px - minimum horizontal distance for swipe
  const MOVEMENT_TAP_THRESHOLD = 10; // px - maximum movement to still be considered a tap

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startX.current = x;
    startY.current = y;
    currentX.current = x;
    currentY.current = y;
    wasSwiped.current = false;
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;

    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    currentX.current = x;
    currentY.current = y;

    const deltaX = Math.abs(x - startX.current);
    const deltaY = Math.abs(y - startY.current);

    // If user is moving horizontally more than vertically, prevent default to enable swipe
    if (deltaX > deltaY && deltaX > MOVEMENT_TAP_THRESHOLD) {
      e.preventDefault();
    }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (startX.current === null || currentX.current === null || startY.current === null || currentY.current === null) return;

    const deltaX = currentX.current - startX.current;
    const deltaY = Math.abs(currentY.current - startY.current);
    const absDeltaX = Math.abs(deltaX);

    // Check if this was primarily a horizontal swipe
    const isHorizontalSwipe = absDeltaX > SWIPE_THRESHOLD && absDeltaX > deltaY;

    if (isHorizontalSwipe) {
      // Prevent the click event from firing
      e.preventDefault();
      e.stopPropagation();
      wasSwiped.current = true;

      if (deltaX > SWIPE_THRESHOLD && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < -SWIPE_THRESHOLD && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    startX.current = null;
    startY.current = null;
    currentX.current = null;
    currentY.current = null;

    // Reset swipe flag after a short delay
    setTimeout(() => {
      wasSwiped.current = false;
    }, 100);
  };

  const interceptClick = (e: React.MouseEvent) => {
    // If a swipe just happened, prevent the click
    if (wasSwiped.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      onClick={interceptClick}
      style={{
        userSelect: 'none',
        touchAction: 'pan-y' // Allow vertical scrolling but handle horizontal gestures
      }}
    >
      {children}
    </div>
  );
}
