// ClickUp Doc 서버사이드 프록시
export default async function handler(req, res) {
  const { docId, pageId } = req.query;
  const token = req.headers['x-clickup-token'];
  const TEAM_ID = '25540965';

  const authHeaders = { Authorization: token };

  async function cuGet(url, withAuth = true) {
    const r = await fetch(url, withAuth ? { headers: authHeaders } : {});
    return { status: r.status, data: await r.json() };
  }

  try {
    // 1) 인증 토큰으로 API 시도
    if (pageId) {
      const { data } = await cuGet(
        `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}?content_format=text%2Fmd`
      );
      if (data.content) return res.json({ name: data.name || data.title || '', content: data.content });
    } else {
      const { data } = await cuGet(
        `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}?content_format=text%2Fmd`
      );
      if (data.content) return res.json({ name: data.name || data.title || '', content: data.content });
      // pages 목록
      const { data: pd } = await cuGet(`https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages`);
      const pages = Array.isArray(pd) ? pd : (pd.pages || []);
      if (pages.length > 0) {
        const { data: pd2 } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pages[0].id}?content_format=text%2Fmd`
        );
        if (pd2.content) return res.json({ name: pages[0].name || '', content: pd2.content });
      }
    }

    // 2) API 토큰으로 안 되면 — doc.clickup.com 페이지 HTML에서 초기 상태 추출 시도
    const docUrl = `https://doc.clickup.com/${TEAM_ID}/p/h/${docId}${pageId ? '/' + pageId : ''}`;
    const htmlRes = await fetch(docUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    const html = await htmlRes.text();

    // window.__STORE__ 또는 __INITIAL_STATE__ 등 JSON 데이터 탐색
    const storeMatch = html.match(/window\.__(?:STORE|INITIAL_STATE|APP_STATE|DATA)__\s*=\s*({.+?})(?:<\/script>|;)/s);
    if (storeMatch) {
      try {
        const store = JSON.parse(storeMatch[1]);
        return res.json({ name: '', content: '', raw: JSON.stringify(store).slice(0, 2000) });
      } catch {}
    }

    // <script type="application/json"> 탐색
    const jsonMatch = html.match(/<script[^>]+type=["']application\/json["'][^>]*>(.+?)<\/script>/s);
    if (jsonMatch) {
      try {
        const d = JSON.parse(jsonMatch[1]);
        return res.json({ name: '', content: '', raw: JSON.stringify(d).slice(0, 2000) });
      } catch {}
    }

    // HTML 자체를 일부 반환 (디버그)
    return res.json({ name: '', content: '', raw: html.slice(0, 2000) });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
