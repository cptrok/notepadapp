import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { sb } from '../lib/supabase';

const CLICKUP_TOKEN_DEFAULT = 'pk_43586564_0YLCBJ33J3UIRLFWTJOEKO98AXN6IVZF';
const CLICKUP_SPACE_ID = '90030550766';
const LICENSE_SPACE_ID = '60975902';
const TEAM_ID = '25540965';

function stripHtml(html) {
  if (typeof window === 'undefined') return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function timeAgo(dateStr) {
  const d = new Date(isNaN(dateStr) ? dateStr : Number(dateStr));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '');
}

function sortByDateCreated(tasks) {
  return [...tasks].sort((a, b) => Number(b.date_created) - Number(a.date_created));
}

export default function Home() {
  const router = useRouter();
  const [currentUsername, setCurrentUsername] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [currentTab, setCurrentTab] = useState('notes');
  const [editorOpen, setEditorOpen] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [allNotes, setAllNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '' });

  const [cuSubTab, setCuSubTab] = useState('search');
  const [cuTasks, setCuTasks] = useState([]);
  const [cuPage, setCuPage] = useState(0);
  const [cuHasMore, setCuHasMore] = useState(false);
  const [cuKeyword, setCuKeyword] = useState('');
  const [cuSearchInput, setCuSearchInput] = useState('');
  const [myTasks, setMyTasks] = useState([]);
  const [myTasksFiltered, setMyTasksFiltered] = useState([]);
  const [myTasksLoaded, setMyTasksLoaded] = useState(false);
  const [mySearchInput, setMySearchInput] = useState('');
  const [cuDetail, setCuDetail] = useState(null);

  const [licSubTab, setLicSubTab] = useState('my');
  const [licenseTasks, setLicenseTasks] = useState([]);
  const [currentLicTaskId, setCurrentLicTaskId] = useState(null);
  const [licDetail, setLicDetail] = useState(null);
  const [trialDocId, setTrialDocId] = useState('rbeb5-147183');
  const [trialPages, setTrialPages] = useState(null);
  const [trialSelectedQuarter, setTrialSelectedQuarter] = useState(null);
  const [trialPanel, setTrialPanel] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsData, setSettingsData] = useState({ username: '', displayName: '', newPassword: '', clickupToken: '' });
  const [settingsMsg, setSettingsMsg] = useState({ text: '', type: '' });

  const clickupTokenRef = useRef(CLICKUP_TOKEN_DEFAULT);
  const quillRef = useRef(null);
  const quillEditorRef = useRef(null);
  const currentNoteIdRef = useRef(null);
  const noteTitleRef = useRef('');
  const allNotesRef = useRef([]);
  const cuPageRef = useRef(0);
  const cuKeywordRef = useRef('');
  const saveTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const trialPagesCache = useRef({});
  useEffect(() => { currentNoteIdRef.current = currentNoteId; }, [currentNoteId]);
  useEffect(() => { noteTitleRef.current = noteTitle; }, [noteTitle]);
  useEffect(() => { allNotesRef.current = allNotes; }, [allNotes]);
  useEffect(() => { cuPageRef.current = cuPage; }, [cuPage]);
  useEffect(() => { cuKeywordRef.current = cuKeyword; }, [cuKeyword]);

  useEffect(() => {
    const saved = localStorage.getItem('memo_user');
    if (!saved) { router.replace('/login'); return; }
    setCurrentUsername(saved);
  }, []);

  useEffect(() => {
    if (!currentUsername) return;
    loadUserProfile();
    loadNotes();
    const onVisibility = () => { if (!document.hidden) loadNotes(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUsername]);

  // URL 파라미터 변화 감지 → 뒤로가기 시 상세 화면 닫기
  useEffect(() => {
    if (!router.isReady || !currentUsername) return;
    const { tab, noteId, taskId, licTaskId, trialPageId } = router.query;
    if (!noteId) setEditorOpen(false);
    if (!taskId) setCuDetail(null);
    if (!licTaskId) { setLicDetail(null); setCurrentLicTaskId(null); }
    if (!trialPageId) { setTrialPanel(null); setTrialSelectedQuarter(null); }
    if (tab) setCurrentTab(tab);
  }, [router.isReady, router.query.tab, router.query.noteId, router.query.taskId, router.query.licTaskId, router.query.trialPageId]);

  useEffect(() => {
    if (!currentUsername || quillRef.current || !quillEditorRef.current) return;
    import('quill').then(({ default: Quill }) => {
      const ImageBlot = Quill.import('formats/image');
      class CustomImageBlot extends ImageBlot {
        static create(value) {
          const node = super.create(value);
          if (typeof value === 'object' && value.src) {
            node.setAttribute('src', value.src);
            if (value.style) node.setAttribute('style', value.style);
          }
          return node;
        }
        static value(node) {
          return { src: node.getAttribute('src'), style: node.getAttribute('style') || '' };
        }
      }
      CustomImageBlot.blotName = 'image';
      CustomImageBlot.tagName = 'IMG';
      Quill.register(CustomImageBlot, true);

      const q = new Quill(quillEditorRef.current, {
        theme: 'snow',
        placeholder: '내용을 입력하세요...',
        modules: {
          toolbar: {
            container: [
              [{ header: [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['link', 'image'],
              ['clean']
            ],
            handlers: {
              image: () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  showToastMsg('이미지 업로드 중...');
                  const resized = await resizeImage(file, 1200, 1200, 0.85);
                  const username = localStorage.getItem('memo_user');
                  const fileName = `${username}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
                  const { error } = await sb.storage.from('memo-images').upload(fileName, resized, { contentType: 'image/jpeg' });
                  if (error) { showToastMsg('업로드 실패'); return; }
                  const { data: urlData } = sb.storage.from('memo-images').getPublicUrl(fileName);
                  const range = q.getSelection(true);
                  q.insertEmbed(range.index, 'image', { src: urlData.publicUrl });
                  q.setSelection(range.index + 1);
                  showToastMsg('이미지 업로드 완료');
                };
                input.click();
              }
            }
          }
        }
      });
      quillRef.current = q;

      quillEditorRef.current.addEventListener('dblclick', e => {
        if (e.target.tagName === 'IMG') {
          const val = e.target.getAttribute('src') || e.target.src;
          if (val) window.open(val, '_blank');
        }
      });

      q.on('text-change', () => {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          if (currentNoteIdRef.current) autoSaveNote();
        }, 1500);
      });

      initImageResize(q);
    });
  }, [currentUsername]);

  async function loadUserProfile() {
    const { data } = await sb.rpc('get_user_profile', { p_username: currentUsername });
    if (data && data[0]) {
      const p = data[0];
      setDisplayName(p.display_name || currentUsername);
      if (p.clickup_token) clickupTokenRef.current = p.clickup_token;
    }
  }

  async function loadNotes() {
    const username = localStorage.getItem('memo_user');
    if (!username) return;
    const { data, error } = await sb.rpc('get_user_notes', { p_username: username });
    if (error) return;
    const notes = data || [];
    setAllNotes(notes);
    setFilteredNotes(notes);
    allNotesRef.current = notes;
    if (currentNoteIdRef.current) {
      const note = notes.find(n => n.id === currentNoteIdRef.current);
      if (note && quillRef.current) {
        setNoteTitle(note.title || '');
        noteTitleRef.current = note.title || '';
        const sel = quillRef.current.getSelection();
        quillRef.current.clipboard.dangerouslyPasteHTML(note.content || '');
        if (sel) quillRef.current.setSelection(sel);
      }
    }
  }

  function searchNotes(q) {
    const keyword = q.toLowerCase();
    if (!keyword) { setFilteredNotes(allNotesRef.current); return; }
    setFilteredNotes(allNotesRef.current.filter(n =>
      (n.title || '').toLowerCase().includes(keyword) ||
      stripHtml(n.content || '').toLowerCase().includes(keyword)
    ));
  }

  function openNote(id) {
    const note = allNotesRef.current.find(n => n.id === id);
    if (!note) return;
    setCurrentNoteId(id);
    currentNoteIdRef.current = id;
    setNoteTitle(note.title || '');
    noteTitleRef.current = note.title || '';
    setShowDelete(true);
    setEditorOpen(true);
    if (quillRef.current) quillRef.current.clipboard.dangerouslyPasteHTML(note.content || '');
    const navFn = editorOpen ? router.replace : router.push;
    navFn({ pathname: '/', query: { tab: 'notes', noteId: id } }, undefined, { shallow: true });
    sb.rpc('get_user_notes', { p_username: localStorage.getItem('memo_user') }).then(({ data }) => {
      if (!data) return;
      const fresh = data.find(n => n.id === id);
      if (fresh && quillRef.current) {
        setNoteTitle(fresh.title || '');
        noteTitleRef.current = fresh.title || '';
        const sel = quillRef.current.getSelection();
        quillRef.current.clipboard.dangerouslyPasteHTML(fresh.content || '');
        if (sel) quillRef.current.setSelection(sel);
      }
    });
  }

  function newNote() {
    setCurrentNoteId(null);
    currentNoteIdRef.current = null;
    setNoteTitle('');
    noteTitleRef.current = '';
    setShowDelete(false);
    setEditorOpen(true);
    if (quillRef.current) quillRef.current.setText('');
    const navFn = editorOpen ? router.replace : router.push;
    navFn({ pathname: '/', query: { tab: 'notes', noteId: 'new' } }, undefined, { shallow: true });
  }

  async function autoSaveNote() {
    const username = localStorage.getItem('memo_user');
    if (!username || !quillRef.current) return;
    const content = quillRef.current.root.innerHTML;
    const title = noteTitleRef.current;
    const id = currentNoteIdRef.current;
    const { data, error } = await sb.rpc('save_user_note', {
      p_username: username, p_id: id, p_title: title, p_content: content
    });
    if (!error && data) {
      if (!id) {
        setCurrentNoteId(data);
        currentNoteIdRef.current = data;
        setShowDelete(true);
      }
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
      loadNotes();
    }
  }

  async function deleteNote() {
    if (!currentNoteIdRef.current) return;
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    const username = localStorage.getItem('memo_user');
    await sb.rpc('delete_user_note', { p_username: username, p_id: currentNoteIdRef.current });
    setCurrentNoteId(null);
    currentNoteIdRef.current = null;
    setEditorOpen(false);
    setShowDelete(false);
    if (quillRef.current) quillRef.current.setText('');
    loadNotes();
    showToastMsg('메모가 삭제되었습니다.');
    router.push({ pathname: '/', query: { tab: 'notes' } }, undefined, { shallow: true });
  }

  async function fetchTasksByKeyword(q) {
    if (!q.trim()) return;
    setCuKeyword(q);
    cuKeywordRef.current = q;
    setCuPage(0);
    cuPageRef.current = 0;
    setCuTasks([]);
    setCuHasMore(false);
    setCuDetail(null);
    await doLoadCuPage(q, 0, true);
  }

  async function doLoadCuPage(keyword, page, isNew) {
    try {
      const res = await fetch(
        `https://api.clickup.com/api/v2/team/${TEAM_ID}/task?space_ids[]=${CLICKUP_SPACE_ID}&subtasks=true&include_closed=true&page=${page}`,
        { headers: { Authorization: clickupTokenRef.current } }
      );
      const data = await res.json();
      const tasks = data.tasks || [];
      const filtered = keyword ? tasks.filter(t =>
        (t.name || '').toLowerCase().includes(keyword.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(keyword.toLowerCase())
      ) : tasks;
      if (isNew) setCuTasks(filtered);
      else setCuTasks(prev => [...prev, ...filtered]);
      setCuPage(page + 1);
      cuPageRef.current = page + 1;
      setCuHasMore(tasks.length === 100);
    } catch (e) { console.error(e); }
  }

  function loadMoreCuPage() {
    doLoadCuPage(cuKeywordRef.current, cuPageRef.current, false);
  }

  async function fetchMyTasks(force) {
    if (myTasksLoaded && !force) return;
    const token = clickupTokenRef.current;
    const parts = token.split('_');
    const userId = parts.length >= 2 ? parts[1] : null;
    if (!userId) return;
    let all = [], page = 0;
    while (true) {
      const res = await fetch(
        `https://api.clickup.com/api/v2/team/${TEAM_ID}/task?space_ids[]=${CLICKUP_SPACE_ID}&subtasks=true&include_closed=false&assignees[]=${userId}&page=${page}`,
        { headers: { Authorization: token } }
      );
      const data = await res.json();
      const tasks = data.tasks || [];
      all = [...all, ...tasks];
      if (tasks.length < 100) break;
      page++;
    }
    const sorted = sortByDateCreated(all);
    setMyTasks(sorted);
    setMyTasksFiltered(sorted);
    setMyTasksLoaded(true);
  }

  function filterMyTasks(q) {
    if (!q) { setMyTasksFiltered(myTasks); return; }
    setMyTasksFiltered(myTasks.filter(t => (t.name || '').toLowerCase().includes(q.toLowerCase())));
  }

  async function openTask(id) {
    const navFn = cuDetail ? router.replace : router.push;
    navFn({ pathname: '/', query: { tab: 'clickup', taskId: id } }, undefined, { shallow: true });
    setCuDetail({ loading: true, id });
    const res = await fetch(`https://api.clickup.com/api/v2/task/${id}`, { headers: { Authorization: clickupTokenRef.current } });
    const data = await res.json();
    setCuDetail({ task: data });
  }

  async function loadLicenseTasks() {
    const token = clickupTokenRef.current;
    const parts = token.split('_');
    const userId = parts.length >= 2 ? parts[1] : null;
    const url = userId
      ? `https://api.clickup.com/api/v2/team/${TEAM_ID}/task?space_ids[]=${LICENSE_SPACE_ID}&statuses[]=in%20progress&assignees[]=${userId}&subtasks=true`
      : `https://api.clickup.com/api/v2/team/${TEAM_ID}/task?space_ids[]=${LICENSE_SPACE_ID}&statuses[]=in%20progress&subtasks=true`;
    const res = await fetch(url, { headers: { Authorization: token } });
    const data = await res.json();
    setLicenseTasks(sortByDateCreated(data.tasks || []));
  }

  async function openLicenseTask(id) {
    const navFn = licDetail ? router.replace : router.push;
    navFn({ pathname: '/', query: { tab: 'license', licTaskId: id } }, undefined, { shallow: true });
    setCurrentLicTaskId(id);
    setLicDetail({ loading: true });
    const res = await fetch(`https://api.clickup.com/api/v2/task/${id}?markdown_description=true`, { headers: { Authorization: clickupTokenRef.current } });
    const task = await res.json();
    const desc = task.description || '';
    const lines = desc.split('\n');
    const 비고Idx = lines.indexOf('비고');
    const 논리코어Idx = lines.indexOf('논리코어');
    let colCount;
    if (비고Idx !== -1) colCount = 비고Idx + 2;
    else if (논리코어Idx !== -1) colCount = 논리코어Idx + 2;
    else colCount = 6;
    const dataStart = colCount - 1;
    const rows = [];
    for (let i = dataStart; i < lines.length; i += colCount) {
      rows.push(lines.slice(i, i + colCount).join('\t'));
    }
    setLicDetail({ task, descFormatted: rows.join('\n') });
  }

  async function loadTrialPages(docId) {
    setTrialDocId(docId);
    setTrialSelectedQuarter(null);
    setTrialPanel(null);
    if (trialPagesCache.current[docId]) { setTrialPages(trialPagesCache.current[docId]); return; }
    setTrialPages(null);
    try {
      const res = await fetch(`https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages`, { headers: { Authorization: clickupTokenRef.current } });
      const data = await res.json();
      const sourcePages = Array.isArray(data) ? data : (data.pages || []);
      const nested = sourcePages.flatMap(p => p.pages || []);
      const pages = nested.filter(p => /^\d{4}\/\dQ$/.test(p.name)).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 2);
      trialPagesCache.current[docId] = pages;
      setTrialPages(pages);
    } catch (e) { setTrialPages([]); }
  }

  async function loadTrialPage(docId, pageId, pageName) {
    const navFn = trialPanel ? router.replace : router.push;
    navFn({ pathname: '/', query: { tab: 'license', trialPageId: pageId, trialPageName: pageName } }, undefined, { shallow: true });
    setTrialSelectedQuarter(pageId);
    setTrialPanel({ loading: true, pageName });
    try {
      const res = await fetch(
        `https://api.clickup.com/api/v3/workspaces/${TEAM_ID}/docs/${docId}/pages/${pageId}?content_format=text%2Fmd`,
        { headers: { Authorization: clickupTokenRef.current } }
      );
      const data = await res.json();
      const content = data.content || data.pages?.[0]?.content || '';
      setTrialPanel({ pageName, sections: parseTrialMarkdown(content) });
    } catch (e) { setTrialPanel({ pageName, sections: [], error: e.message }); }
  }

  function parseTrialMarkdown(content) {
    const sections = [];
    let current = null;
    for (const line of content.split('\n')) {
      const link = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      if (link) {
        if (!current) { current = { name: '기타', files: [] }; sections.push(current); }
        current.files.push({ name: link[1], url: link[2] });
      } else {
        const t = line.trim();
        if (t && !t.startsWith('*') && !t.startsWith('`') && !t.startsWith('{') && !t.startsWith('}') && !t.startsWith('"') && !t.startsWith('[')) {
          current = { name: t, files: [] };
          sections.push(current);
        }
      }
    }
    return sections.filter(s => s.files.length > 0);
  }

  async function downloadAttachment(url, filename) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    } catch { window.open(url, '_blank'); }
  }

  async function openSettings() {
    const { data } = await sb.rpc('get_user_profile', { p_username: currentUsername });
    if (data && data[0]) {
      const p = data[0];
      setSettingsData({ username: p.username || currentUsername, displayName: p.display_name || '', newPassword: '', clickupToken: p.clickup_token || '' });
    }
    setSettingsMsg({ text: '', type: '' });
    setShowSettings(true);
  }

  async function saveProfile() {
    const { error } = await sb.rpc('update_user_profile', {
      p_username: currentUsername,
      p_new_id: settingsData.username,
      p_display_name: settingsData.displayName,
      p_new_password: settingsData.newPassword || null,
      p_clickup_token: settingsData.clickupToken || null
    });
    if (error) { setSettingsMsg({ text: '저장 실패: ' + error.message, type: 'error' }); return; }
    if (settingsData.clickupToken) clickupTokenRef.current = settingsData.clickupToken;
    if (settingsData.displayName) setDisplayName(settingsData.displayName);
    setSettingsMsg({ text: '저장되었습니다.', type: 'success' });
  }

  function logout() {
    localStorage.removeItem('memo_user');
    router.push('/login');
  }

  function showToastMsg(msg) {
    setToast({ show: true, msg });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast({ show: false, msg: '' }), 2500);
  }

  function switchTab(tab) {
    setCurrentTab(tab);
    setCuDetail(null);
    setLicDetail(null);
    setTrialPanel(null);
    if (tab === 'license') loadLicenseTasks();
    if (tab === 'clickup' && cuSubTab === 'my' && !myTasksLoaded) fetchMyTasks(false);
    router.push({ pathname: '/', query: { tab } }, undefined, { shallow: true });
  }

  function switchCuTab(tab) {
    setCuSubTab(tab);
    setCuDetail(null);
    if (tab === 'my' && !myTasksLoaded) fetchMyTasks(false);
  }

  function switchLicTab(tab) {
    setLicSubTab(tab);
    setLicDetail(null);
    setTrialPanel(null);
    setCurrentLicTaskId(null);
    if (tab === 'my') loadLicenseTasks();
    else loadTrialPages(trialDocId);
  }

  function initImageResize(q) {
    const overlay = document.getElementById('img-resize-overlay');
    const handle = document.getElementById('img-resize-handle');
    const label = document.getElementById('img-resize-label');
    if (!overlay) return;
    let activeImg = null, startX, startY, startW, startH;
    function showOverlay(img) {
      activeImg = img;
      const r = img.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.left = r.left + window.scrollX + 'px';
      overlay.style.top = r.top + window.scrollY + 'px';
      overlay.style.width = r.width + 'px';
      overlay.style.height = r.height + 'px';
      label.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
    }
    function hideOverlay() { overlay.style.display = 'none'; activeImg = null; }
    q.root.addEventListener('click', e => { if (e.target.tagName === 'IMG') showOverlay(e.target); else hideOverlay(); });
    document.addEventListener('click', e => { if (activeImg && !overlay.contains(e.target) && e.target !== activeImg) hideOverlay(); });
    function onDragStart(e) {
      if (!activeImg) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX; startY = clientY;
      startW = activeImg.offsetWidth; startH = activeImg.offsetHeight;
      function onMove(ev) {
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const ratio = startW / startH;
        let nw = Math.max(40, startW + (cx - startX));
        let nh = Math.round(nw / ratio);
        activeImg.style.width = nw + 'px';
        activeImg.style.height = nh + 'px';
        overlay.style.width = nw + 'px';
        overlay.style.height = nh + 'px';
        label.textContent = `${Math.round(nw)} × ${Math.round(nh)}`;
      }
      function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }
    handle.addEventListener('mousedown', onDragStart);
    handle.addEventListener('touchstart', onDragStart, { passive: false });
  }

  function resizeImage(file, maxW, maxH, quality) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      img.src = url;
    });
  }

  if (!currentUsername) return null;

  return (
    <>
      <div className="app-layout">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-top">
              <span className="sidebar-title">록근_v6</span>
              {currentTab === 'notes' && <button className="btn-new" onClick={newNote}>+</button>}
            </div>
            <div className="sidebar-tabs">
              <button className={`tab-btn ${currentTab === 'notes' ? 'active' : ''}`} onClick={() => switchTab('notes')}>메모</button>
              <button className={`tab-btn ${currentTab === 'clickup' ? 'active' : ''}`} onClick={() => switchTab('clickup')}>ClickUp</button>
              <button className={`tab-btn ${currentTab === 'license' ? 'active' : ''}`} onClick={() => switchTab('license')}>라이선스</button>
            </div>

            {currentTab === 'notes' && (
              <input className="search-box" type="text" placeholder="메모 검색..." onChange={e => searchNotes(e.target.value)} />
            )}

            {currentTab === 'clickup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="sidebar-tabs" style={{ marginBottom: 0 }}>
                  <button className={`tab-btn ${cuSubTab === 'search' ? 'active' : ''}`} onClick={() => switchCuTab('search')}>태스크 조회</button>
                  <button className={`tab-btn ${cuSubTab === 'my' ? 'active' : ''}`} onClick={() => switchCuTab('my')}>내 태스크</button>
                </div>
                {cuSubTab === 'search' && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input className="search-box" type="text" placeholder="검색어 입력"
                      value={cuSearchInput} onChange={e => setCuSearchInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && fetchTasksByKeyword(cuSearchInput)}
                      style={{ margin: 0, flex: 1, width: 0 }} />
                    <button className="btn-search-clickup" onClick={() => fetchTasksByKeyword(cuSearchInput)}>🔍</button>
                  </div>
                )}
                {cuSubTab === 'my' && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input className="search-box" type="text" placeholder="내 태스크 검색..."
                      value={mySearchInput}
                      onChange={e => { setMySearchInput(e.target.value); filterMyTasks(e.target.value); }}
                      style={{ margin: 0, flex: 1, width: 0 }} />
                    <button className="btn-search-clickup" onClick={() => fetchMyTasks(true)}>🔍</button>
                  </div>
                )}
              </div>
            )}

            {currentTab === 'license' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="sidebar-tabs" style={{ marginBottom: 0 }}>
                  <button className={`tab-btn ${licSubTab === 'my' ? 'active' : ''}`} onClick={() => switchLicTab('my')}>내 태스크</button>
                  <button className={`tab-btn ${licSubTab === 'trial' ? 'active' : ''}`} onClick={() => switchLicTab('trial')}>주기적 트라이얼</button>
                </div>
                {licSubTab === 'trial' && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button className={`tab-btn ${trialDocId === 'rbeb5-147183' ? 'active' : ''}`}
                      style={{ fontSize: '11px', padding: '5px 8px' }}
                      onClick={() => loadTrialPages('rbeb5-147183')}>라이선스</button>
                    <button className={`tab-btn ${trialDocId === 'rbeb5-147203' ? 'active' : ''}`}
                      style={{ fontSize: '11px', padding: '5px 8px' }}
                      onClick={() => loadTrialPages('rbeb5-147203')}>중앙관리라이선스</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {currentTab === 'notes' && (
            <div className="notes-list">
              {filteredNotes.length === 0
                ? <div className="empty-list">메모가 없습니다.<br />+ 버튼을 눌러 첫 메모를 작성하세요.</div>
                : filteredNotes.map(n => (
                  <div key={n.id} className={`note-item ${n.id === currentNoteId ? 'active' : ''}`} onClick={() => openNote(n.id)}>
                    <div className="note-item-title">{n.title || '(제목 없음)'}</div>
                    <div className="note-item-preview">{stripHtml(n.content || '')}</div>
                    <div className="note-item-date">{timeAgo(n.updated_at)}</div>
                  </div>
                ))
              }
            </div>
          )}

          {currentTab === 'clickup' && (
            <div className="notes-list">
              {cuSubTab === 'search' && (
                <>
                  {cuTasks.length === 0 && <div className="empty-list">검색어를 입력하고<br />엔터 또는 🔍를 누르세요.</div>}
                  {cuTasks.map(t => (
                    <div key={t.id} className={`task-item ${cuDetail?.task?.id === t.id ? 'active' : ''}`} onClick={() => openTask(t.id)}>
                      <div className="task-item-title">{t.name}</div>
                      <div className="task-item-meta">
                        <span className="task-status" style={{ background: t.status?.color || '#666' }}>{t.status?.status}</span>
                        {t.assignees?.[0] && <span className="task-assignee">{t.assignees[0].username}</span>}
                        {t.due_date && <span className="task-due">{new Date(Number(t.due_date)).toLocaleDateString('ko-KR')}</span>}
                      </div>
                    </div>
                  ))}
                  {cuHasMore && (
                    <div style={{ padding: '8px 6px' }}>
                      <button className="page-btn" style={{ width: '100%' }} onClick={loadMoreCuPage}>더 보기</button>
                    </div>
                  )}
                </>
              )}
              {cuSubTab === 'my' && (
                <>
                  {!myTasksLoaded && <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>}
                  {myTasksLoaded && myTasksFiltered.length === 0 && <div className="empty-list">담당 태스크가 없습니다.</div>}
                  {myTasksFiltered.map(t => (
                    <div key={t.id} className={`task-item ${cuDetail?.task?.id === t.id ? 'active' : ''}`} onClick={() => openTask(t.id)}>
                      <div className="task-item-title">{t.name}</div>
                      <div className="task-item-meta">
                        <span className="task-status" style={{ background: t.status?.color || '#666' }}>{t.status?.status}</span>
                        {t.due_date && <span className="task-due">{new Date(Number(t.due_date)).toLocaleDateString('ko-KR')}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {currentTab === 'license' && (
            <div className="notes-list">
              {licSubTab === 'my' && (
                <>
                  {licenseTasks.length === 0 && <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>}
                  {licenseTasks.map(t => (
                    <div key={t.id} className={`license-task-item ${t.id === currentLicTaskId ? 'active' : ''}`} onClick={() => openLicenseTask(t.id)}>
                      <div className="license-task-name">{t.name}</div>
                      <div className="license-task-meta">
                        {t.list?.name && <span className="license-list-badge">{t.list.name}</span>}
                        {t.assignees?.[0] && <span>{t.assignees[0].username}</span>}
                        {t.due_date && <span>{new Date(Number(t.due_date)).toLocaleDateString('ko-KR')}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {licSubTab === 'trial' && (
                <>
                  {trialPages === null && <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>}
                  {trialPages && trialPages.length === 0 && <div className="empty-list">분기 데이터가 없습니다.</div>}
                  {trialPages && trialPages.map(p => (
                    <div key={p.id} className={`trial-quarter-item ${p.id === trialSelectedQuarter ? 'active' : ''}`}
                      onClick={() => loadTrialPage(trialDocId, p.id, p.name)}>
                      {p.name}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="sidebar-footer">
            <div className="user-info">
              <span className="user-name">{displayName || currentUsername}</span>
              <button className="btn-settings" onClick={openSettings}>⚙️</button>
              <button className="btn-logout" onClick={logout}>로그아웃</button>
            </div>
          </div>
        </div>

        <div className={`editor ${
          (currentTab === 'notes' && editorOpen) ||
          (currentTab === 'clickup' && cuDetail !== null) ||
          (currentTab === 'license' && licSubTab === 'my' && licDetail !== null) ||
          (currentTab === 'license' && licSubTab === 'trial' && trialPanel !== null)
            ? 'open' : ''
        }`}>
          {/* Quill 에디터 - 항상 DOM에 유지 */}
          <div style={{ display: currentTab === 'notes' && editorOpen ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
            <div className="editor-header">
              <button className="btn-back" style={{ display: 'flex' }} onClick={() => router.back()}>←</button>
              <input className="title-input" type="text" placeholder="제목 (선택사항)"
                value={noteTitle}
                onChange={e => { setNoteTitle(e.target.value); noteTitleRef.current = e.target.value; }} />
              <div className="editor-actions">
                <span className={`save-indicator ${showSaved ? 'show' : ''}`}>저장됨 ✓</span>
                <button className="btn-save" onClick={autoSaveNote}>저장</button>
                {showDelete && <button className="btn-delete" onClick={deleteNote}>삭제</button>}
              </div>
            </div>
            <div id="quill-wrapper">
              <div ref={quillEditorRef}></div>
            </div>
          </div>

          {currentTab === 'notes' && !editorOpen && (
            <div className="editor-empty">
              <div className="editor-empty-icon">✏️</div>
              <h3>메모를 선택하거나 새로 만드세요</h3>
              <p>왼쪽에서 메모를 선택하거나<br />+ 버튼을 눌러 새 메모를 작성하세요</p>
            </div>
          )}

          {currentTab === 'clickup' && !cuDetail && (
            <div className="editor-empty">
              <div className="editor-empty-icon">📋</div>
              <h3>태스크를 선택하세요</h3>
              <p>왼쪽에서 태스크를 선택하면<br />상세 정보가 표시됩니다</p>
            </div>
          )}
          {currentTab === 'clickup' && cuDetail && (
            <div className="task-detail">
              <button className="btn-back" style={{ display: 'flex', marginBottom: '8px' }} onClick={() => router.back()}>←</button>
              {cuDetail.loading
                ? <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>
                : <>
                  <a className="task-detail-title" href={cuDetail.task.url} target="_blank" rel="noreferrer">{cuDetail.task.name}</a>
                  <div className="task-detail-info">
                    <div className="task-detail-row"><span className="task-detail-label">분류</span><span>{cuDetail.task.list?.name}</span></div>
                    <div className="task-detail-row"><span className="task-detail-label">담당자</span><span>{cuDetail.task.assignees?.map(a => a.username).join(', ')}</span></div>
                    <div className="task-detail-row"><span className="task-detail-label">마감일</span><span>{cuDetail.task.due_date ? new Date(Number(cuDetail.task.due_date)).toLocaleDateString('ko-KR') : '-'}</span></div>
                  </div>
                  {cuDetail.task.description && <div className="task-detail-desc">{cuDetail.task.description}</div>}
                  {cuDetail.task.attachments?.length > 0 && (
                    <div className="task-attachments">
                      <div className="task-attachments-title">첨부파일</div>
                      <div className="task-attachments-grid">
                        {cuDetail.task.attachments.map((a, i) => (
                          <button key={i} className="attachment-dl-btn" onClick={() => downloadAttachment(a.url, a.title)}>📎 {a.title}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              }
            </div>
          )}

          {currentTab === 'license' && licSubTab === 'my' && !licDetail && (
            <div className="editor-empty">
              <div className="editor-empty-icon">🔑</div>
              <h3>라이선스 태스크를 선택하세요</h3>
            </div>
          )}
          {currentTab === 'license' && licSubTab === 'my' && licDetail && (
            <div className="task-detail">
              <button className="btn-back" style={{ display: 'flex', marginBottom: '8px' }} onClick={() => router.back()}>←</button>
              {licDetail.loading
                ? <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>
                : <>
                  <a className="task-detail-title" href={licDetail.task.url} target="_blank" rel="noreferrer">{licDetail.task.name}</a>
                  <div className="task-detail-info">
                    <div className="task-detail-row"><span className="task-detail-label">분류</span><span>{licDetail.task.list?.name}</span></div>
                    <div className="task-detail-row"><span className="task-detail-label">담당자</span><span>{licDetail.task.assignees?.map(a => a.username).join(', ')}</span></div>
                    <div className="task-detail-row"><span className="task-detail-label">마감일</span><span>{licDetail.task.due_date ? new Date(Number(licDetail.task.due_date)).toLocaleDateString('ko-KR') : '-'}</span></div>
                  </div>
                  {licDetail.descFormatted && <div className="task-detail-desc">{licDetail.descFormatted}</div>}
                  {licDetail.task.attachments?.length > 0 && (
                    <div className="task-attachments">
                      <div className="task-attachments-title">첨부파일</div>
                      <div className="task-attachments-grid">
                        {licDetail.task.attachments.map((a, i) => (
                          <button key={i} className="attachment-dl-btn" onClick={() => downloadAttachment(a.url, a.title)}>📎 {a.title}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              }
            </div>
          )}

          {currentTab === 'license' && licSubTab === 'trial' && !trialPanel && (
            <div className="editor-empty">
              <div className="editor-empty-icon">📅</div>
              <h3>분기를 선택하세요</h3>
            </div>
          )}
          {currentTab === 'license' && licSubTab === 'trial' && trialPanel && (
            <div className="task-detail">
              <button className="btn-back" style={{ display: 'flex', marginBottom: '8px' }} onClick={() => router.back()}>←</button>
              {trialPanel.loading
                ? <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>
                : <>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>{trialPanel.pageName}</div>
                  {trialPanel.sections?.map((s, i) => (
                    <div key={i}>
                      <div className="trial-section-title">{s.name}</div>
                      {s.files.map((f, j) => (
                        <button key={j} className="attachment-dl-btn" style={{ marginBottom: '8px', display: 'block' }}
                          onClick={() => downloadAttachment(f.url, f.name)}>📎 {f.name}</button>
                      ))}
                    </div>
                  ))}
                  {trialPanel.error && <div style={{ color: 'red' }}>오류: {trialPanel.error}</div>}
                </>
              }
            </div>
          )}
        </div>
      </div>

      <div id="img-resize-overlay">
        <div id="img-resize-handle"></div>
        <div id="img-resize-label"></div>
      </div>

      <div id="toast" className={toast.show ? 'show' : ''}>{toast.msg}</div>

      <div className={`settings-overlay ${showSettings ? 'show' : ''}`}>
        <div className="settings-card">
          <div className="settings-header">
            <h2>⚙️ 프로필 설정</h2>
            <button className="settings-close" onClick={() => setShowSettings(false)}>✕</button>
          </div>
          <div className="settings-divider">계정 정보</div>
          <div className="form-group">
            <label>아이디</label>
            <input type="text" value={settingsData.username} onChange={e => setSettingsData(p => ({ ...p, username: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>이름 (표시용)</label>
            <input type="text" value={settingsData.displayName} onChange={e => setSettingsData(p => ({ ...p, displayName: e.target.value }))} />
          </div>
          <div className="settings-divider">비밀번호 변경</div>
          <div className="form-group">
            <label>새 비밀번호</label>
            <input type="password" value={settingsData.newPassword} onChange={e => setSettingsData(p => ({ ...p, newPassword: e.target.value }))} placeholder="변경하지 않으면 비워두세요" />
          </div>
          <div className="settings-divider">ClickUp 연동</div>
          <div className="form-group">
            <label>ClickUp API 토큰</label>
            <input type="text" value={settingsData.clickupToken} onChange={e => setSettingsData(p => ({ ...p, clickupToken: e.target.value }))} placeholder="pk_..." />
            <div className="input-hint">개인 API 토큰을 입력하면 내 태스크 기능이 활성화됩니다</div>
          </div>
          <button className="btn-success" onClick={saveProfile}>저장</button>
          <div className={`settings-message ${settingsMsg.type}`}>{settingsMsg.text}</div>
        </div>
      </div>
    </>
  );
}
