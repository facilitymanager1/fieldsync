"use client";
import React, { useState } from 'react';
import ServiceReportTable from './ServiceReportTable';
import ServiceReportForm from './ServiceReportForm';

const ServiceReportsPage = () => {
  const [refresh, setRefresh] = useState(0);
  return (
    <section style={{ padding: 32 }}>
      <h2>Service Reports</h2>
      <ServiceReportForm onSubmitted={() => setRefresh(r => r + 1)} />
      <ServiceReportTable key={refresh} />
    </section>
  );
};

export default ServiceReportsPage;
