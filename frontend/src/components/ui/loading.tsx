import React from 'react';
import { cn } from '@/lib/utils';

// Minimalistic spinner component with consistent styling
export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4', 
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
};

// Simple, elegant spinner - just a rotating circle
export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md',
  className 
}) => {
  return (
    <div 
      className={cn(
        'rounded-full border-2 border-muted border-t-primary animate-spin',
        sizeClasses[size],
        className
      )}
    />
  );
};

// Loading Container Component
export interface LoadingProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text,
  fullScreen = false,
  className
}) => {
  const containerClasses = cn(
    'flex flex-col items-center justify-center gap-3',
    {
      'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm': fullScreen,
      'py-8': !fullScreen
    },
    className
  );

  return (
    <div className={containerClasses}>
      <Spinner size={size} />
      {text && (
        <p className="text-sm text-muted-foreground">
          {text}
        </p>
      )}
    </div>
  );
};

// Inline Loading Component (for buttons, small spaces)
export interface InlineLoadingProps {
  size?: 'xs' | 'sm' | 'md';
  text?: string;
  className?: string;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  size = 'sm',
  text,
  className
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Spinner size={size} />
      {text && (
        <span className="text-sm text-muted-foreground">
          {text}
        </span>
      )}
    </div>
  );
};

// Page Loading Component (for route transitions)
export const PageLoading: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <Loading
      size="lg"
      text={text}
      fullScreen
    />
  );
};

// Content Loading Component (for sections within pages)
export const ContentLoading: React.FC<{ 
  text?: string; 
  height?: string;
}> = ({ 
  text = 'Loading...', 
  height = 'h-64'
}) => {
  return (
    <div className={cn('flex items-center justify-center', height)}>
      <Loading
        size="md"
        text={text}
      />
    </div>
  );
};

// Button Loading Component
export const ButtonLoading: React.FC<{ text?: string }> = ({ text }) => {
  return (
    <InlineLoading
      size="sm"
      text={text}
    />
  );
};

// Simple Loading Skeleton Components
export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('skeleton-pulse', className)}>
      <div className="rounded-lg aspect-square mb-3 skeleton-pulse" />
      <div className="space-y-2">
        <div className="h-4 rounded w-3/4 skeleton-pulse" />
        <div className="h-3 rounded w-1/2 skeleton-pulse" />
      </div>
    </div>
  );
};

export const ListSkeleton: React.FC<{ 
  items?: number; 
  className?: string;
}> = ({ items = 5, className }) => {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="skeleton-pulse flex items-center gap-x-3" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="h-12 w-12 rounded-md skeleton-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 rounded w-3/4 skeleton-pulse" />
            <div className="h-3 rounded w-1/2 skeleton-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Export main components
export {
  Spinner as DefaultSpinner,
  Loading as DefaultLoading,
  InlineLoading as DefaultInlineLoading
};
