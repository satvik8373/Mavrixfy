import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
  showArrows?: boolean;
  itemWidth?: number;
  gap?: number;
  snapToItems?: boolean;
  autoHideArrows?: boolean;
  edgeToEdge?: boolean;
}

export const HorizontalScroll: React.FC<HorizontalScrollProps> = ({
  children,
  className,
  showArrows = true,
  itemWidth = 180,
  gap = 16,
  snapToItems = false,
  autoHideArrows = true,
  edgeToEdge = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const [isHovered, setIsHovered] = useState(false);

  // Simple effect that only runs once
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const updateScrollButtons = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scrollElement;
      setScrollState({
        canScrollLeft: scrollLeft > 5,
        canScrollRight: scrollLeft < scrollWidth - clientWidth - 5,
      });
    };

    // Add event listeners
    scrollElement.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);

    // Initial check after a brief delay to ensure DOM is ready
    const timer = setTimeout(updateScrollButtons, 100);

    return () => {
      clearTimeout(timer);
      scrollElement.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, []); // No dependencies to avoid infinite loops

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    
    const scrollAmount = itemWidth * 3 + gap * 2;
    const newScrollLeft = direction === 'left' 
      ? scrollRef.current.scrollLeft - scrollAmount
      : scrollRef.current.scrollLeft + scrollAmount;
    
    scrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  return (
    <div 
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left Arrow */}
      {showArrows && scrollState.canScrollLeft && (
        <button type="button"
          onClick={() => scroll('left')}
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2 z-30",
            "w-10 h-10 rounded-full bg-black/80 hover:bg-black/90",
            "flex items-center justify-center text-white",
            "transition-all duration-200 hover:scale-105",
            "shadow-lg backdrop-blur-sm",
            autoHideArrows 
              ? (isHovered ? "opacity-100" : "opacity-0")
              : "opacity-100"
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Right Arrow */}
      {showArrows && scrollState.canScrollRight && (
        <button type="button"
          onClick={() => scroll('right')}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 z-30",
            "w-10 h-10 rounded-full bg-black/80 hover:bg-black/90",
            "flex items-center justify-center text-white",
            "transition-all duration-200 hover:scale-105",
            "shadow-lg backdrop-blur-sm",
            autoHideArrows 
              ? (isHovered ? "opacity-100" : "opacity-0")
              : "opacity-100"
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Scroll Container */}
      <div className={cn("w-full overflow-hidden", edgeToEdge ? "" : "px-4 md:px-6")}>
        <div
          ref={scrollRef}
          className={cn(
            "flex overflow-x-auto overflow-y-hidden",
            "scrollbar-hide",
            snapToItems && "snap-x snap-mandatory",
            edgeToEdge && "pl-4 md:pl-6 pr-4 md:pr-6",
            className
          )}
          style={{
            gap: `${gap}px`,
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// Individual scroll item wrapper
interface ScrollItemProps {
  children: React.ReactNode;
  className?: string;
  width?: number | string;
  snapToCenter?: boolean;
}

export const ScrollItem: React.FC<ScrollItemProps> = ({
  children,
  className,
  width = 180,
  snapToCenter = false,
}) => {
  return (
    <div
      className={cn(
        "flex-shrink-0",
        snapToCenter && "snap-center",
        className
      )}
      style={{ width: typeof width === 'number' ? `${width}px` : width }}
    >
      {children}
    </div>
  );
};
