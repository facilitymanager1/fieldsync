import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

export default function AnalyticsCharts({ data }: { data: any }) {
  // Example: Tickets by status
  const ticketStatusData = {
    labels: ['Open', 'In Progress', 'Closed'],
    datasets: [
      {
        label: 'Tickets',
        data: [data.openTickets || 0, data.inProgressTickets || 0, data.closedTickets || 0],
        backgroundColor: ['#1976d2', '#ffa726', '#66bb6a'],
      },
    ],
  };

  // Example: Reports completion trend
  const reportTrendData = {
    labels: data.reportTrend?.map((r: any) => r.date) || [],
    datasets: [
      {
        label: 'Completed Reports',
        data: data.reportTrend?.map((r: any) => r.count) || [],
        fill: false,
        borderColor: '#1976d2',
        tension: 0.1,
      },
    ],
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6">Tickets by Status</Typography>
        <Bar data={ticketStatusData} />
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Report Completion Trend</Typography>
        <Line data={reportTrendData} />
      </Paper>
    </Box>
  );
}
