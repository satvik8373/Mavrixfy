import React, { useState } from 'react';
import { Check, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LikeButtonProps {
    isLiked: boolean;
    onToggle: (e: React.MouseEvent) => void;
    className?: string;
    iconSize?: number;
    activeColor?: string;
}

interface LikeButtonState {
    isProcessing: boolean;
}

export const LikeButton = ({
    isLiked,
    onToggle,
    className,
    iconSize = 20,
    activeColor = "text-green-500"
}: LikeButtonProps) => {
    const [state, setState] = useState<LikeButtonState>({
        isProcessing: false
    });

    const handleLikeButtonClick = (e: React.MouseEvent) => {
        // Prevent event bubbling to avoid conflicts
        e.preventDefault();
        e.stopPropagation();

        // Prevent multiple rapid clicks
        if (state.isProcessing) return;

        setState(prev => ({ ...prev, isProcessing: true }));

        // Haptic feedback if available
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(30); // Shorter vibration
        }

        onToggle(e);

        // Reset processing state after a short delay
        setTimeout(() => {
            setState(prev => ({ ...prev, isProcessing: false }));
        }, 300);
    };

    return (
        <button type="button"
            onClick={handleLikeButtonClick}
            disabled={state.isProcessing}
            className={cn(
                "transition-transform duration-150 active:scale-95 flex items-center justify-center relative",
                isLiked ? activeColor : "text-muted-foreground hover:text-foreground",
                state.isProcessing && "opacity-70 cursor-not-allowed",
                className
            )}
            aria-label={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
        >
            <div className={cn("relative transition-all duration-200", isLiked ? "scale-105" : "scale-100")}>
                {isLiked ? (
                    <div
                        className="rounded-full bg-green-500 flex items-center justify-center transition-all duration-200"
                        style={{ width: iconSize, height: iconSize }}
                    >
                        <Check
                            size={iconSize * 0.6}
                            strokeWidth={3}
                            className="text-white"
                        />
                    </div>
                ) : (
                    <PlusCircle
                        size={iconSize}
                        className="transition-all duration-200 text-white"
                    />
                )}
            </div>
        </button>
    );
};
