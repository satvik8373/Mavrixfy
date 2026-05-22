import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionWrapperProps {
  title: string;
  subtitle?: string;
  showViewAll?: boolean;
  onViewAll?: () => void;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
  title,
  subtitle,
  showViewAll = false,
  onViewAll,
  children,
  className,
  headerClassName,
}) => {
  return (
    <section className={cn("mb-4 w-full overflow-x-hidden", className)}>
      <div className={cn("flex items-center justify-between mb-3 px-4 md:px-6", headerClassName)}>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-semibold mb-1 truncate text-white">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>
        
        {showViewAll && onViewAll && (
          <button type="button"
            onClick={onViewAll}
            className="text-muted-foreground text-sm font-medium hover:text-foreground transition-colors flex items-center gap-1 hover:underline flex-shrink-0 ml-4"
          >
            Show all
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Section Content - Ensure no overflow */}
      <div className="w-full overflow-x-hidden">
        {children}
      </div>
    </section>
  );
};
