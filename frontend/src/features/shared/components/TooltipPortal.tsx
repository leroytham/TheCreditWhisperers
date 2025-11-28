import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * TooltipPortal Component
 *
 * Renders a tooltip using React Portal to avoid z-index and overflow clipping issues.
 * The tooltip appears on hover and positions itself intelligently to stay within viewport.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The content to display in the tooltip
 * @param {string} props.className - Additional CSS classes for the icon wrapper
 */
interface TooltipPortalProps {
  children: React.ReactNode;
  className?: string;
}

const TooltipPortal: React.FC<TooltipPortalProps> = ({ children, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculatePosition = useCallback(() => {
    if (!iconRef.current) return;

    const iconRect = iconRef.current.getBoundingClientRect();
    const tooltipWidth = 320; // w-80 = 320px
    const padding = 12; // spacing from icon
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get actual tooltip height if available, otherwise estimate
    const tooltipHeight = tooltipRef.current?.offsetHeight || 300;

    // Default: position to the right and slightly above the icon
    let top = iconRect.top;
    let left = iconRect.right + padding;

    // If tooltip would go off-screen to the right, position it to the left of icon
    if (left + tooltipWidth > viewportWidth - padding) {
      left = iconRect.left - tooltipWidth - padding;
    }

    // If still off-screen to the left, align with right edge of viewport
    if (left < padding) {
      left = viewportWidth - tooltipWidth - padding;
    }

    // Adjust vertical position to keep tooltip in viewport
    if (top + tooltipHeight > viewportHeight - padding) {
      // Try to align bottom of tooltip with bottom of viewport
      top = Math.max(padding, viewportHeight - tooltipHeight - padding);
    }

    // Ensure tooltip doesn't go above viewport
    if (top < padding) {
      top = padding;
    }

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (isVisible) {
      // Calculate position immediately
      calculatePosition();

      // Recalculate after a brief delay to account for content rendering
      const timer = setTimeout(calculatePosition, 10);

      // Add scroll and resize listeners
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isVisible, calculatePosition]);

  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    // Add small delay before hiding to allow moving to tooltip
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  };

  const handleTooltipMouseEnter = () => {
    // Clear hide timeout when hovering tooltip itself
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    setIsVisible(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const tooltipContent = isVisible && (
    <div
      ref={tooltipRef}
      className="fixed w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-[9999]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
      onMouseEnter={handleTooltipMouseEnter}
      onMouseLeave={handleTooltipMouseLeave}
    >
      {children}
    </div>
  );

  return (
    <>
      <div
        ref={iconRef}
        className={`cursor-help ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      {isVisible && createPortal(tooltipContent, document.body)}
    </>
  );
};

export default TooltipPortal;
