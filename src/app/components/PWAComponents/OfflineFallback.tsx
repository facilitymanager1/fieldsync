"use client";
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Container
} from '@mui/material';
import {
  CloudOff as OfflineIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

export default function OfflineFallback() {
  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <OfflineIcon 
            sx={{ 
              fontSize: 64, 
              color: 'text.secondary',
              mb: 2
            }} 
          />
          
          <Typography variant="h5" gutterBottom>
            You're Offline
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph>
            It looks like you've lost your internet connection. Don't worry - you can still access some features of FieldSync while offline.
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            Your data will sync automatically when you're back online.
          </Typography>

          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={handleGoHome}
              sx={{ minWidth: 120 }}
            >
              Go Home
            </Button>
            <Button
              variant="contained"
              onClick={handleRefresh}
              startIcon={<RefreshIcon />}
              sx={{ minWidth: 120 }}
            >
              Try Again
            </Button>
          </Box>

          <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Available Offline Features:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • View cached dashboard data<br />
              • Browse staff information<br />
              • View recent tickets<br />
              • Access knowledge base articles
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}