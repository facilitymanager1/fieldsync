import React from 'react';
import LeaveTable from './LeaveTable';
import { Box, Typography, Button } from '@mui/material';
import Link from 'next/link';

export default function LeavePage() {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Leave Management</Typography>
        <Button component={Link} href="/dashboard/leave/request" variant="contained" color="primary">
          Request Leave
        </Button>
      </Box>
      <LeaveTable />
    </Box>
  );
}
