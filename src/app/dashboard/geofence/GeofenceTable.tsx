"use client";
import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Chip } from '@mui/material';

interface Geofence {
  id?: string;
  _id?: string;
  name: string;
  location: string;
  radius: number;
  status: string;
}

export default function GeofenceTable() {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGeofences();
  }, []);

  const fetchGeofences = async () => {
    setLoading(true);
    const res = await fetch('/api/backend/geofence');
    const data = await res.json();
    setGeofences(data.geofences || []);
    setLoading(false);
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', width: 180 },
    { field: 'location', headerName: 'Location', width: 200 },
    { field: 'radius', headerName: 'Radius (m)', width: 120 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
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
        rows={geofences.map((g) => ({ ...g, id: g.id || g._id })) as Geofence[]}
        columns={columns}
        loading={loading}
        pageSizeOptions={[10, 20]}
        disableRowSelectionOnClick
        autoHeight
      />
    </Box>
  );
}
