export async function GET() {
  // Proxy to backend API
  const res = await fetch('http://localhost:3001/ticket');
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
