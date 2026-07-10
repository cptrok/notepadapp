const GW_BASE = 'https://gw.ex-em.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username, password 필요' });

  try {
    // 1. 로그인 페이지 GET → 초기 세션 쿠키 획득
    const getResp = await fetch(`${GW_BASE}/login`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer': `${GW_BASE}/login`,
      },
      redirect: 'follow',
    });

    // Set-Cookie 헤더에서 초기 쿠키 수집
    const initCookies = parseCookies(getResp.headers.getSetCookie ? getResp.headers.getSetCookie() : [getResp.headers.get('set-cookie')].filter(Boolean));

    // 2. 아이디/비밀번호 POST
    const body = new URLSearchParams({ username, password });
    const postResp = await fetch(`${GW_BASE}/login`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer': `${GW_BASE}/login`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieHeader(initCookies),
      },
      body: body.toString(),
      redirect: 'follow',
    });

    const postCookies = parseCookies(postResp.headers.getSetCookie ? postResp.headers.getSetCookie() : [postResp.headers.get('set-cookie')].filter(Boolean));
    const allCookies = { ...initCookies, ...postCookies };

    const gossoCookie = allCookies['GOSSOcookie'];
    if (!gossoCookie) {
      return res.status(401).json({ error: '로그인 실패 또는 GOSSOcookie를 찾을 수 없습니다.' });
    }

    return res.json({ ok: true, gossoCookie });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function parseCookies(setCookieHeaders) {
  const cookies = {};
  for (const header of setCookieHeaders) {
    if (!header) continue;
    const [nameValue] = header.split(';');
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx < 0) continue;
    const name = nameValue.slice(0, eqIdx).trim();
    const value = nameValue.slice(eqIdx + 1).trim();
    cookies[name] = value;
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}
