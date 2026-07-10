import { sb } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password, otp } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'username, password 필요' });

  try {
    // 117 서버(한국 내부망)를 경유해서 그룹웨어 로그인
    const { data: ngrokUrl, error } = await sb.rpc('get_setting', { p_key: 'ngrok_url' });
    if (error || !ngrokUrl) return res.status(500).json({ ok: false, error: 'ngrok URL이 설정되지 않았습니다.' });

    const r = await fetch(`${ngrokUrl.trim()}/gw-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ username, password, otp: otp || undefined }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
