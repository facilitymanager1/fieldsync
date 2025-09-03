"use client";
import React, { useEffect, useState } from 'react';
import { useAccessibility } from './AccessibilityProvider';

interface LiveRegionProps {
  message?: string;
  priority?: 'polite' | 'assertive';
  clearDelay?: number;
  children?: React.ReactNode;
}

export default function LiveRegion({ 
  message, 
  priority = 'polite', 
  clearDelay = 5000,
  children 
}: LiveRegionProps) {
  const [currentMessage, setCurrentMessage] = useState(message || '');
  const { settings } = useAccessibility();

  useEffect(() => {
    if (message && settings.announcementLevel !== 'off') {
      setCurrentMessage(message);
      
      if (clearDelay > 0) {
        const timer = setTimeout(() => {
          setCurrentMessage('');
        }, clearDelay);
        
        return () => clearTimeout(timer);
      }
    }
  }, [message, clearDelay, settings.announcementLevel]);

  if (settings.announcementLevel === 'off') {
    return null;
  }

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
      role="status"
      aria-relevant="additions text"
    >
      {currentMessage || children}
    </div>
  );
}

// Hook for managing live region messages
export function useLiveRegion() {
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');

  const announce = (text: string, urgency: 'polite' | 'assertive' = 'polite') => {
    setPriority(urgency);
    setMessage(text);
    
    // Clear message after announcement
    setTimeout(() => setMessage(''), 100);
  };

  return {
    message,
    priority,
    announce,
    LiveRegion: () => (
      <LiveRegion message={message} priority={priority} />
    ),
  };
}