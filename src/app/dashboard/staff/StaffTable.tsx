"use client";
import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Chip } from '@mui/material';

interface Staff {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

export default function StaffTable() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    const res = await fetch('/api/backend/staff');
    const data = await res.json();
    setStaff(data.staff || []);
    setLoading(false);
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', width: 180 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'phone', headerName: 'Phone', width: 140 },
    { field: 'role', headerName: 'Role', width: 120 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: any) => (
        <Chip
          label={params.value}
          color={params.value === 'active' ? 'success' : 'warning'}
          size="small"
        />
      ),
    },
  ];

  return (
    <Box height={500}>
      <DataGrid
        rows={staff.map((s) => ({ ...s, id: s.id || s._id }))}
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
