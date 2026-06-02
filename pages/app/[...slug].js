import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { sb } from '../../lib/supabase';

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ClickUp Quill Delta 포맷 → HTML
function renderDelta(ops) {
  let html = '';
  let blockContent = '';
  let listType = null;

  function applyInline(text, attrs) {
    let s = escHtml(text);
    if (attrs.code) s = `<code style="background:#f0f0f0;padding:2px 4px;border-radius:3px;font-size:12px">${s}</code>`;
    if (attrs.bold) s = `<strong>${s}</strong>`;
    if (attrs.italic) s = `<em>${s}</em>`;
    if (attrs.underline) s = `<u>${s}</u>`;
    if (attrs.strike) s = `<s>${s}</s>`;
    if (attrs.link) s = `<a href="${escHtml(attrs.link)}" target="_blank" rel="noreferrer" style="color:var(--accent,#0891b2);text-decoration:underline">${s}</a>`;
    return s;
  }

  function closeList() {
    if (listType === 'bullet') { html += '</ul>'; listType = null; }
    else if (listType === 'ordered') { html += '</ol>'; listType = null; }
  }

  function flushBlock(attrs) {
    const content = blockContent;
    blockContent = '';
    const list = attrs.list;
    const header = attrs.header;
    const banner = attrs['advanced-banner'];
    const bannerColor = attrs['advanced-banner-color'];
    const codeBlock = attrs['code-block'];

    if (list) {
      const lt = typeof list === 'string' ? list : (list.list || 'bullet');
      if (lt === 'ordered') {
        if (listType !== 'ordered') { closeList(); html += '<ol style="padding-left:20px;margin:4px 0">'; listType = 'ordered'; }
        html += `<li>${content}</li>`;
      } else {
        if (listType !== 'bullet') { closeList(); html += '<ul style="padding-left:20px;margin:4px 0">'; listType = 'bullet'; }
        html += `<li>${content}</li>`;
      }
    } else {
      closeList();
      if (codeBlock) {
        html += `<pre style="background:#f4f4f4;padding:8px;border-radius:4px;font-size:12px;overflow-x:auto"><code>${content}</code></pre>`;
      } else if (header) {
        const sz = ['', '18px', '16px', '14px'][Math.min(header, 3)] || '13px';
        html += `<p style="font-size:${sz};font-weight:700;margin:8px 0 4px">${content}</p>`;
      } else if (banner) {
        const colors = { green: '#e8f5e9', blue: '#e3f2fd', yellow: '#fffde7', red: '#ffebee', purple: '#f3e5f5', gray: '#f5f5f5' };
        const bg = colors[bannerColor] || '#f5f5f5';
        html += content ? `<div style="background:${bg};border-radius:6px;padding:10px 14px;margin:4px 0">${content}</div>` : '';
      } else {
        html += content ? `<p style="margin:4px 0">${content}</p>` : '';
      }
    }
  }

  for (const op of ops) {
    if (typeof op.insert === 'string') {
      const chars = op.insert;
      const attrs = op.attributes || {};
      let pos = 0;
      while (pos < chars.length) {
        const nl = chars.indexOf('\n', pos);
        if (nl === -1) {
          blockContent += applyInline(chars.slice(pos), attrs);
          break;
        }
        const seg = chars.slice(pos, nl);
        if (seg) blockContent += applyInline(seg, attrs);
        flushBlock(attrs);
        pos = nl + 1;
      }
    } else if (op.insert && typeof op.insert === 'object') {
      if (op.insert.attachment) {
        const att = op.insert.attachment;
        const name = att.name || 'file';
        const url = att.url_w_host || att.url || '';
        blockContent += url
          ? `<a href="${url}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:4px;background:#efefef;padding:3px 8px;border-radius:4px;font-size:12px;color:#333;text-decoration:none;margin:2px">📎 ${escHtml(name)}</a>`
          : `<span style="background:#efefef;padding:3px 8px;border-radius:4px;font-size:12px">📎 ${escHtml(name)}</span>`;
      } else if (op.insert.mention) {
        const m = op.insert.mention;
        blockContent += `<span style="color:var(--accent,#0891b2)">@${escHtml(m.name || m.username || '')}</span>`;
      }
    }
  }

  closeList();
  if (blockContent) html += `<p style="margin:4px 0">${blockContent}</p>`;
  return html;
}

// 콘텐츠 자동 감지 렌더링 (Delta JSON or Markdown)
function renderContent(content) {
  if (!content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const ops = parsed.ops || (Array.isArray(parsed) ? parsed : null);
      if (ops) return renderDelta(ops);
    } catch {}
  }
  return renderMarkdown(content);
}

