"use client";
import React from 'react';
import { Paper, Typography, Button, Stack } from '@mui/material';

export default function IntegrationPanel() {
  const handleSyncHR = async () => {
    await fetch('/api/backend/integrate/hr', { method: 'POST', body: JSON.stringify({ name: 'Demo Staff' }), headers: { 'Content-Type': 'application/json' } });
    alert('HR sync triggered!');
  };
  const handleSyncPayroll = async () => {
    await fetch('/api/backend/integrate/payroll', { method: 'POST', body: JSON.stringify({ staffId: 's1', amount: 100 }), headers: { 'Content-Type': 'application/json' } });
    alert('Payroll sync triggered!');
  };
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>External Integrations</Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={handleSyncHR}>Sync HR</Button>
        <Button variant="contained" onClick={handleSyncPayroll}>Sync Payroll</Button>
      </Stack>
    </Paper>
  );
}
