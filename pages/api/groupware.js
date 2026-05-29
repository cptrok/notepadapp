const GW_BASE = 'https://gw.ex-em.com';

export default async function handler(req, res) {
  const { action } = req.query;
  const gwSession = req.headers['x-gw-session'];

  try {
    switch (action) {
      case 'list': {
        const { q = '', page = 0, offset = 20 } = req.query;
        const url = `${GW_BASE}/api/works/applets/134/docs?q=${encodeURIComponent(q)}&page=${page}&offset=${offset}&ac=true`;
        const r = await fetch(url, {
          headers: { Cookie: `GOSSOcookie=${gwSession}` },
        });
        if (r.status === 401 || r.status === 403) return res.status(401).json({ error: '세션이 만료되었습니다. 그룹웨어 세션을 다시 입력해주세요.' });
        const text = await r.text();
        let data;
        try { data = JSON.parse(text); } catch {
          console.log('[GW list] non-JSON response status:', r.status, 'body:', text.slice(0, 300));
          return res.status(500).json({ error: 'GW응답파싱실패', raw: text.slice(0, 200) });
        }
        if (!r.ok) return res.status(r.status).json({ error: '목록 로드 실패' });
        return res.json(data);
      }

      case 'detail': {
        const { docId } = req.query;
        if (!docId) return res.status(400).json({ error: 'docId 필요' });
        const r = await fetch(`${GW_BASE}/api/works/applets/134/docs/${docId}`, {
          headers: { Cookie: `GOSSOcookie=${gwSession}` },
        });
        if (r.status === 401 || r.status === 403) return res.status(401).json({ error: '세션이 만료되었습니다. 그룹웨어 세션을 다시 입력해주세요.' });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: '상세 로드 실패' });
        return res.json(data);
      }

      case 'schema': {
        const r = await fetch(`${GW_BASE}/api/works/applets/134`, {
          headers: { Cookie: `GOSSOcookie=${gwSession}` },
        });
        if (r.status === 401 || r.status === 403) return res.status(401).json({ error: '세션이 만료되었습니다.' });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: '스키마 로드 실패' });
        return res.json(data);
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
