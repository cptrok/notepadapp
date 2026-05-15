import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { sb } from '../../lib/supabase';

function MmImage({ fileId, token }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url;
    fetch(`/api/mattermost?action=file&fileId=${fileId}`, { headers: { 'x-mm-token': token } })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => { if (blob) { url = URL.createObjectURL(blob); setSrc(url); } })
      .catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [fileId, token]);
  if (!src) return null;
  return (
    <img
      src={src}
      style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '6px', cursor: 'pointer', objectFit: 'contain' }}
      onClick={() => window.open(src, '_blank')}
    />
  );
}

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

export default function App() {
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
  const [cuHasMore, setCuHasMore] = useState(false);
  const [cuKeyword, setCuKeyword] = useState('');
  const [cuSearchInput, setCuSearchInput] = useState('');
  const [myTasks, setMyTasks] = useState([]);
  const [myTasksFiltered, setMyTasksFiltered] = useState([]);
  const [myTasksLoaded, setMyTasksLoaded] = useState(false);
  const [myTasksHasMore, setMyTasksHasMore] = useState(false);
  const [myTasksLoadingMore, setMyTasksLoadingMore] = useState(false);
  const [cuLoading, setCuLoading] = useState(false);
  const [cuLoadingMore, setCuLoadingMore] = useState(false);
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
  const [settingsData, setSettingsData] = useState({ username: '', displayName: '', newPassword: '', clickupToken: '', mmUsername: '', mmPassword: '' });
  const [settingsMsg, setSettingsMsg] = useState({ text: '', type: '' });

  const [mmToken, setMmToken] = useState(null);
  const [mmUserId, setMmUserId] = useState(null);
  const [mmChannels, setMmChannels] = useState([]);
  const [mmSelectedChannel, setMmSelectedChannel] = useState(null);
  const [mmPosts, setMmPosts] = useState([]);
  const [mmLoading, setMmLoading] = useState(false);
  const [mmPostsLoading, setMmPostsLoading] = useState(false);
  const [mmPostsHasMore, setMmPostsHasMore] = useState(false);
  const [mmLoadingMorePosts, setMmLoadingMorePosts] = useState(false);
  const [mmSummary, setMmSummary] = useState('');
  const [mmSummarizing, setMmSummarizing] = useState(false);
  const [mmSummaryCollapsed, setMmSummaryCollapsed] = useState(false);
  const [mmDateInput, setMmDateInput] = useState('');
  const [mmDateSummary, setMmDateSummary] = useState('');
  const [mmDateSummarizing, setMmDateSummarizing] = useState(false);
  const [mmDateSummaryCollapsed, setMmDateSummaryCollapsed] = useState(false);
  const [mmLoginForm, setMmLoginForm] = useState({ username: '', password: '' });
  const [mmLoginMsg, setMmLoginMsg] = useState('');

  const DEQ_LISTS = {
    MFO: '900303022977', MFT: '900303031749', MFA: '900303116533',
    MFD: '900303116531', MFS: '900303116541', MFM: '900303116526',
    MFP: '900303164467', MFH: '900303116521', Dashboard: '901804149604',
  };
  const DEQ_CUSTOMERS = [{"id":"a5411657-ddb6-41ff-a0df-2c8b65bff602","name":"엑셈"},{"id":"5c0a5ede-05ee-4181-a8d1-91d8211b9da8","name":"고객사추가필요"},{"id":"ba22287b-9706-4dff-84a4-0d38b8787efd","name":"기타고객사"},{"id":"8c5c62ba-b382-43ee-b77d-9b13f540f0d0","name":"BGF네트웍스"},{"id":"2a952a32-4fa8-4849-8344-d2e73842854b","name":"BC카드"},{"id":"0c4c4847-05c7-4209-9665-0f3f215fe72d","name":"IBK기업은행"},{"id":"bf159895-fb85-4082-a07d-bc38303bb18c","name":"IBK투자증권"},{"id":"c8b57b5e-47cd-4a2b-a696-fc4580e4564e","name":"KLNET"},{"id":"df73659a-3a2a-4440-80ae-0c2da41be66d","name":"KT"},{"id":"d1d57bee-0368-4bc8-86b7-b602198388cb","name":"LG디스플레이"},{"id":"dc6817de-0957-4849-89f5-e26735fa73b5","name":"LG에너지솔루션"},{"id":"398e711f-0b70-4f84-973f-7569eef84135","name":"건강보험공단"},{"id":"ad13aa99-7a59-4ae0-9926-9a84d6cf96e2","name":"건강보험심사평가원"},{"id":"a221f483-21c3-46ca-b848-e02135c78e6e","name":"경기도청"},{"id":"f3703851-6eec-4708-b584-dd5d49eb97a2","name":"금융결제원"},{"id":"e0f7d99a-8ebe-44c3-ab8a-6fa8032f258a","name":"기획재정부"},{"id":"3be8f72b-3343-446a-b10b-f2d8574139ee","name":"카카오뱅크"},{"id":"3a8b9c2d-3e13-4624-893d-f3fb26e2ce44","name":"카카오페이"},{"id":"499912dc-fb62-476b-8626-42a3b6c8ecca","name":"카카오페이증권"},{"id":"930820ae-ce40-424e-a793-54bf835b0cc3","name":"한국거래소(KRX)"},{"id":"a8d71e89-d69a-4913-b05e-a27d7f083553","name":"신한은행"},{"id":"45231106-48f6-4e9f-9c4e-a3f7442c552b","name":"신한라이프"},{"id":"395640c6-3548-432b-9ff6-4172bb0003c6","name":"신한투자증권(구.신한금융투자)"},{"id":"d386d3f6-e858-4238-9989-4c21a29afd2f","name":"신한카드"},{"id":"e1fd8f33-87fd-4999-9d40-366a7678b4c5","name":"하나은행"},{"id":"c1c1cd22-4f38-4963-9fa6-3c93a0f20bd9","name":"하나카드"},{"id":"f3141d14-4007-42d5-a31f-9b1ec2a2ad9b","name":"SR(수서고속)"},{"id":"9a560cdf-3dad-4dba-a469-f2b447e9d719","name":"국민연금공단"},{"id":"c7768cce-7491-49d4-afd5-bf815473b694","name":"고려대학교의료원"},{"id":"86b3da06-c940-40df-a6de-9eeaf775f709","name":"현대카드"},{"id":"f34d3596-a2e2-4ada-b677-ce0be1415c2a","name":"현대캐피탈"},{"id":"b4bf089d-ae00-485c-9e9f-fd540102df4f","name":"SK하이닉스"},{"id":"66a44766-8378-4c2e-a02a-f3e712f78f4d","name":"엔카닷컴(구.SK엔카닷컴)"},{"id":"5f4bd043-473f-4c92-94ec-c1e2a0b2b23f","name":"미래에셋증권"},{"id":"99daacee-b306-4efa-9a42-db0a25209b04","name":"삼성생명"},{"id":"40e065c9-fc9f-405d-9ca8-7dd2b52faa6e","name":"삼성전자"},{"id":"1f99cb5c-b95d-4839-a162-cdcaf5d6182a","name":"삼성화재"},{"id":"db0ea50d-cca5-44a5-9dbc-673500edd8db","name":"삼성카드"},{"id":"4012be3b-ce39-4e33-b127-5e3f3e879040","name":"한화생명"},{"id":"ace7a982-5bc0-407b-9ad8-69f06e9cee8a","name":"한화시스템"},{"id":"2de07de8-6ee8-455e-b09b-fc77d497545f","name":"한국신용정보원"},{"id":"d62c25a8-3086-4ad9-9847-5db5e95dcdcc","name":"한국전력공사"},{"id":"c305a1d7-1bef-45ad-8321-97072135bcdc","name":"한국투자증권"},{"id":"07b07df0-0ba8-4a76-b60f-2d268725df99","name":"한국철도공사(구.코레일)"},{"id":"e47eabab-1024-4aa5-8c23-974e3a626473","name":"KB라이프생명"},{"id":"de380e7c-6566-4854-a28f-7c8b82831d4e","name":"KB증권"},{"id":"c6c90b2e-03e0-4024-ac79-441a38151388","name":"KB국민카드"},{"id":"c7a07f36-b51a-480b-9732-34215e51e80c","name":"단국대학교"},{"id":"2164a1ce-1163-4b16-95be-dc8989bee47a","name":"경기신용보증재단"},{"id":"95d883e5-fb0f-495b-881a-bec00626df4d","name":"NH투자증권"},{"id":"986b9473-020c-4a1e-bfae-e07b9090fd7d","name":"NH농협생명"},{"id":"a331c619-f8b1-4f70-9082-826b039d3478","name":"한국주택금융공사"},{"id":"935d4c8d-6d78-4b26-a409-4800cc036ca1","name":"한국도로공사"},{"id":"5a443175-0540-41ae-8e77-a86705c064aa","name":"토스뱅크"},{"id":"8267dd2a-00cd-4ec5-8bc5-07de919a8614","name":"토스증권"},{"id":"ed40e664-4aea-4e47-bfef-47d55f2fdf1f","name":"토스CX"},{"id":"9e6ea49b-5b4d-4b89-bcd8-6c583e1ec0dc","name":"KIDB"},{"id":"fb4d628f-b427-4342-81aa-fabfeeef1277","name":"푸디스트"},{"id":"cebd12b5-7b47-4dc8-9187-d7a80d09b08b","name":"웰컴저축은행"},{"id":"5e972528-c7f4-4eba-869e-908a7e3b100d","name":"웰컴페이먼츠"}];
  const DEQ_ISSUE_TYPES = [
    { id: 'eb4f762b-f3b4-4d27-a900-27918626ebe4', name: 'Inquiry' },
    { id: '94f7e5c5-3ef4-4680-a316-56403c99c3b7', name: 'Bug' },
    { id: 'ee2478c8-3f15-4623-b1c6-bbc4277c5785', name: 'Improvement' },
    { id: '32d3359f-433a-47c7-9e61-2e69bc5fb52a', name: 'Spec' },
    { id: '3314ebb4-703e-4512-bf9f-c3ef7ed01708', name: 'Need Plan' },
    { id: '1d5443b1-f195-4f58-acfe-710ad9b85795', name: 'Daemon Build' },
    { id: '92388248-45dc-4c30-a76c-7d71149973ce', name: 'DSR' },
    { id: '13a21f06-f598-4e14-a977-6de6ad2a1810', name: "Support" },
  ];

  const [cuRegModal, setCuRegModal] = useState(false);
  const [cuRegForm, setCuRegForm] = useState({ product: 'MFO', taskName: '', customer: '', issueType: 'eb4f762b-f3b4-4d27-a900-27918626ebe4', description: '', customerSearch: '' });
  const [cuRegLoading, setCuRegLoading] = useState(false);
  const [cuRegMsg, setCuRegMsg] = useState('');

  const clickupTokenRef = useRef(CLICKUP_TOKEN_DEFAULT);
  const quillRef = useRef(null);
  const quillEditorRef = useRef(null);
  const currentNoteIdRef = useRef(null);
  const noteTitleRef = useRef('');
  const allNotesRef = useRef([]);
  const cuKeywordRef = useRef('');
  const cuBufferRef = useRef([]);
  const cuApiPageRef = useRef(0);
  const cuApiExhaustedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const trialPagesCache = useRef({});
  const myApiPageRef = useRef(0);
  const myUserIdRef = useRef(null);
  const myBufferRef = useRef([]);
  const myApiExhaustedRef = useRef(false);
  const myAllRef = useRef([]);
  const mmTokenRef = useRef(null);
  const mmUserIdRef = useRef(null);
  const mmPostsPageRef = useRef(1);
  const mmScrollRef = useRef(null);
  const mmPrevScrollHeightRef = useRef(null);
  const mmUsersCacheRef = useRef({});

  useLayoutEffect(() => {
    if (mmPrevScrollHeightRef.current !== null && mmScrollRef.current) {
      mmScrollRef.current.scrollTop = mmScrollRef.current.scrollHeight - mmPrevScrollHeightRef.current;
      mmPrevScrollHeightRef.current = null;
    }
  }, [mmPosts]);

  useEffect(() => { currentNoteIdRef.current = currentNoteId; }, [currentNoteId]);
  useEffect(() => { noteTitleRef.current = noteTitle; }, [noteTitle]);
  useEffect(() => { allNotesRef.current = allNotes; }, [allNotes]);
  useEffect(() => { cuKeywordRef.current = cuKeyword; }, [cuKeyword]);

  useEffect(() => {
    const saved = localStorage.getItem('memo_user');
    if (!saved) { router.replace('/login'); return; }
    setCurrentUsername(saved);
    const savedMmToken = localStorage.getItem('mm_token');
    const savedMmUserId = localStorage.getItem('mm_user_id');
    if (savedMmToken && savedMmUserId) {
      mmTokenRef.current = savedMmToken;
      mmUserIdRef.current = savedMmUserId;
      setMmToken(savedMmToken);
      setMmUserId(savedMmUserId);
    }
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

  // URL 경로 변화 감지 → 뒤로가기 시 상세 화면 닫기
  useEffect(() => {
    if (!router.isReady || !currentUsername) return;
    const slug = router.query.slug || [];
    const [section, id] = slug;

    if (section !== 'note' || !id) { clearTimeout(saveTimerRef.current); setEditorOpen(false); }
    if (section !== 'clickup' || !id) setCuDetail(null);
    if (section !== 'license' || !id) { setLicDetail(null); setCurrentLicTaskId(null); }
    if (section !== 'trial') { setTrialPanel(null); setTrialSelectedQuarter(null); }

    if (section === 'note') setCurrentTab('notes');
    else if (section === 'clickup') setCurrentTab('clickup');
    else if (section === 'license') setCurrentTab('license');
    else if (section === 'trial') { setCurrentTab('license'); setLicSubTab('trial'); }
    else if (section === 'chat') setCurrentTab('chat');
  }, [router.isReady, router.asPath]);

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

      // DB 저장 토큰 복원
      if (p.mm_token) {
        mmTokenRef.current = p.mm_token;
        setMmToken(p.mm_token);
        localStorage.setItem('mm_token', p.mm_token);
      }
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
    navFn(`/app/note/${id}`, undefined, { shallow: true });
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
    navFn('/app/note/new', undefined, { shallow: true });
  }

  async function autoSaveNote(showIndicator = false) {
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
      if (showIndicator) {
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      }
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
    router.push('/app/note', undefined, { shallow: true });
  }

  const CU_PAGE_SIZE = 6;

  async function fetchApiPage(keyword) {
    if (cuApiExhaustedRef.current) return;
    const res = await fetch(
      `https://api.clickup.com/api/v2/team/${TEAM_ID}/task?space_ids[]=${CLICKUP_SPACE_ID}&subtasks=true&include_closed=true&order_by=created&page=${cuApiPageRef.current}`,
      { headers: { Authorization: clickupTokenRef.current } }
    );
    const data = await res.json();
    const tasks = data.tasks || [];
    const filtered = keyword ? tasks.filter(t =>
      (t.name || '').toLowerCase().includes(keyword.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(keyword.toLowerCase())
    ) : tasks;
    cuBufferRef.current = [...cuBufferRef.current, ...filtered];
    cuApiPageRef.current += 1;
    if (tasks.length < 100) cuApiExhaustedRef.current = true;
  }

  async function fillBuffer(keyword) {
    while (cuBufferRef.current.length < CU_PAGE_SIZE && !cuApiExhaustedRef.current) {
      await fetchApiPage(keyword);
    }
  }

  async function fetchTasksByKeyword(q) {
    if (!q.trim()) return;
    setCuKeyword(q);
    cuKeywordRef.current = q;
    setCuTasks([]);
    setCuHasMore(false);
    setCuDetail(null);
    cuBufferRef.current = [];
    cuApiPageRef.current = 0;
    cuApiExhaustedRef.current = false;
    setCuLoading(true);
    try {
      await fillBuffer(q);
      const toShow = cuBufferRef.current.splice(0, CU_PAGE_SIZE);
      setCuTasks(toShow);
      setCuHasMore(cuBufferRef.current.length > 0 || !cuApiExhaustedRef.current);
    } catch (e) { console.error(e); }
    setCuLoading(false);
  }

  async function loadMoreCuPage() {
    setCuLoadingMore(true);
    try {
      await fillBuffer(cuKeywordRef.current);
      const toShow = cuBufferRef.current.splice(0, CU_PAGE_SIZE);
      setCuTasks(prev => [...prev, ...toShow]);
      setCuHasMore(cuBufferRef.current.length > 0 || !cuApiExhaustedRef.current);
    } catch (e) { console.error(e); }
    setCuLoadingMore(false);
  }

  async function fetchMyApiPage() {
    if (myApiExhaustedRef.current) return;
    const res = await fetch(
      `https://api.clickup.com/api/v2/team/${TEAM_ID}/task?space_ids[]=${CLICKUP_SPACE_ID}&subtasks=true&include_closed=true&order_by=created&assignees[]=${myUserIdRef.current}&page=${myApiPageRef.current}`,
      { headers: { Authorization: clickupTokenRef.current } }
    );
    const data = await res.json();
    const tasks = data.tasks || [];
    myBufferRef.current = [...myBufferRef.current, ...tasks];
    myAllRef.current = [...myAllRef.current, ...tasks];
    myApiPageRef.current += 1;
    if (tasks.length < 100) myApiExhaustedRef.current = true;
  }

  async function fillMyBuffer() {
    while (myBufferRef.current.length < CU_PAGE_SIZE && !myApiExhaustedRef.current) {
      await fetchMyApiPage();
    }
  }

  async function fetchMyTasks(force) {
    if (myTasksLoaded && !force) return;
    setCuLoading(true);
    const token = clickupTokenRef.current;
    const parts = token.split('_');
    const userId = parts.length >= 2 ? parts[1] : null;
    if (!userId) { setCuLoading(false); return; }
    myUserIdRef.current = userId;
    myApiPageRef.current = 0;
    myBufferRef.current = [];
    myAllRef.current = [];
    myApiExhaustedRef.current = false;
    try {
      await fillMyBuffer();
      const toShow = myBufferRef.current.splice(0, CU_PAGE_SIZE);
      setMyTasks(toShow);
      setMyTasksFiltered(toShow);
      setMyTasksHasMore(myBufferRef.current.length > 0 || !myApiExhaustedRef.current);
    } catch (e) { console.error(e); }
    setMyTasksLoaded(true);
    setCuLoading(false);
  }

  async function loadMoreMyTasks() {
    setMyTasksLoadingMore(true);
    try {
      await fillMyBuffer();
      const toShow = myBufferRef.current.splice(0, CU_PAGE_SIZE);
      setMyTasks(prev => [...prev, ...toShow]);
      setMyTasksFiltered(prev => [...prev, ...toShow]);
      setMyTasksHasMore(myBufferRef.current.length > 0 || !myApiExhaustedRef.current);
    } catch (e) { console.error(e); }
    setMyTasksLoadingMore(false);
  }

  function filterMyTasks(q) {
    if (!q) { setMyTasksFiltered(myTasks); return; }
    setMyTasksFiltered(myAllRef.current.filter(t => (t.name || '').toLowerCase().includes(q.toLowerCase())));
  }

  async function openTask(id) {
    const navFn = cuDetail ? router.replace : router.push;
    navFn(`/app/clickup/${id}`, undefined, { shallow: true });
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
    navFn(`/app/license/${id}`, undefined, { shallow: true });
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
    navFn(`/app/trial/${pageId}?name=${encodeURIComponent(pageName)}`, undefined, { shallow: true });
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
      setSettingsData({ username: p.username || currentUsername, displayName: p.display_name || '', newPassword: '', clickupToken: p.clickup_token || '', mmUsername: p.mm_username || '', mmPassword: p.mm_password || '' });
    }
    setSettingsMsg({ text: '', type: '' });
    setShowSettings(true);
  }

  async function saveProfile() {
    // MM 계정이 입력된 경우 먼저 인증 검증
    let mmToken_new = null;
    let mmUserId_new = null;
    if (settingsData.mmUsername && settingsData.mmPassword) {
      setSettingsMsg({ text: 'Mattermost 인증 확인 중...', type: '' });
      try {
        const r = await fetch('/api/mattermost?action=login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: settingsData.mmUsername, password: settingsData.mmPassword }),
        });
        const mmData = await r.json();
        if (!r.ok || !mmData.token) {
          setSettingsMsg({ text: 'Mattermost 인증 실패: ' + (mmData.error || '아이디 또는 비밀번호를 확인하세요.'), type: 'error' });
          return;
        }
        mmToken_new = mmData.token;
        mmUserId_new = mmData.userId;
      } catch (e) {
        setSettingsMsg({ text: 'Mattermost 연결 오류: ' + e.message, type: 'error' });
        return;
      }
    }

    // MM 인증 통과 후 전체 저장
    const { error } = await sb.rpc('update_user_profile', {
      p_username: currentUsername,
      p_new_id: settingsData.username,
      p_display_name: settingsData.displayName,
      p_new_password: settingsData.newPassword || null,
      p_clickup_token: settingsData.clickupToken || null,
    });
    if (error) { setSettingsMsg({ text: '저장 실패: ' + error.message, type: 'error' }); return; }
    if (settingsData.clickupToken) clickupTokenRef.current = settingsData.clickupToken;
    if (settingsData.displayName) setDisplayName(settingsData.displayName);

    if (mmToken_new) {
      mmTokenRef.current = mmToken_new;
      mmUserIdRef.current = mmUserId_new;
      setMmToken(mmToken_new);
      setMmUserId(mmUserId_new);
      localStorage.setItem('mm_token', mmToken_new);
      localStorage.setItem('mm_user_id', mmUserId_new);
      await sb.rpc('update_mm_token', { p_username: currentUsername, p_mm_token: mmToken_new });
      setSettingsMsg({ text: '저장되었습니다. Mattermost 연동 완료.', type: 'success' });
    } else {
      setSettingsMsg({ text: '저장되었습니다.', type: 'success' });
    }
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
    if (tab === 'chat' && mmTokenRef.current && mmChannels.length === 0) mmLoadChannels();
    const path = tab === 'notes' ? 'note' : tab;
    router.push(`/app/${path}`, undefined, { shallow: true });
  }

  function switchCuTab(tab) {
    setCuSubTab(tab);
    setCuDetail(null);
    if (tab === 'my' && !myTasksLoaded) fetchMyTasks(false);
  }

  useEffect(() => {
    if (mmToken && mmChannels.length === 0) mmLoadChannels();
  }, [mmToken]);

  async function mmLogin() {
    if (!mmLoginForm.username || !mmLoginForm.password) {
      setMmLoginMsg('아이디와 비밀번호를 입력하세요.');
      return;
    }
    setMmLoginMsg('로그인 중...');
    try {
      const r = await fetch('/api/mattermost?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: mmLoginForm.username, password: mmLoginForm.password }),
      });
      const data = await r.json();
      if (!r.ok) { setMmLoginMsg(data.error || '로그인 실패'); return; }
      localStorage.setItem('mm_token', data.token);
      localStorage.setItem('mm_user_id', data.userId);
      mmTokenRef.current = data.token;
      mmUserIdRef.current = data.userId;
      setMmToken(data.token);
      setMmUserId(data.userId);
      setMmLoginMsg('로그인 성공!');
      setMmLoginForm({ username: '', password: '' });
    } catch (e) {
      setMmLoginMsg('오류: ' + e.message);
    }
  }

  async function mmLogout() {
    localStorage.removeItem('mm_token');
    localStorage.removeItem('mm_user_id');
    mmTokenRef.current = null;
    mmUserIdRef.current = null;
    setMmToken(null);
    setMmUserId(null);
    setMmChannels([]);
    setMmSelectedChannel(null);
    setMmPosts([]);
    mmUsersCacheRef.current = {};
    setMmLoginMsg('');
    // DB에서 토큰 삭제
    await sb.rpc('update_mm_token', { p_username: currentUsername, p_mm_token: '' });
    setSettingsData(p => ({ ...p, mmUsername: '', mmPassword: '' }));
  }

  async function mmLoadChannels() {
    if (!mmTokenRef.current) return;
    setMmLoading(true);
    try {
      const teamsRes = await fetch('/api/mattermost?action=teams', {
        headers: { 'x-mm-token': mmTokenRef.current },
      });
      const teams = await teamsRes.json();
      if (!Array.isArray(teams) || teams.length === 0) { setMmLoading(false); return; }
      let allChannels = [];
      for (const team of teams) {
        const chRes = await fetch(`/api/mattermost?action=channels&teamId=${team.id}&userId=${mmUserIdRef.current}`, {
          headers: { 'x-mm-token': mmTokenRef.current },
        });
        const channels = await chRes.json();
        if (Array.isArray(channels)) {
          const MM_INCLUDE = ['[MF', '[exemONE'];
          const MM_EXCLUDE = ['이슈접수', '이슈 접수', '공지사항', '잡담', '제품기획', '제품이슈방', '기획방', '전체공지방', '2그룹', '긴급공지', '신입OJT'];
          const filtered = channels.filter(c => {
            if (c.type === 'D' || c.type === 'G') return false;
            const name = c.display_name || c.name;
            if (!MM_INCLUDE.some(kw => name.includes(kw))) return false;
            if (MM_EXCLUDE.some(kw => name.includes(kw))) return false;
            return true;
          });
          allChannels = [...allChannels, ...filtered.map(c => ({ ...c, teamName: team.display_name }))];
        }
      }
      allChannels.sort((a, b) => (b.last_post_at || 0) - (a.last_post_at || 0));
      setMmChannels(allChannels);
    } catch (e) { console.error(e); }
    setMmLoading(false);
  }

  async function mmFetchPosts(channelId, page) {
    const r = await fetch(`/api/mattermost?action=posts&channelId=${channelId}&page=${page}`, {
      headers: { 'x-mm-token': mmTokenRef.current },
    });
    const data = await r.json();
    if (!data.order || !data.posts) return [];
    const posts = data.order.map(id => data.posts[id]).filter(Boolean);
    const uniqueUserIds = [...new Set(posts.map(p => p.user_id).filter(uid => uid && !mmUsersCacheRef.current[uid]))];
    if (uniqueUserIds.length > 0) {
      const usersRes = await fetch('/api/mattermost?action=users', {
        method: 'POST',
        headers: { 'x-mm-token': mmTokenRef.current, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: uniqueUserIds }),
      });
      const users = await usersRes.json();
      if (Array.isArray(users)) users.forEach(u => { mmUsersCacheRef.current[u.id] = u.nickname || u.username; });
    }
    return posts;
  }

  async function mmOpenChannel(channel) {
    setMmSelectedChannel(channel);
    setMmPosts([]);
    setMmPostsHasMore(false);
    setMmSummary('');
    setMmDateSummary('');
    setMmPostsLoading(true);
    try {
      const posts = await mmFetchPosts(channel.id, 0);
      mmPostsPageRef.current = 1;
      setMmPosts(posts.reverse());
      setMmPostsHasMore(posts.length === 50);
      setTimeout(() => { if (mmScrollRef.current) mmScrollRef.current.scrollTop = mmScrollRef.current.scrollHeight; }, 50);
    } catch (e) { console.error(e); }
    setMmPostsLoading(false);
  }

  async function mmLoadMorePosts() {
    if (!mmSelectedChannel) return;
    setMmLoadingMorePosts(true);
    if (mmScrollRef.current) mmPrevScrollHeightRef.current = mmScrollRef.current.scrollHeight;
    try {
      const posts = await mmFetchPosts(mmSelectedChannel.id, mmPostsPageRef.current);
      mmPostsPageRef.current += 1;
      setMmPosts(prev => [...posts.reverse(), ...prev]);
      setMmPostsHasMore(posts.length === 50);
    } catch (e) { console.error(e); }
    setMmLoadingMorePosts(false);
  }

  async function mmSummarize() {
    if (!mmPosts.length || !mmSelectedChannel) return;
    setMmSummarizing(true);
    setMmSummary('');
    try {
      const messages = mmPosts
        .filter(p => p.message?.trim())
        .map(p => ({ username: mmUsersCacheRef.current[p.user_id] || p.user_id?.slice(0, 8), message: p.message }));
      const r = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, channelName: mmChannelDisplayName(mmSelectedChannel) }),
      });
      const data = await r.json();
      if (!r.ok) { setMmSummary('오류: ' + data.error); return; }
      setMmSummary(data.summary);
    } catch (e) { setMmSummary('오류: ' + e.message); }
    finally { setMmSummarizing(false); }
  }


  async function mmSummarizeByDate() {
    if (!mmDateInput || !mmSelectedChannel) return;
    setMmDateSummarizing(true);
    setMmDateSummary('');
    try {
      const [year, month, day] = mmDateInput.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      const r = await fetch(`/api/mattermost?action=posts&channelId=${mmSelectedChannel.id}&since=${startOfDay.getTime()}`, {
        headers: { 'x-mm-token': mmTokenRef.current },
      });
      const data = await r.json();
      if (!r.ok) { setMmDateSummary('오류: ' + data.error); return; }
      const order = data.order || [];
      const posts = order
        .map(id => data.posts[id])
        .filter(p => p.create_at >= startOfDay.getTime() && p.create_at <= endOfDay.getTime() && p.message?.trim())
        .sort((a, b) => a.create_at - b.create_at);
      if (posts.length === 0) { setMmDateSummary('해당 날짜의 메시지가 없습니다.'); return; }
      const unknownIds = [...new Set(posts.map(p => p.user_id).filter(id => !mmUsersCacheRef.current[id]))];
      if (unknownIds.length > 0) {
        const ur = await fetch('/api/mattermost?action=users', {
          method: 'POST',
          headers: { 'x-mm-token': mmTokenRef.current, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: unknownIds }),
        });
        if (ur.ok) { const ud = await ur.json(); ud.forEach(u => { mmUsersCacheRef.current[u.id] = u.username; }); }
      }
      const messages = posts.map(p => ({
        username: mmUsersCacheRef.current[p.user_id] || p.user_id?.slice(0, 8),
        message: p.message,
      }));
      const dateLabel = `${year}년 ${month}월 ${day}일`;
      const gr = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, channelName: mmChannelDisplayName(mmSelectedChannel), date: dateLabel, mode: 'date' }),
      });
      const gd = await gr.json();
      if (!gr.ok) { setMmDateSummary('오류: ' + gd.error); return; }
      setMmDateSummary(gd.summary);
    } catch (e) { setMmDateSummary('오류: ' + e.message); }
    finally { setMmDateSummarizing(false); }
  }

  async function saveToNote(title, text) {
    const username = localStorage.getItem('memo_user');
    if (!username) return alert('로그인이 필요합니다.');
    const content = '<p>' + text.replace(/\n/g, '</p><p>') + '</p>';
    const { error } = await sb.rpc('save_user_note', {
      p_username: username, p_id: null, p_title: title, p_content: content,
    });
    if (error) { alert('저장 실패: ' + error.message); return; }
    loadNotes();
    alert('메모에 저장되었습니다.');
  }

  function openCuRegModal() {
    const title = noteTitleRef.current || '';
    const text = quillRef.current ? quillRef.current.getText().trim() : '';
    setCuRegForm(f => ({ ...f, taskName: title, description: text, customerSearch: '', customer: '' }));
    setCuRegMsg('');
    setCuRegModal(true);
  }

  async function submitCuReg() {
    if (!cuRegForm.taskName.trim()) return setCuRegMsg('태스크명을 입력해주세요.');
    if (!cuRegForm.customer) return setCuRegMsg('고객사를 선택해주세요.');
    setCuRegLoading(true);
    setCuRegMsg('');
    const listId = DEQ_LISTS[cuRegForm.product];
    const today = new Date();
    const todayTs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    try {
      const r = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
        method: 'POST',
        headers: { Authorization: clickupTokenRef.current, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cuRegForm.taskName,
          description: cuRegForm.description,
          custom_fields: [
            { id: 'cc55be6f-f4bf-42b7-9a33-b06e1b60f800', value: cuRegForm.customer },
            { id: '6d0330f1-3102-4eea-9099-90875ec6700a', value: cuRegForm.issueType },
            { id: 'ad3894ba-579d-4a6b-946b-9070d604652e', value: todayTs },
          ],
        }),
      });
      const data = await r.json();
      if (!r.ok) { setCuRegMsg('오류: ' + (data.err || JSON.stringify(data))); return; }
      setCuRegMsg('✅ 등록 완료! Task ID: ' + data.id);
    } catch (e) { setCuRegMsg('오류: ' + e.message); }
    finally { setCuRegLoading(false); }
  }

  function mmChannelDisplayName(ch) {
    if (ch.type === 'D') {
      const parts = ch.name.split('__');
      const otherId = parts.find(uid => uid !== mmUserIdRef.current);
      return mmUsersCacheRef.current[otherId] || otherId || ch.name;
    }
    return ch.display_name || ch.name;
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

  const cuRegFilteredCustomers = DEQ_CUSTOMERS.filter(c =>
    !cuRegForm.customerSearch || c.name.toLowerCase().includes(cuRegForm.customerSearch.toLowerCase())
  );

  return (
    <>
      {cuRegModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg, #fff)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontWeight: 700, fontSize: '16px' }}>📋 ClickUp [DEQ]협업시스템 등록</span>
              <button onClick={() => setCuRegModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text, #333)' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-sub, #666)' }}>제품 *</div>
                <select value={cuRegForm.product} onChange={e => setCuRegForm(f => ({ ...f, product: e.target.value }))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px', background: 'var(--bg, #fff)', color: 'var(--text, #333)' }}>
                  {Object.keys(DEQ_LISTS).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-sub, #666)' }}>태스크명 *</div>
                <input value={cuRegForm.taskName} onChange={e => setCuRegForm(f => ({ ...f, taskName: e.target.value }))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px', background: 'var(--bg, #fff)', color: 'var(--text, #333)', boxSizing: 'border-box' }} placeholder="태스크명 입력" />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-sub, #666)' }}>고객사 *</div>
                <input value={cuRegForm.customerSearch} onChange={e => setCuRegForm(f => ({ ...f, customerSearch: e.target.value, customer: '' }))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px', marginBottom: '4px', background: 'var(--bg, #fff)', color: 'var(--text, #333)', boxSizing: 'border-box' }} placeholder="고객사 검색..." />
                {cuRegForm.customerSearch && !cuRegForm.customer && (
                  <div style={{ border: '1px solid var(--border, #ddd)', borderRadius: '6px', maxHeight: '160px', overflowY: 'auto', background: 'var(--bg, #fff)' }}>
                    {cuRegFilteredCustomers.slice(0, 20).map(c => (
                      <div key={c.id} onClick={() => setCuRegForm(f => ({ ...f, customer: c.id, customerSearch: c.name }))} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border, #eee)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, #f5f5f5)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        {c.name}
                      </div>
                    ))}
                    {cuRegFilteredCustomers.length === 0 && <div style={{ padding: '8px 12px', fontSize: '13px', color: '#999' }}>검색 결과 없음</div>}
                  </div>
                )}
                {cuRegForm.customer && <div style={{ fontSize: '12px', color: '#0066cc', marginTop: '2px' }}>✓ {cuRegForm.customerSearch}</div>}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-sub, #666)' }}>Issue Type *</div>
                <select value={cuRegForm.issueType} onChange={e => setCuRegForm(f => ({ ...f, issueType: e.target.value }))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px', background: 'var(--bg, #fff)', color: 'var(--text, #333)' }}>
                  {DEQ_ISSUE_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-sub, #666)' }}>설명</div>
                <textarea value={cuRegForm.description} onChange={e => setCuRegForm(f => ({ ...f, description: e.target.value }))} rows={5} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '13px', resize: 'vertical', background: 'var(--bg, #fff)', color: 'var(--text, #333)', boxSizing: 'border-box' }} placeholder="설명 (선택)" />
              </div>
              {cuRegMsg && <div style={{ fontSize: '13px', color: cuRegMsg.startsWith('✅') ? '#2e7d32' : '#c00', padding: '8px', borderRadius: '6px', background: cuRegMsg.startsWith('✅') ? '#e8f5e9' : '#fff0f0' }}>{cuRegMsg}</div>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setCuRegModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', background: 'var(--bg, #fff)', cursor: 'pointer', fontSize: '14px' }}>취소</button>
                <button onClick={submitCuReg} disabled={cuRegLoading} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#0066cc', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>{cuRegLoading ? '등록 중...' : '📋 등록하기'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="app-layout">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-top">
              <span className="sidebar-title">록근_v79</span>
              {currentTab === 'notes' && <button className="btn-new" onClick={newNote}>+</button>}
            </div>
            <div className="sidebar-tabs">
              <button className={`tab-btn ${currentTab === 'notes' ? 'active' : ''}`} onClick={() => switchTab('notes')}>메모</button>
              <button className={`tab-btn ${currentTab === 'clickup' ? 'active' : ''}`} onClick={() => switchTab('clickup')}>ClickUp</button>
              <button className={`tab-btn ${currentTab === 'license' ? 'active' : ''}`} onClick={() => switchTab('license')}>라이선스</button>
              <button className={`tab-btn ${currentTab === 'chat' ? 'active' : ''}`} onClick={() => switchTab('chat')}>MM</button>
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
                  {cuLoading && <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>}
                  {!cuLoading && cuTasks.length === 0 && <div className="empty-list">검색어를 입력하고<br />엔터 또는 🔍를 누르세요.</div>}
                  {!cuLoading && cuTasks.map(t => (
                    <div key={t.id} className={`task-item ${cuDetail?.task?.id === t.id ? 'active' : ''}`} onClick={() => openTask(t.id)}>
                      <div className="task-item-title">{t.name}</div>
                      <div className="task-item-meta">
                        <span className="task-status" style={{ background: t.status?.color || '#666' }}>{t.status?.status}</span>
                        {t.assignees?.[0] && <span className="task-assignee">{t.assignees[0].username}</span>}
                        {t.due_date && <span className="task-due">{new Date(Number(t.due_date)).toLocaleDateString('ko-KR')}</span>}
                      </div>
                    </div>
                  ))}
                  {cuLoadingMore && <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>}
                  {!cuLoading && !cuLoadingMore && cuHasMore && (
                    <div style={{ padding: '8px 6px' }}>
                      <button className="page-btn" style={{ width: '100%' }} onClick={loadMoreCuPage}>더 보기</button>
                    </div>
                  )}
                </>
              )}
              {cuSubTab === 'my' && (
                <>
                  {cuLoading && <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>}
                  {!cuLoading && myTasksLoaded && myTasksFiltered.length === 0 && <div className="empty-list">담당 태스크가 없습니다.</div>}
                  {!cuLoading && myTasksFiltered.map(t => (
                    <div key={t.id} className={`task-item ${cuDetail?.task?.id === t.id ? 'active' : ''}`} onClick={() => openTask(t.id)}>
                      <div className="task-item-title">{t.name}</div>
                      <div className="task-item-meta">
                        <span className="task-status" style={{ background: t.status?.color || '#666' }}>{t.status?.status}</span>
                        {t.due_date && <span className="task-due">{new Date(Number(t.due_date)).toLocaleDateString('ko-KR')}</span>}
                      </div>
                    </div>
                  ))}
                  {myTasksLoadingMore && <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>}
                  {!cuLoading && !myTasksLoadingMore && myTasksHasMore && (
                    <div style={{ padding: '8px 6px' }}>
                      <button className="page-btn" style={{ width: '100%' }} onClick={loadMoreMyTasks}>더 보기</button>
                    </div>
                  )}
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

          {currentTab === 'chat' && (
            <div className="notes-list">
              {!mmToken && (
                <div className="empty-list">설정에서 Mattermost<br />로그인을 먼저 해주세요.</div>
              )}
              {mmToken && mmLoading && (
                <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>
              )}
              {mmToken && !mmLoading && mmChannels.length === 0 && (
                <div className="empty-list">
                  채널이 없습니다.<br />
                  <button className="btn-search-clickup" style={{ marginTop: '8px' }} onClick={mmLoadChannels}>새로고침</button>
                </div>
              )}
              {mmToken && !mmLoading && mmChannels.map(ch => (
                <div key={ch.id}
                  className={`note-item ${mmSelectedChannel?.id === ch.id ? 'active' : ''}`}
                  onClick={() => mmOpenChannel(ch)}>
                  <div className="note-item-title">
                    {ch.type === 'D' ? '💬 ' : ch.type === 'P' ? '🔒 ' : '# '}
                    {mmChannelDisplayName(ch)}
                  </div>
                  {ch.teamName && <div className="note-item-date">{ch.teamName}</div>}
                </div>
              ))}
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
          (currentTab === 'license' && licSubTab === 'trial' && trialPanel !== null) ||
          (currentTab === 'chat' && mmSelectedChannel !== null)
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
                <button className="btn-search-clickup" style={{ width: 'auto', padding: '0 10px', fontSize: '12px' }} onClick={openCuRegModal}>📋 ClickUp 등록</button>
                <button className="btn-save" onClick={() => autoSaveNote(true)}>저장</button>
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
          {currentTab === 'chat' && !mmSelectedChannel && (
            <div className="editor-empty">
              <div className="editor-empty-icon">💬</div>
              <h3>채널을 선택하세요</h3>
              <p>왼쪽에서 채널을 선택하면<br />대화 내용이 표시됩니다</p>
            </div>
          )}
          {currentTab === 'chat' && mmSelectedChannel && (
            <div className="task-detail" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexShrink: 0 }}>
                <button className="btn-back" style={{ display: 'flex' }} onClick={() => setMmSelectedChannel(null)}>←</button>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>{mmChannelDisplayName(mmSelectedChannel)}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexShrink: 0 }}>
                <input
                  type="date"
                  value={mmDateInput}
                  onChange={e => setMmDateInput(e.target.value)}
                  onClick={e => { try { e.target.showPicker(); } catch {} }}
                  style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '13px', background: 'var(--bg, #fff)', color: 'var(--text, #333)', cursor: 'pointer' }}
                />
                <button className="btn-search-clickup" style={{ width: 'auto', padding: '0 10px', fontSize: '12px' }} onClick={mmSummarizeByDate} disabled={mmDateSummarizing || !mmDateInput}>
                  {mmDateSummarizing ? '⏳' : '✨ 요약하기'}
                </button>
                <button className="btn-search-clickup" style={{ width: 'auto', padding: '0 10px', fontSize: '12px' }} onClick={() => mmOpenChannel(mmSelectedChannel)}>🔃 다시 불러오기</button>
              </div>
              {mmDateSummary && (
                <div style={{ marginBottom: '10px', padding: '12px', borderRadius: '8px', background: 'var(--accent-bg, #e8f0fe)', border: '1px solid var(--accent, #0066cc)', flexShrink: 0 }}>
                  <div style={{ marginBottom: mmDateSummaryCollapsed ? 0 : '6px' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginBottom: '6px' }}>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: 'var(--text, #333)', padding: '2px 7px' }} onClick={() => saveToNote(`${mmChannelDisplayName(mmSelectedChannel)} - ${mmDateInput.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년 $2월 $3일')}`, mmDateSummary)}>📋 메모저장</button>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: 'var(--text, #333)', padding: '2px 7px' }} onClick={mmSummarizeByDate} disabled={mmDateSummarizing}>🔄 다시 요약하기</button>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: 'var(--text, #333)', padding: '2px 7px' }} onClick={() => setMmDateSummaryCollapsed(v => !v)}>{mmDateSummaryCollapsed ? '▼' : '▲'}</button>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: 'var(--text, #333)', padding: '2px 7px' }} onClick={() => setMmDateSummary('')}>✕</button>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>📅 {mmDateInput.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년 $2월 $3일')} 요약</div>
                  </div>
                  {!mmDateSummaryCollapsed && <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{mmDateSummary}</div>}
                </div>
              )}
              {mmPostsLoading && <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>}
              {!mmPostsLoading && mmPosts.length === 0 && <div className="empty-list">메시지가 없습니다.</div>}
              {!mmPostsLoading && (
                <div ref={mmScrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mmPostsHasMore && (
                    <div style={{ padding: '4px 0 8px' }}>
                      {mmLoadingMorePosts
                        ? <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>
                        : <button className="page-btn" style={{ width: '100%' }} onClick={mmLoadMorePosts}>이전 대화 더 보기</button>
                      }
                    </div>
                  )}
                  {mmPosts.map(post => (
                    <div key={post.id} style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary, #f5f5f5)' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent, #0066cc)' }}>
                          {mmUsersCacheRef.current[post.user_id] || post.user_id?.slice(0, 8)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted, #999)' }}>
                          {timeAgo(post.create_at)}
                        </span>
                      </div>
                      {post.message && <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.message}</div>}
                      {post.file_ids?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {post.file_ids.map(fileId => (
                            <MmImage key={fileId} fileId={fileId} token={mmTokenRef.current} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
          <div className="settings-divider">Mattermost 연동</div>
          {mmToken ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '13px', color: '#4caf50' }}>✓ {settingsData.mmUsername || 'Mattermost'} 연동됨</div>
              <button className="btn-logout" style={{ width: '100%' }} onClick={mmLogout}>Mattermost 연동 해제</button>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Mattermost 아이디</label>
                <input type="text" value={settingsData.mmUsername}
                  onChange={e => setSettingsData(p => ({ ...p, mmUsername: e.target.value }))}
                  placeholder="Mattermost 아이디" />
              </div>
              <div className="form-group">
                <label>Mattermost 비밀번호</label>
                <input type="password" value={settingsData.mmPassword}
                  onChange={e => setSettingsData(p => ({ ...p, mmPassword: e.target.value }))}
                  placeholder="Mattermost 비밀번호" />
                <div className="input-hint">저장 시 자동으로 로그인하여 토큰을 갱신합니다</div>
              </div>
            </>
          )}
          <button className="btn-success" onClick={saveProfile}>저장</button>
          <div className={`settings-message ${settingsMsg.type}`}>{settingsMsg.text}</div>
        </div>
      </div>
    </>
  );
}
