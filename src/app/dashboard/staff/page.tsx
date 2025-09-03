import React from 'react';
import StaffTable from './StaffTable';
import ProtectedRoute from '../../ProtectedRoute';

const StaffPage = () => {
  return (
    <ProtectedRoute allowed={['Admin', 'Supervisor', 'SiteStaff']}>
      <section style={{ padding: 32 }}>
        <h2>Staff Overview</h2>
        <StaffTable />
      </section>
    </ProtectedRoute>
  );
};

export default StaffPage;
