import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/staff`, {
    method: 'GET',
  });
  const data = await res.json();
  return NextResponse.json({ staff: data.staff || [] });
}
