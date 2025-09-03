import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/service-report`, {
    method: 'GET',
  });
  const data = await res.json();
  return NextResponse.json({ reports: data.reports || [] });
}
