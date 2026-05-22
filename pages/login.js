import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { sb } from '../lib/supabase';

const ADMIN_PASSWORD = 'admin1234';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saveId, setSaveId] = useState(false);
  const [savePw, setSavePw] = useState(false);
  const [authMsg, setAuthMsg] = useState({ text: '', type: '' });
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPw, setAdminPw] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPw, setNewPw] = useState('');
  const [adminMsg, setAdminMsg] = useState({ text: '', type: '' });
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('memo_user');
    if (saved) { router.replace('/app/note'); return; }
    const savedId = localStorage.getItem('memo_saved_id');
    const savedPw = localStorage.getItem('memo_saved_pw');
    if (savedId) { setUsername(savedId); setSaveId(true); }
    if (savedPw) { setPassword(savedPw); setSavePw(true); }
  }, []);

  async function login() {
    if (!username.trim() || !password) {
      setAuthMsg({ text: '아이디와 비밀번호를 입력하세요.', type: 'error' });
      return;
    }
    setAuthMsg({ text: '로그인 중...', type: '' });
    const { data, error } = await sb.rpc('verify_login', { p_username: username.trim(), p_password: password });
    if (error || !data) {
      setAuthMsg({ text: '아이디 또는 비밀번호가 올바르지 않습니다.', type: 'error' });
      return;
    }
    if (saveId) localStorage.setItem('memo_saved_id', username.trim());
    else localStorage.removeItem('memo_saved_id');
    if (savePw) localStorage.setItem('memo_saved_pw', password);
    else localStorage.removeItem('memo_saved_pw');
    localStorage.setItem('memo_user', username.trim());
    router.push('/app/note');
  }

  function handleLogoClick() {
    logoClickCount.current++;
    clearTimeout(logoClickTimer.current);
    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0;
      setShowAdmin(true);
    } else {
      logoClickTimer.current = setTimeout(() => { logoClickCount.current = 0; }, 2000);
    }
  }

  async function createUser() {
    if (adminPw !== ADMIN_PASSWORD) {
      setAdminMsg({ text: '관리자 비밀번호가 올바르지 않습니다.', type: 'error' });
      return;
    }
    if (!newUser.trim() || !newPw) {
      setAdminMsg({ text: '아이디와 비밀번호를 입력하세요.', type: 'error' });
      return;
    }
    const { error } = await sb.rpc('create_memo_user', { p_username: newUser.trim(), p_password: newPw });
    if (error) {
      setAdminMsg({ text: '생성 실패: ' + error.message, type: 'error' });
    } else {
      setAdminMsg({ text: `계정 '${newUser.trim()}'이 생성되었습니다.`, type: 'success' });
      setNewUser(''); setNewPw(''); setAdminPw('');
    }
  }

  return (
    <>
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo" onClick={handleLogoClick}>
            <h1>📝 록근_v116</h1>
            <p>아이디와 비밀번호로 로그인하세요</p>
          </div>
          <div className="form-group">
            <label>아이디</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="아이디 입력" autoComplete="username"
              onKeyDown={e => e.key === 'Enter' && login()} />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력" autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && login()} />
          </div>
          <div className="save-options">
            <label className="save-option">
              <input type="checkbox" checked={saveId} onChange={e => setSaveId(e.target.checked)} />
              아이디 저장
            </label>
            <label className="save-option">
              <input type="checkbox" checked={savePw} onChange={e => setSavePw(e.target.checked)} />
              비밀번호 저장
            </label>
          </div>
          <button className="btn btn-primary" onClick={login}>로그인</button>
          <div className={`auth-message ${authMsg.type}`}>{authMsg.text}</div>
        </div>
      </div>

      <div className={`admin-overlay ${showAdmin ? 'show' : ''}`}>
        <div className="admin-card">
          <div className="admin-header">
            <h2>⚙️ 관리자 패널</h2>
            <button className="admin-close" onClick={() => { setShowAdmin(false); setAdminMsg({ text: '', type: '' }); }}>✕</button>
          </div>
          <div className="form-group">
            <label>관리자 비밀번호</label>
            <input type="password" value={adminPw} onChange={e => setAdminPw(e.target.value)} placeholder="관리자 비밀번호" />
          </div>
          <div className="form-group">
            <label>새 사용자 아이디</label>
            <input type="text" value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="새 아이디" />
          </div>
          <div className="form-group">
            <label>새 사용자 비밀번호</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호" />
          </div>
          <button className="btn-success" onClick={createUser}>계정 생성</button>
          <div className={`admin-message ${adminMsg.type}`}>{adminMsg.text}</div>
          <div className="admin-hint">로고를 5번 클릭하면 관리자 패널이 열립니다</div>
        </div>
      </div>
    </>
  );
}
