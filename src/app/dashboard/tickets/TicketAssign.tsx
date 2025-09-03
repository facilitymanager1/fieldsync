"use client";
import React, { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

export default function TicketAssign({ ticketId, currentAssignee, onUpdated }: { ticketId: string, currentAssignee: string, onUpdated?: () => void }) {
  const [assignee, setAssignee] = useState(currentAssignee);
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    setLoading(true);
    await fetch('/backend/ticket/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, assignee, updatedBy: 'admin' }),
    });
    setLoading(false);
    if (onUpdated) onUpdated();
  };

  return (
    <span>
      <TextField
        value={assignee}
        onChange={e => setAssignee(e.target.value)}
        size="small"
        placeholder="Assignee"
        sx={{ width: 100, mr: 1 }}
      />
      <Button onClick={handleAssign} size="small" variant="outlined" disabled={loading}>
        Assign
      </Button>
    </span>
  );
}
