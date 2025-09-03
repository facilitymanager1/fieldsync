"use client";
import React, { forwardRef } from 'react';
import { Button, ButtonProps } from '@mui/material';
import { useAccessibility } from './AccessibilityProvider';

interface AccessibleButtonProps extends ButtonProps {
  ariaLabel?: string;
  ariaDescribedBy?: string;
  screenReaderText?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ 
    ariaLabel, 
    ariaDescribedBy, 
    screenReaderText, 
    onKeyDown,
    onClick,
    children,
    ...props 
  }, ref) => {
    const { announceToScreenReader, settings } = useAccessibility();

    const handleClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (screenReaderText && settings.screenReaderOptimized) {
        announceToScreenReader(screenReaderText);
      }
      onClick?.(event);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      // Handle Enter and Space key presses
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (screenReaderText && settings.screenReaderOptimized) {
          announceToScreenReader(screenReaderText);
        }
        onClick?.(event as any);
      }
      onKeyDown?.(event);
    };

    return (
      <Button
        ref={ref}
        {...props}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        sx={{
          ...props.sx,
          position: 'relative',
          '&:focus-visible': {
            outline: `${settings.focusIndicators === 'enhanced' ? '3px' : '2px'} solid`,
            outlineColor: 'primary.main',
            outlineOffset: '2px',
          }
        }}
      >
        {children}
        {screenReaderText && settings.screenReaderOptimized && (
          <span className="sr-only">
            {screenReaderText}
          </span>
        )}
      </Button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

export default AccessibleButton;