import React, { useState } from 'react';
import { Box, Button, TextField, MenuItem } from '@mui/material';

const types = ['article', 'training', 'quiz'];

export default function KnowledgeBaseForm({ onCreated }: { onCreated?: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState(types[0]);
  const [tags, setTags] = useState('');
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
    const res = await fetch('/backend/knowledge-base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content,
        type,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        attachmentIds,
      }),
    });
    if (res.ok) {
      setTitle('');
      setContent('');
      setType(types[0]);
      setTags('');
      setFiles(null);
      if (onCreated) onCreated();
    } else {
      setError('Failed to create article');
    }
    setLoading(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} required sx={{ minWidth: 200 }} />
      <TextField label="Content" value={content} onChange={e => setContent(e.target.value)} required sx={{ minWidth: 200 }} />
      <TextField select label="Type" value={type} onChange={e => setType(e.target.value)} sx={{ minWidth: 120 }}>
        {types.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
      </TextField>
      <TextField label="Tags (comma separated)" value={tags} onChange={e => setTags(e.target.value)} sx={{ minWidth: 200 }} />
      <input type="file" multiple onChange={e => setFiles(e.target.files)} style={{ minWidth: 200 }} />
      <Button type="submit" variant="contained" disabled={loading} sx={{ minWidth: 120 }}>
        {loading ? 'Creating...' : 'Create Article'}
      </Button>
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </Box>
  );
}
