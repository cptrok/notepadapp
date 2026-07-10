import { sb } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { url, filename, to, clickupToken } = req.body || {};
  if (!url || !filename || !to) {
    return res.status(400).json({ ok: false, error: 'url, filename, to 필요' });
  }

  try {
    const { data: ngrokUrl, error } = await sb.rpc('get_setting', { p_key: 'ngrok_url' });
    if (error || !ngrokUrl) {
      return res.status(500).json({ ok: false, error: 'ngrok URL이 설정되지 않았습니다.' });
    }

    const r = await fetch(`${ngrokUrl.trim()}/send-email-from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ url, filename, to, clickupToken }),
      signal: AbortSignal.timeout(120000),
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(500).json({ ok: false, error: `서버 응답 오류 (${r.status}): ${text.slice(0, 200)}` });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
