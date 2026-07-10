import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { sb } from '../lib/supabase';
import Head from 'next/head';

const STATUS_OPTIONS = ['검토중', '진행중', '완료'];

const statusStyle = s => ({
  fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600,
  background: s === '완료' ? '#e8f5e9' : s === '진행중' ? '#e3f2fd' : '#f5f5f5',
  color: s === '완료' ? '#2e7d32' : s === '진행중' ? '#1565c0' : '#888',
});

export default function Admin() {
  const router = useRouter();
  const [tab, setTab] = useState('accounts'); // 'accounts' | 'feedback'

  // 계정관리
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [accountView, setAccountView] = useState('idle'); // 'idle' | 'detail' | 'create'
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });
  const [createForm, setCreateForm] = useState({ username: '', password: '', passwordConfirm: '' });
  const [createMsg, setCreateMsg] = useState({ text: '', type: '' });

  // 개선요청관리
  const [requests, setRequests] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editComment, setEditComment] = useState('');
  const [reqMsg, setReqMsg] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);

  // 시스템설정
  const [ngrokUrl, setNgrokUrl] = useState('');
  const [settingMsg, setSettingMsg] = useState({ text: '', type: '' });
  const [installList, setInstallList] = useState([]);
  const [installForm, setInstallForm] = useState({ label: '', url: '' });
  const [installMsg, setInstallMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    const saved = localStorage.getItem('memo_user');
    if (!saved || saved !== 'admin') { router.replace('/login'); return; }
    loadUsers();
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data: ngrok } = await sb.rpc('get_setting', { p_key: 'ngrok_url' });
    if (ngrok) setNgrokUrl(ngrok);
    loadInstallList();
  }

  async function loadInstallList() {
    const { data } = await sb.rpc('get_install_list');
    setInstallList(data || []);
  }

  async function saveNgrokUrl() {
    const { error } = await sb.rpc('update_setting', { p_key: 'ngrok_url', p_value: ngrokUrl.trim() });
    if (error) {
      setSettingMsg({ text: '저장 실패: ' + error.message, type: 'error' });
    } else {
      setSettingMsg({ text: '저장됐습니다.', type: 'success' });
    }
    setTimeout(() => setSettingMsg({ text: '', type: '' }), 3000);
  }

  async function addInstallItem() {
    if (!installForm.label.trim() || !installForm.url.trim()) return;
    const sortOrder = installList.length > 0 ? Math.max(...installList.map(i => i.sort_order)) + 1 : 0;
    const { error } = await sb.rpc('add_install_item', {
      p_label: installForm.label.trim(),
      p_url: installForm.url.trim(),
      p_sort_order: sortOrder,
    });
    if (error) {
      setInstallMsg({ text: '추가 실패: ' + error.message, type: 'error' });
    } else {
      setInstallForm({ label: '', url: '' });
      setInstallMsg({ text: '추가됐습니다.', type: 'success' });
      loadInstallList();
    }
    setTimeout(() => setInstallMsg({ text: '', type: '' }), 3000);
  }

  async function removeInstallItem(id) {
    const { error } = await sb.rpc('delete_install_item', { p_id: id });
    if (error) {
      setInstallMsg({ text: '삭제 실패: ' + error.message, type: 'error' });
      setTimeout(() => setInstallMsg({ text: '', type: '' }), 3000);
    } else {
      loadInstallList();
    }
  }

  function logout() {
    localStorage.removeItem('memo_user');
    router.replace('/login');
  }

  // ── 계정관리 ──────────────────────────────────────
  async function loadUsers() {
    const { data } = await sb.rpc('get_all_users');
    setUsers(data || []);
  }

  function selectUser(user) {
    setSelectedUser(user);
    setAccountView('detail');
    setNewPw('');
    setNewPwConfirm('');
    setPwMsg({ text: '', type: '' });
  }

  async function createUser() {
    if (!createForm.username.trim()) { setCreateMsg({ text: '아이디를 입력하세요.', type: 'error' }); return; }
    if (!createForm.password) { setCreateMsg({ text: '비밀번호를 입력하세요.', type: 'error' }); return; }
    if (createForm.password !== createForm.passwordConfirm) { setCreateMsg({ text: '비밀번호가 일치하지 않습니다.', type: 'error' }); return; }
    setCreateMsg({ text: '생성 중...', type: '' });
    const { error } = await sb.rpc('create_memo_user', { p_username: createForm.username.trim(), p_password: createForm.password });
    if (error) { setCreateMsg({ text: '생성 실패: ' + error.message, type: 'error' }); return; }
    setCreateMsg({ text: `'${createForm.username.trim()}' 계정이 생성되었습니다.`, type: 'success' });
    setCreateForm({ username: '', password: '', passwordConfirm: '' });
    loadUsers();
  }

  async function deleteUser() {
    if (!window.confirm(`'${selectedUser.username}' 계정을 삭제하시겠습니까?\n메모 데이터도 모두 삭제됩니다.`)) return;
    const { error } = await sb.rpc('delete_memo_user', { p_username: selectedUser.username });
    if (error) { setPwMsg({ text: '삭제 실패: ' + error.message, type: 'error' }); return; }
    setUsers(prev => prev.filter(u => u.username !== selectedUser.username));
    setSelectedUser(null);
    setAccountView('idle');
  }

  async function changePassword() {
    if (!newPw) { setPwMsg({ text: '새 비밀번호를 입력하세요.', type: 'error' }); return; }
    if (newPw !== newPwConfirm) { setPwMsg({ text: '비밀번호가 일치하지 않습니다.', type: 'error' }); return; }
    setPwMsg({ text: '변경 중...', type: '' });
    const { error } = await sb.rpc('admin_update_password', { p_username: selectedUser.username, p_new_password: newPw });
    if (error) { setPwMsg({ text: '변경 실패: ' + error.message, type: 'error' }); return; }
    setPwMsg({ text: '비밀번호가 변경되었습니다.', type: 'success' });
    setNewPw(''); setNewPwConfirm('');
  }

  // ── 개선요청관리 ──────────────────────────────────
  async function loadRequests() {
    const { data } = await sb.rpc('get_all_improvement_requests');
    setRequests(data || []);
  }

  function selectRequest(req) {
    setSelectedReq(req);
    setEditStatus(req.status);
    setEditComment(req.comment || '');
    setReqMsg({ text: '', type: '' });
  }

  async function saveRequest() {
    setSaving(true);
    setReqMsg({ text: '', type: '' });
    const { error } = await sb.rpc('update_improvement_request', {
      p_id: selectedReq.id,
      p_status: editStatus,
      p_comment: editComment,
    });
    setSaving(false);
    if (error) { setReqMsg({ text: '저장 실패: ' + error.message, type: 'error' }); return; }
    setReqMsg({ text: '저장되었습니다.', type: 'success' });
    setTimeout(() => setReqMsg({ text: '', type: '' }), 3000);
    setRequests(prev => prev.map(r => r.id === selectedReq.id ? { ...r, status: editStatus, comment: editComment } : r));
    setSelectedReq(prev => ({ ...prev, status: editStatus, comment: editComment }));
  }

  function switchTab(t) {
    setTab(t);
    setSelectedUser(null);
    setAccountView('idle');
    setSelectedReq(null);
    if (t === 'accounts') loadUsers();
    if (t === 'feedback') loadRequests();
  }

  const detailOpen = (tab === 'accounts' && accountView !== 'idle') || (tab === 'feedback' && selectedReq) || tab === 'settings';

  return (
    <>
      <Head><title>Clickpad Admin</title></Head>
      <div className="app-layout">
        {/* 사이드바 */}
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-top">
              <span className="sidebar-title">⚙️ Admin Clickpad_v329</span>
            </div>
            <div className="sidebar-tabs">
              <button className={`tab-btn ${tab === 'accounts' ? 'active' : ''}`} onClick={() => switchTab('accounts')}>계정관리</button>
              <button className={`tab-btn ${tab === 'feedback' ? 'active' : ''}`} onClick={() => switchTab('feedback')}>개선요청</button>
              <button className={`tab-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => switchTab('settings')}>시스템설정</button>
            </div>
          </div>

          {tab === 'accounts' && (
            <div style={{ padding: '8px 8px 0' }}>
              <button className="btn-success" onClick={() => { setAccountView('create'); setSelectedUser(null); setCreateForm({ username: '', password: '', passwordConfirm: '' }); setCreateMsg({ text: '', type: '' }); }}>
                + 계정 추가
              </button>
            </div>
          )}

          <div className="notes-list">
            {tab === 'accounts' && (
              users.length === 0
                ? <div className="empty-list">사용자가 없습니다.</div>
                : users.map(u => (
                  <div key={u.username}
                    className={`note-item ${selectedUser?.username === u.username ? 'active' : ''}`}
                    onClick={() => selectUser(u)}>
                    <div className="note-item-title">{u.username}</div>
                    {u.display_name && <div className="note-item-preview">{u.display_name}</div>}
                  </div>
                ))
            )}

            {tab === 'feedback' && (
              requests.length === 0
                ? <div className="empty-list">등록된 개선요청이 없습니다.</div>
                : requests.map(r => (
                  <div key={r.id}
                    className={`note-item ${selectedReq?.id === r.id ? 'active' : ''}`}
                    onClick={() => selectRequest(r)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <div className="note-item-title" style={{ flex: 1 }}>{r.title}</div>
                      <span style={statusStyle(r.status)}>{r.status}</span>
                    </div>
                    <div className="note-item-preview">{r.username}</div>
                    <div className="note-item-date">{new Date(r.created_at).toLocaleDateString('ko-KR')}</div>
                  </div>
                ))
            )}
          </div>

          <div className="sidebar-footer">
            <div className="user-info">
              <span className="user-name">admin</span>
              <button className="btn-logout" onClick={logout}>로그아웃</button>
            </div>
          </div>
        </div>

        {/* 에디터 패널 */}
        <div className={`editor ${detailOpen ? 'open' : ''}`}>

          {/* 계정관리 */}
          {tab === 'accounts' && accountView === 'idle' && (
            <div className="editor-empty">
              <div className="editor-empty-icon">👤</div>
              <h3>계정관리</h3>
              <p>왼쪽에서 사용자를 선택하거나<br />계정을 추가하세요</p>
            </div>
          )}
          {tab === 'accounts' && accountView === 'detail' && selectedUser && (
            <div className="task-detail" style={{ maxWidth: '480px' }}>
              <button className="btn-back" style={{ display: 'flex', marginBottom: '16px' }} onClick={() => { setSelectedUser(null); setAccountView('idle'); }}>←</button>
              <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{selectedUser.username}</h3>
              {selectedUser.display_name && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>{selectedUser.display_name}</p>}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: selectedUser.display_name ? 0 : '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>비밀번호 변경</p>
                <div className="form-group">
                  <label>새 비밀번호</label>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호 입력"
                    onKeyDown={e => e.key === 'Enter' && changePassword()} />
                </div>
                <div className="form-group">
                  <label>새 비밀번호 확인</label>
                  <input type="password" value={newPwConfirm} onChange={e => setNewPwConfirm(e.target.value)} placeholder="비밀번호 재입력"
                    onKeyDown={e => e.key === 'Enter' && changePassword()} />
                </div>
                <button className="btn-success" onClick={changePassword}>변경</button>
                {pwMsg.text && <div className={`settings-message ${pwMsg.type}`}>{pwMsg.text}</div>}
              </div>
              {selectedUser.username !== 'admin' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#e53935', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>계정 삭제</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>계정과 모든 메모 데이터가 영구적으로 삭제됩니다.</p>
                  <button onClick={deleteUser} style={{ background: '#e53935', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    계정 삭제
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === 'accounts' && accountView === 'create' && (
            <div className="task-detail" style={{ maxWidth: '480px' }}>
              <button className="btn-back" style={{ display: 'flex', marginBottom: '16px' }} onClick={() => setAccountView('idle')}>←</button>
              <h3 style={{ fontSize: '18px', marginBottom: '24px' }}>새 계정 추가</h3>
              <div className="form-group">
                <label>아이디</label>
                <input type="text" value={createForm.username} onChange={e => setCreateForm(p => ({ ...p, username: e.target.value }))} placeholder="아이디 입력" />
              </div>
              <div className="form-group">
                <label>비밀번호</label>
                <input type="password" value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} placeholder="비밀번호 입력" />
              </div>
              <div className="form-group">
                <label>비밀번호 확인</label>
                <input type="password" value={createForm.passwordConfirm} onChange={e => setCreateForm(p => ({ ...p, passwordConfirm: e.target.value }))} placeholder="비밀번호 재입력"
                  onKeyDown={e => e.key === 'Enter' && createUser()} />
              </div>
              <button className="btn-success" onClick={createUser}>계정 생성</button>
              {createMsg.text && <div className={`settings-message ${createMsg.type}`}>{createMsg.text}</div>}
            </div>
          )}

          {/* 개선요청 상세 */}
          {tab === 'feedback' && !selectedReq && (
            <div className="editor-empty">
              <div className="editor-empty-icon">💡</div>
              <h3>개선요청관리</h3>
              <p>왼쪽에서 항목을 선택하세요</p>
            </div>
          )}
          {tab === 'feedback' && selectedReq && (
            <div className="task-detail" style={{ maxWidth: '600px' }}>
              <button className="btn-back" style={{ display: 'flex', marginBottom: '16px' }} onClick={() => setSelectedReq(null)}>←</button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '17px', flex: 1, marginRight: '10px' }}>{selectedReq.title}</h3>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {selectedReq.username} · {new Date(selectedReq.created_at).toLocaleString('ko-KR')}
              </div>

              <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.7', padding: '14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px' }}>
                {selectedReq.content || '(내용 없음)'}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px' }}>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>처리</p>

                <div className="form-group">
                  <label>상태</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', background: 'white', outline: 'none' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>댓글</label>
                  <textarea value={editComment} onChange={e => setEditComment(e.target.value)}
                    placeholder="사용자에게 보여질 답변을 입력하세요"
                    style={{ width: '100%', minHeight: '120px', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <button className="btn-success" onClick={saveRequest} disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                {reqMsg.text && <div className={`settings-message ${reqMsg.type}`}>{reqMsg.text}</div>}
              </div>
            </div>
          )}

          {/* 시스템설정 */}
          {tab === 'settings' && (
            <div style={{ padding: '24px' }}>
              <h3>시스템설정</h3>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 600, fontSize: '14px' }}>메일 전송 서버 URL (ngrok)</label>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                  ngrok 재시작 후 변경된 URL을 여기에 입력하세요.
                </div>
                <input
                  type="text"
                  value={ngrokUrl}
                  onChange={e => setNgrokUrl(e.target.value)}
                  placeholder="https://xxxx.ngrok-free.app"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', width: '100%' }}
                />
                <button className="btn-success" onClick={saveNgrokUrl} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                  저장
                </button>
                {settingMsg.text && <div className={`settings-message ${settingMsg.type}`}>{settingMsg.text}</div>}
              </div>

              <hr style={{ margin: '28px 0', borderColor: 'var(--border)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 600, fontSize: '14px' }}>설치파일 리스트 관리</label>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                  ClickUp 메뉴 → 설치파일 탭에 표시되는 항목을 관리합니다.
                </div>

                {/* 현재 리스트 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {installList.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}>
                      <span style={{ fontWeight: 600, minWidth: '80px' }}>{item.label}</span>
                      <span style={{ flex: 1, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>{item.url}</span>
                      <button onClick={() => removeInstallItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}>✕</button>
                    </div>
                  ))}
                  {installList.length === 0 && <div style={{ color: '#aaa', fontSize: '13px' }}>항목이 없습니다.</div>}
                </div>

                {/* 추가 폼 */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#888' }}>이름</span>
                    <input
                      value={installForm.label}
                      onChange={e => setInstallForm(f => ({ ...f, label: e.target.value }))}
                      placeholder="예: MFO2601"
                      style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', width: '110px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span style={{ fontSize: '11px', color: '#888' }}>ClickUp Doc URL</span>
                    <input
                      value={installForm.url}
                      onChange={e => setInstallForm(f => ({ ...f, url: e.target.value }))}
                      placeholder="https://app.clickup.com/..."
                      style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', width: '100%' }}
                    />
                  </div>
                  <button
                    className="btn-success"
                    onClick={addInstallItem}
                    disabled={!installForm.label.trim() || !installForm.url.trim()}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    추가
                  </button>
                </div>
                {installMsg.text && <div className={`settings-message ${installMsg.type}`}>{installMsg.text}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
