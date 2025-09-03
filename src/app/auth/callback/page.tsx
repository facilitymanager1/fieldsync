/**
 * OAuth2/SAML Authentication Callback Page
 * Handles OAuth2 and SAML authentication callbacks
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Alert, Typography, Paper } from '@mui/material';
import { useAuth } from '../AuthContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { isAuthenticated, error, clearError } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Give the AuthContext time to process the callback
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (isAuthenticated) {
          setStatus('success');
          setMessage('Authentication successful! Redirecting...');
          
          // Redirect after a short delay
          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
        } else if (error) {
          setStatus('error');
          setMessage(error);
          
          // Redirect to login after showing error
          setTimeout(() => {
            clearError();
            router.push('/login');
          }, 3000);
        } else {
          // Still processing or failed
          setTimeout(() => {
            setStatus('error');
            setMessage('Authentication failed. Please try again.');
            
            setTimeout(() => {
              router.push('/login');
            }, 2000);
          }, 5000); // Give it 5 seconds total
        }
      } catch (err) {
        console.error('Callback processing error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred.');
        
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    };

    processCallback();
  }, [isAuthenticated, error, router, clearError]);

  const getStatusColor = () => {
    switch (status) {
      case 'loading': return 'primary';
      case 'success': return 'success';
      case 'error': return 'error';
      default: return 'primary';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <CircularProgress size={48} color="primary" />;
      case 'success':
        return (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'success.contrastText',
              fontSize: 24
            }}
          >
            ✓
          </Box>
        );
      case 'error':
        return (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'error.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'error.contrastText',
              fontSize: 24
            }}
          >
            ✕
          </Box>
        );
      default:
        return <CircularProgress size={48} />;
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.50',
        p: 2
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          textAlign: 'center'
        }}
      >
        <Box sx={{ mb: 3 }}>
          {getIcon()}
        </Box>

        <Typography
          variant="h5"
          component="h1"
          gutterBottom
          color={`${getStatusColor()}.main`}
          sx={{ fontWeight: 600 }}
        >
          {status === 'loading' && 'Authenticating...'}
          {status === 'success' && 'Success!'}
          {status === 'error' && 'Authentication Failed'}
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 3 }}
        >
          {message}
        </Typography>

        {status === 'error' && (
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
            <Typography variant="body2">
              {error || 'Please try logging in again or contact support if the problem persists.'}
            </Typography>
          </Alert>
        )}

        {status === 'success' && (
          <Alert severity="success" sx={{ mt: 2, textAlign: 'left' }}>
            <Typography variant="body2">
              You will be redirected to the dashboard shortly.
            </Typography>
          </Alert>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" color="text.disabled">
            This window will redirect automatically.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}