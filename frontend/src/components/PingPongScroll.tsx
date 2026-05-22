import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface PingPongScrollProps {
    text: string;
    className?: string;
    velocity?: number; // px/sec
    delay?: number; // seconds
}

export const PingPongScroll = ({
    text,
    className,
    velocity = 28, // fast & smooth
    delay = 1.2,
}: PingPongScrollProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    const position = useRef(0);
    const direction = useRef(1);
    const lastTime = useRef<number | null>(null);
    const pauseUntil = useRef<number | null>(null);

    // Measure overflow and manage smooth animation loop
    useEffect(() => {
        // Reset state on text change
        position.current = 0;
        direction.current = 1;
        pauseUntil.current = null;
        if (textRef.current) {
            textRef.current.style.transform = 'translate3d(0,0,0)';
        }

        if (!containerRef.current || !textRef.current) return;

        let maxOffsetVal = 0;
        let animationFrameId: number | null = null;

        const animate = (time: number) => {
            if (lastTime.current === null) lastTime.current = time;

            // Clamp delta to avoid jumps (IMPORTANT)
            let delta = (time - lastTime.current) / 1000;
            delta = Math.min(delta, 0.033); // max ~30fps step
            lastTime.current = time;

            // Pause at edges
            if (pauseUntil.current && time < pauseUntil.current) {
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            position.current += direction.current * velocity * delta;

            if (position.current >= maxOffsetVal) {
                position.current = maxOffsetVal;
                direction.current = -1;
                pauseUntil.current = time + delay * 1000;
            } else if (position.current <= 0) {
                position.current = 0;
                direction.current = 1;
                pauseUntil.current = time + delay * 1000;
            }

            // Sub-pixel smoothing + GPU transform
            const smoothX = Math.round(position.current * 100) / 100;

            if (textRef.current) {
                textRef.current.style.transform =
                    `translate3d(${-smoothX}px, 0, 0)`;
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        const checkOverflow = () => {
            if (!containerRef.current || !textRef.current) return;
            const containerWidth = containerRef.current.clientWidth;
            const textWidth = textRef.current.scrollWidth;
            const diff = textWidth - containerWidth;
            maxOffsetVal = diff > 1 ? diff : 0;

            // Start or stop animation based on overflow
            if (maxOffsetVal > 0) {
                if (!animationFrameId) {
                    lastTime.current = null;
                    pauseUntil.current = null;
                    animationFrameId = requestAnimationFrame(animate);
                }
            } else {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                if (textRef.current) {
                    textRef.current.style.transform = 'translate3d(0,0,0)';
                }
            }
        };

        const observer = new ResizeObserver(checkOverflow);
        observer.observe(containerRef.current);
        // Also check initially
        checkOverflow();

        return () => {
            observer.disconnect();
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            lastTime.current = null;
            pauseUntil.current = null;
        };
    }, [text, velocity, delay]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "w-full overflow-hidden relative",
                className
            )}
        >
            <div
                ref={textRef}
                className="w-max whitespace-nowrap will-change-transform"
                style={{
                    transform: 'translate3d(0,0,0)', // GPU warm-up
                }}
            >
                {text}
            </div>
        </div>
    );
};
