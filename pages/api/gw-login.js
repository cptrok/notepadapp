const GW_BASE = 'https://gw.ex-em.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, otp } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username, password 필요' });

  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
  };

  const debug = {};

  try {
    // STEP 1: 초기 세션 쿠키 획득
    const initResp = await fetch(`${GW_BASE}/login`, { headers: commonHeaders, redirect: 'follow' });
    const initCookies = parseCookies(getSetCookieHeaders(initResp));
    debug.initCookies = Object.keys(initCookies);

    // STEP 2: 아이디/비밀번호 로그인
    const loginResp = await fetch(`${GW_BASE}/api/login`, {
      method: 'POST',
      headers: { ...commonHeaders, 'Content-Type': 'application/json', Cookie: cookieHeader(initCookies) },
      body: JSON.stringify({ username, password }),
      redirect: 'follow',
    });
    const loginCookies = parseCookies(getSetCookieHeaders(loginResp));
    const allCookies = { ...initCookies, ...loginCookies };

    const loginData = await loginResp.json();
    debug.loginResponse = loginData;
    debug.loginCookies = Object.keys(loginCookies);

    if (loginData.code !== '200') {
      return res.status(401).json({ error: loginData.message || '아이디/비밀번호 로그인 실패', debug });
    }

    // OTP 없이 이미 GOSSOcookie가 있으면 반환
    const gossoAfterLogin = allCookies['GOSSOcookie'];
    if (gossoAfterLogin && !otp) {
      return res.json({ ok: true, gossoCookie: gossoAfterLogin, debug });
    }

    if (!otp) {
      return res.status(200).json({ ok: false, needOtp: true, message: 'OTP 값을 입력해주세요.', debug });
    }

    // STEP 3: OTP 제출 (redirect 수동 처리로 중간 쿠키 캡처)
    const otpResp = await fetch(`${GW_BASE}/api/otpLogin`, {
      method: 'POST',
      headers: { ...commonHeaders, 'Content-Type': 'application/json', Cookie: cookieHeader(allCookies) },
      body: JSON.stringify({ otpNum: otp }),
      redirect: 'manual', // redirect 수동 처리
    });
    const otpCookies = parseCookies(getSetCookieHeaders(otpResp));
    let finalCookies = { ...allCookies, ...otpCookies };

    let otpData = null;
    try { otpData = await otpResp.json(); } catch {}
    debug.otpStatus = otpResp.status;
    debug.otpResponse = otpData;
    debug.otpCookies = Object.keys(otpCookies);

    // redirect 응답이면 Location 따라가서 최종 쿠키 획득
    if (otpResp.status === 302 || otpResp.status === 301) {
      const location = otpResp.headers.get('location');
      debug.otpRedirect = location;
      if (location) {
        const redirectUrl = location.startsWith('http') ? location : `${GW_BASE}${location}`;
        const redirectResp = await fetch(redirectUrl, {
          headers: { ...commonHeaders, Cookie: cookieHeader(finalCookies) },
          redirect: 'follow',
        });
        const redirectCookies = parseCookies(getSetCookieHeaders(redirectResp));
        finalCookies = { ...finalCookies, ...redirectCookies };
        debug.redirectCookies = Object.keys(redirectCookies);
      }
    }

    debug.finalCookieKeys = Object.keys(finalCookies);

    if (otpData && otpData.code && otpData.code !== '200') {
      return res.status(401).json({ error: `OTP 실패: ${otpData.message || JSON.stringify(otpData)}`, debug });
    }

    const gossoCookie = finalCookies['GOSSOcookie'];
    if (!gossoCookie) {
      return res.status(401).json({ error: 'GOSSOcookie를 가져오지 못했습니다.', debug });
    }

    return res.json({ ok: true, gossoCookie, debug });
  } catch (e) {
    return res.status(500).json({ error: e.message, debug });
  }
}

function getSetCookieHeaders(response) {
  if (response.headers.getSetCookie) return response.headers.getSetCookie();
  const h = response.headers.get('set-cookie');
  return h ? [h] : [];
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
