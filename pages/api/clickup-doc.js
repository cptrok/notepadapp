// ClickUp Doc 서버사이드 프록시
export default async function handler(req, res) {
  const { docId, pageId } = req.query;
  const token = req.headers['x-clickup-token'];
  const TEAM_ID = '25540965';

  async function cuGet(url, headers = {}) {
    const r = await fetch(url, { headers });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    return { status: r.status, data };
  }

  const authHeaders = token ? { Authorization: token } : {};

  // 시도할 API 엔드포인트 목록 (인증 있음 → 없음 순서로)
  const attempts = [];

  if (pageId) {
    const pageUrl = `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}?content_format=text%2Fmd`;
    if (token) attempts.push({ url: pageUrl, headers: authHeaders, label: 'page-auth' });
    attempts.push({ url: pageUrl, headers: {}, label: 'page-noauth' });
  } else {
    const docUrl = `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}?content_format=text%2Fmd`;
    const pagesUrl = `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages`;
    if (token) attempts.push({ url: docUrl, headers: authHeaders, label: 'doc-auth' });
    attempts.push({ url: docUrl, headers: {}, label: 'doc-noauth' });
    if (token) attempts.push({ url: pagesUrl, headers: authHeaders, label: 'pages-auth' });
    attempts.push({ url: pagesUrl, headers: {}, label: 'pages-noauth' });
  }

  try {
    for (const attempt of attempts) {
      const { status, data } = await cuGet(attempt.url, attempt.headers);
      if (status === 200 && data) {
        if (data.content) {
          return res.json({ name: data.name || data.title || '', content: data.content });
        }
        // pages 목록인 경우 첫 페이지 로드
        if (attempt.label.startsWith('pages') && (Array.isArray(data) || data.pages)) {
          const pages = Array.isArray(data) ? data : (data.pages || []);
          if (pages.length > 0) {
            const firstPageUrl = `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pages[0].id}?content_format=text%2Fmd`;
            const useAuth = attempt.label.endsWith('-auth');
            const { status: s2, data: pd2 } = await cuGet(firstPageUrl, useAuth ? authHeaders : {});
            if (s2 === 200 && pd2 && pd2.content) {
              return res.json({ name: pages[0].name || '', content: pd2.content });
            }
          }
        }
      }
    }

    // 모든 API 시도 실패 — 공개 공유 URL 형태로 직접 접근 시도
    // ClickUp 공개 문서는 share token 기반 API를 사용할 수 있음
    // rbeb5-2724398 형태에서 앞부분이 space alias일 수 있음
    const shareApiAttempts = [
      `https://api.clickup.com/api/v3/docs/${docId}${pageId ? '/pages/' + pageId : ''}?content_format=text%2Fmd`,
      `https://api.clickup.com/api/v2/doc/${docId}${pageId ? '/page/' + pageId : ''}`,
    ];

    for (const url of shareApiAttempts) {
      const { status, data } = await cuGet(url, token ? authHeaders : {});
      if (status === 200 && data && data.content) {
        return res.json({ name: data.name || data.title || '', content: data.content });
      }
    }

    // 최후 수단: 내용 없음 반환 (클라이언트에서 iframe으로 표시 가능)
    return res.json({
      name: '',
      content: '',
      iframeUrl: `https://doc.clickup.com/${TEAM_ID}/p/h/${docId}${pageId ? '/' + pageId : ''}`,
      error_detail: 'API로 내용을 가져올 수 없습니다. iframe으로 표시합니다.'
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