function renderMarkdown(text) {
  if (!text) return '';
  // 마크다운 → HTML 변환 (링크, 굵게, 코드, 줄바꿈)
  let html = text
    // 코드블록
    .replace(/```[\s\S]*?```/g, m => `<pre style="background:var(--bg-sub,#f4f4f4);padding:8px;border-radius:4px;overflow-x:auto;font-size:12px">${m.slice(3, -3).replace(/</g, '&lt;')}</pre>`)
    // 인라인 코드
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-sub,#f4f4f4);padding:2px 4px;border-radius:3px;font-size:12px">$1</code>')
    // 마크다운 링크 [text](url)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color:var(--accent,#0891b2);text-decoration:underline">$1</a>')
    // 굵게 **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // 이탤릭 *text*
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // 헤딩 ## text
    .replace(/^### (.+)$/gm, '<strong style="font-size:13px">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:14px">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong style="font-size:15px">$1</strong>')
    // bare URL (마크다운 링크로 처리 안 된 것)
    .replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer" style="color:var(--accent,#0891b2);text-decoration:underline">$2</a>')
    // 줄바꿈
    .replace(/\n/g, '<br>');
  return html;
}

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

const PRODUCTS_FIELD_ID = '7ff58f07-8cd6-43ba-98f3-045f8b35f765';
const DEQ_LABEL_MAP = {
  MFO: '37380433-ed62-488a-85a7-75de8ff1dd65', MFM: 'fe56b30c-60d5-4af4-b604-0442c85e1e4e',
  MFT: '4f0d3c0c-b0a9-47b0-be98-f8e39df6491a', MFH: '1ff22cde-5d33-4506-ab0f-98419d9d4d20',
  MFD: '6fc80999-58b5-4d8d-ac63-b932799232f2', MFA: '2cc747cb-4ec8-4d21-b7b8-393e3fbf49a8',
  MFS: '241cfc52-ef33-4792-8002-e5b20c4b5ff9', MFP: '3603f65b-68ec-4426-ad20-e2dc9ed9ed99',
  OSLIB: '304a2e9d-d855-483e-8e51-79cf7cee0603',
  'DFM (Dashboard for maxgauge)': 'a7b8ba2e-a3a1-4ec1-9987-590d443a0a63',
  'DFL (Dashboard for license)': 'adab33f6-8094-428d-99c1-0deb2e31144c',
  SNDF: 'fd59ec23-0c75-4ee1-aa71-75b8d92902d1',
};
const DEQ_LABEL_NAMES = Object.fromEntries(Object.entries(DEQ_LABEL_MAP).map(([k, v]) => [v, k]));
function getTaskProducts(t) {
  const field = t.custom_fields?.find(f => f.id === PRODUCTS_FIELD_ID);
  if (!field?.value?.length) return [];
  return field.value.map(v => {
    if (typeof v === 'string') return DEQ_LABEL_NAMES[v];
    return DEQ_LABEL_NAMES[v.id] || v.label || v.name;
  }).filter(Boolean);
}

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

function getFaqTitle(vals) {
  // HTML 제외, 가장 긴 문자열 = 제목 (날짜/ID 형식 제외)
  let best = '';
  for (const [k, v] of Object.entries(vals)) {
    if (k === 'create_date' || k === 'update_date' || k === 'creator' || k === 'updater') continue;
    if (typeof v === 'string' && !v.includes('<') && !v.startsWith('http') && v.length > best.length
        && !/^\d{8}$/.test(v) && !/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      best = v;
    }
  }
  return best || '(제목 없음)';
}

function getFaqMetaFields(vals, titleStr) {
  const result = [];
  for (const [k, v] of Object.entries(vals)) {
    if (k === 'create_date' || k === 'update_date' || k === 'creator' || k === 'updater') continue;
    if (typeof v !== 'string' || v === titleStr || v.includes('<') || v.startsWith('http') || v.length === 0 || v.length > 100) continue;
    if (/^\d{8}$/.test(v) || /^\d{4}-\d{2}-\d{2}T/.test(v)) continue;
    result.push(v);
  }
  return result;
}

function getFaqBodySections(vals, titleStr, metaFields) {
  // 본문 섹션: HTML 필드 또는 100자 초과 평문 필드 전부 수집 (순서 유지)
  const metaSet = new Set(metaFields);
  const sections = [];
  for (const [k, v] of Object.entries(vals)) {
    if (k === 'create_date' || k === 'update_date' || k === 'creator' || k === 'updater') continue;
    if (typeof v !== 'string' || v === titleStr || metaSet.has(v) || v.length === 0) continue;
    if (/^\d{8}$/.test(v) || /^\d{4}-\d{2}-\d{2}T/.test(v) || v.startsWith('http')) continue;
    if (v.includes('<') || v.length > 100) sections.push({ html: v.includes('<'), content: v });
  }
  return sections;
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
  const [cuAppendDesc, setCuAppendDesc] = useState('');
  const [cuDescSaving, setCuDescSaving] = useState(false);
  const [cuAttachSaving, setCuAttachSaving] = useState(false);
  const cuAttachInputRef = useRef(null);
  const cuMyUserRef = useRef(null);

  const [cuDocInput, setCuDocInput] = useState('');
  const [cuDocPanel, setCuDocPanel] = useState(null);

  const [licSubTab, setLicSubTab] = useState('my');
  const [licenseTasks, setLicenseTasks] = useState([]);
  const [currentLicTaskId, setCurrentLicTaskId] = useState(null);
  const [licDetail, setLicDetail] = useState(null);
  const [trialDocId, setTrialDocId] = useState('rbeb5-147183');
  const [trialPages, setTrialPages] = useState(null);
  const [trialSelectedQuarter, setTrialSelectedQuarter] = useState(null);
  const [trialPanel, setTrialPanel] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsData, setSettingsData] = useState({ username: '', displayName: '', newPassword: '', clickupToken: '', mmUsername: '', mmPassword: '', mmToken: '', gwSession: '' });
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
  const [mmDateInputs, setMmDateInputs] = useState({});
  const [mmDateImageIds, setMmDateImageIds] = useState({});
  const [mmDateSummary, setMmDateSummary] = useState({});
  const [mmDateSummarizing, setMmDateSummarizing] = useState(false);
  const [mmDateSummaryCollapsed, setMmDateSummaryCollapsed] = useState({});
  const [mmLoginForm, setMmLoginForm] = useState({ username: '', password: '' });
  const [mmLoginMsg, setMmLoginMsg] = useState('');
  const [cuCommentModal, setCuCommentModal] = useState(null);
  const [cuCommentSearch, setCuCommentSearch] = useState('');
  const [cuCommentSearching, setCuCommentSearching] = useState(false);
  const [cuCommentPosting, setCuCommentPosting] = useState(false);

  const [gwSession, setGwSession] = useState('');
  const gwSessionRef = useRef('');
  const [faqList, setFaqList] = useState([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqDetail, setFaqDetail] = useState(null);
  const [faqDetailLoading, setFaqDetailLoading] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');
  const [faqPage, setFaqPage] = useState(0);
  const [faqHasMore, setFaqHasMore] = useState(false);
  const faqAllItemsRef = useRef([]);
  const faqAllLoadedRef = useRef(false);

  const DEQ_LISTS = {
    MFO: '900303022977', MFT: '900303031749', MFA: '900303116533',
    MFD: '900303116531', MFS: '900303116541', MFM: '900303116526',
    MFP: '900303164467', MFH: '900303116521', Dashboard: '901804149604',
  };
  const DEQ_LIST_NAMES = Object.fromEntries(Object.entries(DEQ_LISTS).map(([k, v]) => [v, k]));
  const TEAM_IN_CHARGE = {
    MFO: 8, MFD: 8, MFT: 8, MFA: 8,
    MFM: 7, MFH: 7, MFP: 7, MFS: 7,
  };
  const DEQ_PRODUCT_LABELS = {
    MFO: '37380433-ed62-488a-85a7-75de8ff1dd65',
    MFM: 'fe56b30c-60d5-4af4-b604-0442c85e1e4e',
    MFT: '4f0d3c0c-b0a9-47b0-be98-f8e39df6491a',
    MFH: '1ff22cde-5d33-4506-ab0f-98419d9d4d20',
    MFD: '6fc80999-58b5-4d8d-ac63-b932799232f2',
    MFA: '2cc747cb-4ec8-4d21-b7b8-393e3fbf49a8',
    MFS: '241cfc52-ef33-4792-8002-e5b20c4b5ff9',
    MFP: '3603f65b-68ec-4426-ad20-e2dc9ed9ed99',
    OSLIB: '304a2e9d-d855-483e-8e51-79cf7cee0603',
    'DFM (Dashboard for maxgauge)': 'a7b8ba2e-a3a1-4ec1-9987-590d443a0a63',
    'DFL (Dashboard for license)': 'adab33f6-8094-428d-99c1-0deb2e31144c',
    SNDF: 'fd59ec23-0c75-4ee1-aa71-75b8d92902d1',
  };
  const DEQ_CUSTOMERS = [{"id":"a5411657-ddb6-41ff-a0df-2c8b65bff602","name":"엑셈"},{"id":"a6896010-d819-4cdd-ad43-725582d7a12e","name":"연차"},{"id":"eb71a861-fc96-4b08-9852-c34de454b09b","name":"반차"},{"id":"888601a3-2f93-49cf-afaf-8ff1c87591bb","name":"반반차"},{"id":"e683d3f6-e858-4238-9989-4c21a29afd2f","name":"대휴"},{"id":"5c0a5ede-05ee-4181-a8d1-91d8211b9da8","name":"고객사추가필요"},{"id":"ba22287b-9706-4dff-84a4-0d38b8787efd","name":"기타고객사"},{"id":"582db9a9-e7c8-47b5-9fc1-6eba3fe8b66b","name":"ABL생명"},{"id":"9ec0cc93-25aa-4a5e-a4fb-cf51214ddcbc","name":"AIG손해보험"},{"id":"89f56874-374b-4ee2-bad6-82ef5cc4824b","name":"AXA손해보험(구.AXA다이렉트)"},{"id":"2a952a32-4fa8-4849-8344-d2e73842854b","name":"BC카드"},{"id":"8c5c62ba-b382-43ee-b77d-9b13f540f0d0","name":"BGF네트웍스"},{"id":"a534334f-ce87-4d79-84e8-8df4af6512b9","name":"BGF리테일"},{"id":"49cf1e7b-1ce6-4da3-b661-d6de55601faa","name":"BNK캐피탈"},{"id":"e1ce192e-e7dc-4cf0-8d9b-0ba946737163","name":"CJ제일제당"},{"id":"5792838e-2666-47f3-a40a-8aeadcc1d435","name":"CJCGV"},{"id":"0b9ab850-5d88-48bc-8e01-b85389622370","name":"CJONE"},{"id":"1711c5e6-9e70-43af-9fe5-21acacbbb432","name":"CJ올리브네트웍스"},{"id":"0e182823-bef2-43f9-bc46-eac4e64f86ae","name":"DA인포메이션"},{"id":"68bd8709-80d4-4c9f-b855-adfb6ad82ccb","name":"DB생명보험(구.DB생명)"},{"id":"89e0fdd1-ff66-4f2e-a932-024628d3cc86","name":"DB손해보험"},{"id":"0032a3ce-24b8-40d6-adc9-9d5ea71d5bfb","name":"GIT"},{"id":"e7e1f57d-58f0-4d01-b7c4-558833097d76","name":"그랜드코리아레저(GKL)"},{"id":"b32b6a94-b344-4807-b21c-80e6793ac8e3","name":"GLN"},{"id":"a72f1db8-67c0-4eef-8a71-d7f92daf4adc","name":"GS홈쇼핑"},{"id":"0c4c4847-05c7-4209-9665-0f3f215fe72d","name":"IBK기업은행"},{"id":"5d5a1a9d-4423-46c4-bcfc-8ad36f8b85a7","name":"IBK연금보험"},{"id":"c0dbc43f-cb01-40d4-9731-d8444f812593","name":"KB국민은행"},{"id":"5052cceb-f953-4c85-8e3c-7ecc36cf84c7","name":"KB손해보험"},{"id":"de380e7c-6566-4854-a28f-7c8b82831d4e","name":"KB증권"},{"id":"fd58faa2-735c-403e-a408-34dc5b9b9e3e","name":"KB캐피탈"},{"id":"cda9bbf9-0c9f-4cae-aa6b-c80947f1085c","name":"KCB"},{"id":"14829161-efb3-472c-b1ae-d82f52cb691b","name":"KCC"},{"id":"686e25cc-2202-4688-a029-b8eaec2fced6","name":"KCC글라스"},{"id":"0f6bd9f8-11b8-409f-bf53-bf35efb4b76b","name":"KCG(KCC건설)"},{"id":"f76f2fec-737f-4cdb-8a6c-e4fa57ee0787","name":"KDB산업은행"},{"id":"8a51a47b-3d8b-44ec-9ca1-df6df8ff6e51","name":"KDB생명"},{"id":"1b636088-2e3e-4b6c-867d-a7cc10cc6d21","name":"KEC반도체"},{"id":"8abd3bb9-70b3-44d4-8672-4852cfb08b68","name":"KG이니시스"},{"id":"7eccee4e-8731-49cd-ae02-8c6b27a55368","name":"KIS정보통신(구.키스정보통신)"},{"id":"c8b57b5e-47cd-4a2b-a696-fc4580e4564e","name":"KLNET"},{"id":"930820ae-ce40-424e-a793-54bf835b0cc3","name":"한국거래소(KRX)"},{"id":"df73659a-3a2a-4440-80ae-0c2da41be66d","name":"KT"},{"id":"2bc8efc7-cd9b-4908-8e6b-502c7d700f88","name":"다올투자증권(구,KTB투자증권)"},{"id":"1e0efd2b-a82b-4ca7-9fc2-5647b8265949","name":"KTH"},{"id":"3f60fb29-3515-4d90-b02e-18388ff30526","name":"LF"},{"id":"d1d57bee-0368-4bc8-86b7-b602198388cb","name":"LG디스플레이"},{"id":"dc6817de-0957-4849-89f5-e26735fa73b5","name":"LG에너지솔루션"},{"id":"0bf4b4d1-5c16-4444-873e-49fa33328966","name":"LH공사"},{"id":"2cb406e7-e1c4-4566-92d6-5e8b87ce67e0","name":"MG손해보험"},{"id":"186c4fb4-452f-4cfe-b1a2-67121756cd85","name":"NHN한국사이버결제(KCP)"},{"id":"986b9473-020c-4a1e-bfae-e07b9090fd7d","name":"NH농협생명(구.NH생명)"},{"id":"7961792b-ed21-4387-a8cf-875fd36ac71e","name":"NICE"},{"id":"997d7636-6d6f-4ba3-ab7a-7c474b769651","name":"OK데이터시스템"},{"id":"1ecd0718-eb91-4fac-a9d0-7c0311a73494","name":"SBI저축은행"},{"id":"56c6c7d9-dfb5-4058-925b-7defec056d5d","name":"SC제일은행"},{"id":"d47a212d-dbce-4670-871f-9086bea05023","name":"SK브로드밴드"},{"id":"4e211577-3e9c-4fa6-9d9a-21111c9953a3","name":"SKT"},{"id":"66a44766-8378-4c2e-a02a-f3e712f78f4d","name":"엔카닷컴(구.SK엔카닷컴)"},{"id":"503bd762-d477-45b6-a3a6-b663510d19dc","name":"SK증권"},{"id":"d0a92b53-0812-4f8e-9dc1-f5e25a61413f","name":"핀크(SK핀테크)"},{"id":"b4bf089d-ae00-485c-9e9f-fd540102df4f","name":"SK하이닉스"},{"id":"9548210a-ad98-404e-b9e8-38828e2e0686","name":"섹타나인(구,SPC네트워크)"},{"id":"f3141d14-4007-42d5-a31f-9b1ec2a2ad9b","name":"SR(수서고속)"},{"id":"0a7f8b73-d6a9-43ec-b3a8-ecdb0ccc0c72","name":"VP"},{"id":"faabf274-2cef-4299-a589-8c0fca41fc73","name":"강원대학교"},{"id":"af94038a-f61f-4c3e-a529-c36e1e2dd940","name":"강원대학교병원"},{"id":"c49c29d2-8a3d-442c-bef5-850da09df987","name":"건국대학교"},{"id":"d88a9a9c-21c5-4572-9b70-a2740f4b1b8e","name":"건설공제조합"},{"id":"d1b07e83-bfd4-42e0-93a7-5db8e43c6a92","name":"경기도교통정보센터"},{"id":"a221f483-21c3-46ca-b848-e02135c78e6e","name":"경기도청"},{"id":"2164a1ce-1163-4b16-95be-dc8989bee47a","name":"경기신용보증재단"},{"id":"63e0e90d-8c35-4919-b3e9-c22caec292c2","name":"경남에너지"},{"id":"a22f6012-fabc-41c7-ac42-bbd6abbe0cfa","name":"경남은행"},{"id":"ff0322b1-15e9-4366-b00b-198f35e3a96f","name":"창원경상대학교병원"},{"id":"c7768cce-7491-49d4-afd5-bf815473b694","name":"고려대학교의료원(구.고대의료원)"},{"id":"7cd69a2c-384a-4b3c-af90-5d2496f58f1a","name":"고려해운"},{"id":"ea13d4bd-8de9-4474-b25f-c6d13df05dd3","name":"공무원연금공단"},{"id":"b2fef2e2-c7bb-4901-ba6a-74f32c2e6370","name":"관세청"},{"id":"bed9591c-4391-4558-8d80-0b4c9e6e8886","name":"교보문고"},{"id":"ad231d6a-5d13-46ff-8588-5a38cfd59355","name":"교보증권"},{"id":"8212fd3c-9df1-43f2-9b42-886f7bea610d","name":"행정안전부(국가재난망)"},{"id":"92649cc1-1dbf-4f80-9e5c-654432552f3a","name":"국립대학교"},{"id":"68eed181-52b6-4c9b-bde5-b298492c1c0d","name":"국립중앙의료원"},{"id":"dc48b81e-3715-4ec6-bef2-5cae224a7cdf","name":"국민권익위원회"},{"id":"9a560cdf-3dad-4dba-a469-f2b447e9d719","name":"국민연금공단"},{"id":"c6c90b2e-03e0-4024-ac79-441a38151388","name":"KB국민카드(구.국민카드)"},{"id":"b59095fc-d808-41f3-b360-f4e7d239a0b8","name":"국방과학연구소"},{"id":"fbff21da-a227-4e5c-ac64-855a99ee0563","name":"국방부"},{"id":"d2fa2a1b-0407-467f-a3d0-d404c8779bd2","name":"국세청"},{"id":"44d4bc4a-f4ec-4c62-9da8-03773f5c1fb2","name":"군사안보지원사령부"},{"id":"aa6f147a-2676-4ada-8891-6ba04c512f99","name":"군인공제회"},{"id":"f3703851-6eec-4708-b584-dd5d49eb97a2","name":"금융결제원"},{"id":"b7ff2e72-e82e-454d-8fe9-df347b780e88","name":"금융투자협회"},{"id":"b7d49808-eb11-44c7-bc15-cfdff6deb530","name":"기술보증기금"},{"id":"e0f7d99a-8ebe-44c3-ab8a-6fa8032f258a","name":"기획재정부"},{"id":"cd4427ef-832f-4409-aed9-9620b263084c","name":"가천대길병원"},{"id":"a342f67a-5724-4571-8d9b-faad0b15f6d3","name":"나이키코리아"},{"id":"106ff8c0-24ac-4a41-b8b2-e00f3274d72f","name":"네이버"},{"id":"1e2b1e23-c756-47a1-9d32-a2bf4f9d8920","name":"녹십자"},{"id":"e8de7ac3-2865-4fd9-8821-985a06cd6032","name":"농협몰"},{"id":"05880d3b-a16a-4110-9f01-92e0ee6703b9","name":"농림수산업자신용보증기금"},{"id":"2930bbe5-2ab6-4c13-b53c-1979700f6c3b","name":"농협정보시스템"},{"id":"57429342-8759-4961-9e8e-8e45c456c270","name":"농협경제지주(구.농협하나로마트/농협하나로유통)"},{"id":"8fe55210-a171-4691-8671-c7d0f788d897","name":"다스"},{"id":"c7a07f36-b51a-480b-9732-34215e51e80c","name":"단국대학교"},{"id":"c6738d21-6d12-423e-8c00-09ec63edb8aa","name":"대구은행"},{"id":"cd06bdec-7c44-4683-b283-b3162565a3af","name":"대림그룹(구,대림산업)"},{"id":"06ac0794-827b-4235-9bd7-f3de54529e62","name":"대법원"},{"id":"6e510a0d-be0b-456c-abdd-c4ba92e37e4e","name":"대성산업(구.대성그룹)"},{"id":"79059042-c087-460a-92d0-a088e0580168","name":"대신증권"},{"id":"917cf902-5b6e-42ec-8720-f29ea61eb05a","name":"대우건설"},{"id":"05c50d51-d471-4c26-96f7-8cbd37d716c6","name":"한화오션(구,대우조선해양)"},{"id":"a62f083c-7adb-43fc-98be-922f5e92f0cf","name":"대한지방행정공제회"},{"id":"5570ef0e-edba-4091-8072-6794a0457d8a","name":"더블유쇼핑"},{"id":"9fc7fb14-365d-489b-91d1-b1e7b59193a8","name":"더즌"},{"id":"abe1c516-901a-45e1-950d-fb557d14f99a","name":"도로교통공단"},{"id":"d47dc407-2f6b-42cc-9572-3bfe99857afa","name":"동국대의료원(동국대학교일산병원)"},{"id":"e2013b87-3433-4174-8aed-fde13b71bbc2","name":"동국대학교"},{"id":"8fcc6bf4-1a3d-43ac-b422-ec0e1f515f8d","name":"DB금융투자(구.동부증권)"},{"id":"9c1ba443-611f-49b0-b465-d6c9d45c7670","name":"DB하이텍(구.동부하이텍)"},{"id":"9ad94dbb-51bd-4d68-91c7-602b4b65fc38","name":"한국동서발전"},{"id":"9776af42-5b98-4d56-8216-79627b18a1cb","name":"동양생명보험(구.동양생명)"},{"id":"6e69261e-be18-4980-bd72-41ec8b4e2871","name":"동원그룹(구.동원)"},{"id":"6e111e81-ddf3-4bbb-ab37-30b48f3b1e3e","name":"라이나금융서비스"},{"id":"508f6ee5-8c41-45f1-95a5-d987981704ca","name":"라이나생명"},{"id":"505eb136-b6c5-4333-978d-2ed4182f927c","name":"로젠택배"},{"id":"693d16b6-7d4a-477a-8f0e-e2875a19a7f3","name":"롯데e커머스"},{"id":"62df50ea-3d6c-4291-a540-5994f3ca7f92","name":"롯데글로벌로지스"},{"id":"8614194c-572d-4c23-88c7-bd8d64f28950","name":"롯데렌탈"},{"id":"2068ff58-aac6-4b74-8349-809e2322273f","name":"롯데마트"},{"id":"d2704d40-735e-4203-8912-aae1b610c3d8","name":"롯데백화점"},{"id":"a293d34e-c690-46eb-baf3-fb0704cf5b05","name":"롯데손해보험"},{"id":"8fc0cf05-716e-452d-acea-3f3daede1d65","name":"롯데캐피탈"},{"id":"627a5eaf-4d6f-4f0e-9832-0ca875856e3b","name":"롯데하이마트"},{"id":"29d3f8d8-76f2-4a6b-ba4f-bd1b9cd53393","name":"롯데홈쇼핑"},{"id":"5494141b-d757-4928-919c-70db37ab9920","name":"마켓컬리"},{"id":"3e8747c5-2693-45ec-b901-97b792ef778e","name":"메리츠증권"},{"id":"1c1538eb-bc50-4707-9f2d-af21c7302161","name":"메리츠화재"},{"id":"6c62e8a9-a0ee-4ce8-8340-f275d4b5e699","name":"메트라이프"},{"id":"68317292-77fe-40be-9d4b-c65524bddd51","name":"미니스톱"},{"id":"5f4bd043-473f-4c92-94ec-c1e2a0b2b23f","name":"미래에셋증권(구.미래에섯대우)"},{"id":"3053864a-7c0f-48e5-b2ab-762b00888fb9","name":"미래에셋생명"},{"id":"cdbc9a23-2bfd-420f-b319-2fe53ac6e1cd","name":"한국방송통신대학교"},{"id":"9391e5c6-d8fd-474b-bbeb-adc6a6ff2232","name":"방위사업청"},{"id":"27a52601-6dfc-4aff-86d6-0680da71795f","name":"법무부"},{"id":"bc94d4b3-f6ce-4a00-99ac-77b9748ebc5b","name":"서울보호관찰소"},{"id":"7373b7fc-af1b-4f12-ad99-d332af795667","name":"부산대학교병원"},{"id":"c327854f-0485-4dd6-8b7e-90eef1b8e2f1","name":"부산신항만(PNC)"},{"id":"03778a0e-06a4-4ddb-97e4-ecc359469616","name":"부산은행"},{"id":"ab75b9ad-c068-42ba-ad7b-5529e1817aa3","name":"비지니스링커시스템"},{"id":"f8f7b2f3-c5fb-4428-8bff-3ae14d9257e3","name":"빗썸코리아"},{"id":"3c724cb3-dece-4e45-8910-e7bb16b60adb","name":"빙그레"},{"id":"522d841f-f2e1-421c-967d-7cac247b3a00","name":"사이버로지텍"},{"id":"3a6515e0-9679-4569-a848-cff93575d437","name":"산림조합중앙회"},{"id":"f92f2d53-e72c-4ac5-be9b-bd2f2aa3a460","name":"산업안전보건공단"},{"id":"67181978-a537-433e-a205-03bbfd92103e","name":"삼성디스플레이"},{"id":"36d6c623-ce52-49a0-b5fc-ad3b173a481f","name":"삼성SDI"},{"id":"fd6e5efd-9ba7-4a07-94b4-ccdb06e43655","name":"삼성SDS"},{"id":"6084b0e9-0de4-45c3-a254-13a2448a8c7e","name":"삼성닷컴"},{"id":"df7c4fba-8a60-4704-8e1b-469a90dceb2b","name":"삼성반도체"},{"id":"d32cc844-2006-4d10-a644-783bea158dc2","name":"강북삼성병원"},{"id":"99daacee-b306-4efa-9a42-db0a25209b04","name":"삼성생명"},{"id":"7d81740d-8a79-4239-bf88-8ad8e90724a7","name":"삼성웰스토리"},{"id":"8baab507-df51-4022-8c98-df07929e4699","name":"삼성인력개발원"},{"id":"7a562439-9049-4dab-aaf3-215d22836e03","name":"삼성전기"},{"id":"40e065c9-fc9f-405d-9ca8-7dd2b52faa6e","name":"삼성전자"},{"id":"6060882b-216e-4f2b-bfd2-514bc206a8f2","name":"삼성증권"},{"id":"db0ea50d-cca5-44a5-9dbc-673500edd8db","name":"삼성카드"},{"id":"1f99cb5c-b95d-4839-a162-cdcaf5d6182a","name":"삼성화재"},{"id":"d03f9101-536a-468f-a14b-c4a622d89191","name":"상수도사업부"},{"id":"efa49347-f68d-4214-bf07-22a11d65666a","name":"새마을금고"},{"id":"b99de2c9-3f16-4745-8d56-144424e15043","name":"서민금융진흥원"},{"id":"981932db-671f-4bcc-bb35-b28f9911dd8d","name":"서울대학교병원"},{"id":"5a369970-36fd-426e-8348-38dc43447c44","name":"서울대학교"},{"id":"2107cbeb-8dbf-4a9e-89cb-27011d5d6a38","name":"서울동부병원"},{"id":"17e053f9-f32d-489f-9cc2-ff2f87d62393","name":"서울보증보험"},{"id":"4a3bbe1a-8adb-4c56-aa46-7a0b9684ca85","name":"서울시데이터센터"},{"id":"1d640ebf-ea63-48c9-b53c-33693632d841","name":"서울시청"},{"id":"51fed032-3d7c-4c2e-834f-df37e1895406","name":"서울우유"},{"id":"3d057650-929e-429c-aa47-8b926bfb0a38","name":"서울주택도시공사"},{"id":"92900e36-a320-48ce-a143-e384afd3c2d5","name":"성모병원"},{"id":"e3728281-057e-4cf3-b37f-0d2f4812b393","name":"핵토파이낸셜(구.세틀뱅크)"},{"id":"7db41fe5-c264-4018-be85-b9b5962bea85","name":"서울종합방재센터(구.소방방재청)"},{"id":"be89b2a2-df25-429d-ad84-18690e0c715d","name":"손해보험협회"},{"id":"7b2b8848-b0aa-4650-9aad-cb7ae1074402","name":"한국수자원공사"},{"id":"4458a664-e9eb-400c-a656-4e5a36516e39","name":"스마트로"},{"id":"fa7c50d9-f3f0-493a-9e05-dc22d0289d03","name":"케이토토(구.스포츠토토)"},{"id":"a7699f70-e0ba-447c-9e90-7a112fcafc46","name":"쓱닷컴(SSG.COM)"},{"id":"0b34b6b1-8aea-4b49-bfd6-4ac1d9824870","name":"신세계I&C"},{"id":"d78a8c09-c08d-43ec-b1dd-91782579dd14","name":"네파"},{"id":"1033c2de-a1a3-4fda-a21e-1faa15b1ecd9","name":"신영증권"},{"id":"be2d0a22-083f-446b-bb1b-f71b2288e686","name":"신용보증기금"},{"id":"1cd8e156-835c-46c3-bbaa-7d8851fbc639","name":"신용보증재단중앙회"},{"id":"eab33227-1f60-4b3c-a109-095ee3e3d71e","name":"신용회복위원회"},{"id":"395640c6-3548-432b-9ff6-4172bb0003c6","name":"신한투자증권(구.신한금융투자)"},{"id":"45231106-48f6-4e9f-9c4e-a3f7442c552b","name":"신한라이프"},{"id":"a8d71e89-d69a-4913-b05e-a27d7f083553","name":"신한은행"},{"id":"22db2d4a-85fc-43b6-b37c-1141cb474801","name":"신한저축은행"},{"id":"c4b0bac3-3073-4a99-9a2f-f1ee455f22dc","name":"신한캐피탈"},{"id":"c050a045-ff51-4c14-9c91-978e56decf39","name":"아모레퍼시픽"},{"id":"9d316a1f-32c0-4808-a241-231d732a7924","name":"서울아산병원"},{"id":"e7219b78-b0ed-4613-9e10-f03c62b6dd50","name":"아시아나항공"},{"id":"30b0c573-2800-4c88-8355-eb0578a6140a","name":"아이마켓코리아"},{"id":"8b55c1c3-a0ca-4855-a817-c61996d40086","name":"안랩"},{"id":"10d573ac-0efc-4e73-a7ba-53b5dd9651d3","name":"엔투비"},{"id":"6d606c21-acc4-420e-a2da-7456094e2afe","name":"여신금융협회"},{"id":"ed626ca7-e4c9-4e95-807b-4ef8f26515f3","name":"영원아웃도어"},{"id":"7382529a-2f7c-4502-a802-104c69a302f9","name":"예금보험공사"},{"id":"fdfcc883-42de-4232-9007-93ac41a90878","name":"예탁결제원"},{"id":"5cdacb78-331e-4751-83bb-30b0ff6248c6","name":"우리금융캐피탈"},{"id":"a5689226-4b24-412d-9938-029370421a9c","name":"우리은행"},{"id":"40575743-680d-41cc-aac8-a0fa2b1d2d29","name":"우리카드"},{"id":"59aef537-1843-474f-8bd9-7300eb51ad83","name":"우체국금융"},{"id":"8786a985-938f-49d2-9f11-be77fbc1ec49","name":"위메프"},{"id":"ba72c095-b14e-4a0a-a64e-d3057783aeb0","name":"윤선생영어교실"},{"id":"349ae100-df08-42bc-9db3-6a8fbbf55f15","name":"이마트"},{"id":"25df0a95-e2ed-4794-ae69-4fa701a9e0b9","name":"LS증권(구.이베스트투자증권)"},{"id":"27b4cf63-fd9d-4792-935c-51df07216667","name":"지마켓"},{"id":"90c63100-9436-4a89-bc17-10a03b350a3d","name":"이지스엔터프라이즈"},{"id":"46a29cb4-614d-4008-a7b0-7f040904ab5d","name":"인천국제공항공사"},{"id":"afdd4f62-f74f-422b-abd0-7d09092745e8","name":"인하대학교"},{"id":"55100871-eb7f-46c2-8753-ec5f2ba4c09e","name":"국민건강보험공단 일산병원"},{"id":"1cc42dfe-1a46-4afe-af8e-573515857fc7","name":"저축은행중앙회"},{"id":"8aeed9ea-b5fa-4060-ae44-fec53c1ebe17","name":"대한적십자사"},{"id":"827e7dd2-92e9-411a-9845-9276adc916b5","name":"한국전력거래소"},{"id":"a231c619-f8b1-4f70-9082-826b039d3478","name":"전북대학교병원"},{"id":"7649d9b7-0032-4398-a06a-df216f6fe022","name":"제이티넷"},{"id":"3bbe73e2-e6f6-40b4-97e1-abb44c3ee0f1","name":"제주항공"},{"id":"11b97859-ff30-403d-ac9c-33a139e34445","name":"중앙그룹(구.조인스)"},{"id":"af817343-9a1c-45f2-a94f-d83636cb2833","name":"한국주택금융공사"},{"id":"9f08ca33-4f55-4474-9cd5-a1599e2491a3","name":"한국중부발전"},{"id":"083fdc1a-a677-4699-ba4d-f1ccca02be2a","name":"중소벤처기업진흥공단"},{"id":"bb540f8b-1262-41c0-91cc-ef65071064ff","name":"중앙대학교"},{"id":"b47477be-1cf5-4ac9-a3b8-b677c3781020","name":"중앙대학교병원"},{"id":"02c4bef6-096a-4d34-b7d3-67b667676784","name":"중앙보훈병원"},{"id":"c1a2a88a-afe1-4759-b8a3-f2c322097583","name":"한국지역정보개발원"},{"id":"d62575a2-ece6-4c98-94bd-dc55c1e23f56","name":"청호나이스"},{"id":"1517b748-517e-455f-8f26-cddb68b20fa9","name":"축산물품질평가원"},{"id":"379cc84c-0eff-4391-92cd-bf46990b7ece","name":"충남대학교병원"},{"id":"74c0bbd9-ad04-47fd-a46a-b4aa1735497d","name":"JT친애저축은행(구.친애저축은행)"},{"id":"3be8f72b-3343-446a-b10b-f2d8574139ee","name":"카카오뱅크"},{"id":"3a8b9c2d-3e13-4624-893d-f3fb26e2ce44","name":"카카오페이"},{"id":"5a8fa101-7a79-47d5-a8cd-a6187dfe2d96","name":"코나아이"},{"id":"07b07df0-0ba8-4a76-b60f-2d268725df99","name":"한국철도공사(구.코레일)"},{"id":"da483509-ac37-423a-b054-737e4acd6dd9","name":"코리아세븐"},{"id":"631dd83c-6d3f-4e97-a4bc-ec9bc2cba9bd","name":"코스콤"},{"id":"27980c24-aba9-4d44-a99b-57cca864ac14","name":"코오롱그룹(구.코오롱베니트)"},{"id":"82185b6a-cf2e-4655-9d9d-18132ab79d25","name":"쿠팡"},{"id":"d1a14698-98ca-4425-8da5-fed4552424ee","name":"크린토피아"},{"id":"1db3f494-f446-4334-998d-7476006abe83","name":"KIS자산평가(구.키스채권평가)"},{"id":"c4562cf5-e5d2-4409-b4c8-48a0807b4a79","name":"키파운드리"},{"id":"b19aab9f-d44c-4fbf-b74c-88b0d827fcfd","name":"타임교육"},{"id":"04414244-f85f-473e-9669-5bc37c51fb40","name":"택시유가보조금"},{"id":"ed40e664-4aea-4e47-bfef-47d55f2fdf1f","name":"토스CX"},{"id":"5a443175-0540-41ae-8e77-a86705c064aa","name":"토스뱅크"},{"id":"8267dd2a-00cd-4ec5-8bc5-07de919a8614","name":"토스증권"},{"id":"486d4eaa-6c99-4651-b876-f7643ac22e46","name":"통계청"},{"id":"c89b51da-4f62-4b7c-af6d-91812896d6df","name":"티머니"},{"id":"665c8107-67d3-4508-85b2-01a64e027639","name":"티알엔"},{"id":"2e3c183f-32e9-4da8-be91-217392cea8f2","name":"파주시청"},{"id":"683b3188-b3b3-4396-bc0e-d0db0401cdc5","name":"퍼스트데이터(FDK)"},{"id":"7d0ab5b3-71b5-4da6-8f8a-08218589df7d","name":"포스코대우"},{"id":"770bd0fe-667a-4d0d-a677-c949e4c18335","name":"폭스바겐"},{"id":"fb4d628f-b427-4342-81aa-fabfeeef1277","name":"푸디스트"},{"id":"e47eabab-1024-4aa5-8c23-974e3a626473","name":"KB라이프생명(구,푸르덴셜생명)"},{"id":"2d986d37-1405-4b05-8034-d46ad993b13b","name":"하나증권(구.하나대투증권)"},{"id":"9607fe8a-869f-412e-8f11-daa6c67e8ddc","name":"하나머니(구,하나멤버스)"},{"id":"61e43727-51a2-4ea6-bd15-767072997518","name":"하나생명"},{"id":"e1fd8f33-87fd-4999-9d40-366a7678b4c5","name":"하나은행"},{"id":"205b2e2d-5420-4959-bf02-9611f63a7ed9","name":"하나저축은행"},{"id":"c1c1cd22-4f38-4963-9fa6-3c93a0f20bd9","name":"하나카드"},{"id":"6f7b78b8-fc7a-4f79-b1e7-461d92eb81db","name":"하나캐피탈"},{"id":"1ffeef1e-ba86-4370-826d-b40c96e652fe","name":"하이투자증권"},{"id":"5eaeb6d5-e129-4a76-85c2-38d0246ef6e1","name":"하이트진로"},{"id":"1da6e650-08f4-4078-9d74-030a1b51ca2a","name":"한국가스공사"},{"id":"8c9b71b8-e30c-479d-9cc5-b2d91e80a976","name":"한국건설기술연구원"},{"id":"68c8b8e2-ef0f-4871-a7ce-4be11427d2c9","name":"한국고용정보원"},{"id":"6e6e1685-506c-4d6b-9c07-697136b94645","name":"한국평가데이터(구.한국기업데이터)"},{"id":"3420188d-73bc-4e8d-b939-b401733c5215","name":"한국노인인력개발원"},{"id":"40b39875-3db2-42d3-b688-1a29ecba0327","name":"한국농어촌공사"},{"id":"9472149f-c550-4250-bf96-b77c94018337","name":"한국대학교육협의회"},{"id":"935d4c8d-6d78-4b26-a409-4800cc036ca1","name":"한국도로공사"},{"id":"801bd3a2-2a2d-4f20-824c-fd4b4cea3635","name":"한국마사회"},{"id":"9b9f7127-72c0-49f1-bd36-0a82a043f1ea","name":"KTNET(구.한국무역정보통신)"},{"id":"27cde653-3bb3-4fbc-93b0-a2ddf85dcbc5","name":"한국방송공사"},{"id":"30613b7a-b063-4b59-b443-b29f00abeefe","name":"한국방송광고진흥공사"},{"id":"faf250c7-33bc-4f34-a175-8c66f21f3d78","name":"한국보건산업진흥원"},{"id":"944f9ad6-bbe0-428e-9010-79534ee6ced5","name":"한국산업기술평가관리원"},{"id":"ab52a8e5-6b67-4ae8-8090-5e8dd213b7be","name":"한국산업기술시험원"},{"id":"4a808338-e61b-4576-bf4f-187114ed427c","name":"한국수출입은행"},{"id":"b17464ed-0768-4f2a-970f-ba18a46ecdd3","name":"한국승강기안전공단"},{"id":"2de07de8-6ee8-455e-b09b-fc77d497545f","name":"한국신용정보원"},{"id":"6ead3466-1f7f-402a-8c90-2b8e915e5d5b","name":"한국신용카드결제"},{"id":"0296c751-bf69-4ea7-9cfb-436c445c98cf","name":"한국연구재단"},{"id":"776d2d67-dc17-4505-abf2-de323f73b80a","name":"한국외식업중앙회"},{"id":"d84ed5a3-cc43-46e0-8ca8-44bca6d6f9f3","name":"한국은행"},{"id":"55805de3-2926-4a15-ad51-d1406e25e3fe","name":"한국인터넷진흥원"},{"id":"51d3feac-910f-46fc-8ae2-092f2c0e2008","name":"한국임업진흥원"},{"id":"3ec50199-a078-4f56-9592-ee97d4496442","name":"한국자산관리공사"},{"id":"437dfb09-5467-490b-8c9f-f1cd4d7539b8","name":"한국장학재단"},{"id":"d62c25a8-3086-4ad9-9847-5db5e95dcdcc","name":"한국전력공사"},{"id":"356aa172-2add-4331-a290-968adca33bf4","name":"한국증권금융"},{"id":"f047d4b8-1345-43bb-8171-7b1a4394dfbe","name":"한국캐피탈"},{"id":"c305a1d7-1bef-45ad-8321-97072135bcdc","name":"한국투자증권"},{"id":"a29f6335-eac2-4cdc-a08b-3c7ac5718110","name":"한국화재보험협회"},{"id":"fc22d0c5-4e1e-4e03-8c67-6cad59a0a3e0","name":"한살림사업연합(구.한살림연합)"},{"id":"b81f227a-15ed-43de-8af7-e1e232522d56","name":"한섬"},{"id":"fbd7f323-8e57-4979-a0c0-0ff1ab4f009d","name":"한성자동차"},{"id":"2340a409-818b-4480-a7d4-eb3a514fd26f","name":"한전KDN"},{"id":"e43a79c1-2f6f-45bf-a000-8d8a05d20de4","name":"한화S&C"},{"id":"4012be3b-ce39-4e33-b127-5e3f3e879040","name":"한화생명"},{"id":"b5528cba-66dd-4fbe-aa29-012ed78734f6","name":"한화손해보험"},{"id":"ace7a982-5bc0-407b-9ad8-69f06e9cee8a","name":"한화시스템"},{"id":"f0433fa3-b178-42ec-8350-6f949f7d9d55","name":"한화자산운용"},{"id":"e2811f8e-4844-4388-80d2-680e1e10ae54","name":"한화투자증권"},{"id":"85de7aef-4ea3-4baf-b81a-1f2e55b2fd8d","name":"현대리바트"},{"id":"66a14690-0cd3-4b3f-9fc1-d359f0615981","name":"현대중공업"},{"id":"862e6937-8c3b-48c6-87be-9ca68ab14220","name":"현대해상"},{"id":"c1564902-64e0-45fe-ba72-df6af1f96d07","name":"현대홈쇼핑"},{"id":"bfc2434f-bc95-43e9-91f6-1c7b987fa250","name":"효성ITX"},{"id":"cf9df1c4-1178-4c20-97ed-9a275fdcd5f4","name":"효성티앤에스"},{"id":"fccfce83-628b-4cbf-a6b8-0145ccdddfbb","name":"효성중공업"},{"id":"2657afd9-350c-47ed-9df5-a71b660dd267","name":"두산전자"},{"id":"1511b9ba-68b4-4f9b-b7b6-8a0ed134b9bd","name":"CJ대한통운"},{"id":"eff45b7e-f7b0-4a89-bc49-c47b68278886","name":"DGB생명보험(구.DGB생명)"},{"id":"928d30ae-1c5e-435d-b80d-25f638bf08c4","name":"DGB캐피탈"},{"id":"098e711f-0b70-4f84-973f-7569eef84135","name":"건강보험공단"},{"id":"ad13aa99-7a59-4ae0-9926-9a84d6cf96e2","name":"건강보험심사평가원"},{"id":"86b3da06-c940-40df-a6de-9eeaf775f709","name":"현대카드"},{"id":"a85f924a-ef93-4722-86f2-e82be6e3f0d3","name":"NH선물"},{"id":"a0ff3d50-47e0-4902-a883-b281114b09f3","name":"NH농협캐피탈(구.NH캐피탈)"},{"id":"543f5b26-4813-468c-af7a-34189f86d6dc","name":"NH멤버스"},{"id":"a2207c25-86e6-496c-bbff-df934f5ba9d5","name":"농협목우촌"},{"id":"e3f5f923-5b07-4bd7-96cb-79f607d790c1","name":"신세계인터내셔널"},{"id":"0802e5d7-7706-4d83-ab14-067757842504","name":"신세계면세점"},{"id":"93362e11-4167-4cc6-a5e6-e2f6edd5e0be","name":"신세계스타벅스"},{"id":"43fd4381-d0ff-49f8-9b66-87eb3e6e020f","name":"신세계ITSM"},{"id":"6dd5d8a3-de5e-4222-9d09-3eef35341990","name":"티빙"},{"id":"6b297ed9-f7a4-4db5-8cd6-e1a7e111ad27","name":"CJ HR"},{"id":"84280645-cce5-43fc-9d87-9b034f69d954","name":"CJ온스타일(구.CJ오쇼핑)"},{"id":"e108e62a-058f-489b-8ef4-494ee536c6e0","name":"한전KPS"},{"id":"e0ba7a57-85ff-46e2-87dc-2af37caf8a2e","name":"SH공사(서울주택도시공사)"},{"id":"90f69c01-f50d-4ba5-88a2-e3585899823a","name":"KG모빌리언스"},{"id":"1624b4ed-5ec9-4a58-b0fe-c5c0244c5690","name":"천재교육"},{"id":"4af52431-5980-43e2-86bd-2b4683e544cd","name":"천재교과서"},{"id":"4fa2a589-52b5-4d9d-847a-d840cec4ff6d","name":"인터파크"},{"id":"13bc54a9-62c0-4fc3-b990-2bda464319da","name":"현대이지웰"},{"id":"df022b36-b61c-4f99-bb9e-b95ece738c8c","name":"K-CAR"},{"id":"1c9a3359-7c04-4bea-aabe-4feccd6865e1","name":"하나손해보험"},{"id":"b89fea1d-9729-4c0c-bb7b-63494f2bce2e","name":"한국사회복지협의회"},{"id":"779a6723-b919-41f4-812a-2cb85e0fcb8b","name":"보건복지부(한국사회보장정보원)"},{"id":"499912dc-fb62-476b-8626-42a3b6c8ecca","name":"카카오페이증권"},{"id":"9afda009-cc66-4b48-b828-a6e91fcda53c","name":"한국환경공단"},{"id":"a8d8783c-a6e1-429f-8873-bc536d9198b1","name":"국립암센터"},{"id":"06600abc-9f23-4d99-9134-071f6bab435a","name":"공군작전사령부"},{"id":"c91c2e2a-a1d6-4a3b-b5f5-3f167cce90eb","name":"하나금융티아이"},{"id":"ca1a0474-cbb9-4acc-aa36-8999042de032","name":"하나금융파인드"},{"id":"6dcf9943-36a0-4ead-a26e-9a1af8264d04","name":"포스코ICT"},{"id":"cebd12b5-7b47-4dc8-9187-d7a80d09b08b","name":"웰컴저축은행"},{"id":"5e972528-c7f4-4eba-869e-908a7e3b100d","name":"웰컴페이먼츠"},{"id":"4c241878-af4e-422a-b1d9-303272ea9333","name":"웰컴FND"},{"id":"b1263d02-d6b8-4616-ae98-a7f0755f59fc","name":"KT커머스"},{"id":"ff7bd4c2-bdb5-497d-875c-073c5d494c90","name":"한국투자저축은행"},{"id":"9f01c7ef-86b1-4257-ab4f-885e142b4b4e","name":"모나미"},{"id":"3482f436-29a1-460b-b176-48599bdfe838","name":"지머니트랜스"},{"id":"e3d230ef-626b-4ccb-84d0-ac9dc689cdae","name":"교육청"},{"id":"97b07624-a43b-4f40-a74d-332e7e47f0bf","name":"한국생명공학연구원"},{"id":"a19ae240-0dc9-44e9-8522-e0db12fac8f2","name":"한국건강관리협회"},{"id":"0a2c37b2-7350-4948-a476-e6e6abd1dc66","name":"롯데면세점"},{"id":"c42552f9-d379-45ed-ac13-d15a511f68f0","name":"블루월넛"},{"id":"3b6a0f0a-dfaf-4c77-b967-767124442159","name":"삼성엔지니어링"},{"id":"c25ee867-c3b5-464a-8963-e554d372b1c5","name":"공영홈쇼핑"},{"id":"08cdefbf-f110-4b6d-aa36-4296e2920ea1","name":"한양대학교"},{"id":"88d00a76-74b7-4788-9705-fec401258b97","name":"서울보건환경연구원"},{"id":"eb4b6546-d6a5-4ef0-a7d7-9ee946d38f35","name":"나비엠알오"},{"id":"b19c6426-d70f-4c54-993d-05c9814ac585","name":"투썸플레이스"},{"id":"f599bc4d-86f3-4322-80ed-f42a5fefd69c","name":"스테코"},{"id":"f4c4ba64-db28-4ea3-bd2b-013b3d4652b0","name":"신세계프라퍼티"},{"id":"7f1311c8-6588-4a3d-a473-383b7d61844f","name":"숭실사이버대학교"},{"id":"5bae816e-a2a5-41ca-9f6b-941273293a5e","name":"한독"},{"id":"e29acb0c-4658-47fe-8b1a-5dc0d6c7d629","name":"효성에프엠에스"},{"id":"9f4bde32-81cb-4877-8fe8-a8cdaa1edede","name":"쿠쿠전자(구.쿠쿠홀딩스)"},{"id":"90482913-1859-45d8-990e-8d5876fba015","name":"행정안전부"},{"id":"2db8604f-a1df-4c95-abcb-744a82f09218","name":"순천향대학교병원"},{"id":"f48bcb64-0a19-4964-9975-f609480258c2","name":"비트컴퓨터"},{"id":"d5958b59-fe12-40b6-9808-54ac2de8bfdb","name":"신한카드"},{"id":"df6203b3-734c-4999-8349-6ea27a3da204","name":"삼성선물"},{"id":"ed86a524-ad59-454f-9ea8-ee0acff25a9f","name":"EXEMJP"},{"id":"918d611d-7090-44fe-b30c-b86397fc4b61","name":"EXEMCN"},{"id":"8a83cee2-ffea-45aa-9ec3-2774446701c6","name":"농협물류"},{"id":"3948e717-055b-4a71-b676-a89f12a30709","name":"수협은행(수협중앙회 포함)"},{"id":"8b8028fc-e554-4f9d-a030-9c6034f68bb5","name":"제주은행"},{"id":"ef2ae48e-15ee-46e9-91f2-eec2b4b761ac","name":"메리츠캐피탈"},{"id":"5af41942-7189-4665-ae17-26f4de21dea6","name":"삼성중공업"},{"id":"b2dfd6a4-c28b-47bb-a513-9d30eff0f19b","name":"한국선불카드"},{"id":"44f8c7b7-13e6-42bb-82cb-ea31207fcb2b","name":"LG전자"},{"id":"9e6ea49b-5b4d-4b89-bcd8-6c583e1ec0dc","name":"KIDB"},{"id":"e04c8c87-a4b1-41d8-afb4-5c435b9c8f19","name":"현대백화점"},{"id":"ed21fc9c-f5ed-42e0-9d6d-e33508ff03b7","name":"휠라홀딩스"},{"id":"9c7dfce2-5fc4-4754-902b-fdf6c7ffc8d4","name":"HL만도"},{"id":"bf2c4170-db16-4c19-9daf-2b54fee361ff","name":"비오시스템즈"},{"id":"2d860420-9eff-41f7-89ad-96e4c4254a13","name":"신원의료재"},{"id":"a8043eeb-ef55-43cd-a06d-dea143206a86","name":"섹터"},{"id":"9b9ae42e-d285-4b2a-8a48-e21cbaf0e369","name":"질병관리"},{"id":"09a142e8-cd26-44b8-9667-1cbfddd2ae59","name":"M캐피탈"},{"id":"bf159895-fb85-4082-a07d-bc38303bb18c","name":"IBK투자증권"},{"id":"49441423-0e0a-454e-aeb5-d12f29c9fb06","name":"여성가족부"},{"id":"4c11ef69-1747-4878-803f-1dd309ad60e1","name":"한국양성평등진흥"},{"id":"119f5ad2-2d45-4106-97fb-cbbf8f755c85","name":"kb금융지주"},{"id":"ac5dd29e-6b3a-4dd2-9cd8-9c2afecd2588","name":"중국법인"},{"id":"757fe14f-d1eb-4981-b41b-e5be0b0883c5","name":"티맥스티베로"},{"id":"f89a4078-4322-4546-990e-df3faabd2e99","name":"나이스디앤"},{"id":"5ae327b5-f8d7-4d0e-8102-b03fbe78169e","name":"나이스디앤비"},{"id":"95d883e5-fb0f-495b-881a-bec00626df4d","name":"NH투자증권"},{"id":"481f304b-2d3c-4d8b-aa80-6aed185c89a0","name":"비엔케"},{"id":"488845f0-3fd8-45a4-a53c-fcefae32d2d4","name":"전북은"},{"id":"f34d3596-a2e2-4ada-b677-ce0be1415c2a","name":"현대캐피탈"},{"id":"c5f3eff3-1ef9-400b-9e30-07d03708ce21","name":"대덕전자"},{"id":"129d4a48-f336-4901-9a9b-541de1a5b9b6","name":"KTAlpha"},{"id":"55e42c54-22c0-4058-8cf5-fbca0a28e316","name":"우리종합금"},{"id":"9e841922-8e15-418c-aa59-ed28bb5f3c40","name":"콘텐트리중앙"},{"id":"e4d3b34b-6244-41ce-8268-97abc2acf47d","name":"충북대학교병원"},{"id":"8fde5403-1d58-4ef0-bb3b-13ff6809f827","name":"건설근로자공제"},{"id":"8e364a44-8edd-4c2a-936f-0f0209cef27f","name":"공항철도"},{"id":"01e3f003-8754-47d9-9e04-78b866ed408a","name":"롯데월"},{"id":"a2731c94-508b-4065-8f2f-2f6c432fc89b","name":"한국전기안전공사"},{"id":"fb875704-34d7-4df5-9f1b-08c4402ec0fd","name":"더존비즈온"},{"id":"6d762c8e-03cc-4528-a508-1f5963c39d16","name":"한국표준협회"},{"id":"a38f03a3-7467-4785-a381-4ac7d7e8141f","name":"nice"},{"id":"a979993c-72d2-4e66-9792-f75f5827a3b4","name":"한국신용보증재단"},{"id":"5cd6387c-9de8-4350-988e-aa39b7e69003","name":"한국남동발전"},{"id":"cca4285c-c272-4b30-810b-8344468d2a6f","name":"생명보험협"},{"id":"c3d9685a-d3ef-41f3-83c5-bbb31d9bf6bd","name":"생명보험협회"},{"id":"2a16bf83-0b5d-459c-b457-0d4ac8660a5a","name":"생명보험협회2"}];
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
  const [cuRegForm, setCuRegForm] = useState({ product: 'MFO', productLabels: ['MFO'], taskName: '', customer: '', issueType: 'eb4f762b-f3b4-4d27-a900-27918626ebe4', description: '', customerSearch: '', imageUrls: [], attachImages: false, extraAssignees: [] });
  const [cuRegLoading, setCuRegLoading] = useState(false);
  const [cuRegMsg, setCuRegMsg] = useState('');
  const [cuSearchFocused, setCuSearchFocused] = useState(false);
  const [cuMembers, setCuMembers] = useState([]);
  const [cuMemberSearch, setCuMemberSearch] = useState('');
  const [cuMemberFocused, setCuMemberFocused] = useState(false);
  const cuMembersCacheRef = useRef({});

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
    else if (section === 'faq') setCurrentTab('faq');
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

  async function ensureCuMyUser() {
    if (cuMyUserRef.current) return;
    try {
      const r = await fetch('https://api.clickup.com/api/v2/user', { headers: { Authorization: clickupTokenRef.current } });
      const d = await r.json();
      if (d.user) cuMyUserRef.current = d.user;
    } catch (e) {}
  }

  function resolveCuMentions(text) {
    if (!cuMyUserRef.current) return text;
    const u = cuMyUserRef.current;
    const mention = `@[${u.id}]`;
    return text.replace(/@me\b/gi, mention);
  }

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

      // 그룹웨어 세션 복원
      const storedGwSession = p.gw_session || '';
      gwSessionRef.current = storedGwSession;
      setGwSession(storedGwSession);

      // ClickUp 본인 유저 정보 캐시
      const token = p.clickup_token || clickupTokenRef.current;
      if (token && !cuMyUserRef.current) {
        fetch('https://api.clickup.com/api/v2/user', { headers: { Authorization: token } })
          .then(r => r.json())
          .then(d => { if (d.user) cuMyUserRef.current = d.user; })
          .catch(() => {});
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

  async function fetchApiPageNum(pageNum, keyword) {
    const res = await fetch(
      `https://api.clickup.com/api/v2/team/${TEAM_ID}/task?space_ids[]=${CLICKUP_SPACE_ID}&subtasks=true&include_closed=true&order_by=created&page=${pageNum}`,
      { headers: { Authorization: clickupTokenRef.current } }
    );
    const data = await res.json();
    const tasks = data.tasks || [];
    return { tasks, exhausted: tasks.length < 100 };
  }

  function filterTasks(tasks, keyword) {
    if (!keyword) return tasks;
    const kw = keyword.toLowerCase();
    return tasks.filter(t =>
      (t.name || '').toLowerCase().includes(kw) ||
      (t.description || '').toLowerCase().includes(kw)
    );
  }

  async function fillBuffer(keyword, parallel = false) {
    if (parallel && cuApiPageRef.current === 0 && !cuApiExhaustedRef.current) {
      // 첫 검색: 2페이지 병렬 fetch
      const [r0, r1] = await Promise.all([
        fetchApiPageNum(0, keyword),
        fetchApiPageNum(1, keyword),
      ]);
      cuBufferRef.current = [...filterTasks(r0.tasks, keyword), ...filterTasks(r1.tasks, keyword)];
      cuApiPageRef.current = 2;
      if (r0.exhausted || r1.exhausted) cuApiExhaustedRef.current = true;
    }
    while (cuBufferRef.current.length < CU_PAGE_SIZE && !cuApiExhaustedRef.current) {
      const { tasks, exhausted } = await fetchApiPageNum(cuApiPageRef.current, keyword);
      cuBufferRef.current = [...cuBufferRef.current, ...filterTasks(tasks, keyword)];
      cuApiPageRef.current += 1;
      if (exhausted) cuApiExhaustedRef.current = true;
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
      await fillBuffer(q, true);
      const toShow = cuBufferRef.current.splice(0, CU_PAGE_SIZE);
      setCuTasks(toShow);
      setCuHasMore(cuBufferRef.current.length > 0 || !cuApiExhaustedRef.current);
      // 다음 페이지 백그라운드 pre-fetch
      if (!cuApiExhaustedRef.current) fillBuffer(q).catch(() => {});
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
      // 다음 페이지 백그라운드 pre-fetch
      if (!cuApiExhaustedRef.current) fillBuffer(cuKeywordRef.current).catch(() => {});
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
    setCuAppendDesc('');
    const res = await fetch(`https://api.clickup.com/api/v2/task/${id}?markdown_description=true`, { headers: { Authorization: clickupTokenRef.current } });
    const data = await res.json();
    setCuDetail({ task: data });
  }

  async function appendCuDescription() {
    if (!cuAppendDesc.trim() || !cuDetail?.task) return;
    setCuDescSaving(true);
    await ensureCuMyUser();
    const resolved = resolveCuMentions(cuAppendDesc.trim());
    const body = { comment_text: resolved, notify_all: false };
    if (cuMyUserRef.current) body.assignee = cuMyUserRef.current.id;
    const res = await fetch(`https://api.clickup.com/api/v2/task/${cuDetail.task.id}/comment`, {
      method: 'POST',
      headers: { Authorization: clickupTokenRef.current, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setCuAppendDesc('');
      showToastMsg('댓글이 추가되었습니다.');
    } else {
      showToastMsg('저장 실패. 다시 시도해주세요.');
    }
    setCuDescSaving(false);
  }

  async function openCuCommentModal(text, imageIds = []) {
    setCuCommentModal({ text, imageIds });
    setCuCommentSearch('');
    if (!myTasksLoaded) {
      setCuCommentSearching(true);
      await fetchMyTasks(false);
      setCuCommentSearching(false);
    }
  }

  async function postCommentToTask(taskId) {
    if (!cuCommentModal?.text) return;
    setCuCommentPosting(true);
    await ensureCuMyUser();

    // 댓글 추가
    const resolved = resolveCuMentions(cuCommentModal.text);
    const body = { comment_text: resolved, notify_all: false };
    if (cuMyUserRef.current) body.assignee = cuMyUserRef.current.id;
    const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
      method: 'POST',
      headers: { Authorization: clickupTokenRef.current, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setCuCommentPosting(false);
      showToastMsg('댓글 추가 실패. 다시 시도해주세요.');
      return;
    }

    // 이미지 첨부
    const imageIds = cuCommentModal.imageIds || [];
    let uploadedCount = 0;
    for (const fileId of imageIds) {
      try {
        const fileRes = await fetch(`/api/mattermost?action=file&fileId=${fileId}`, {
          headers: { 'x-mm-token': mmTokenRef.current },
        });
        if (!fileRes.ok) continue;
        const blob = await fileRes.blob();
        const contentDisposition = fileRes.headers.get('content-disposition') || '';
        const nameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        let fileName = nameMatch ? nameMatch[1].replace(/['"]/g, '') : '';
        if (!fileName) {
          const extMap = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
          const ext = extMap[blob.type] || 'png';
          fileName = `image_${fileId}.${ext}`;
        }
        const form = new FormData();
        form.append('attachment', blob, fileName);
        const attachRes = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, {
          method: 'POST',
          headers: { Authorization: clickupTokenRef.current },
          body: form,
        });
        if (attachRes.ok) uploadedCount++;
        else { const errText = await attachRes.text().catch(() => ''); console.error('첨부 실패', attachRes.status, errText); }
      } catch (e) { console.error('첨부 오류', e); }
    }

    setCuCommentPosting(false);
    setCuCommentModal(null);
    setCuCommentSearch('');
    const msg = imageIds.length > 0
      ? `댓글이 추가되었습니다. (이미지 ${uploadedCount}/${imageIds.length}개 첨부)`
      : '댓글이 추가되었습니다.';
    showToastMsg(msg);
  }

  async function attachFileToCuTask(file) {
    if (!file || !cuDetail?.task) return;
    setCuAttachSaving(true);
    const form = new FormData();
    form.append('attachment', file);
    const res = await fetch(`https://api.clickup.com/api/v2/task/${cuDetail.task.id}/attachment`, {
      method: 'POST',
      headers: { Authorization: clickupTokenRef.current },
      body: form,
    });
    if (res.ok) {
      const data = await res.json();
      setCuDetail(prev => ({
        ...prev,
        task: {
          ...prev.task,
          attachments: [...(prev.task.attachments || []), { url: data.url, title: data.title || file.name }],
        },
      }));
      showToastMsg('파일이 첨부되었습니다.');
    } else {
      showToastMsg('첨부 실패. 다시 시도해주세요.');
    }
    setCuAttachSaving(false);
    if (cuAttachInputRef.current) cuAttachInputRef.current.value = '';
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

  async function loadCuDocPage(url) {
    // ClickUp URL 파싱
    // 형식1: https://app.clickup.com/{workspaceId}/v/dc/{docId}/{pageId}
    // 형식2: https://doc.clickup.com/{workspaceId}/p/h/{parentId}/{docId}  ← 두 번째가 실제 docId
    const appMatch = url.match(/app\.clickup\.com\/[^/]+\/v\/dc\/([^/?#]+)(?:\/([^/?#]+))?/);
    const docMatch = url.match(/doc\.clickup\.com\/[^/]+\/p\/h\/([^/?#]+)(?:\/([^/?#]+))?/);
    if (!appMatch && !docMatch) { setCuDocPanel({ error: '올바른 ClickUp Doc URL이 아닙니다.' }); return; }
    // doc.clickup.com: {parentId}/{childId} — parentId가 실제 docId, childId가 pageId
    let docId, pageId;
    if (docMatch) {
      docId = docMatch[1];           // rbeb5-2724398
      pageId = docMatch[2] || null;  // 28ffba6942726fd
    } else {
      docId = appMatch[1];
      pageId = appMatch[2] || null;
    }
    setCuDocPanel({ loading: true });
    // 서버사이드 프록시를 통해 호출 (CORS 우회 + 공개 doc 지원)
    try {
      const params = pageId ? `docId=${docId}&pageId=${pageId}` : `docId=${docId}`;
      const res = await fetch(`/api/clickup-doc?${params}`, {
        headers: { 'x-clickup-token': clickupTokenRef.current }
      });
      const data = await res.json();
      if (data.error) { setCuDocPanel({ error: data.error }); return; }
      if (data.debug) { setCuDocPanel({ name: data.name || 'Doc 페이지', content: '', debug: data.debug }); return; }
      setCuDocPanel({ name: data.name || 'Doc 페이지', content: data.content || '' });
    } catch (e) { setCuDocPanel({ error: e.message }); }
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
    // 캐시된 값으로 즉시 표시
    setSettingsData({
      username: currentUsername || '',
      displayName: displayName || '',
      newPassword: '',
      clickupToken: clickupTokenRef.current || '',
      mmUsername: '',
      mmPassword: '',
      mmToken: mmTokenRef.current || '',
      gwSession: gwSessionRef.current || '',
    });
    setSettingsMsg({ text: '', type: '' });
    setShowSettings(true);
    // RPC로 추가 정보(mm_username 등) 보완
    try {
      const { data } = await sb.rpc('get_user_profile', { p_username: currentUsername });
      if (data && data[0]) {
        const p = data[0];
        setSettingsData(prev => ({ ...prev, mmUsername: p.mm_username || prev.mmUsername }));
      }
    } catch {}
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

    // MM 인증 통과 후 전체 저장 (p_mm_token은 별도 처리 — null 전달 시 기존 토큰 삭제됨)
    const { error } = await sb.rpc('update_user_profile', {
      p_username: currentUsername,
      p_new_id: currentUsername,
      p_display_name: settingsData.displayName,
      p_new_password: settingsData.newPassword || null,
      p_clickup_token: settingsData.clickupToken || null,
      p_mm_username: settingsData.mmUsername || null,
      p_mm_password: settingsData.mmPassword || null,
      p_mm_token: mmToken_new || settingsData.mmToken || null,
      p_gw_session: settingsData.gwSession || null,
    });
    if (error) { setSettingsMsg({ text: '저장 실패: ' + error.message, type: 'error' }); return; }
    if (settingsData.clickupToken) clickupTokenRef.current = settingsData.clickupToken;
    if (settingsData.displayName) setDisplayName(settingsData.displayName);
    if (settingsData.gwSession !== undefined) {
      gwSessionRef.current = settingsData.gwSession;
      setGwSession(settingsData.gwSession);
    }

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
    setFaqDetail(null);
    if (tab === 'license') loadLicenseTasks();
    if (tab === 'clickup' && cuSubTab === 'my' && !myTasksLoaded) fetchMyTasks(false);
    if (tab === 'chat' && mmTokenRef.current && mmChannels.length === 0) mmLoadChannels();
    if (tab === 'faq' && faqAllItemsRef.current.length === 0) loadFaqList('', 0, true);
    const path = tab === 'notes' ? 'note' : tab;
    router.push(`/app/${path}`, undefined, { shallow: true });
  }

  function applyFaqFilter(searchTerm) {
    const q = (searchTerm || '').toLowerCase().trim();
    if (!q) {
      setFaqList(faqAllItemsRef.current);
    } else {
      setFaqList(faqAllItemsRef.current.filter(item => {
        const title = getFaqTitle(item.values || {});
        return title.toLowerCase().includes(q);
      }));
    }
  }

  async function loadFaqPage(page, replace = false) {
    if (!gwSessionRef.current) return null;
    const r = await fetch(`/api/groupware?action=list&page=${page}&offset=20`, {
      headers: { 'x-gw-session': gwSessionRef.current },
    });
    const data = await r.json();
    if (r.status === 401) { showToastMsg('그룹웨어 세션 만료. 설정에서 GOSSOcookie를 갱신하세요.'); return null; }
    if (!r.ok) { showToastMsg('FAQ 로드 실패'); return null; }
    const items = data.data || [];
    const isLast = data.page?.lastPage ?? items.length < 20;
    if (replace) {
      faqAllItemsRef.current = items;
    } else {
      faqAllItemsRef.current = [...faqAllItemsRef.current, ...items];
    }
    if (isLast) faqAllLoadedRef.current = true;
    return { items, isLast, page };
  }

  async function loadFaqList(searchTerm, page, replace = false) {
    if (!gwSessionRef.current) return;
    setFaqLoading(true);
    try {
      const result = await loadFaqPage(page, replace);
      if (!result) return;
      applyFaqFilter(searchTerm);
      setFaqPage(result.page);
      setFaqHasMore(!result.isLast);
    } catch (e) {
      showToastMsg('FAQ 로드 오류: ' + e.message);
    } finally {
      setFaqLoading(false);
    }
  }

  async function searchFaq(searchTerm) {
    if (!gwSessionRef.current) return;
    setFaqSearch(searchTerm);
    if (faqAllLoadedRef.current) {
      applyFaqFilter(searchTerm);
      return;
    }
    // 전체 로드 후 필터
    setFaqLoading(true);
    try {
      let page = Math.floor(faqAllItemsRef.current.length / 20);
      let isDone = faqAllLoadedRef.current;
      while (!isDone) {
        const result = await loadFaqPage(page, false);
        if (!result) break;
        isDone = result.isLast;
        page++;
      }
      applyFaqFilter(searchTerm);
      setFaqHasMore(false);
    } catch (e) {
      showToastMsg('FAQ 검색 오류: ' + e.message);
    } finally {
      setFaqLoading(false);
    }
  }

  async function openFaqDetail(docId, knownTitle) {
    setFaqDetail({ loading: true, doc: null, title: knownTitle || '' });
    setFaqDetailLoading(true);
    try {
      const r = await fetch(`/api/groupware?action=detail&docId=${docId}`, {
        headers: { 'x-gw-session': gwSessionRef.current },
      });
      const data = await r.json();
      if (r.status === 401) { showToastMsg('그룹웨어 세션 만료. 설정에서 GOSSOcookie를 갱신하세요.'); setFaqDetail(null); return; }
      const doc = data.data || data;
      setFaqDetail({ loading: false, doc, title: knownTitle || '' });
    } catch (e) {
      showToastMsg('FAQ 상세 로드 오류: ' + e.message);
      setFaqDetail(null);
    } finally {
      setFaqDetailLoading(false);
    }
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
      if (!teamsRes.ok || !Array.isArray(teams)) {
        setMmLoading(false);
        if (teamsRes.status === 401) {
          setMmToken(null); mmTokenRef.current = null;
          localStorage.removeItem('mm_token');
          showToastMsg('MM 세션이 만료됐습니다. 다시 로그인해주세요.');
        } else {
          showToastMsg('MM 채널 불러오기 실패: ' + (teams?.error || teamsRes.status));
        }
        return;
      }
      if (teams.length === 0) { setMmLoading(false); return; }
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
      if (Array.isArray(users)) users.forEach(u => { mmUsersCacheRef.current[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.nickname || u.username; });
    }
    return posts;
  }

  async function mmOpenChannel(channel) {
    setMmSelectedChannel(channel);
    setMmPosts([]);
    setMmPostsHasMore(false);
    setMmSummary('');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    setMmDateInputs(prev => ({ ...prev, [channel.id]: prev[channel.id] || todayStr }));
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
    const mmDateInput = mmDateInputs[mmSelectedChannel?.id] || '';
    if (!mmDateInput || !mmSelectedChannel) return;
    const chId = mmSelectedChannel.id;
    setMmDateSummarizing(true);
    setMmDateSummary(prev => ({ ...prev, [chId]: '' }));
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
      const allDayPosts = order
        .map(id => data.posts[id])
        .filter(p => p.create_at >= startOfDay.getTime() && p.create_at <= endOfDay.getTime());
      const allFileIds = allDayPosts.flatMap(p => p.file_ids || []);
      setMmDateImageIds(prev => ({ ...prev, [chId]: allFileIds }));
      const posts = allDayPosts.filter(p => p.message?.trim()).sort((a, b) => a.create_at - b.create_at);
      if (posts.length === 0) { setMmDateSummary(prev => ({ ...prev, [chId]: '해당 날짜의 메시지가 없습니다.' })); return; }
      const unknownIds = [...new Set(posts.map(p => p.user_id).filter(id => !mmUsersCacheRef.current[id]))];
      if (unknownIds.length > 0) {
        const ur = await fetch('/api/mattermost?action=users', {
          method: 'POST',
          headers: { 'x-mm-token': mmTokenRef.current, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: unknownIds }),
        });
        if (ur.ok) { const ud = await ur.json(); ud.forEach(u => { mmUsersCacheRef.current[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.nickname || u.username; }); }
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
      if (!gr.ok) { setMmDateSummary(prev => ({ ...prev, [chId]: '오류: ' + gd.error })); return; }
      setMmDateSummary(prev => ({ ...prev, [chId]: gd.summary }));
    } catch (e) { setMmDateSummary(prev => ({ ...prev, [chId]: '오류: ' + e.message })); }
    finally { setMmDateSummarizing(false); }
  }

  async function saveToNote(title, text, fileIds = [], mmToken = null) {
    const username = localStorage.getItem('memo_user');
    if (!username) return alert('로그인이 필요합니다.');
    let imageHtml = '';
    if (fileIds.length > 0 && mmToken) {
      for (const fileId of fileIds) {
        try {
          const r = await fetch(`/api/mattermost?action=file&fileId=${fileId}`, { headers: { 'x-mm-token': mmToken } });
          if (r.ok) {
            const blob = await r.blob();
            if (blob.type.startsWith('image/')) {
              const ext = blob.type.includes('png') ? 'png' : blob.type.includes('gif') ? 'gif' : 'jpg';
              const fileName = `${username}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
              const { error: uploadErr } = await sb.storage.from('memo-images').upload(fileName, blob, { contentType: blob.type });
              if (!uploadErr) {
                const { data: urlData } = sb.storage.from('memo-images').getPublicUrl(fileName);
                imageHtml += `<p><img src="${urlData.publicUrl}"></p>`;
              }
            }
          }
        } catch {}
      }
    }
    const content = '<p>' + text.replace(/\n/g, '</p><p>') + '</p>' + imageHtml;
    const { data, error } = await sb.rpc('save_user_note', {
      p_username: username, p_id: null, p_title: title, p_content: content,
    });
    if (error) { alert('저장 실패: ' + error.message); return; }
    loadNotes();
    if (window.confirm('메모에 저장되었습니다.\n메모장으로 이동하시겠습니까?')) {
      router.push(`/app/note/${data}`);
    }
  }

  async function fetchCuMembers(listId) {
    if (cuMembersCacheRef.current[listId]) { setCuMembers(cuMembersCacheRef.current[listId]); return; }
    try {
      const r = await fetch(`https://api.clickup.com/api/v2/list/${listId}/member`, { headers: { Authorization: clickupTokenRef.current } });
      if (r.ok) {
        const d = await r.json();
        cuMembersCacheRef.current[listId] = d.members || [];
        setCuMembers(d.members || []);
      }
    } catch {}
  }

  function openCuRegModal(overrideTitle, overrideText, overrideImageUrls) {
    const title = overrideTitle ?? (noteTitleRef.current || '');
    const text = overrideText ?? (quillRef.current ? quillRef.current.getText().trim() : '');
    let taskName = title;
    const lines = text.split('\n');
    const h2Idx = lines.findIndex(l => l.startsWith('## '));
    if (h2Idx !== -1) {
      const nextLine = lines.slice(h2Idx + 1).find(l => l.trim() !== '');
      if (nextLine) taskName = nextLine.trim();
    }
    if (!myUserIdRef.current) {
      const parts = clickupTokenRef.current.split('_');
      if (parts.length >= 2) myUserIdRef.current = parts[1];
    }
    const dateMatch = title.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    const dateStr = dateMatch ? `${dateMatch[1]}.${String(dateMatch[2]).padStart(2,'0')}.${String(dateMatch[3]).padStart(2,'0')}` : null;
    const extractSection = (src, heading) => {
      const lines = src.split('\n');
      const idx = lines.findIndex(l => l.trim() === heading);
      if (idx === -1) return '';
      const nextH2 = lines.findIndex((l, i) => i > idx && l.startsWith('## '));
      const sectionLines = nextH2 === -1 ? lines.slice(idx) : lines.slice(idx, nextH2);
      return sectionLines.join('\n').trim();
    };
    const issuePart = extractSection(text, '## 이슈사항');
    const progressPart = extractSection(text, '## 진행내역');
    const bodyParts = [issuePart, progressPart].filter(Boolean).join('\n\n');
    const body = bodyParts || text;
    const description = dateStr ? `${dateStr}\n${body}` : body;
    const html = quillRef.current?.root.innerHTML || '';
    const imageUrls = overrideImageUrls ?? [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(u => u.startsWith('http'));
    const productKeys = Object.keys(DEQ_LISTS);
    const detectProduct = (str) => productKeys.find(k => new RegExp(`\\[${k}\\]`, 'i').test(str));
    const detectedProduct = detectProduct(title) || detectProduct(taskName) || detectProduct(text);
    const nextProduct = detectedProduct || null;
    const resolvedProduct = nextProduct || 'MFO';
    // ## 타이틀 라인에서 [고객명] 추출 후 DEQ_CUSTOMERS 매칭
    const titleLine = (() => {
      const lines = text.split('\n');
      const idx = lines.findIndex(l => l.trim() === '## 타이틀');
      if (idx !== -1) return lines.slice(idx + 1).find(l => l.trim()) || '';
      return taskName;
    })();
    const bracketMatch = titleLine.match(/\[([^\]]+)\]/);
    const customerKeyword = bracketMatch ? bracketMatch[1] : titleLine.split(/\s/)[0];
    const detectedCustomer = customerKeyword
      ? DEQ_CUSTOMERS.find(c => c.name.includes(customerKeyword) || customerKeyword.includes(c.name))
      : null;
    setCuRegForm(f => ({
      ...f,
      taskName, description, imageUrls, attachImages: imageUrls.length > 0, extraAssignees: [],
      customerSearch: detectedCustomer ? detectedCustomer.name : '',
      customer: detectedCustomer ? detectedCustomer.id : '',
      ...(nextProduct ? { product: nextProduct, productLabels: [nextProduct] } : {}),
    }));
    setCuMemberSearch('');
    setCuRegMsg('');
    fetchCuMembers(DEQ_LISTS[resolvedProduct]);
    setCuRegModal(true);
  }

  async function submitCuReg() {
    if (!cuRegForm.taskName.trim()) return setCuRegMsg('태스크명을 입력해주세요.');
    if (!cuRegForm.customer) return setCuRegMsg('고객사를 선택해주세요.');
    setCuRegLoading(true);
    setCuRegMsg('');
    await ensureCuMyUser();
    const listId = DEQ_LISTS[cuRegForm.product];
    const today = new Date();
    const todayTs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    try {
      const r = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
        method: 'POST',
        headers: { Authorization: clickupTokenRef.current, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cuRegForm.taskName,
          description: resolveCuMentions(cuRegForm.description),
          assignees: [...(myUserIdRef.current ? [Number(myUserIdRef.current)] : []), ...cuRegForm.extraAssignees.map(u => u.id)],
          custom_fields: [
            { id: 'cc55be6f-f4bf-42b7-9a33-b06e1b60f800', value: cuRegForm.customer },
            { id: '6d0330f1-3102-4eea-9099-90875ec6700a', value: cuRegForm.issueType },
            { id: 'ad3894ba-579d-4a6b-946b-9070d604652e', value: todayTs },
            ...(TEAM_IN_CHARGE[cuRegForm.product] !== undefined ? [{ id: '98e3cb87-f426-48b7-a8ee-6ad9cd1a79c0', value: TEAM_IN_CHARGE[cuRegForm.product] }] : []),
          ],
        }),
      });
      const data = await r.json();
      if (!r.ok) { setCuRegMsg('오류: ' + (data.err || JSON.stringify(data))); return; }
      let productMsg = '';
      if (data.id && cuRegForm.productLabels.length > 0) {
        const labelIds = cuRegForm.productLabels.map(p => DEQ_PRODUCT_LABELS[p]).filter(v => v !== undefined);
        if (labelIds.length > 0) {
          const fr = await fetch(`https://api.clickup.com/api/v2/task/${data.id}/field/7ff58f07-8cd6-43ba-98f3-045f8b35f765`, {
            method: 'POST',
            headers: { Authorization: clickupTokenRef.current, 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: labelIds }),
          });
          const fd = await fr.json();
          productMsg = fr.ok ? ' | Product ✅' : ' | Product 오류: ' + JSON.stringify(fd);
        }
      }
      let imageMsg = '';
      if (data.id && cuRegForm.attachImages && cuRegForm.imageUrls.length > 0) {
        let ok = 0, fail = 0;
        for (const url of cuRegForm.imageUrls) {
          try {
            const ir = await fetch(url);
            if (ir.ok) {
              const blob = await ir.blob();
              const filename = decodeURIComponent(url.split('/').pop().split('?')[0]) || 'image.jpg';
              const fd = new FormData();
              fd.append('attachment', blob, filename);
              const ar = await fetch(`https://api.clickup.com/api/v2/task/${data.id}/attachment`, {
                method: 'POST',
                headers: { Authorization: clickupTokenRef.current },
                body: fd,
              });
              ar.ok ? ok++ : fail++;
            }
          } catch { fail++; }
        }
        imageMsg = ` | 이미지 ${ok}개 첨부${fail > 0 ? ` (${fail}개 실패)` : ''}`;
      }
      setCuRegMsg('✅ 등록 완료! Task ID: ' + data.id + productMsg + imageMsg);
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
                <select value={cuRegForm.product} onChange={e => { setCuRegForm(f => ({ ...f, product: e.target.value, productLabels: DEQ_PRODUCT_LABELS[e.target.value] ? [e.target.value] : [] })); fetchCuMembers(DEQ_LISTS[e.target.value]); }} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px', background: 'var(--bg, #fff)', color: 'var(--text, #333)' }}>
                  {Object.keys(DEQ_LISTS).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-sub, #666)' }}>태스크명 *</div>
                <input value={cuRegForm.taskName} onChange={e => setCuRegForm(f => ({ ...f, taskName: e.target.value }))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px', background: 'var(--bg, #fff)', color: 'var(--text, #333)', boxSizing: 'border-box' }} placeholder="태스크명 입력" />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-sub, #666)' }}>고객사 *</div>
                <input value={cuRegForm.customerSearch} onChange={e => setCuRegForm(f => ({ ...f, customerSearch: e.target.value, customer: '' }))} onFocus={() => setCuSearchFocused(true)} onBlur={() => setTimeout(() => setCuSearchFocused(false), 200)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px', marginBottom: '4px', background: 'var(--bg, #fff)', color: 'var(--text, #333)', boxSizing: 'border-box' }} placeholder="고객사 검색..." />
                {cuSearchFocused && cuRegForm.customerSearch && (
                  <div style={{ border: '1px solid var(--border, #ddd)', borderRadius: '6px', maxHeight: '160px', overflowY: 'auto', background: 'var(--bg, #fff)' }}>
                    {cuRegFilteredCustomers.slice(0, 20).map(c => (
                      <div key={c.id} onClick={() => { setCuRegForm(f => ({ ...f, customer: c.id, customerSearch: c.name })); setCuSearchFocused(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border, #eee)' }}
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
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-sub, #666)' }}>담당자</div>
                <div style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px', background: 'var(--bg-sub, #f9f9f9)', color: 'var(--text, #333)', marginBottom: '6px' }}>
                  {myUserIdRef.current ? '나 (본인)' : '로그인 필요'}
                </div>
                {cuRegForm.extraAssignees.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                    {cuRegForm.extraAssignees.map(u => (
                      <span key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', background: '#e8f0fe', border: '1px solid #0066cc', fontSize: '12px', color: '#0066cc' }}>
                        {u.username.split(' /')[0]}
                        <button type="button" onClick={() => setCuRegForm(f => ({ ...f, extraAssignees: f.extraAssignees.filter(a => a.id !== u.id) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#0066cc', fontSize: '12px', lineHeight: 1 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text" placeholder="담당자 추가 검색..." value={cuMemberSearch}
                    onChange={e => setCuMemberSearch(e.target.value)}
                    onFocus={() => setCuMemberFocused(true)}
                    onBlur={() => setTimeout(() => setCuMemberFocused(false), 150)}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '13px', background: 'var(--bg, #fff)', color: 'var(--text, #333)', boxSizing: 'border-box' }}
                  />
                  {cuMemberFocused && cuMemberSearch && (() => {
                    const q = cuMemberSearch.toLowerCase();
                    const filtered = cuMembers.filter(m => !cuRegForm.extraAssignees.find(a => a.id === m.id) && (m.username?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)));
                    return filtered.length > 0 ? (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '6px', zIndex: 100, maxHeight: '160px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        {filtered.slice(0, 8).map(m => (
                          <div key={m.id} onMouseDown={() => { setCuRegForm(f => ({ ...f, extraAssignees: [...f.extraAssignees, { id: m.id, username: m.username }] })); setCuMemberSearch(''); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border, #eee)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary, #f5f5f5)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <div style={{ fontWeight: 500 }}>{m.username.split(' /')[0]}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #999)' }}>{m.username.split('/ ').slice(1).join(' / ')}</div>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-sub, #666)' }}>설명</div>
                <textarea value={cuRegForm.description} onChange={e => setCuRegForm(f => ({ ...f, description: e.target.value }))} rows={5} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '13px', resize: 'vertical', background: 'var(--bg, #fff)', color: 'var(--text, #333)', boxSizing: 'border-box' }} placeholder="설명 (선택)" />
              </div>
              {cuRegForm.imageUrls.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={cuRegForm.attachImages} onChange={e => setCuRegForm(f => ({ ...f, attachImages: e.target.checked }))} />
                  <span>이미지 첨부 ({cuRegForm.imageUrls.length}개)</span>
                </label>
              )}
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
              <span className="sidebar-title">Clickpad_v198</span>
              {currentTab === 'notes' && <button className="btn-new" onClick={newNote}>+</button>}
            </div>
            <div className="sidebar-tabs">
              <button className={`tab-btn ${currentTab === 'notes' ? 'active' : ''}`} onClick={() => switchTab('notes')}>메모</button>
              <button className={`tab-btn ${currentTab === 'clickup' ? 'active' : ''}`} onClick={() => switchTab('clickup')}>ClickUp</button>
              <button className={`tab-btn ${currentTab === 'license' ? 'active' : ''}`} onClick={() => switchTab('license')}>라이선스</button>
              <button className={`tab-btn ${currentTab === 'chat' ? 'active' : ''}`} onClick={() => switchTab('chat')}>MM</button>
              <button className={`tab-btn ${currentTab === 'faq' ? 'active' : ''}`} onClick={() => switchTab('faq')}>FAQ</button>
            </div>

            {currentTab === 'notes' && (
              <input className="search-box" type="text" placeholder="메모 검색..." onChange={e => searchNotes(e.target.value)} />
            )}

            {currentTab === 'faq' && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input className="search-box" type="text" placeholder="FAQ 검색..."
                  value={faqSearch}
                  onChange={e => setFaqSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchFaq(faqSearch)}
                  style={{ margin: 0, flex: 1, width: 0 }} />
                <button className="btn-search-clickup" onClick={() => searchFaq(faqSearch)}>🔍</button>
              </div>
            )}

            {currentTab === 'clickup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="sidebar-tabs" style={{ marginBottom: 0 }}>
                  <button className={`tab-btn ${cuSubTab === 'search' ? 'active' : ''}`} onClick={() => switchCuTab('search')}>태스크 조회</button>
                  <button className={`tab-btn ${cuSubTab === 'my' ? 'active' : ''}`} onClick={() => switchCuTab('my')}>내 태스크</button>
                  <button className={`tab-btn ${cuSubTab === 'doc' ? 'active' : ''}`} onClick={() => switchCuTab('doc')}>Doc 페이지</button>
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
                {cuSubTab === 'doc' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input className="search-box" type="text" placeholder="ClickUp Doc URL 붙여넣기"
                        value={cuDocInput} onChange={e => setCuDocInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && loadCuDocPage(cuDocInput)}
                        style={{ margin: 0, flex: 1, width: 0 }} />
                      <button className="btn-search-clickup" onClick={() => loadCuDocPage(cuDocInput)}>🔍</button>
                    </div>
                    {!cuDocPanel && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.8', background: 'var(--bg-sub,#f8f8f8)', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--text)' }}>URL 가져오는 방법</div>
                        <div>① Doc 페이지 열기</div>
                        <div>② 우상단 <b>공유(Share)</b> 클릭</div>
                        <div>③ <b>Public</b> 탭 → <b>Publish</b></div>
                        <div>④ Public link 복사 후 위에 붙여넣기</div>
                        <img src="/clickup-doc-guide.jpg" alt="ClickUp 공유 방법" style={{ width: '60%', maxWidth: '160px', display: 'block', margin: '8px auto 0', borderRadius: '6px', objectFit: 'contain' }} />
                      </div>
                    )}
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
                        {getTaskProducts(t).map(p => <span key={p} style={{ fontSize: '11px', fontWeight: 700, color: '#fff', background: '#4A7AB5', borderRadius: '3px', padding: '1px 5px', marginRight: '2px' }}>{p}</span>)}
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
                        {getTaskProducts(t).map(p => <span key={p} style={{ fontSize: '11px', fontWeight: 700, color: '#fff', background: '#4A7AB5', borderRadius: '3px', padding: '1px 5px', marginRight: '2px' }}>{p}</span>)}
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

          {currentTab === 'faq' && (
            <div className="notes-list">
              {!gwSession && (
                <div className="empty-list">설정에서 그룹웨어<br />GOSSOcookie를 입력해주세요.</div>
              )}
              {gwSession && faqLoading && faqList.length === 0 && (
                <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>
              )}
              {gwSession && !faqLoading && faqList.length === 0 && (
                <div className="empty-list">FAQ 항목이 없습니다.</div>
              )}
              {gwSession && faqList.map(item => {
                const vals = item.values || {};
                const title = getFaqTitle(vals);
                const dateStr = vals.create_date ? vals.create_date.slice(0, 10) : '';
                return (
                  <div key={item.id}
                    className={`note-item ${faqDetail?.doc?.id === item.id ? 'active' : ''}`}
                    onClick={() => openFaqDetail(item.id, title)}>
                    <div className="note-item-title">{title}</div>
                    {dateStr && <div className="note-item-date">{dateStr}</div>}
                  </div>
                );
              })}
              {gwSession && !faqLoading && faqHasMore && (
                <div style={{ padding: '8px 6px' }}>
                  <button className="page-btn" style={{ width: '100%' }} onClick={() => loadFaqList('', faqPage + 1)}>더 보기</button>
                </div>
              )}
              {gwSession && faqLoading && faqList.length > 0 && (
                <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>
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
          (currentTab === 'clickup' && cuSubTab === 'doc' && cuDocPanel !== null) ||
          (currentTab === 'license' && licSubTab === 'my' && licDetail !== null) ||
          (currentTab === 'license' && licSubTab === 'trial' && trialPanel !== null) ||
          (currentTab === 'chat' && mmSelectedChannel !== null) ||
          (currentTab === 'faq' && faqDetail !== null)
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
                <button className="btn-search-clickup" style={{ width: 'auto', padding: '0 10px', fontSize: '12px' }} onClick={() => openCuRegModal()}>📋 ClickUp 등록</button>
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

          {currentTab === 'clickup' && cuSubTab === 'doc' && cuDocPanel && (
            <div className="task-detail">
              <button className="btn-back" style={{ display: 'flex', marginBottom: '8px' }} onClick={() => setCuDocPanel(null)}>←</button>
              {cuDocPanel.loading
                ? <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>
                : cuDocPanel.error
                  ? <div style={{ color: 'red', padding: '16px' }}>{cuDocPanel.error}</div>
                  : <>
                      {cuDocPanel.name && <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>{cuDocPanel.name}</div>}
                      {cuDocPanel.content
                        ? <div className="task-detail-desc" dangerouslySetInnerHTML={{ __html: renderContent(cuDocPanel.content) }} />
                        : cuDocPanel.debug
                          ? <pre style={{ fontSize: '11px', background: '#f4f4f4', padding: '8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{cuDocPanel.debug}</pre>
                          : <div style={{ color: '#888', padding: '16px' }}>내용이 없습니다.</div>
                      }
                    </>
              }
            </div>
          )}

          {currentTab === 'clickup' && !cuDetail && !(cuSubTab === 'doc' && cuDocPanel) && (
            <div className="editor-empty">
              <div className="editor-empty-icon">📋</div>
              <h3>태스크를 선택하세요</h3>
              <p>왼쪽에서 태스크를 선택하면{'\n'}상세 정보가 표시됩니다</p>
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
                  {cuDetail.task.description && <div className="task-detail-desc" dangerouslySetInnerHTML={{ __html: renderMarkdown(cuDetail.task.description) }} />}
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
                  value={mmDateInputs[mmSelectedChannel?.id] || ''}
                  onChange={e => setMmDateInputs(prev => ({ ...prev, [mmSelectedChannel.id]: e.target.value }))}
                  onClick={e => { try { e.target.showPicker(); } catch {} }}
                  style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '13px', background: 'var(--bg, #fff)', color: 'var(--text, #333)', cursor: 'pointer' }}
                />
                <button className="btn-search-clickup" style={{ width: 'auto', padding: '0 10px', fontSize: '12px' }} onClick={mmSummarizeByDate} disabled={mmDateSummarizing || !mmDateInputs[mmSelectedChannel?.id]}>
                  {mmDateSummarizing ? '⏳' : '✨ 요약하기'}
                </button>
                <button className="btn-search-clickup" style={{ width: 'auto', padding: '0 10px', fontSize: '12px' }} onClick={() => mmOpenChannel(mmSelectedChannel)}>🔃 다시 불러오기</button>
              </div>
              {mmDateSummary[mmSelectedChannel?.id] && (
                <div style={{ marginBottom: '10px', padding: '12px', borderRadius: '8px', background: 'var(--accent-bg, #e8f0fe)', border: '1px solid var(--accent, #0066cc)', flexShrink: 0 }}>
                  <div style={{ marginBottom: mmDateSummaryCollapsed[mmSelectedChannel?.id] ? 0 : '6px' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginBottom: '6px' }}>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: 'var(--text, #333)', padding: '2px 7px' }} onClick={() => saveToNote(`${mmChannelDisplayName(mmSelectedChannel)} - ${(mmDateInputs[mmSelectedChannel?.id] || '').replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년 $2월 $3일')}`, mmDateSummary[mmSelectedChannel.id], mmDateImageIds[mmSelectedChannel?.id] || [], mmTokenRef.current)}>📋 메모저장</button>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: '#0066cc', padding: '2px 7px', fontWeight: 600 }} onClick={() => { const dateLabel = (mmDateInputs[mmSelectedChannel?.id] || '').replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년 $2월 $3일'); openCuRegModal(`${mmChannelDisplayName(mmSelectedChannel)} - ${dateLabel}`, mmDateSummary[mmSelectedChannel.id], []); }}>📋 ClickUp 등록</button>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: '#7c3aed', padding: '2px 7px', fontWeight: 600 }} onClick={() => openCuCommentModal(mmDateSummary[mmSelectedChannel.id], mmDateImageIds[mmSelectedChannel?.id] || [])}>💬 태스크에 댓글</button>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: 'var(--text, #333)', padding: '2px 7px' }} onClick={mmSummarizeByDate} disabled={mmDateSummarizing}>🔄 다시 요약하기</button>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: 'var(--text, #333)', padding: '2px 7px' }} onClick={() => setMmDateSummaryCollapsed(prev => ({ ...prev, [mmSelectedChannel.id]: !prev[mmSelectedChannel.id] }))}>{mmDateSummaryCollapsed[mmSelectedChannel?.id] ? '▼' : '▲'}</button>
                      <button style={{ background: 'var(--bg, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', color: 'var(--text, #333)', padding: '2px 7px' }} onClick={() => setMmDateSummary(prev => ({ ...prev, [mmSelectedChannel.id]: '' }))}>✕</button>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>📅 {(mmDateInputs[mmSelectedChannel?.id] || '').replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년 $2월 $3일')} 요약</div>
                  </div>
                  {!mmDateSummaryCollapsed[mmSelectedChannel?.id] && <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{mmDateSummary[mmSelectedChannel.id]}</div>}
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
          {currentTab === 'faq' && !faqDetail && (
            <div className="editor-empty">
              <div className="editor-empty-icon">📖</div>
              <h3>FAQ 항목을 선택하세요</h3>
              <p>왼쪽에서 항목을 선택하면<br />상세 내용이 표시됩니다</p>
            </div>
          )}
          {currentTab === 'faq' && faqDetail && (
            <div className="task-detail" style={{ overflowY: 'auto' }}>
              <button className="btn-back" style={{ display: 'flex', marginBottom: '16px' }} onClick={() => setFaqDetail(null)}>←</button>
              {faqDetail.loading
                ? <div className="loading-wrap"><div className="spinner" /><span>불러오는 중...</span></div>
                : faqDetail.doc && (() => {
                  const vals = faqDetail.doc.values || faqDetail.doc;
                  // 목록에서 전달받은 제목 우선 사용
                  const title = faqDetail.title || getFaqTitle(typeof vals === 'object' ? vals : {});
                  const metaFields = getFaqMetaFields(vals, title);
                  const dateStr = vals.create_date ? vals.create_date.slice(0, 10) : '';
                  const creator = vals.creator?.fullName || vals.creator?.name || '';
                  const bodySections = getFaqBodySections(vals, title, metaFields);
                  return (
                    <>
                      {/* 이슈요약 섹션 */}
                      <div style={{ borderBottom: '2px solid var(--border, #e0e0e0)', marginBottom: '16px', paddingBottom: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#c0392b', marginBottom: '6px', letterSpacing: '0.5px' }}>◆ 이슈요약 ◆</div>
                        <div style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.5, color: 'var(--text)' }}>{title}</div>
                      </div>

                      {/* 기본정보 섹션 */}
                      {metaFields.length > 0 && (
                        <div style={{ borderBottom: '2px solid var(--border, #e0e0e0)', marginBottom: '16px', paddingBottom: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#c0392b', marginBottom: '10px', letterSpacing: '0.5px' }}>◆ 기본정보 ◆</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px' }}>
                            {metaFields.map((v, i) => (
                              <div key={i} style={{ fontSize: '13px', color: 'var(--text)', minWidth: '120px' }}>
                                <span style={{ color: '#2980b9', fontWeight: 600, marginRight: '6px' }}>●</span>{v}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 작성자/날짜 */}
                      {(dateStr || creator) && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                          {creator && <span style={{ marginRight: '8px' }}>{creator}</span>}
                          {dateStr}
                        </div>
                      )}

                      {/* 공지 상세 섹션 */}
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#c0392b', marginBottom: '10px', letterSpacing: '0.5px' }}>◆ 공지 상세 ◆</div>
                        {bodySections.length === 0
                          ? <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>(내용 없음)</div>
                          : bodySections.map((s, i) => (
                            <div key={i} style={{ marginBottom: i < bodySections.length - 1 ? '16px' : 0 }}>
                              {s.html
                                ? <div className="faq-content" style={{ fontSize: '14px', lineHeight: 1.8, wordBreak: 'break-word', color: 'var(--text)' }}
                                    dangerouslySetInnerHTML={{ __html: s.content.replace(/\n/g, '<br>') }} />
                                : <div style={{ fontSize: '14px', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text)' }}>{s.content}</div>
                              }
                            </div>
                          ))
                        }
                      </div>
                    </>
                  );
                })()
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
            <input type="text" value={settingsData.username} readOnly style={{ opacity: 0.6, cursor: 'default' }} />
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
          <div className="settings-divider">그룹웨어 연동</div>
          <div className="form-group">
            <label>GOSSOcookie 값</label>
            <input type="text" value={settingsData.gwSession}
              onChange={e => setSettingsData(p => ({ ...p, gwSession: e.target.value }))}
              placeholder="그룹웨어 로그인 후 쿠키값 입력" />
            <div className="input-hint">gw.ex-em.com 로그인 후 개발자도구 → Application → Cookies → GOSSOcookie 값</div>
          </div>
          <button className="btn-success" onClick={saveProfile}>저장</button>
          <div className={`settings-message ${settingsMsg.type}`}>{settingsMsg.text}</div>
        </div>
      </div>

      {cuCommentModal && (
        <div className="admin-overlay show" onClick={e => e.target === e.currentTarget && setCuCommentModal(null)}>
          <div className="admin-card" style={{ width: '480px', maxWidth: '95vw' }}>
            <div className="admin-header">
              <h2>💬 태스크에 댓글 추가</h2>
              <button className="admin-close" onClick={() => setCuCommentModal(null)}>✕</button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              내 태스크에서 선택하면 요약 내용이 댓글로 추가됩니다.
              {cuCommentModal?.imageIds?.length > 0 && <span style={{ marginLeft: '6px', color: '#7c3aed', fontWeight: 600 }}>🖼 이미지 {cuCommentModal.imageIds.length}개 첨부 예정</span>}
            </div>
            <input
              type="text"
              value={cuCommentSearch}
              onChange={e => setCuCommentSearch(e.target.value)}
              placeholder="태스크명 필터..."
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border, #ddd)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box', marginBottom: '8px' }}
              autoFocus
            />
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border, #ddd)', borderRadius: '6px' }}>
              {cuCommentSearching && <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>불러오는 중...</div>}
              {!cuCommentSearching && myTasks.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>내 태스크가 없습니다.</div>
              )}
              {!cuCommentSearching && myTasks
                .filter(t => !cuCommentSearch.trim() || t.name.toLowerCase().includes(cuCommentSearch.toLowerCase()))
                .map(t => (
                <div key={t.id}
                  style={{ padding: '10px 14px', borderBottom: '1px solid var(--border, #eee)', cursor: cuCommentPosting ? 'default' : 'pointer', fontSize: '13px', opacity: cuCommentPosting ? 0.6 : 1 }}
                  onClick={() => !cuCommentPosting && postCommentToTask(t.id)}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{t.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.list?.name} · {t.status?.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
