/**
 * Multi-Factor Authentication Verification Component
 * Handles TOTP, SMS, and backup code verification
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Tabs,
  Tab,
  Link,
  Paper,
  InputAdornment,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Security as SecurityIcon,
  Smartphone as SmartphoneIcon,
  Key as KeyIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';

interface MFAVerificationProps {
  email: string;
  password: string;
  onVerify: (mfaToken: string, isBackupCode: boolean) => Promise<{ success: boolean; error?: string }>;
  onBack: () => void;
  isLoading: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`mfa-tabpanel-${index}`}
      aria-labelledby={`mfa-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export default function MFAVerification({
  email,
  password,
  onVerify,
  onBack,
  isLoading
}: MFAVerificationProps) {
  const [tabValue, setTabValue] = useState(0);
  const [mfaCode, setMfaCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // TOTP input refs for auto-focus
  const totpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  const [totpValues, setTotpValues] = useState(['', '', '', '', '', '']);

  useEffect(() => {
    // Auto-focus first input on mount
    if (totpRefs[0].current) {
      totpRefs[0].current.focus();
    }
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
    // Reset input values when switching tabs
    setMfaCode('');
    setBackupCode('');
    setTotpValues(['', '', '', '', '', '']);
  };

  const handleTotpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newValues = [...totpValues];
    newValues[index] = value;
    setTotpValues(newValues);

    // Auto-focus next input
    if (value && index < 5 && totpRefs[index + 1].current) {
      totpRefs[index + 1].current.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullCode = newValues.join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode, false);
      }
    }
  };

  const handleTotpKeyDown = (index: number, event: React.KeyboardEvent) => {
    if (event.key === 'Backspace' && !totpValues[index] && index > 0) {
      // Focus previous input on backspace
      totpRefs[index - 1].current?.focus();
    }
  };

  const handleTotpPaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedText.length === 6) {
      const newValues = pastedText.split('').slice(0, 6);
      setTotpValues(newValues);
      
      // Focus last input
      totpRefs[5].current?.focus();
      
      // Auto-submit
      setTimeout(() => {
        handleVerify(pastedText, false);
      }, 100);
    }
  };

  const handleVerify = async (code: string, isBackupCode: boolean) => {
    setError(null);
    
    if (!code.trim()) {
      setError(isBackupCode ? 'Please enter a backup code' : 'Please enter the verification code');
      return;
    }

    try {
      const result = await onVerify(code.trim(), isBackupCode);
      
      if (!result.success) {
        setError(result.error || 'Verification failed');
        
        // Clear inputs on error
        if (isBackupCode) {
          setBackupCode('');
        } else {
          setMfaCode('');
          setTotpValues(['', '', '', '', '', '']);
          totpRefs[0].current?.focus();
        }
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (tabValue === 0) {
      // TOTP verification
      const fullCode = totpValues.join('');
      handleVerify(fullCode, false);
    } else {
      // Backup code verification
      handleVerify(backupCode, true);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 400, width: '100%' }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <SecurityIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          Two-Factor Authentication
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Enter your verification code to complete sign in
        </Typography>
      </Box>

      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{ mb: 3 }}
        aria-label="MFA verification methods"
      >
        <Tab
          icon={<SmartphoneIcon />}
          label="Authenticator"
          id="mfa-tab-0"
          aria-controls="mfa-tabpanel-0"
        />
        <Tab
          icon={<KeyIcon />}
          label="Backup Code"
          id="mfa-tab-1"
          aria-controls="mfa-tabpanel-1"
        />
      </Tabs>

      <form onSubmit={handleSubmit}>
        <TabPanel value={tabValue} index={0}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            Enter the 6-digit code from your authenticator app
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 1,
              justifyContent: 'center',
              mb: 3
            }}
            onPaste={handleTotpPaste}
          >
            {totpValues.map((value, index) => (
              <TextField
                key={index}
                inputRef={totpRefs[index]}
                value={value}
                onChange={(e) => handleTotpChange(index, e.target.value)}
                onKeyDown={(e) => handleTotpKeyDown(index, e)}
                inputProps={{
                  maxLength: 1,
                  style: {
                    textAlign: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    padding: '12px 8px'
                  }
                }}
                sx={{
                  width: 50,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: value ? 'primary.main' : 'grey.300',
                      borderWidth: 2,
                    },
                  },
                }}
                variant="outlined"
                disabled={isLoading}
              />
            ))}
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading || totpValues.join('').length !== 6}
            sx={{ mb: 2 }}
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </Button>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            Enter one of your backup codes
          </Typography>

          <TextField
            fullWidth
            label="Backup Code"
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            disabled={isLoading}
            inputProps={{
              style: {
                textAlign: 'center',
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                letterSpacing: '2px'
              }
            }}
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading || !backupCode.trim()}
            sx={{ mb: 2 }}
          >
            {isLoading ? 'Verifying...' : 'Verify Backup Code'}
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => setShowBackupCodes(!showBackupCodes)}
              sx={{ textDecoration: 'none' }}
            >
              {showBackupCodes ? 'Hide' : 'Show'} backup code info
            </Link>
            
            <Collapse in={showBackupCodes}>
              <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
                <Typography variant="body2" gutterBottom>
                  Backup codes are 8-character codes that can be used when you don't have access to your authenticator app.
                </Typography>
                <Typography variant="body2">
                  Each backup code can only be used once. Make sure to store them in a safe place.
                </Typography>
              </Alert>
            </Collapse>
          </Box>
        </TabPanel>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ textAlign: 'center' }}>
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={onBack}
            disabled={isLoading}
            sx={{ textDecoration: 'none' }}
          >
            ← Back to login
          </Link>
        </Box>
      </form>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center' }}>
          Having trouble? Contact your system administrator for assistance.
        </Typography>
      </Box>
    </Paper>
  );
}