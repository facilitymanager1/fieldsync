"use client";
import React, { useEffect, useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

interface Shift {
  id: string;
  staffId: string;
  siteId: string;
  start: string;
  end: string | null;
  state: string;
}

export default function ShiftTable() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/backend/shift")
      .then((res) => res.json())
      .then((data) => setShifts(data.shifts || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Shift ID</TableCell>
            <TableCell>Staff ID</TableCell>
            <TableCell>Site ID</TableCell>
            <TableCell>Start</TableCell>
            <TableCell>End</TableCell>
            <TableCell>State</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
          ) : shifts.length === 0 ? (
            <TableRow><TableCell colSpan={6}>No shifts found.</TableCell></TableRow>
          ) : (
            shifts.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell>{shift.id}</TableCell>
                <TableCell>{shift.staffId}</TableCell>
                <TableCell>{shift.siteId}</TableCell>
                <TableCell>{shift.start ? new Date(shift.start).toLocaleString() : ''}</TableCell>
                <TableCell>{shift.end ? new Date(shift.end).toLocaleString() : ''}</TableCell>
                <TableCell>{shift.state}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
