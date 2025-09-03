"use client";
import React, { useState } from 'react';
import { Box, Typography, TextField, Button, MenuItem, Alert } from '@mui/material';
import { useRouter } from 'next/navigation';

const leaveTypes = [
  { value: 'sick', label: 'Sick Leave' },
  { value: 'casual', label: 'Casual Leave' },
  { value: 'earned', label: 'Earned Leave' },
];

export default function LeaveRequestPage() {
  const [form, setForm] = useState({
    staffId: '',
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    const res = await fetch('/api/backend/leave/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push('/dashboard/leave'), 1000);
    } else {
      setError('Failed to request leave');
    }
    setLoading(false);
  };

  return (
    <Box maxWidth={500} mx="auto" mt={4}>
      <Typography variant="h5" mb={2}>Request Leave</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">Leave requested successfully!</Alert>}
      <form onSubmit={handleSubmit}>
        <TextField
          label="Staff ID"
          name="staffId"
          value={form.staffId}
          onChange={handleChange}
          fullWidth
          required
          margin="normal"
        />
        <TextField
          select
          label="Leave Type"
          name="leaveType"
          value={form.leaveType}
          onChange={handleChange}
          fullWidth
          required
          margin="normal"
        >
          {leaveTypes.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Start Date"
          name="startDate"
          type="date"
          value={form.startDate}
          onChange={handleChange}
          fullWidth
          required
          margin="normal"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="End Date"
          name="endDate"
          type="date"
          value={form.endDate}
          onChange={handleChange}
          fullWidth
          required
          margin="normal"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Reason"
          name="reason"
          value={form.reason}
          onChange={handleChange}
          fullWidth
          required
          margin="normal"
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={loading}
          sx={{ mt: 2 }}
        >
          {loading ? 'Submitting...' : 'Submit'}
        </Button>
      </form>
    </Box>
  );
}
