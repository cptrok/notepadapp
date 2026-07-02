// ClickUp Doc 하위 페이지 목록 조회
export default async function handler(req, res) {
  const { docId, pageId } = req.query;
  const token = req.headers['x-clickup-token'];
  const TEAM_ID = '25540965';

  if (!token) return res.status(401).json({ error: '토큰 없음' });

  try {
    const r = await fetch(
      `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages?parent_page_id=${pageId}&content_format=text%2Fmd`,
      { headers: { Authorization: token } }
    );
    const data = await r.json();
    if (!Array.isArray(data)) return res.json([]);
    return res.json(data.map(p => ({ id: p.id, name: p.name, doc_id: p.doc_id, content: p.content || '' })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
