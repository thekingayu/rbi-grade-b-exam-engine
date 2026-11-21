import React from 'react';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export interface Glass3DActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface Glass3DCardProps {
  accentColor: string;
  secondaryAccentColor?: string;
  logoIcon: React.ReactNode;
  kicker?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: Glass3DActionItem[];
  ctaLabel: string;
  onCardClick: () => void;
  className?: string;
  minHeightClass?: string;
}

export const Glass3DCard: React.FC<Glass3DCardProps> = ({
  accentColor,
  secondaryAccentColor,
  logoIcon,
  kicker,
  title,
  description,
  children,
  actions = [],
  ctaLabel,
  onCardClick,
  className,
  minHeightClass = 'min-h-[312px]'
}) => {
  const accent2 = secondaryAccentColor || accentColor;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCardClick();
    }
  };

  return (
    <div
      className={clsx('u3d-parent group cursor-pointer select-none', className)}
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={handleKeyDown}
      style={
        {
          '--u3d-accent': accentColor,
          '--u3d-accent-2': accent2,
          '--u3d-accent-ink': accentColor
        } as React.CSSProperties
      }
    >
      <div className={clsx('u3d-card flex flex-col justify-between p-6 sm:p-7', minHeightClass)}>
        {/* 5-Layer Concentric 3D Floating Circles (Top-Right Signature Motif) */}
        <div className="u3d-logo" aria-hidden="true">
          <span className="u3d-circle u3d-circle1" />
          <span className="u3d-circle u3d-circle2" />
          <span className="u3d-circle u3d-circle3" />
          <span className="u3d-circle u3d-circle4" />
          <span className="u3d-circle u3d-circle5">{logoIcon}</span>
        </div>

        {/* Sculpted Frosted-Glass Inner Layer */}
        <div className="u3d-glass" aria-hidden="true" />

        {/* Foreground Elevated Content */}
        <div className="u3d-content space-y-3">
          <div className="pr-24 sm:pr-28 min-w-0">
            {kicker && (
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#5C5A52] dark:text-[#B8B3A6] truncate">
                {kicker}
              </p>
            )}
            <h3 className="font-heading font-black text-lg sm:text-xl leading-snug text-[#141413] dark:text-[#FAF8EC] mt-1 group-hover:text-[#0D47FF] dark:group-hover:text-[#ECD5FF] transition-colors line-clamp-2">
              {title}
            </h3>
          </div>

          {description && (
            <p className="text-xs sm:text-[13px] text-[#4A4942] dark:text-[#C5C0B4] leading-relaxed line-clamp-2 pr-4">
              {description}
            </p>
          )}

          {children && <div className="pt-1">{children}</div>}
        </div>

        {/* Bottom Elevated Quick-Action Circles + Primary CTA */}
        <div className="u3d-bottom flex items-center justify-between gap-3 pt-4 mt-4 border-t border-[#141413]/10 dark:border-[#FAF8EC]/10">
          <div className="u3d-action-row">
            {actions.slice(0, 3).map((action, idx) => (
              <button
                key={idx}
                type="button"
                title={action.label}
                aria-label={action.label}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className="u3d-action-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D47FF]"
              >
                {action.icon}
              </button>
            ))}
          </div>

          <span className="u3d-view-more text-xs font-extrabold tracking-tight text-[#141413] dark:text-[#FAF8EC] group-hover:text-[#0D47FF] dark:group-hover:text-[#ECD5FF] whitespace-nowrap shrink-0">
            <span>{ctaLabel}</span>
            <ChevronRight className="w-4 h-4 stroke-[2.5] transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
