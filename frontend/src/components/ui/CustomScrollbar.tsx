import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CustomScrollbarProps {
  children: React.ReactNode;
  className?: string;
  thumbClassName?: string;
  showOnHover?: boolean;
}

interface ScrollbarState {
  isScrolling: boolean;
  isDragging: boolean;
  showScrollbar: boolean;
  isScrollbarHovered: boolean;
  thumbHeight: number;
  thumbTop: number;
}

export const CustomScrollbar: React.FC<CustomScrollbarProps> = ({
  children,
  className,
  thumbClassName,
  showOnHover = true,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<ScrollbarState>({
    isScrolling: false,
    isDragging: false,
    showScrollbar: false,
    isScrollbarHovered: false,
    thumbHeight: 0,
    thumbTop: 0,
  });

  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const dragStartRef = useRef({ y: 0, scrollTop: 0 });

  const updateScrollbar = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollHeight, clientHeight, scrollTop } = container;
    const hasScroll = scrollHeight > clientHeight;

    if (!hasScroll) {
      setState(prev => prev.showScrollbar ? { ...prev, showScrollbar: false } : prev);
      return;
    }

    // Calculate thumb height (proportional to visible content)
    const thumbHeightCalc = Math.max((clientHeight / scrollHeight) * clientHeight, 40);

    // Calculate thumb position
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - thumbHeightCalc;
    const thumbTopCalc = (scrollTop / maxScrollTop) * maxThumbTop;

    setState(prev => {
      if (
        prev.thumbHeight === thumbHeightCalc &&
        prev.thumbTop === thumbTopCalc &&
        prev.showScrollbar
      ) {
        return prev;
      }
      return {
        ...prev,
        thumbHeight: thumbHeightCalc,
        thumbTop: thumbTopCalc,
        showScrollbar: true,
      };
    });
  }, []);

  const handleScroll = useCallback(() => {
    updateScrollbar();
    setState(prev => prev.isScrolling ? prev : { ...prev, isScrolling: true });

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setState(prev => prev.isScrolling ? { ...prev, isScrolling: false } : prev);
    }, 1000);
  }, [updateScrollbar]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setState(prev => prev.isDragging ? prev : { ...prev, isDragging: true });
    dragStartRef.current = {
      y: e.clientY,
      scrollTop: scrollContainerRef.current?.scrollTop || 0,
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!state.isDragging || !scrollContainerRef.current) return;

      const container = scrollContainerRef.current;
      const { scrollHeight, clientHeight } = container;
      const maxScrollTop = scrollHeight - clientHeight;
      const maxThumbTop = clientHeight - state.thumbHeight;

      const deltaY = e.clientY - dragStartRef.current.y;
      const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
      container.scrollTop = dragStartRef.current.scrollTop + scrollDelta;
    },
    [state.isDragging, state.thumbHeight]
  );

  const handleMouseUp = useCallback(() => {
    setState(prev => prev.isDragging ? { ...prev, isDragging: false } : prev);
  }, []);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (!scrollContainerRef.current || !scrollThumbRef.current) return;
    if (e.target === scrollThumbRef.current) return;

    const container = scrollContainerRef.current;
    const { scrollHeight, clientHeight } = container;
    const trackRect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - state.thumbHeight;

    container.scrollTop = (clickY / maxThumbTop) * maxScrollTop;
  }, [state.thumbHeight]);

  const handleScrollRef = useRef(handleScroll);
  const handleMouseMoveRef = useRef(handleMouseMove);
  const handleMouseUpRef = useRef(handleMouseUp);

  useEffect(() => {
    handleScrollRef.current = handleScroll;
    handleMouseMoveRef.current = handleMouseMove;
    handleMouseUpRef.current = handleMouseUp;
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollbar();
    const onScroll = () => handleScrollRef.current();
    container.addEventListener('scroll', onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollbar);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [updateScrollbar]);

  useEffect(() => {
    if (state.isDragging) {
      const onMouseMove = (e: MouseEvent) => handleMouseMoveRef.current(e);
      const onMouseUp = () => handleMouseUpRef.current();

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.userSelect = '';
      };
    }
  }, [state.isDragging]);

  const shouldShowThumb = state.showScrollbar && (!showOnHover || state.isScrolling || state.isDragging || state.isScrollbarHovered);

  return (
    <div className="relative w-full h-full">
      <div
        ref={scrollContainerRef}
        data-scroll-container="true"
        className={cn('w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar-hide', className)}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>

      {/* Custom Scrollbar Track */}
      {state.showScrollbar && (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
          className={cn(
            'absolute top-0 right-0 w-3 h-full pointer-events-auto z-50',
            'transition-opacity duration-200',
            shouldShowThumb ? 'opacity-100' : 'opacity-0'
          )}
          onClick={handleTrackClick}
          onMouseEnter={() => setState(prev => prev.isScrollbarHovered ? prev : { ...prev, isScrollbarHovered: true })}
          onMouseLeave={() => setState(prev => prev.isScrollbarHovered ? { ...prev, isScrollbarHovered: false } : prev)}
        >
          {/* Scrollbar Thumb */}
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
            ref={scrollThumbRef}
            className={cn(
              'absolute right-0.5 w-2.5 rounded-md cursor-pointer transition-all duration-200',
              'bg-[#5a5a5a] hover:bg-[#7a7a7a] active:bg-[#8a8a8a]',
              state.isDragging && 'bg-[#8a8a8a]',
              thumbClassName
            )}
            style={{
              height: `${state.thumbHeight}px`,
              top: `${state.thumbTop}px`,
            }}
            onMouseDown={handleMouseDown}
          />
        </div>
      )}
    </div>
  );
};

export default CustomScrollbar;
