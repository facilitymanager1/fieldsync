"use client";
import React, { useEffect, useRef } from 'react';
import { useAccessibility } from './AccessibilityProvider';

interface FocusManagerProps {
  children: React.ReactNode;
  focusOnMount?: boolean;
  restoreFocus?: boolean;
  focusSelector?: string;
  trapFocus?: boolean;
}

export default function FocusManager({
  children,
  focusOnMount = false,
  restoreFocus = true,
  focusSelector,
  trapFocus = false,
}: FocusManagerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const { settings } = useAccessibility();

  useEffect(() => {
    if (!settings.keyboardNavigation) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus management on mount
    if (focusOnMount && containerRef.current) {
      if (focusSelector) {
        const element = containerRef.current.querySelector(focusSelector) as HTMLElement;
        element?.focus();
      } else {
        // Find first focusable element
        const focusableElement = getFocusableElement(containerRef.current);
        focusableElement?.focus();
      }
    }

    // Focus trap implementation
    if (trapFocus && containerRef.current) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Tab' && containerRef.current) {
          handleTabKey(event, containerRef.current);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }

    // Cleanup: restore focus
    return () => {
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [focusOnMount, restoreFocus, focusSelector, trapFocus, settings.keyboardNavigation]);

  const getFocusableElement = (container: HTMLElement): HTMLElement | null => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ];

    const focusableElements = container.querySelectorAll(
      focusableSelectors.join(', ')
    );

    return focusableElements[0] as HTMLElement || null;
  };

  const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ];

    const focusableElements = container.querySelectorAll(
      focusableSelectors.join(', ')
    );

    return Array.from(focusableElements) as HTMLElement[];
  };

  const handleTabKey = (event: KeyboardEvent, container: HTMLElement) => {
    const focusableElements = getFocusableElements(container);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (!firstFocusable) return;

    if (event.shiftKey) {
      // Shift + Tab: moving backwards
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab: moving forwards
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  return <div ref={containerRef}>{children}</div>;
}