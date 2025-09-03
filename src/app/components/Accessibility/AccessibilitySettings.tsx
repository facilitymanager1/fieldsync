"use client";
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Switch,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Divider,
  Alert,
  Slider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Accessibility as AccessibilityIcon,
  Visibility as VisibilityIcon,
  VolumeUp as VolumeUpIcon,
  Navigation as NavigationIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAccessibility } from './AccessibilityProvider';

interface AccessibilitySettingsProps {
  onClose?: () => void;
}

export default function AccessibilitySettings({ onClose }: AccessibilitySettingsProps) {
  const { 
    settings, 
    updateSetting, 
    announceToScreenReader,
    isReducedMotion,
    isHighContrast 
  } = useAccessibility();
  
  const [expandedSections, setExpandedSections] = useState<string[]>(['vision']);

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleResetToDefaults = () => {
    const defaultSettings = {
      highContrast: false,
      reducedMotion: false,
      screenReaderOptimized: false,
      fontSize: 'medium' as const,
      focusIndicators: 'default' as const,
      keyboardNavigation: true,
      skipLinks: true,
      announcementLevel: 'polite' as const,
    };

    Object.entries(defaultSettings).forEach(([key, value]) => {
      updateSetting(key as keyof typeof defaultSettings, value);
    });

    announceToScreenReader('Accessibility settings reset to defaults');
  };

  const testScreenReader = () => {
    announceToScreenReader(
      'Screen reader test: This is a test announcement to verify screen reader functionality is working correctly.',
      'assertive'
    );
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AccessibilityIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h4" component="h1">
              Accessibility Settings
            </Typography>
          </Box>

          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            Customize your experience to meet your accessibility needs. 
            These settings are automatically saved and synchronized across your sessions.
          </Typography>

          {/* System Detection Alert */}
          {(isReducedMotion || isHighContrast) && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                System preferences detected: 
                {isReducedMotion && ' Reduced Motion'}
                {isReducedMotion && isHighContrast && ', '}
                {isHighContrast && ' High Contrast'}
              </Typography>
            </Alert>
          )}

          {/* Vision Settings */}
          <Accordion 
            expanded={expandedSections.includes('vision')}
            onChange={() => handleSectionToggle('vision')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <VisibilityIcon sx={{ mr: 2 }} />
                <Typography variant="h6">Vision & Display</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                
                {/* Font Size */}
                <FormControl component="fieldset">
                  <FormLabel component="legend" id="font-size-label">
                    Font Size
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby="font-size-label"
                    value={settings.fontSize}
                    onChange={(e) => updateSetting('fontSize', e.target.value as any)}
                    row
                  >
                    <FormControlLabel value="small" control={<Radio />} label="Small" />
                    <FormControlLabel value="medium" control={<Radio />} label="Medium" />
                    <FormControlLabel value="large" control={<Radio />} label="Large" />
                    <FormControlLabel value="extra-large" control={<Radio />} label="Extra Large" />
                  </RadioGroup>
                </FormControl>

                {/* High Contrast */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.highContrast}
                      onChange={(e) => updateSetting('highContrast', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">High Contrast Mode</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Increases contrast between text and background colors
                      </Typography>
                    </Box>
                  }
                />

                {/* Reduced Motion */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.reducedMotion}
                      onChange={(e) => updateSetting('reducedMotion', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">Reduce Motion</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Minimizes animation and movement effects
                      </Typography>
                    </Box>
                  }
                />

                {/* Focus Indicators */}
                <FormControl component="fieldset">
                  <FormLabel component="legend" id="focus-indicators-label">
                    Focus Indicators
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby="focus-indicators-label"
                    value={settings.focusIndicators}
                    onChange={(e) => updateSetting('focusIndicators', e.target.value as any)}
                  >
                    <FormControlLabel 
                      value="default" 
                      control={<Radio />} 
                      label="Default focus indicators" 
                    />
                    <FormControlLabel 
                      value="enhanced" 
                      control={<Radio />} 
                      label="Enhanced focus indicators (thicker, higher contrast)" 
                    />
                  </RadioGroup>
                </FormControl>
                
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Screen Reader Settings */}
          <Accordion 
            expanded={expandedSections.includes('screen-reader')}
            onChange={() => handleSectionToggle('screen-reader')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <VolumeUpIcon sx={{ mr: 2 }} />
                <Typography variant="h6">Screen Reader & Audio</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                
                {/* Screen Reader Optimization */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.screenReaderOptimized}
                      onChange={(e) => updateSetting('screenReaderOptimized', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">Screen Reader Optimization</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Optimizes interface for screen reader compatibility
                      </Typography>
                    </Box>
                  }
                />

                {/* Announcement Level */}
                <FormControl component="fieldset">
                  <FormLabel component="legend" id="announcement-level-label">
                    Announcement Level
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby="announcement-level-label"
                    value={settings.announcementLevel}
                    onChange={(e) => updateSetting('announcementLevel', e.target.value as any)}
                  >
                    <FormControlLabel value="off" control={<Radio />} label="Off - No announcements" />
                    <FormControlLabel value="polite" control={<Radio />} label="Polite - Wait for user to finish" />
                    <FormControlLabel value="assertive" control={<Radio />} label="Assertive - Interrupt when important" />
                  </RadioGroup>
                </FormControl>

                {/* Test Screen Reader */}
                <Box>
                  <Button
                    variant="outlined"
                    onClick={testScreenReader}
                    startIcon={<VolumeUpIcon />}
                    disabled={settings.announcementLevel === 'off'}
                  >
                    Test Screen Reader Announcement
                  </Button>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Click to test if screen reader announcements are working correctly
                  </Typography>
                </Box>
                
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Navigation Settings */}
          <Accordion 
            expanded={expandedSections.includes('navigation')}
            onChange={() => handleSectionToggle('navigation')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <NavigationIcon sx={{ mr: 2 }} />
                <Typography variant="h6">Navigation & Interaction</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                
                {/* Keyboard Navigation */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.keyboardNavigation}
                      onChange={(e) => updateSetting('keyboardNavigation', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">Enhanced Keyboard Navigation</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Improves keyboard navigation with focus management
                      </Typography>
                    </Box>
                  }
                />

                {/* Skip Links */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.skipLinks}
                      onChange={(e) => updateSetting('skipLinks', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">Skip Navigation Links</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Shows skip links at the top of pages for faster navigation
                      </Typography>
                    </Box>
                  }
                />
                
              </Box>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 3 }} />

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleResetToDefaults}
            >
              Reset to Defaults
            </Button>
            {onClose && (
              <Button variant="contained" onClick={onClose}>
                Done
              </Button>
            )}
          </Box>

          {/* Accessibility Information */}
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Accessibility Features Available:</strong>
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
              <li>ARIA labels and descriptions for all interactive elements</li>
              <li>Keyboard navigation with Tab, Enter, Space, and Arrow keys</li>
              <li>Screen reader optimized announcements and landmarks</li>
              <li>High contrast mode compatible with system preferences</li>
              <li>Reduced motion support for vestibular disorders</li>
              <li>Focus management for modal dialogs and dynamic content</li>
            </ul>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}