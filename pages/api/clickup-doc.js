// ClickUp Doc 서버사이드 프록시
export default async function handler(req, res) {
  const { docId, pageId, source } = req.query;
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

  function extractContent(data) {
    if (!data) return null;
    const content = data.content || data.markdown || data.text || '';
    const name = data.name || data.title || data.page_name || '';
    if (content) return { name, content };
    const page = data.page || data.doc_page || data.pages?.[0] || {};
    if (page.content) return { name: page.name || name, content: page.content };
    return null;
  }

  try {
    // app.clickup.com URL은 공개 API 미지원 → 인증 v3 API로 바로 시도
    if (source !== 'app') {
      // 1) 공개 페이지 API (로그인 불필요, doc.clickup.com 형식)
      const publicUrl = pageId
        ? `${FRONTDOOR}/docs/v1/${TEAM_ID}/publicPage/${docId}?public_key=${pageId}`
        : `${FRONTDOOR}/docs/v1/${TEAM_ID}/publicPage/${docId}`;
      const { status, data } = await cuGet(publicUrl);
      if (status === 200 && data) {
        const result = extractContent(data);
        if (result) return res.json(result);
        // 내용 없음 → 아래 v3 API로 fallthrough
      }
    }

    // 2) 인증 토큰으로 ClickUp API v3
    if (token) {
      const authHeaders = { Authorization: token };

      if (pageId) {
        const dbg = {};

        // 시도 1a: docs/{docId}/pages/{pageId} with content_format
        const { status, data } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}?content_format=text%2Fmd`,
          authHeaders
        );
        dbg.t1 = { status, content: JSON.stringify(data?.content).slice(0, 100), keys: data ? Object.keys(data) : null };
        if (status === 200 && data?.content) {
          return res.json({ name: data.name || '', content: data.content });
        }

        // 시도 1b: content_format 없이
        if (status === 200 && data) {
          const content = data.content || data.markdown || data.text || data.body || '';
          if (content) return res.json({ name: data.name || '', content });
        }

        // 시도 2: 두 번째 ID가 실제 docId인 경우 (docs/{pageId})
        const { status: s2, data: d2 } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${pageId}?content_format=text%2Fmd`,
          authHeaders
        );
        dbg.t2 = { status: s2 };
        if (s2 === 200 && d2?.content) {
          return res.json({ name: d2.name || '', content: d2.content });
        }

        // 시도 3: docs/{docId}/pages 전체 목록 (content_format=text/md)
        const { status: s3, data: d3 } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages?content_format=text%2Fmd&limit=200`,
          authHeaders
        );
        const ids = Array.isArray(d3) ? d3.map(p => p.id) : null;
        dbg.t3 = { status: s3, count: Array.isArray(d3) ? d3.length : null, ids, found: ids?.includes(pageId) };
        if (s3 === 200 && Array.isArray(d3)) {
          const page = d3.find(p => p.id === pageId);
          if (page?.content) return res.json({ name: page.name || '', content: page.content });
        }

        // 시도 4: content_format 없이 원본
        const { status: s4, data: d4 } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}`,
          authHeaders
        );
        dbg.t4 = { status: s4, content: JSON.stringify(d4?.content).slice(0, 200) };
        if (s4 === 200 && d4?.content) {
          return res.json({ name: d4.name || '', content: d4.content });
        }

        // 시도 5: application/json (Quill Delta) 형식
        const { status: s5, data: d5 } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}?content_format=application%2Fjson`,
          authHeaders
        );
        dbg.t5 = { status: s5, content: JSON.stringify(d5?.content).slice(0, 300) };
        if (s5 === 200 && d5?.content) {
          return res.json({ name: d5.name || '', content: d5.content });
        }

        // 시도 6: text/plain 형식
        const { status: s6, data: d6 } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}?content_format=text%2Fplain`,
          authHeaders
        );
        dbg.t6 = { status: s6, content: JSON.stringify(d6?.content).slice(0, 300) };
        if (s6 === 200 && d6?.content) {
          return res.json({ name: d6.name || '', content: d6.content });
        }

        return res.status(404).json({ error: '내용을 가져올 수 없습니다.', dbg });
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
