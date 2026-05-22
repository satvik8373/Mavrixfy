import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface EqualiserAnimationProps {
  className?: string;
}

interface BarState {
  id: number;
  height: number;
}

const EqualiserAnimation = ({ className }: EqualiserAnimationProps) => {
  const [bars, setBars] = useState<BarState[]>([
    { id: 1, height: 50 },
    { id: 2, height: 75 },
    { id: 3, height: 60 },
  ]);
  
  useEffect(() => {
    // Update animation every 250ms
    const interval = setInterval(() => {
      setBars(prev => prev.map(bar => ({ ...bar, height: Math.random() * 100 })));
    }, 250);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className={cn('flex items-center justify-center space-x-0.5', className)}>
      {bars.map((bar) => (
        <div 
          key={bar.id} 
          className="w-0.5 bg-green-500" 
          style={{ height: `${Math.max(40, bar.height)}%` }}
        ></div>
      ))}
    </div>
  );
};

export default EqualiserAnimation; 