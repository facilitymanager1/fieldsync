import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch(`${process.env.BACKEND_URL || 'http://localhost:4000'}/leave`, {
    method: 'GET',
  });
  const data = await res.json();
  return NextResponse.json({ leaves: data.leaves || [] });
}
