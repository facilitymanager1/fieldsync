"use client";
import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import AnalyticsCharts from './AnalyticsCharts';

interface AnalyticsData {
  totalStaff: number;
  activeShifts: number;
  openTickets: number;
  completedReports: number;
}

export default function DashboardAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const res = await fetch('/api/backend/analytics');
    const data = await res.json();
    setData(data.analytics || null);
  };

  if (!data) return <Box>Loading analytics...</Box>;

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ minWidth: 200, flex: 1 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Total Staff</Typography>
            <Typography variant="h4">{data.totalStaff}</Typography>
          </Paper>
        </Box>
        <Box sx={{ minWidth: 200, flex: 1 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Active Shifts</Typography>
            <Typography variant="h4">{data.activeShifts}</Typography>
          </Paper>
        </Box>
        <Box sx={{ minWidth: 200, flex: 1 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Open Tickets</Typography>
            <Typography variant="h4">{data.openTickets}</Typography>
          </Paper>
        </Box>
        <Box sx={{ minWidth: 200, flex: 1 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Completed Reports</Typography>
            <Typography variant="h4">{data.completedReports}</Typography>
          </Paper>
        </Box>
      </Box>
      <AnalyticsCharts data={data} />
    </>
  );
}
