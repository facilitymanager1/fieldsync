import React from 'react';
import AuditLogTable from './AuditLogTable';
import ProtectedRoute from '../../ProtectedRoute';

export default function AuditLogsPage() {
  return (
    <ProtectedRoute allowed={['admin', 'manager']}>
      <AuditLogTable />
    </ProtectedRoute>
  );
}
