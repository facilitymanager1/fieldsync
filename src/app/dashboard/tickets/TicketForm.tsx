"use client";
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

const categories = ['General', 'Technical', 'HR', 'Other'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];

export default function TicketForm({ onCreated }: { onCreated?: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [priority, setPriority] = useState(priorities[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

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
    const res = await fetch('/backend/ticket/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        category,
        priority,
        createdBy: 'admin', // TODO: Replace with real user
        assignee: '',
        attachmentIds,
      }),
    });
    if (res.ok) {
      setTitle('');
      setDescription('');
      setCategory(categories[0]);
      setPriority(priorities[0]);
      setFiles(null);
      if (onCreated) onCreated();
    } else {
      setError('Failed to create ticket');
    }
    setLoading(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} required sx={{ minWidth: 200 }} />
      <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} required sx={{ minWidth: 200 }} />
      <TextField select label="Category" value={category} onChange={e => setCategory(e.target.value)} sx={{ minWidth: 120 }}>
        {categories.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
      </TextField>
      <TextField select label="Priority" value={priority} onChange={e => setPriority(e.target.value)} sx={{ minWidth: 120 }}>
        {priorities.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
      </TextField>
      <input
        type="file"
        multiple
        onChange={e => setFiles(e.target.files)}
        style={{ minWidth: 200 }}
      />
      <Button type="submit" variant="contained" disabled={loading} sx={{ minWidth: 120 }}>
        {loading ? 'Creating...' : 'Create Ticket'}
      </Button>
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </Box>
  );
}
