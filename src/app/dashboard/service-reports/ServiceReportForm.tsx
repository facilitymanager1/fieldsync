import React, { useState } from 'react';
import { Box, Button, TextField } from '@mui/material';

export default function ServiceReportForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const [summary, setSummary] = useState('');
  const [location, setLocation] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const attachmentIds: string[] = [];
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        const uploadRes = await fetch('/backend/attachments/upload', {
          method: 'POST',
          body: formData,
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          if (data.attachment?.id) attachmentIds.push(data.attachment.id);
        }
      }
    }
    const res = await fetch('/backend/service-report/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        location,
        attachmentIds,
      }),
    });
    if (res.ok) {
      setSummary('');
      setLocation('');
      setFiles(null);
      if (onSubmitted) onSubmitted();
    } else {
      setError('Failed to submit report');
    }
    setLoading(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <TextField label="Summary" value={summary} onChange={e => setSummary(e.target.value)} required sx={{ minWidth: 200 }} />
      <TextField label="Location" value={location} onChange={e => setLocation(e.target.value)} required sx={{ minWidth: 200 }} />
      <input type="file" multiple onChange={e => setFiles(e.target.files)} style={{ minWidth: 200 }} />
      <Button type="submit" variant="contained" disabled={loading} sx={{ minWidth: 120 }}>
        {loading ? 'Submitting...' : 'Submit Report'}
      </Button>
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </Box>
  );
}
