export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const r = await fetch('https://dagger-lego-dumping.ngrok-free.dev/send-email', {
      method: 'POST',
      signal: AbortSignal.timeout(70000),
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
