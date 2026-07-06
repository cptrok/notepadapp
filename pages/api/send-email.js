import { sb } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { version, to } = req.body || {};
    const { data: ngrokUrl, error } = await sb.rpc('get_setting', { p_key: 'ngrok_url' });
    if (error || !ngrokUrl) return res.status(500).json({ ok: false, error: 'ngrok URL이 설정되지 않았습니다.' });

    const r = await fetch(`${ngrokUrl.trim()}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({ version: version || '', to: to || '' }),
      signal: AbortSignal.timeout(620000),
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
