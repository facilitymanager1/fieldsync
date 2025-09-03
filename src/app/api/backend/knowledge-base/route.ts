import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/knowledge-base/summary`, {
    method: 'GET',
  });
  const data = await res.json();
  return NextResponse.json({ articles: data.articles || [] });
}
