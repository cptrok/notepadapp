// ClickUp Doc 서버사이드 프록시
export default async function handler(req, res) {
  const { docId, pageId } = req.query;
  const token = req.headers['x-clickup-token'];
  const TEAM_ID = '25540965';
  const FRONTDOOR = 'https://frontdoor-prod-ap-southeast-1-1.clickup.com';

  async function cuGet(url, headers = {}) {
    const r = await fetch(url, { headers });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    return { status: r.status, data };
  }

  try {
    // 1) 공개 페이지 API (로그인 불필요)
    if (pageId) {
      const publicUrl = `${FRONTDOOR}/docs/v1/${TEAM_ID}/publicPage/${docId}?public_key=${pageId}`;
      const { status, data } = await cuGet(publicUrl);
      if (status === 200 && data) {
        const content = data.content || data.markdown || data.text || '';
        const name = data.name || data.title || data.page_name || '';
        if (content) return res.json({ name, content });
        // 내용이 중첩된 경우 탐색
        const page = data.page || data.doc_page || data.pages?.[0] || {};
        if (page.content) return res.json({ name: page.name || name, content: page.content });
        // 응답 구조 디버그
        return res.json({ name, content: '', debug: JSON.stringify(data).slice(0, 3000) });
      }
    } else {
      const publicUrl = `${FRONTDOOR}/docs/v1/${TEAM_ID}/publicPage/${docId}`;
      const { status, data } = await cuGet(publicUrl);
      if (status === 200 && data) {
        const content = data.content || data.markdown || data.text || '';
        const name = data.name || data.title || '';
        if (content) return res.json({ name, content });
        const page = data.page || data.doc_page || data.pages?.[0] || {};
        if (page.content) return res.json({ name: page.name || name, content: page.content });
        return res.json({ name, content: '', debug: JSON.stringify(data).slice(0, 3000) });
      }
    }

    // 2) 인증 토큰으로 ClickUp API v3 시도
    if (token) {
      const authHeaders = { Authorization: token };
      if (pageId) {
        const { status, data } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}?content_format=text%2Fmd`,
          authHeaders
        );
        if (status === 200 && data?.content) {
          return res.json({ name: data.name || '', content: data.content });
        }
      } else {
        const { status, data } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}?content_format=text%2Fmd`,
          authHeaders
        );
        if (status === 200 && data?.content) {
          return res.json({ name: data.name || '', content: data.content });
        }
      }
    }

    res.status(404).json({ error: '내용을 가져올 수 없습니다.' });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
