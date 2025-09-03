"use client";
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Divider,
  Alert,
  Paper,
} from '@mui/material';
import AccessibilitySettings from '../../components/Accessibility/AccessibilitySettings';
import AccessibleButton from '../../components/Accessibility/AccessibleButton';
import FocusManager from '../../components/Accessibility/FocusManager';
import LiveRegion, { useLiveRegion } from '../../components/Accessibility/LiveRegion';
import { useAccessibility } from '../../components/Accessibility/AccessibilityProvider';

export default function AccessibilityPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [testCounter, setTestCounter] = useState(0);
  const { announceToScreenReader, settings, isHighContrast, isReducedMotion } = useAccessibility();
  const { announce, LiveRegion: DemoLiveRegion } = useLiveRegion();

  const handleTestAnnouncement = () => {
    const messages = [
      'This is a test announcement for screen readers.',
      'Button clicked successfully!',
      'Testing accessibility features...',
      'Screen reader integration is working properly.',
    ];
    const message = messages[testCounter % messages.length];
    setTestCounter(prev => prev + 1);
    announceToScreenReader(message, 'assertive');
    announce(message, 'assertive');
  };

  const handleFocusTest = () => {
    announce('Focus management test activated', 'polite');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Accessibility Testing & Configuration
      </Typography>

      <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
        This page demonstrates and tests the accessibility features implemented in FieldSync.
        Use this page to configure accessibility settings and test various features.
      </Typography>

      {/* Current Settings Status */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Current Accessibility Status
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  High Contrast: {isHighContrast ? '✅ Enabled' : '❌ Disabled'}
                </Typography>
                <Typography variant="body2">
                  Reduced Motion: {isReducedMotion ? '✅ Enabled' : '❌ Disabled'}
                </Typography>
                <Typography variant="body2">
                  Screen Reader Optimized: {settings.screenReaderOptimized ? '✅ Enabled' : '❌ Disabled'}
                </Typography>
                <Typography variant="body2">
                  Font Size: {settings.fontSize}
                </Typography>
                <Typography variant="body2">
                  Focus Indicators: {settings.focusIndicators}
                </Typography>
                <Typography variant="body2">
                  Keyboard Navigation: {settings.keyboardNavigation ? '✅ Enabled' : '❌ Disabled'}
                </Typography>
                <Typography variant="body2">
                  Skip Links: {settings.skipLinks ? '✅ Enabled' : '❌ Disabled'}
                </Typography>
                <Typography variant="body2">
                  Announcement Level: {settings.announcementLevel}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <AccessibleButton
                  variant="contained"
                  onClick={() => setShowSettings(!showSettings)}
                  ariaLabel={showSettings ? 'Hide accessibility settings' : 'Show accessibility settings'}
                  screenReaderText={showSettings ? 'Accessibility settings panel closed' : 'Accessibility settings panel opened'}
                >
                  {showSettings ? 'Hide' : 'Show'} Accessibility Settings
                </AccessibleButton>
                
                <AccessibleButton
                  variant="outlined"
                  onClick={handleTestAnnouncement}
                  ariaLabel="Test screen reader announcement"
                  screenReaderText="Screen reader test announcement triggered"
                >
                  Test Screen Reader Announcement
                </AccessibleButton>

                <AccessibleButton
                  variant="outlined"
                  onClick={handleFocusTest}
                  ariaLabel="Test focus management"
                  screenReaderText="Focus management test activated"
                >
                  Test Focus Management
                </AccessibleButton>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Accessibility Settings Panel */}
      {showSettings && (
        <FocusManager focusOnMount trapFocus>
          <Paper sx={{ mb: 4, p: 2 }}>
            <AccessibilitySettings onClose={() => setShowSettings(false)} />
          </Paper>
        </FocusManager>
      )}

      {/* Feature Demonstrations */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                ARIA Labels & Descriptions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <AccessibleButton
                  variant="outlined"
                  ariaLabel="Example button with ARIA label"
                  ariaDescribedBy="button-description"
                >
                  Button with ARIA
                </AccessibleButton>
                <Typography id="button-description" variant="body2" sx={{ color: 'text.secondary' }}>
                  This button demonstrates proper ARIA labeling and description implementation.
                </Typography>

                <Box role="group" aria-labelledby="radio-group-label">
                  <Typography id="radio-group-label" variant="subtitle2">
                    Example Radio Group
                  </Typography>
                  {/* Radio buttons would go here */}
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                    Radio groups with proper ARIA grouping and labeling.
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Keyboard Navigation
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                Test keyboard navigation with Tab, Enter, Space, and Arrow keys:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {['First', 'Second', 'Third', 'Fourth'].map((item, index) => (
                  <AccessibleButton
                    key={item}
                    variant="outlined"
                    size="small"
                    ariaLabel={`${item} keyboard navigation test button`}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = e.currentTarget.parentElement?.children[index + 1] as HTMLElement;
                        next?.focus();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev = e.currentTarget.parentElement?.children[index - 1] as HTMLElement;
                        prev?.focus();
                      }
                    }}
                  >
                    {item} Button
                  </AccessibleButton>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Live Regions & Announcements
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                Screen reader announcements and live regions for dynamic content updates:
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                Click the "Test Screen Reader Announcement" button above to test live announcements.
                Messages will be announced to screen readers based on your announcement level setting.
              </Alert>

              <LiveRegion message="This is a persistent live region for important announcements." />
              <DemoLiveRegion />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* Accessibility Information */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Accessibility Features Implemented
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                WCAG 2.1 AA Compliance Features:
              </Typography>
              <ul>
                <li>Proper heading hierarchy (H1-H6)</li>
                <li>ARIA labels, descriptions, and landmarks</li>
                <li>Keyboard navigation support</li>
                <li>Focus management and indicators</li>
                <li>Color contrast compliance</li>
                <li>Text alternatives for images</li>
                <li>Semantic HTML structure</li>
                <li>Form labels and error messages</li>
              </ul>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Enhanced Accessibility Features:
              </Typography>
              <ul>
                <li>Screen reader optimizations</li>
                <li>High contrast mode support</li>
                <li>Reduced motion preferences</li>
                <li>Customizable font sizes</li>
                <li>Skip navigation links</li>
                <li>Live region announcements</li>
                <li>Focus trap for modals</li>
                <li>Persistent accessibility settings</li>
              </ul>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}