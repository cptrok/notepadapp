const MM_BASE = 'https://chat.exem.io/api/v4';

export default async function handler(req, res) {
  const { action, teamId, channelId, userId } = req.query;
  const token = req.headers['x-mm-token'];

  try {
    switch (action) {
      case 'login': {
        const { username, password } = req.body;
        const r = await fetch(`${MM_BASE}/users/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login_id: username, password }),
        });
        const mmToken = r.headers.get('Token');
        const data = await r.json();
        if (!r.ok) return res.status(400).json({ error: data.message || '로그인 실패' });
        return res.json({ token: mmToken, userId: data.id, username: data.username });
      }

      case 'teams': {
        const r = await fetch(`${MM_BASE}/users/me/teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data.message });
        return res.json(data);
      }

      case 'channels': {
        const r = await fetch(`${MM_BASE}/users/${userId}/teams/${teamId}/channels`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data.message });
        return res.json(data);
      }

      case 'posts': {
        const page = req.query.page || 0;
        const since = req.query.since || '';
        const url = since
          ? `${MM_BASE}/channels/${channelId}/posts?since=${since}&per_page=200`
          : `${MM_BASE}/channels/${channelId}/posts?page=${page}&per_page=50`;
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data.message });
        return res.json(data);
      }

      case 'file': {
        const { fileId } = req.query;
        const r = await fetch(`${MM_BASE}/files/${fileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return res.status(r.status).json({ error: '파일 로드 실패' });
        const contentType = r.headers.get('content-type') || 'application/octet-stream';
        const contentDisposition = r.headers.get('content-disposition');
        res.setHeader('Content-Type', contentType);
        if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const buffer = await r.arrayBuffer();
        return res.send(Buffer.from(buffer));
      }

      case 'users': {
        const { userIds } = req.body;
        const r = await fetch(`${MM_BASE}/users/ids`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(userIds),
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data.message });
        return res.json(data);
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
