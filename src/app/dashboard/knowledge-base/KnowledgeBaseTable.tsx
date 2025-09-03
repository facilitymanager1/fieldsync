import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Chip, Link } from '@mui/material';

interface Attachment {
  id: string;
  filename: string;
  url: string;
}
interface KnowledgeBaseArticle {
  id?: string;
  _id?: string;
  title: string;
  category: string;
  status: string;
  url: string;
  attachments?: Attachment[];
}

export default function KnowledgeBaseTable() {
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    const res = await fetch('/api/backend/knowledge-base');
    const data = await res.json();
    setArticles(data.articles || []);
    setLoading(false);
  };

  const columns: GridColDef[] = [
    { field: 'title', headerName: 'Title', width: 220, renderCell: (params) => (
      <Link href={params.row.url} target="_blank" rel="noopener">{params.value}</Link>
    ) },
    { field: 'category', headerName: 'Category', width: 140 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === 'published' ? 'success' : 'warning'}
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
        rows={articles.map((a) => ({ ...a, id: a.id || a._id })) as KnowledgeBaseArticle[]}
        columns={columns}
        loading={loading}
        pageSizeOptions={[10, 20]}
        disableRowSelectionOnClick
        autoHeight
      />
    </Box>
  );
}
