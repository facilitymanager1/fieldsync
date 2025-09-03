
"use client";
import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Box, Chip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

interface Leave {
  id?: string;
  _id?: string;
  staffId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvedBy?: string;
}

export default function LeaveTable() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    const res = await fetch('/api/backend/leave');
    const data = await res.json();
    setLeaves(data.leaves || []);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    await fetch('/api/backend/leave/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'approved', approvedBy: 'admin' }),
    });
    fetchLeaves();
  };

  const handleReject = async (id: string) => {
    await fetch('/api/backend/leave/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'rejected', approvedBy: 'admin' }),
    });
    fetchLeaves();
  };

  const columns: GridColDef[] = [
    { field: 'staffId', headerName: 'Staff ID', width: 120 },
    { field: 'leaveType', headerName: 'Type', width: 120 },
    { field: 'startDate', headerName: 'Start', width: 120 },
    { field: 'endDate', headerName: 'End', width: 120 },
    { field: 'reason', headerName: 'Reason', width: 180 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: any) => (
        <Chip
          label={params.value}
          color={params.value === 'approved' ? 'success' : params.value === 'rejected' ? 'error' : 'warning'}
          size="small"
        />
      ),
    },
    { field: 'approvedBy', headerName: 'Approved By', width: 120 },
    {
      field: 'actions',
      type: 'actions',
      width: 120,
      getActions: (params: any) => [
        <GridActionsCellItem
          icon={<CheckIcon color="success" />}
          label="Approve"
          onClick={() => handleApprove(params.id)}
          disabled={params.row.status !== 'pending'}
        />,
        <GridActionsCellItem
          icon={<CloseIcon color="error" />}
          label="Reject"
          onClick={() => handleReject(params.id)}
          disabled={params.row.status !== 'pending'}
        />,
      ],
    },
  ];

  return (
    <Box height={500}>
      <DataGrid
        rows={leaves.map((l) => ({ ...l, id: l.id || l._id })) as Leave[]}
        columns={columns}
        loading={loading}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 10 },
          },
        }}
        pageSizeOptions={[10, 20]}
        disableRowSelectionOnClick
        autoHeight
      />
    </Box>
  );
}
