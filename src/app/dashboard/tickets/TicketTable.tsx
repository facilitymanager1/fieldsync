"use client";
import React, { useEffect, useState } from 'react';
import TicketActions from './TicketActions';
import TicketAssign from './TicketAssign';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

interface Attachment {
  id: string;
  filename: string;
  url: string;
}
interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdBy: string;
  assignee: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

export default function TicketTable() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch("/backend/ticket")
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets || []))
      .finally(() => setLoading(false));
  }, [refresh]);

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Assignee</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell>Attachments</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow>
          ) : tickets.length === 0 ? (
            <TableRow><TableCell colSpan={8}>No tickets found.</TableCell></TableRow>
          ) : (
            tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>{ticket.id}</TableCell>
                <TableCell>{ticket.title}</TableCell>
                <TableCell>{ticket.category}</TableCell>
                <TableCell>{ticket.priority}</TableCell>
                <TableCell>
                  <TicketActions ticketId={ticket.id} currentStatus={ticket.status} onUpdated={() => setRefresh(r => r + 1)} />
                </TableCell>
                <TableCell>
                  <TicketAssign ticketId={ticket.id} currentAssignee={ticket.assignee} onUpdated={() => setRefresh(r => r + 1)} />
                </TableCell>
                <TableCell>{new Date(ticket.createdAt).toLocaleString()}</TableCell>
                <TableCell>{new Date(ticket.updatedAt).toLocaleString()}</TableCell>
                <TableCell>
                  {ticket.attachments && ticket.attachments.length > 0 ? (
                    ticket.attachments.map(att => (
                      <a
                        key={att.id}
                        href={`/backend/attachments/${att.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'block' }}
                      >
                        {att.filename}
                      </a>
                    ))
                  ) : (
                    <span style={{ color: '#888' }}>None</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
