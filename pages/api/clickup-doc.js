// ClickUp Doc 서버사이드 프록시 — CORS 없이 공개 doc 접근 가능
export default async function handler(req, res) {
  const { docId, pageId } = req.query;
  const token = req.headers['x-clickup-token'];
  const TEAM_ID = '25540965';

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = token;

  async function cuGet(url, withAuth = true) {
    const h = withAuth ? headers : { 'Content-Type': 'application/json' };
    const r = await fetch(url, { headers: h });
    return { status: r.status, data: await r.json() };
  }

  try {
    if (pageId) {
      // 1) 인증 있이 페이지 조회
      let { status, data } = await cuGet(
        `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}?content_format=text%2Fmd`
      );
      if (data.content) return res.json({ name: data.name || data.title || '', content: data.content });

      // 2) 인증 없이 재시도 (공개 doc)
      ({ status, data } = await cuGet(
        `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}?content_format=text%2Fmd`,
        false
      ));
      if (data.content) return res.json({ name: data.name || data.title || '', content: data.content });

      // 3) pages 목록 시도
      ({ status, data } = await cuGet(
        `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages`
      ));
      if (status === 403) {
        ({ status, data } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages`,
          false
        ));
      }
      const pages = Array.isArray(data) ? data : (data.pages || []);
      if (pages.length > 0) {
        const firstPage = pages[0];
        const { data: pd } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${firstPage.id}?content_format=text%2Fmd`,
          false
        );
        return res.json({ name: firstPage.name || firstPage.title || '', content: pd.content || '' });
      }
      return res.status(403).json({ error: '내용을 불러올 수 없습니다.' });
    } else {
      // docId만 있을 때 — doc 직접 또는 pages 목록
      let { status, data } = await cuGet(
        `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}?content_format=text%2Fmd`
      );
      if (status === 403) {
        ({ status, data } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}?content_format=text%2Fmd`,
          false
        ));
      }
      if (data.content) return res.json({ name: data.name || data.title || '', content: data.content });

      let { data: pdata } = await cuGet(
        `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages`
      );
      if (pdata.err) {
        ({ data: pdata } = await cuGet(
          `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages`,
          false
        ));
      }
      const pages = Array.isArray(pdata) ? pdata : (pdata.pages || []);
      if (pages.length === 0) return res.status(403).json({ error: '내용을 불러올 수 없습니다.' });

      const firstPage = pages[0];
      const { data: pd } = await cuGet(
        `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${firstPage.id}?content_format=text%2Fmd`,
        false
      );
      return res.json({ name: firstPage.name || firstPage.title || '', content: pd.content || '' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
