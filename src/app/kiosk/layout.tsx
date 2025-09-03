/**
 * Kiosk Layout Component - Dedicated full-screen layout for kiosk mode
 * 
 * Features:
 * - Full-screen immersive experience
 * - Minimal UI chrome
 * - Touch-optimized interface
 * - Auto-refresh and health monitoring
 * - Secure kiosk environment
 */

'use client';

import { ReactNode } from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

// Kiosk-specific theme with large touch targets and high contrast
const kioskTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2196F3',
      light: '#64B5F6',
      dark: '#1976D2',
    },
    secondary: {
      main: '#4CAF50',
      light: '#81C784',
      dark: '#388E3C',
    },
    error: {
      main: '#F44336',
      light: '#EF5350',
      dark: '#D32F2F',
    },
    warning: {
      main: '#FF9800',
      light: '#FFB74D',
      dark: '#F57C00',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
  },
  typography: {
    // Larger fonts for kiosk readability
    h1: {
      fontSize: '3rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1.125rem',
    },
    body2: {
      fontSize: '1rem',
    },
    button: {
      fontSize: '1.125rem',
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 48, // Larger touch targets
          borderRadius: 8,
          padding: '12px 24px',
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            minHeight: 48,
            fontSize: '1.125rem',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 48,
          minHeight: 48,
        },
      },
    },
  },
});

interface KioskLayoutProps {
  children: ReactNode;
}

export default function KioskLayout({ children }: KioskLayoutProps) {
  return (
    <ThemeProvider theme={kioskTheme}>
      <CssBaseline />
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
          backgroundColor: 'background.default',
          // Prevent text selection and context menus for kiosk mode
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          // Disable zoom and scroll
          touchAction: 'manipulation',
          // Prevent highlighting
          WebkitTapHighlightColor: 'transparent',
          // Cursor styling
          cursor: 'default',
          // Font smoothing for better readability
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
        onContextMenu={(e) => e.preventDefault()} // Disable right-click menu
        onSelectStart={(e: any) => e.preventDefault()} // Disable text selection
        onDragStart={(e) => e.preventDefault()} // Disable drag operations
      >
        {children}
      </Box>
    </ThemeProvider>
  );
}
