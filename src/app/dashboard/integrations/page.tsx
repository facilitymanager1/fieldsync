import React from 'react';
import IntegrationPanel from './IntegrationPanel';
import ProtectedRoute from '../../ProtectedRoute';

export default function IntegrationsPage() {
  return (
    <ProtectedRoute allowed={['admin', 'manager']}>
      <IntegrationPanel />
    </ProtectedRoute>
  );
}
