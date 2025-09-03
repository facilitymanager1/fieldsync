import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Chip } from '@mui/material';

interface Attachment {
  id: string;
  filename: string;
  url: string;
}
interface ServiceReport {
  id?: string;
  _id?: string;
  staffId: string;
  date: string;
  location: string;
  status: string;
  summary: string;
  attachments?: Attachment[];
}

export default function ServiceReportTable() {
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    const res = await fetch('/api/backend/service-report');
    const data = await res.json();
    setReports(data.reports || []);
    setLoading(false);
  };

  const columns: GridColDef[] = [
    { field: 'staffId', headerName: 'Staff ID', width: 120 },
    { field: 'date', headerName: 'Date', width: 120 },
    { field: 'location', headerName: 'Location', width: 180 },
    { field: 'summary', headerName: 'Summary', width: 200 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === 'completed' ? 'success' : 'warning'}
          size="small"
        />
      ),
    },
    {
      field: 'attachments',
      headerName: 'Attachments',
      width: 200,
      renderCell: (params) => (
        params.value && params.value.length > 0 ? (
          <Box>
            {params.value.map((att: Attachment) => (
              <a
                key={att.id}
                href={`/backend/attachments/${att.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block' }}
              >
                {att.filename}
              </a>
            ))}
          </Box>
        ) : (
          <span style={{ color: '#888' }}>None</span>
        )
      ),
    },
  ];

  return (
    <Box height={500}>
      <DataGrid
        rows={reports.map((r) => ({ ...r, id: r.id || r._id })) as ServiceReport[]}
        columns={columns}
        loading={loading}
        pageSizeOptions={[10, 20]}
        disableRowSelectionOnClick
        autoHeight
      />
    </Box>
  );
}
