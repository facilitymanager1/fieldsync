"use client";
import React, { useState } from 'react';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

const statuses = ['open', 'in progress', 'resolved', 'closed'];

export default function TicketActions({ ticketId, currentStatus, onUpdated }: { ticketId: string, currentStatus: string, onUpdated?: () => void }) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (e: any) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setLoading(true);
    await fetch('/backend/ticket/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, status: newStatus, updatedBy: 'admin' }),
    });
    setLoading(false);
    if (onUpdated) onUpdated();
  };

  return (
    <Select
      value={status}
      onChange={handleStatusChange}
      size="small"
      disabled={loading}
      sx={{ minWidth: 120 }}
    >
      {statuses.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
    </Select>
  );
}
