export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, channelName, date, mode } = req.body;
  if (!messages || messages.length === 0) return res.status(400).json({ error: '메시지가 없습니다.' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });

  const style = '명사형 종결 어미를 사용해 간결하게 작성할 것. (예: "~함", "~됨", "~할 것", "~한 상태" 등. "~했습니다", "~보입니다" 같은 경어체 금지)';
  const text = messages.map(m => `[${m.username}] ${m.message}`).join('\n');
  const prompt = mode === 'date'
    ? `다음은 "${channelName}" 채널의 ${date} 대화 내용입니다.\n아래 내용을 다음 형식으로 한국어로 정리해주세요. ${style}\n\n## 타이틀\n- 해당 날짜에 발생한 문제/이슈/문의의 핵심 내용만 명사 위주로 한 줄 작성. "확인", "진행", "완료", "요청", "처리" 같은 동작 표현은 제외\n\n## 이슈사항\n- 해당 날짜에 언급된 이슈, 문제, 오류 등을 항목별로 정리\n\n## 진행내역\n- 해당 날짜에 진행된 작업, 논의, 결정 사항을 빠짐없이 항목별로 상세히 정리. 어떤 내용이 논의됐는지, 어떤 결정이 내려졌는지 구체적으로 작성. 담당자/작성자 이름은 포함하지 말 것. 내용이 많으면 항목을 여러 개로 나눠서 작성\n\n(해당 항목이 없으면 "없음"으로 표기)\n\n대화 내용:\n${text}`
    : `다음은 "${channelName}" 채널의 최근 대화 내용입니다.\n아래 대화를 한국어로 간결하게 요약해주세요. 주요 논의 사항, 결정된 내용, 액션 아이템이 있으면 구분해서 정리해주세요. ${style}\n\n${text}`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || '요약 실패' });
    const summary = data.choices?.[0]?.message?.content || '요약 결과가 없습니다.';
    return res.json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
