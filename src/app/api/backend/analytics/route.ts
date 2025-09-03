import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/analytics`, {
    method: 'GET',
  });
  const data = await res.json();
  return NextResponse.json({ analytics: data.analytics || null });
}
