"use client";
import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Paper, Typography } from '@mui/material';

export default function AuditLogTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/backend/audit-logs')
      .then(res => res.json())
      .then(data => {
        setLogs(data.logs || []);
        setLoading(false);
      });
  }, []);

  const columns: GridColDef[] = [
    { field: 'timestamp', headerName: 'Timestamp', width: 180 },
    { field: 'userId', headerName: 'User', width: 120 },
    { field: 'action', headerName: 'Action', width: 160 },
    { field: 'entityType', headerName: 'Entity Type', width: 120 },
    { field: 'entityId', headerName: 'Entity ID', width: 120 },
    { field: 'details', headerName: 'Details', width: 200, valueGetter: (params: any) => JSON.stringify(params.row.details) },
  ];

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Audit Logs</Typography>
      <div style={{ height: 500, width: '100%' }}>
        <DataGrid rows={logs} columns={columns} loading={loading} getRowId={row => row.id} />
      </div>
    </Paper>
  );
}
