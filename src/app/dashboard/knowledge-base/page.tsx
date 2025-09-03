"use client";
import React, { useState } from 'react';
import KnowledgeBaseTable from './KnowledgeBaseTable';
import KnowledgeBaseForm from './KnowledgeBaseForm';

const KnowledgeBasePage = () => {
  const [refresh, setRefresh] = useState(0);
  return (
    <section style={{ padding: 32 }}>
      <h2>Knowledge Base</h2>
      <KnowledgeBaseForm onCreated={() => setRefresh(r => r + 1)} />
      <KnowledgeBaseTable key={refresh} />
    </section>
  );
};

export default KnowledgeBasePage;
