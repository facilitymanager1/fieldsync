"use client";
import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogTitle,
  Typography,
  Box,
  IconButton,
  Snackbar,
  Alert
} from '@mui/material';
import { 
  GetApp as InstallIcon, 
  Close as CloseIcon,
  Smartphone as MobileIcon,
  Computer as DesktopIcon
} from '@mui/icons-material';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showOfflineSnackbar, setShowOfflineSnackbar] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check if app is running in standalone mode
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
    };

    checkStandalone();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show install prompt after 30 seconds if not already installed
      setTimeout(() => {
        if (!isInstalled && !isStandalone) {
          setShowInstallDialog(true);
        }
      }, 30000);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallDialog(false);
    };

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineSnackbar(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineSnackbar(true);
    };

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial online status
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isInstalled, isStandalone]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      
      setDeferredPrompt(null);
      setShowInstallDialog(false);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallDialog(false);
    
    // Don't show again for 7 days
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Check if install prompt was recently dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      if (dismissedTime > sevenDaysAgo) {
        setShowInstallDialog(false);
      }
    }
  }, []);

  const getDeviceType = () => {
    const userAgent = navigator.userAgent;
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  };

  const deviceType = getDeviceType();

  return (
    <>
      {/* Install Dialog */}
      <Dialog
        open={showInstallDialog && !isStandalone && !!deferredPrompt}
        onClose={handleDismiss}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              {deviceType === 'mobile' ? <MobileIcon /> : <DesktopIcon />}
              <Typography variant="h6">Install FieldSync</Typography>
            </Box>
            <IconButton onClick={handleDismiss} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Install FieldSync for a better experience with:
          </Typography>
          
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <li>Faster loading and performance</li>
            <li>Offline access to core features</li>
            <li>Push notifications for important updates</li>
            <li>Desktop-like experience</li>
            <li>Direct access from your {deviceType === 'mobile' ? 'home screen' : 'desktop'}</li>
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            The app will work like any other installed app on your {deviceType}.
          </Typography>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleDismiss} color="inherit">
            Not Now
          </Button>
          <Button 
            onClick={handleInstallClick} 
            variant="contained" 
            startIcon={<InstallIcon />}
          >
            Install App
          </Button>
        </DialogActions>
      </Dialog>

      {/* Offline Indicator Snackbar */}
      <Snackbar
        open={showOfflineSnackbar}
        autoHideDuration={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity="warning" 
          onClose={() => setShowOfflineSnackbar(false)}
          action={
            <Button color="inherit" size="small">
              RETRY
            </Button>
          }
        >
          You're offline. Some features may not work.
        </Alert>
      </Snackbar>

      {/* PWA Status Indicator (for development) */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          position="fixed"
          bottom={16}
          right={16}
          bgcolor="rgba(0,0,0,0.8)"
          color="white"
          p={1}
          borderRadius={1}
          fontSize="12px"
          zIndex={9999}
        >
          PWA: {isStandalone ? 'Installed' : 'Not Installed'} | 
          {isOnline ? ' Online' : ' Offline'}
        </Box>
      )}
    </>
  );
}