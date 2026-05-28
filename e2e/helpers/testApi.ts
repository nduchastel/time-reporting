const BACKEND = 'http://localhost:3001';

export async function reset() {
  const r = await fetch(`${BACKEND}/__test__/reset`, { method: 'POST' });
  if (!r.ok) throw new Error(`reset failed: ${r.status}`);
}

export async function seed(body: any) {
  const r = await fetch(`${BACKEND}/__test__/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`seed failed: ${r.status}`);
}

export async function openaiNext(body: any) {
  const r = await fetch(`${BACKEND}/__test__/openai-next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`openai-next failed: ${r.status}`);
}
