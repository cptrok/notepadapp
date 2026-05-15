export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, channelName } = req.body;
  if (!messages || messages.length === 0) return res.status(400).json({ error: '메시지가 없습니다.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });

  const text = messages.map(m => `[${m.username}] ${m.message}`).join('\n');
  const prompt = `다음은 "${channelName}" 채널의 최근 대화 내용입니다.\n아래 대화를 한국어로 간결하게 요약해주세요. 주요 논의 사항, 결정된 내용, 액션 아이템이 있으면 구분해서 정리해주세요.\n\n${text}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || '요약 실패' });
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || '요약 결과가 없습니다.';
    return res.json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
