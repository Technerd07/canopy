let ADMIN_USERS = [];
let CURRENT_USER = null;

const MAX_FILE_BYTES = 500 * 1024 * 1024;
const MAX_MEDIA_ITEMS = 10;
const STORAGE_KEY = 'canopy_posts_v10';
const VOTED_KEY = 'canopy_voted_v10';
const SAVED_KEY = 'canopy_saved_v10';

const GENERAL_CATEGORY = 'General';
const MOMENTS_CATEGORY = 'Moments';
const COLLECTIONS = ['Snapshots', 'Technology', 'News & Politics', 'Journal & Mindfulness', 'Random'];
const POST_TONES = [
  { id: 'sage', label: 'Sage' },
  { id: 'sky', label: 'Sky' },
  { id: 'lavender', label: 'Lavender' },
  { id: 'amber', label: 'Amber' },
  { id: 'rose', label: 'Rose' },
  { id: 'teal', label: 'Teal' },
  { id: 'coral', label: 'Coral' },
  { id: 'indigo', label: 'Indigo' },
  { id: 'olive', label: 'Olive' },
  { id: 'slate', label: 'Slate' }
];

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const normName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();

// ================= SERVER-BACKED AUTH =================
const getCurrentUser = () => CURRENT_USER;
const isAdmin = (u) => Boolean(u && u.role === 'admin');
const getAdminTitle = (name) => (ADMIN_USERS.find((u) => normName(u.name) === normName(name)) || {}).title || '';

function renderAuthorBadge(role, authorName = '') {
  if (role !== 'admin') return '';
  const title = authorName ? getAdminTitle(authorName) : '';
  const tip = title ? `Site Administrator · ${title}` : 'Site Administrator';
  return `<span class="admin-badge" title="${escapeHtml(tip)}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>Admin</span>`;
}

function isReservedAuthorName(name) {
  if (isAdmin(getCurrentUser())) return false;
  const n = normName(name);
  return Boolean(n && ADMIN_USERS.some((u) => normName(u.name) === n || normName(u.id) === n));
}

async function initAuthFromServer() {
  try {
    const [aRes, mRes] = await Promise.all([
      fetch('/api/auth/admins', { credentials: 'same-origin' }),
      fetch('/api/auth/me', { credentials: 'same-origin' })
    ]);
    if (aRes.ok) ADMIN_USERS = (await aRes.json()).admins || [];
    if (mRes.ok) CURRENT_USER = (await mRes.json()).user || null;
  } catch (err) {
    console.error('Auth init failed:', err);
  }
  renderAdminToggle();
  syncAllAuthorInputs();
  syncGeneralCategoryOption();
  renderDomainChips();
  render();
}

async function verifyAdminCredentials(username, passphrase) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, passphrase })
    });
    if (!res.ok) return null;
    CURRENT_USER = (await res.json()).user || null;
    return CURRENT_USER;
  } catch {
    return null;
  }
}

async function signOutAdminSession() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  CURRENT_USER = null;
}

// ================= DOMAINS, PLATFORMS & ICONS =================
const DOMAINS = [
  { id: 'general', label: 'General Notice', section: GENERAL_CATEGORY, defaultTone: 'sky', keywords: /\b(announcement|notice|guideline|changelog|welcome)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' },
  { id: 'moments', label: 'Day-to-Day', section: MOMENTS_CATEGORY, defaultTone: 'coral', keywords: /\b(day to day|daily|moment|today|weekend|trip|walk)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.1"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#f97316"/></svg>' },
  { id: 'tech', label: 'Technology', section: 'Technology', defaultTone: 'indigo', keywords: /\b(code|linux|docker|podman|nginx|k8s|kubernetes|postgres|sql|rust|python|js|react|api|server|cli|bash|git)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.3"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
  { id: 'ai', label: 'AI & Research', section: 'Technology', defaultTone: 'lavender', keywords: /\b(ai|llm|neural|transformer|gpt|mistral|model|lora|gguf|inference)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.1"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/></svg>' },
  { id: 'photo', label: 'Photography', section: 'Snapshots', defaultTone: 'rose', keywords: /\b(photo|photography|camera|lens|film|cinema|video|sunset|golden hour|snapshot)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.1"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>' },
  { id: 'nature', label: 'Nature', section: 'Snapshots', defaultTone: 'sage', keywords: /\b(nature|forest|tree|mountain|coast|garden|flower|hiking|coffee|morning)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.1"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>' },
  { id: 'politics', label: 'World & Policy', section: 'News & Politics', defaultTone: 'slate', keywords: /\b(politics|policy|government|election|parliament|geopolitics|news|world|economy)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.1"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg>' },
  { id: 'medical', label: 'Health Brief', section: 'News & Politics', defaultTone: 'teal', keywords: /\b(medical|medicine|clinical|health|vaccine|pubmed|who|trial)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.3"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>' },
  { id: 'mindfulness', label: 'Vedanta & Mind', section: 'Journal & Mindfulness', defaultTone: 'amber', keywords: /\b(vedanta|advaita|upanishad|gita|mindfulness|meditation|dharma|awareness|philosophy)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.1"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>' },
  { id: 'random', label: 'Miscellany', section: 'Random', defaultTone: 'lavender', keywords: /\b(random|misc|curious|trivia)\b/i, svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.1"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="1.5" fill="#8b5cf6"/></svg>' }
];

const PLATFORMS = [
  { match: /github\.com/i, name: 'GitHub', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.02c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>' },
  { match: /youtube\.com|youtu\.be/i, name: 'YouTube', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-3.8.5-5.8s-.1-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>' },
  { match: /pubmed|who\.int/i, name: 'Health News', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.4"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>' },
  { match: /unsplash\.com|instagram\.com/i, name: 'Photo', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg>' }
];

const DEFAULT_LINK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const EDIT_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
const EYE_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.1"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const PLAY_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-left:2px;"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
const UPVOTE_SVG = (active, size = 15) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V8"/><path d="M12 13c0-4 3-6.5 6.5-6.5 0 4-2.5 6.5-6.5 6.5Z" fill="${active ? 'currentColor' : 'none'}" fill-opacity="${active ? '0.28' : '0'}"/><path d="M12 16c0-3.2-2.4-5.4-5.4-5.4 0 3.2 2.2 5.4 5.4 5.4Z" fill="${active ? 'currentColor' : 'none'}" fill-opacity="${active ? '0.28' : '0'}"/></svg>`;

const ICONS = {
  All: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="#3b82f6"/><rect x="13" y="3" width="8" height="8" rx="2" fill="#60a5fa"/><rect x="3" y="13" width="8" height="8" rx="2" fill="#93c5fd"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#2563eb"/></svg>',
  Saved: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" stroke-width="2.1"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>',
  General: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(14,165,233,0.16)" stroke="#0284c7" stroke-width="2.1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  Moments: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(249,115,22,0.16)" stroke="#f97316" stroke-width="2.1"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="#f97316"/></svg>',
  Snapshots: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(236,72,153,0.15)" stroke="#ec4899" stroke-width="2.1"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="3.2"/></svg>',
  Technology: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(99,102,241,0.14)" stroke="#6366f1" stroke-width="2.1"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>',
  'News & Politics': '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(59,130,246,0.14)" stroke="#3b82f6" stroke-width="2.1"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h10"/></svg>',
  'Journal & Mindfulness': '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(245,158,11,0.14)" stroke="#f59e0b" stroke-width="2.1"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>',
  Random: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(139,92,246,0.14)" stroke="#8b5cf6" stroke-width="2.1"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="1.4" fill="#8b5cf6"/></svg>'
};

const getHostname = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const detectPlatform = (url) => (!url ? null : PLATFORMS.find((p) => p.match.test(url)) || { name: getHostname(url) || 'Link', svg: DEFAULT_LINK_ICON });
const getDomainObj = (id) => DOMAINS.find((d) => d.id === id) || DOMAINS[DOMAINS.length - 1];
const getToneObj = (id) => POST_TONES.find((t) => t.id === id) || POST_TONES[0];

function detectDomainFromText(text, url = '') {
  const combined = `${text} ${url}`;
  for (const d of DOMAINS) {
    if (d.id === 'general' && !isAdmin(getCurrentUser())) continue;
    if (d.keywords.test(combined)) return d.id;
  }
  if (/pubmed|who\.int/i.test(url)) return 'medical';
  if (/github\.com/i.test(url)) return 'tech';
  if (/unsplash\.com|instagram\.com/i.test(url)) return 'photo';
  return 'random';
}

function resolvePostTone(post) {
  if (post.tone && POST_TONES.some((t) => t.id === post.tone)) return post.tone;
  const dom = getDomainObj(post.domain);
  return (dom && dom.defaultTone) || POST_TONES[Math.abs(Number(post.id || 0)) % POST_TONES.length].id;
}

const SEED_POSTS = [
  {
    id: 600,
    title: 'Welcome to Canopy — General Notices & House Notes',
    summary: 'A self-hosted, account-free archive for essays, daily visual notes, and calm conversation hosted directly on our own hardware.',
    body: 'Welcome to Canopy.\n\n• No visitor accounts or third-party tracking are required to read or contribute.\n• General Notices is reserved for site updates and housekeeping from administrators.\n• Open any multi-photo entry to browse its full-resolution sliding gallery.',
    url: '',
    category: GENERAL_CATEGORY,
    domain: 'general',
    tone: 'sky',
    author: 'Damodar',
    authorRole: 'admin',
    upvotes: 18,
    views: 340,
    media: [],
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    comments: []
  },
  {
    id: 607,
    title: 'Evening Coffee & Golden Skies',
    summary: 'Three quiet frames from the evening walk. Open this entry to slide through the full gallery.',
    body: 'Caught warm late-afternoon light on the way back home and stopped for filter coffee. Use the arrows or swipe to move through each frame.',
    url: '',
    category: MOMENTS_CATEGORY,
    domain: 'moments',
    tone: 'coral',
    author: 'Damodar',
    authorRole: 'admin',
    upvotes: 34,
    views: 510,
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85' },
      { type: 'image', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85' },
      { type: 'image', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85' }
    ],
    createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    comments: []
  },
  {
    id: 602,
    title: 'Botanical Time-Lapse Study',
    summary: 'Click the video directly to play inline, or click the card title to open the full entry and discussion.',
    body: 'Native HTML5 video playback works inline on the feed and inside the sliding gallery when opened.',
    url: '',
    category: 'Snapshots',
    domain: 'nature',
    tone: 'sage',
    author: 'Damodar',
    authorRole: 'admin',
    upvotes: 62,
    views: 890,
    media: [{ type: 'video', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' }],
    createdAt: new Date(Date.now() - 3600_000 * 4).toISOString(),
    comments: []
  },
  {
    id: 603,
    title: 'Notes on Advaita Vedanta: The Witness in Daily Noise',
    summary: 'Reflections on separating observation from mental commentary during busy days.',
    body: 'In Vedanta, the mind is treated as an instrument rather than identity itself.\n\nNotice the thought arising, notice the space in which it appears, and pause two breaths before reacting.',
    url: '',
    category: 'Journal & Mindfulness',
    domain: 'mindfulness',
    tone: 'amber',
    author: 'Damodar',
    authorRole: 'admin',
    upvotes: 54,
    views: 780,
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=85' }],
    createdAt: new Date(Date.now() - 3600_000 * 7).toISOString(),
    comments: []
  },
  {
    id: 604,
    title: 'Rootless Podman & Nginx Alpine Edge Setup',
    summary: 'Serving static assets and proxying internal API routes with minimal footprint and isolated networking.',
    body: 'Built a lightweight edge container using nginx:alpine with 512M client_max_body_size and an isolated db-internal Docker network.',
    url: 'https://github.com',
    category: 'Technology',
    domain: 'tech',
    tone: 'indigo',
    author: 'Damodar',
    authorRole: 'admin',
    upvotes: 24,
    views: 462,
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=85' }],
    createdAt: new Date(Date.now() - 3600_000 * 11).toISOString(),
    comments: []
  }
];

function migratePosts(rawPosts) {
  const list = (rawPosts || []).map((p) => ({
    ...p,
    authorRole: p.authorRole || 'member',
    tone: resolvePostTone(p),
    comments: (p.comments || []).map((c) => ({
      ...c,
      authorRole: c.authorRole || 'member',
      replies: (c.replies || []).map((r) => ({ ...r, authorRole: r.authorRole || 'member' }))
    }))
  }));
  if (!list.some((p) => p.category === GENERAL_CATEGORY)) list.unshift(SEED_POSTS[0]);
  if (!list.some((p) => p.category === MOMENTS_CATEGORY)) list.splice(1, 0, SEED_POSTS[1]);
  return list;
}

const storedPosts = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const state = {
  posts: migratePosts(storedPosts || SEED_POSTS),
  voted: new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || '[]')),
  saved: new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')),
  upvotedComments: new Set(),
  view: 'All',
  sort: 'top',
  query: '',
  activePostId: null,
  editingPostId: null,
  replyingToId: null,
  scatterPostId: null,
  lightboxPostId: null,
  lightboxIndex: 0,
  selectedDomain: 'random',
  selectedTone: 'sage',
  manualDomainOverride: false,
  manualSectionOverride: false,
  manualToneOverride: false,
  pendingMedia: [],
  dragMediaIndex: null,
  savedScrollY: 0,
  isTransitioning: false,
  feedNeedsRefresh: false
};

const formatViews = (n = 0) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));
const formatBytes = (b) => (b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const timeAgo = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
};
const getPostMedia = (p) => (Array.isArray(p.media) ? p.media : p.mediaUrl ? [{ type: p.mediaType || 'image', url: p.mediaUrl }] : []);
const countAllComments = (p) => (p.comments || []).reduce((a, c) => a + 1 + (c.replies ? c.replies.length : 0), 0);

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}

function spawnUpvoteFloat(btnEl, text = '+1') {
  if (!btnEl) return;
  btnEl.classList.remove('upvote-burst');
  void btnEl.offsetWidth;
  btnEl.classList.add('upvote-burst');
  const r = btnEl.getBoundingClientRect();
  const tag = document.createElement('span');
  tag.className = 'upvote-float';
  tag.textContent = text;
  tag.style.left = `${r.left + r.width / 2}px`;
  tag.style.top = `${r.top - 4}px`;
  document.body.appendChild(tag);
  setTimeout(() => tag.remove(), 860);
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state.posts.map((p) => ({ ...p, media: getPostMedia(p).filter((m) => m.url && !m.url.startsWith('blob:')) })))
  );
  localStorage.setItem(VOTED_KEY, JSON.stringify([...state.voted]));
  localStorage.setItem(SAVED_KEY, JSON.stringify([...state.saved]));
}

// ================= MEDIA RENDERERS: COLLAGE ON FEED, SLIDER INSIDE POST =================
function renderMediaCollage(post, isPreview = false) {
  const items = getPostMedia(post);
  if (!items.length) return '';
  const visible = Math.min(items.length, 4);
  const extra = items.length - 4;

  const tiles = items.slice(0, 4).map((item, idx) => {
    const isLastExtra = idx === 3 && extra > 0;
    if (item.type === 'video') {
      return `
        <div class="collage-tile video-tile" ${isPreview ? '' : 'data-inline-video="true"'}>
          <video src="${item.url}" playsinline preload="metadata"></video>
          <div class="play-overlay"><div class="play-circle">${PLAY_ICON}</div></div>
          <span class="media-badge">Video</span>
          ${isLastExtra ? `<div class="more-overlay">+${extra}</div>` : ''}
        </div>`;
    }
    return `
      <div class="collage-tile">
        <img src="${item.url}" alt="${escapeHtml(post.title || 'Media')} (${idx + 1})" loading="lazy" />
        ${isLastExtra ? `<div class="more-overlay">+${extra}</div>` : ''}
      </div>`;
  }).join('');

  return `<div class="media-collage count-${visible}">${tiles}</div>`;
}

function renderMediaCarousel(post) {
  const items = getPostMedia(post);
  if (!items.length) return '';
  const multi = items.length > 1;
  const slides = items.map((item, idx) => {
    if (item.type === 'video') {
      return `<div class="carousel-slide video-slide"><video src="${item.url}" controls playsinline preload="metadata"></video></div>`;
    }
    return `<div class="carousel-slide" data-lightbox="${post.id}" data-media-index="${idx}"><img src="${item.url}" alt="${escapeHtml(post.title || 'Slide')} (${idx + 1})" loading="lazy" /></div>`;
  }).join('');

  return `
    <div class="media-carousel" data-carousel="true">
      <div class="carousel-track">${slides}</div>
      ${multi ? `
        <button type="button" class="carousel-nav carousel-prev" data-carousel-dir="-1" aria-label="Previous slide">‹</button>
        <button type="button" class="carousel-nav carousel-next" data-carousel-dir="1" aria-label="Next slide">›</button>
        <span class="carousel-counter">1 / ${items.length}</span>
        <div class="carousel-dots">${items.map((_, i) => `<button type="button" class="carousel-dot ${i === 0 ? 'active' : ''}" data-carousel-goto="${i}" aria-label="Go to slide ${i + 1}"></button>`).join('')}</div>` : ''}
    </div>`;
}

function updateCarouselIndicator(carousel) {
  const track = carousel.querySelector('.carousel-track');
  if (!track || !track.clientWidth) return;
  const idx = Math.round(track.scrollLeft / track.clientWidth);
  const total = carousel.querySelectorAll('.carousel-slide').length;
  const counter = carousel.querySelector('.carousel-counter');
  if (counter) counter.textContent = `${idx + 1} / ${total}`;
  carousel.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

function pauseAllInlineVideos(exceptVideo = null) {
  document.querySelectorAll('.video-tile video').forEach((v) => {
    if (v !== exceptVideo && !v.paused) {
      v.pause();
      v.closest('.video-tile')?.classList.remove('playing');
    }
  });
}

document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-carousel-dir]');
  if (navBtn) {
    e.stopPropagation();
    const c = navBtn.closest('[data-carousel]');
    const track = c && c.querySelector('.carousel-track');
    if (!track) return;
    track.querySelectorAll('video').forEach((v) => v.pause());
    const total = c.querySelectorAll('.carousel-slide').length;
    const cur = Math.round(track.scrollLeft / (track.clientWidth || 1));
    const next = (cur + Number(navBtn.dataset.carouselDir) + total) % total;
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
    return;
  }
  const dot = e.target.closest('[data-carousel-goto]');
  if (dot) {
    e.stopPropagation();
    const c = dot.closest('[data-carousel]');
    const track = c && c.querySelector('.carousel-track');
    if (track) {
      track.querySelectorAll('video').forEach((v) => v.pause());
      track.scrollTo({ left: Number(dot.dataset.carouselGoto) * track.clientWidth, behavior: 'smooth' });
    }
  }
});

document.addEventListener('scroll', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('carousel-track')) {
    const c = e.target.closest('[data-carousel]');
    if (c) updateCarouselIndicator(c);
  }
}, true);

// ================= ADMIN UI SYNC =================
function renderAdminToggle() {
  const btn = document.getElementById('adminToggle');
  const user = getCurrentUser();
  if (isAdmin(user)) {
    btn.classList.add('admin-signed-in');
    btn.title = 'Signed in as administrator · click to sign out';
    btn.innerHTML = `<span class="admin-dot"></span><span>${escapeHtml(user.name)} · Sign Out</span>`;
  } else {
    btn.classList.remove('admin-signed-in');
    btn.title = 'Administrator sign-in';
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Admin</span>`;
  }
}

function syncGeneralCategoryOption() {
  const opt = document.getElementById('generalCategoryOption');
  const sel = document.getElementById('fCategory');
  if (!opt || !sel) return;
  const admin = isAdmin(getCurrentUser());
  opt.disabled = !admin;
  opt.hidden = !admin;
  if (!admin && sel.value === GENERAL_CATEGORY) sel.value = 'Random';
}

function syncAuthorField(el) {
  if (!el) return;
  const user = getCurrentUser();
  if (isAdmin(user)) {
    el.value = user.name;
    el.readOnly = true;
    el.classList.add('admin-locked');
  } else {
    if (el.classList.contains('admin-locked')) el.value = '';
    el.readOnly = false;
    el.classList.remove('admin-locked');
  }
}

function syncAllAuthorInputs() {
  syncAuthorField(document.getElementById('fAuthor'));
  syncAuthorField(document.getElementById('cAuthor'));
  document.querySelectorAll('.reply-author').forEach(syncAuthorField);
}

function setInlineError(el, msg) {
  if (el) {
    el.textContent = msg || '';
    el.classList.toggle('visible', Boolean(msg));
  }
}

function openAdminModal() {
  const user = getCurrentUser();
  const form = document.getElementById('adminSignInForm');
  const out = document.getElementById('adminSignOutView');
  setInlineError(document.getElementById('adminSignInError'), '');
  if (isAdmin(user)) {
    document.getElementById('adminModalTitle').textContent = 'Administrator Session';
    form.style.display = 'none';
    out.style.display = 'block';
    document.getElementById('adminActiveName').textContent = user.name;
    document.getElementById('adminActiveBadge').innerHTML = renderAuthorBadge(user.role, user.name);
    const t = getAdminTitle(user.name);
    document.getElementById('adminActiveTitle').textContent = t ? `${t} · Active Session` : 'Signed in as administrator';
    openModal('adminModal');
  } else {
    document.getElementById('adminModalTitle').textContent = 'Administrator Sign In';
    form.style.display = 'flex';
    out.style.display = 'none';
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassphrase').value = '';
    openModal('adminModal');
    setTimeout(() => document.getElementById('adminUsername').focus(), 50);
  }
}

document.getElementById('adminToggle').onclick = openAdminModal;
document.getElementById('adminSignInForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const session = await verifyAdminCredentials(
    document.getElementById('adminUsername').value.trim(),
    document.getElementById('adminPassphrase').value
  );
  if (!session) {
    setInlineError(document.getElementById('adminSignInError'), 'Invalid username or passphrase.');
    showToast('Invalid credentials');
    document.getElementById('adminPassphrase').select();
    return;
  }
  closeModal('adminModal');
  renderAdminToggle();
  syncAllAuthorInputs();
  syncGeneralCategoryOption();
  renderDomainChips();
  render();
  renderComposerPreview();
  showToast(`Signed in as ${session.name}`);
});

document.getElementById('confirmSignOutBtn').onclick = async () => {
  const prev = getCurrentUser();
  await signOutAdminSession();
  closeModal('adminModal');
  renderAdminToggle();
  syncAllAuthorInputs();
  syncGeneralCategoryOption();
  renderDomainChips();
  render();
  renderComposerPreview();
  showToast(prev ? `Signed out (${prev.name})` : 'Signed out');
};

// ================= FEED RENDERING & ACTIONS =================
function renderTopRailOnly() {
  const top = [...state.posts].sort((a, b) => b.upvotes - a.upvotes).slice(0, 4);
  document.getElementById('topList').innerHTML = top.map((p) => `
    <li class="mini-item" data-open-post="${p.id}" data-tone="${resolvePostTone(p)}">
      <span class="mini-item-left"><span class="tone-dot"></span><span class="mini-item-title">${escapeHtml(p.title)}</span></span>
      <span class="mini-score">${UPVOTE_SVG(true, 13)} ${p.upvotes}</span>
    </li>`).join('');
}

function toggleUpvote(id, triggerEl = null) {
  const post = state.posts.find((p) => p.id === id);
  if (!post) return;
  const nowVoted = !state.voted.has(id);
  if (nowVoted) {
    state.voted.add(id);
    post.upvotes += 1;
    spawnUpvoteFloat(triggerEl, '+1');
  } else {
    state.voted.delete(id);
    post.upvotes = Math.max(0, post.upvotes - 1);
  }
  saveState();
  const card = document.querySelector(`[data-open-post="${id}"]`);
  const btn = card && card.querySelector(`[data-upvote="${id}"]`);
  if (btn) {
    btn.classList.toggle('voted', nowVoted);
    btn.innerHTML = `${UPVOTE_SVG(nowVoted)}<span>${post.upvotes}</span>`;
  }
  renderTopRailOnly();
  if (state.activePostId === id) updatePostViewHeaderAndActions(post);
}

function toggleSave(id) {
  const nowSaved = !state.saved.has(id);
  if (nowSaved) {
    state.saved.add(id);
    showToast('Saved to bookmarks');
  } else {
    state.saved.delete(id);
    showToast('Removed from bookmarks');
  }
  saveState();
  const card = document.querySelector(`[data-open-post="${id}"]`);
  if (card) {
    if (state.view === 'Saved' && !nowSaved) {
      card.remove();
      if (!document.querySelectorAll('#postList > *').length) render();
    } else {
      const btn = card.querySelector(`[data-save="${id}"]`);
      if (btn) {
        btn.classList.toggle('saved', nowSaved);
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${nowSaved ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="2.2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>`;
      }
    }
  }
  const pill = document.querySelector('#primaryNav [data-view="Saved"] .count-pill');
  if (pill) pill.textContent = state.posts.filter((p) => state.saved.has(p.id)).length;
  if (state.activePostId === id) {
    const p = state.posts.find((x) => x.id === id);
    if (p) updatePostViewHeaderAndActions(p);
  }
}

function render() {
  state.feedNeedsRefresh = false;
  document.getElementById('feedView').classList.remove('no-card-anim');
  const admin = isAdmin(getCurrentUser());

  document.getElementById('primaryNav').innerHTML = [
    { id: 'All', label: 'All Entries', count: state.posts.length },
    { id: 'Saved', label: 'Bookmarks', count: state.posts.filter((p) => state.saved.has(p.id)).length }
  ].map((i) => `<li><button type="button" class="nav-btn ${state.view === i.id && !state.activePostId ? 'active' : ''}" data-view="${i.id}"><span class="nav-btn-left">${ICONS[i.id]}${i.label}</span><span class="count-pill">${i.count}</span></button></li>`).join('');

  document.getElementById('generalNav').innerHTML = `<li><button type="button" class="nav-btn ${state.view === GENERAL_CATEGORY && !state.activePostId ? 'active' : ''}" data-view="${GENERAL_CATEGORY}"><span class="nav-btn-left">${ICONS.General}General Notices</span><span class="count-pill">${state.posts.filter((p) => p.category === GENERAL_CATEGORY).length}</span></button></li>`;
  document.getElementById('momentsNav').innerHTML = `<li><button type="button" class="nav-btn ${state.view === MOMENTS_CATEGORY && !state.activePostId ? 'active' : ''}" data-view="${MOMENTS_CATEGORY}"><span class="nav-btn-left">${ICONS.Moments}Day-to-Day</span><span class="count-pill">${state.posts.filter((p) => p.category === MOMENTS_CATEGORY).length}</span></button></li>`;
  document.getElementById('categoryNav').innerHTML = COLLECTIONS.map((c) => `<li><button type="button" class="nav-btn ${state.view === c && !state.activePostId ? 'active' : ''}" data-view="${c}"><span class="nav-btn-left">${ICONS[c]}${escapeHtml(c)}</span><span class="count-pill">${state.posts.filter((p) => p.category === c).length}</span></button></li>`).join('');

  const inGeneral = state.view === GENERAL_CATEGORY && !state.query.trim();
  const inMoments = state.view === MOMENTS_CATEGORY && !state.query.trim();
  const openBtn = document.getElementById('openComposer');
  const openLabel = document.getElementById('openComposerLabel');
  const lockPill = document.getElementById('generalLockPill');
  if (inGeneral && !admin) {
    openBtn.style.display = 'none';
    lockPill.style.display = 'inline-flex';
  } else {
    openBtn.style.display = 'inline-flex';
    lockPill.style.display = 'none';
    openLabel.textContent = inGeneral ? 'New Notice' : inMoments ? 'Add Moment' : 'New Entry';
  }

  const q = state.query.trim().toLowerCase();
  let filtered = state.posts.filter((p) => (state.view === 'Saved' ? state.saved.has(p.id) : state.view === 'All' || p.category === state.view));
  if (state.sort === 'media') filtered = filtered.filter((p) => getPostMedia(p).length > 0);
  if (q) filtered = filtered.filter((p) => `${p.title} ${p.summary} ${p.body || ''} ${p.author} ${p.category}`.toLowerCase().includes(q));
  filtered.sort((a, b) =>
    state.sort === 'latest' || inGeneral || inMoments
      ? new Date(b.createdAt) - new Date(a.createdAt)
      : b.upvotes - a.upvotes || new Date(b.createdAt) - new Date(a.createdAt)
  );

  document.getElementById('feedHeading').textContent = q
    ? `Search: "${state.query}"`
    : state.view === 'All'
      ? 'All Entries'
      : inGeneral
        ? 'General Notices'
        : inMoments
          ? 'Day-to-Day Moments'
          : state.view;
  document.getElementById('clearSearchBtn').classList.toggle('visible', Boolean(q));
  document.getElementById('searchTriggerText').textContent = q ? `Search: ${state.query}` : 'Search archive…';
  document.getElementById('feedMeta').textContent = inGeneral
    ? `${filtered.length} notices · curated by administrators`
    : inMoments
      ? `${filtered.length} moments · visual diary`
      : `${filtered.length} entries · ${state.sort === 'latest' ? 'most recent' : state.sort === 'media' ? 'visual entries' : 'featured'}`;

  const list = document.getElementById('postList');
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">${q ? `No entries matched "${escapeHtml(state.query)}".` : 'No entries here yet.'}</div>`;
    renderTopRailOnly();
    return;
  }

  list.innerHTML = filtered.map((post, idx) => {
    const voted = state.voted.has(post.id);
    const saved = state.saved.has(post.id);
    const tone = resolvePostTone(post);
    const domainObj = getDomainObj(post.domain || detectDomainFromText(`${post.title} ${post.summary}`, post.url));
    const commentCount = countAllComments(post);
    const canEdit = post.category !== GENERAL_CATEGORY || admin;
    const hasUrl = post.url && /^https?:\/\//i.test(post.url);
    const plat = hasUrl ? detectPlatform(post.url) : null;

    if (post.category === MOMENTS_CATEGORY) {
      const init = (post.author || '?').slice(0, 2).toUpperCase();
      return `
        <article class="moment-card" data-open-post="${post.id}" data-tone="${tone}" style="animation-delay:${Math.min(idx, 6) * 25}ms">
          <div class="moment-head">
            <div class="moment-author-row">
              <div class="moment-avatar">${escapeHtml(init)}</div>
              <div class="moment-author-meta">
                <span class="moment-author-name">${escapeHtml(post.author)}${renderAuthorBadge(post.authorRole, post.author)}</span>
                <span class="moment-time" data-ts="${post.createdAt}">${timeAgo(post.createdAt)}${post.editedAt ? ' · edited' : ''}</span>
              </div>
            </div>
            <span class="section-tag">Day-to-Day</span>
          </div>
          ${renderMediaCollage(post)}
          <div class="moment-body">
            <div class="moment-action-bar">
              <div class="moment-action-left">
                <button type="button" class="moment-action-btn ${voted ? 'voted' : ''}" data-upvote="${post.id}">${UPVOTE_SVG(voted)}<span>${post.upvotes}</span></button>
                <span class="moment-action-btn" style="cursor:default;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span data-comment-count="${post.id}">${commentCount}</span></span>
              </div>
              <div class="moment-action-left">
                <button type="button" class="moment-action-btn ${saved ? 'saved' : ''}" data-save="${post.id}" title="Bookmark"><svg width="14" height="14" viewBox="0 0 24 24" fill="${saved ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="2.2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg></button>
                ${canEdit ? `<button type="button" class="moment-action-btn" data-edit="${post.id}" title="Edit">${EDIT_SVG}</button>` : ''}
              </div>
            </div>
            <div class="moment-caption-title">${escapeHtml(post.title)}</div>
            <p class="moment-caption-text">${escapeHtml(post.summary)}</p>
          </div>
        </article>`;
    }

    return `
      <article class="post-card" data-open-post="${post.id}" data-tone="${tone}" style="animation-delay:${Math.min(idx, 6) * 25}ms">
        <div>
          <div class="post-eyebrow">
            <span class="domain-pill">${domainObj.svg}${escapeHtml(domainObj.label)}</span>
            <span class="section-tag">${escapeHtml(post.category)}</span>
            <span>·</span><span><strong>${escapeHtml(post.author)}</strong>${renderAuthorBadge(post.authorRole, post.author)}</span>
            <span>·</span><span data-ts="${post.createdAt}">${timeAgo(post.createdAt)}</span>
            ${post.editedAt ? '<span class="edited-tag">(edited)</span>' : ''}
          </div>
          <h2 class="post-title">${escapeHtml(post.title)}</h2>
          <p class="post-summary">${escapeHtml(post.summary)}</p>
          ${renderMediaCollage(post)}
          <div class="post-footer">
            <span class="meta-stat">${EYE_SVG} <span data-view-count="${post.id}">${formatViews(post.views)}</span></span><span>·</span>
            <span class="meta-stat"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span data-comment-count="${post.id}">${commentCount}</span> ${commentCount === 1 ? 'comment' : 'comments'}</span>
            ${hasUrl && plat ? `<span>·</span><a class="ext-pill" href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer" data-ext-link="true">${plat.svg}<span>${escapeHtml(plat.name)}</span></a>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="action-btn ${voted ? 'voted' : ''}" data-upvote="${post.id}" title="Appreciate">${UPVOTE_SVG(voted)}<span>${post.upvotes}</span></button>
          <button type="button" class="action-btn ${saved ? 'saved' : ''}" data-save="${post.id}" title="Bookmark"><svg width="14" height="14" viewBox="0 0 24 24" fill="${saved ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="2.2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg></button>
          ${canEdit ? `<button type="button" class="action-btn edit-btn" data-edit="${post.id}" title="Edit entry">${EDIT_SVG}</button>` : ''}
        </div>
      </article>`;
  }).join('');

  renderTopRailOnly();
}

// ================= SILKY-SMOOTH POST VIEW OPEN / CLOSE =================
function updatePostViewHeaderAndActions(post) {
  const dom = getDomainObj(post.domain || detectDomainFromText(`${post.title} ${post.summary}`, post.url));
  document.getElementById('postView').setAttribute('data-tone', resolvePostTone(post));
  document.getElementById('ppMeta').innerHTML = `
    <span class="domain-pill">${dom.svg}${escapeHtml(dom.label)}</span>
    <span class="section-tag">${escapeHtml(post.category)}</span>
    <span>by <strong>${escapeHtml(post.author)}</strong>${renderAuthorBadge(post.authorRole, post.author)}</span>
    <span>·</span><span data-ts="${post.createdAt}">${timeAgo(post.createdAt)}</span>
    ${post.editedAt ? '<span class="edited-tag">(edited)</span>' : ''}
    <span>·</span><span class="meta-stat">${EYE_SVG} ${formatViews(post.views)} views</span>`;

  const voted = state.voted.has(post.id);
  const saved = state.saved.has(post.id);
  const canEdit = post.category !== GENERAL_CATEGORY || isAdmin(getCurrentUser());
  document.getElementById('ppActions').innerHTML = `
    <button type="button" class="pp-btn ${voted ? 'voted' : ''}" id="ppUpvoteBtn">${UPVOTE_SVG(voted)} <span>${voted ? 'Appreciated' : 'Appreciate'} · ${post.upvotes}</span></button>
    <button type="button" class="pp-btn ${saved ? 'saved' : ''}" id="ppSaveBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="${saved ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="2.2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg><span>${saved ? 'Bookmarked' : 'Bookmark'}</span></button>
    <button type="button" class="pp-btn" id="ppScatterBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg><span>Share</span></button>
    ${canEdit ? `<button type="button" class="pp-btn" id="ppEditBtn">${EDIT_SVG}<span>Edit</span></button>` : ''}`;
  document.getElementById('ppUpvoteBtn').onclick = (e) => toggleUpvote(post.id, e.currentTarget);
  document.getElementById('ppSaveBtn').onclick = () => toggleSave(post.id);
  document.getElementById('ppScatterBtn').onclick = () => openScatterModal(post.id);
  const eb = document.getElementById('ppEditBtn');
  if (eb) eb.onclick = () => openEditComposer(post.id);
}

function populatePostViewBody(post) {
  document.getElementById('ppTitle').textContent = post.title;
  document.getElementById('ppBody').textContent = post.body || post.summary;
  const mediaEl = document.getElementById('ppMedia');
  const items = getPostMedia(post);
  if (items.length) {
    mediaEl.style.display = 'block';
    mediaEl.innerHTML = renderMediaCarousel(post);
  } else {
    mediaEl.style.display = 'none';
    mediaEl.innerHTML = '';
  }

  const ext = document.getElementById('ppExtLink');
  if (post.url && /^https?:\/\//i.test(post.url)) {
    const plat = detectPlatform(post.url);
    ext.href = post.url;
    ext.innerHTML = `${plat ? plat.svg : ''} <span>Open ${escapeHtml(plat ? plat.name : 'Reference')} ↗</span>`;
    ext.style.display = 'inline-flex';
  } else {
    ext.style.display = 'none';
  }
}

function openPostView(postId, instant = false) {
  const post = state.posts.find((p) => p.id === postId);
  if (!post || state.isTransitioning) return;
  pauseAllInlineVideos();
  post.views = (post.views || 0) + 1;
  saveState();
  const vc = document.querySelector(`[data-view-count="${post.id}"]`);
  if (vc) vc.textContent = formatViews(post.views);

  const feedEl = document.getElementById('feedView');
  const panel = document.getElementById('postView');
  const mountAndReveal = () => {
    state.activePostId = postId;
    state.replyingToId = null;
    updatePostViewHeaderAndActions(post);
    populatePostViewBody(post);
    document.getElementById('ppLiveStatus').textContent = `Active Discussion · ${2 + (post.id % 5)} reading`;
    setInlineError(document.getElementById('commentAuthorError'), '');
    syncAllAuthorInputs();
    renderThreads(post);

    feedEl.style.display = 'none';
    panel.classList.remove('is-visible');
    panel.classList.add('is-mounted');
    window.scrollTo({ top: 0, behavior: 'instant' });
    history.replaceState(null, '', `#post-${post.id}`);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.classList.add('is-visible');
        state.isTransitioning = false;
      });
    });
  };

  if (instant || state.activePostId) {
    mountAndReveal();
    return;
  }
  state.isTransitioning = true;
  state.savedScrollY = window.scrollY;
  feedEl.classList.add('view-hidden');
  setTimeout(mountAndReveal, 160);
}

function closePostView(instant = false) {
  if (!state.activePostId || state.isTransitioning) return;
  const panel = document.getElementById('postView');
  const feedEl = document.getElementById('feedView');
  panel.querySelectorAll('video').forEach((v) => v.pause());

  const finishClose = () => {
    panel.classList.remove('is-visible', 'is-mounted');
    document.getElementById('ppMedia').innerHTML = '';
    state.activePostId = null;
    state.replyingToId = null;
    history.replaceState(null, '', window.location.pathname);

    if (state.feedNeedsRefresh) render();
    feedEl.classList.add('no-card-anim', 'view-hidden');
    feedEl.style.display = 'block';
    window.scrollTo({ top: state.savedScrollY || 0, behavior: 'instant' });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        feedEl.classList.remove('view-hidden');
        state.isTransitioning = false;
      });
    });
  };

  if (instant) {
    panel.classList.remove('is-visible', 'is-mounted');
    document.getElementById('ppMedia').innerHTML = '';
    state.activePostId = null;
    state.replyingToId = null;
    feedEl.classList.remove('view-hidden');
    feedEl.style.display = 'block';
    return;
  }

  state.isTransitioning = true;
  panel.classList.remove('is-visible');
  setTimeout(finishClose, 200);
}

document.getElementById('closePostView').onclick = () => closePostView(false);
document.getElementById('ppMedia').addEventListener('click', (e) => {
  if (e.target.closest('[data-carousel-dir],[data-carousel-goto],video')) return;
  const tile = e.target.closest('[data-lightbox]');
  if (tile) openLightbox(Number(tile.dataset.lightbox), Number(tile.dataset.mediaIndex || 0));
});

// ================= COMPOSER, 10-SLOT REORDER & PREVIEW =================
function renderDomainChips() {
  const admin = isAdmin(getCurrentUser());
  document.getElementById('domainChips').innerHTML = DOMAINS.filter((d) => d.id !== 'general' || admin)
    .map((d) => `<button type="button" class="domain-chip ${state.selectedDomain === d.id ? 'selected' : ''}" data-domain="${d.id}">${d.svg}<span>${escapeHtml(d.label)}</span></button>`)
    .join('');
}

function renderToneSwatches() {
  document.getElementById('toneSwatches').innerHTML = POST_TONES.map(
    (t) => `<button type="button" class="tone-swatch-btn ${state.selectedTone === t.id ? 'selected' : ''}" data-tone-pick="${t.id}" data-tone="${t.id}"><span class="tone-swatch-dot"></span><span>${t.label}</span></button>`
  ).join('');
  document.getElementById('toneLabelHint').textContent = getToneObj(state.selectedTone).label;
}

function renderComposerPreview() {
  const card = document.getElementById('composerPreviewCard');
  const pane = document.querySelector('.composer-preview-pane');
  if (!card) return;
  const existing = state.editingPostId ? state.posts.find((p) => p.id === state.editingPostId) : null;
  const user = getCurrentUser();
  const rawTitle = document.getElementById('fTitle').value.trim();
  const rawText = document.getElementById('fSummary').value.trim();
  const firstLine = rawText.split('\n')[0] || '';
  const summary = firstLine.length > 180 ? `${firstLine.slice(0, 177)}…` : firstLine;
  const url = document.getElementById('fUrl').value.trim();
  const category = document.getElementById('fCategory').value;
  const author = isAdmin(user) ? user.name : document.getElementById('fAuthor').value.trim() || 'Author';
  const authorRole = isAdmin(user) ? 'admin' : existing && existing.author === author ? existing.authorRole : 'member';
  const dom = getDomainObj(state.selectedDomain);
  const hasUrl = url && /^https?:\/\//i.test(url);
  const plat = hasUrl ? detectPlatform(url) : null;

  card.setAttribute('data-tone', state.selectedTone);
  if (pane) pane.setAttribute('data-tone', state.selectedTone);
  const previewMediaPost = { id: 0, title: rawTitle || 'Preview', media: state.pendingMedia.map((m) => ({ type: m.type, url: m.url })) };

  card.innerHTML = `
    <div>
      <div class="post-eyebrow">
        <span class="domain-pill">${dom.svg}${escapeHtml(dom.label)}</span>
        <span class="section-tag">${escapeHtml(category)}</span>
        <span>·</span><span><strong>${escapeHtml(author)}</strong>${renderAuthorBadge(authorRole, author)}</span>
        <span>·</span><span>${existing ? timeAgo(existing.createdAt) : 'just now'}</span>
      </div>
      <h2 class="post-title ${rawTitle ? '' : 'preview-placeholder'}">${escapeHtml(rawTitle || 'Entry headline…')}</h2>
      <p class="post-summary ${summary ? '' : 'preview-placeholder'}">${escapeHtml(summary || 'Compose your text and attach up to 10 photos or videos to see the grouped preview.')}</p>
      ${renderMediaCollage(previewMediaPost, true)}
      <div class="post-footer">
        <span class="meta-stat">${EYE_SVG} ${formatViews(existing ? existing.views : 1)}</span><span>·</span>
        <span class="meta-stat">${existing ? countAllComments(existing) : 0} comments</span>
        ${hasUrl && plat ? `<span>·</span><span class="ext-pill">${plat.svg}<span>${escapeHtml(plat.name)}</span></span>` : ''}
      </div>
    </div>
    <div class="card-actions"><div class="action-btn voted">${UPVOTE_SVG(true)}<span>${existing ? existing.upvotes : 1}</span></div></div>`;
}

const previewStage = document.getElementById('previewStage');
if (previewStage) {
  previewStage.addEventListener('mousemove', (e) => {
    if (document.body.classList.contains('calm-mode')) return;
    const card = document.getElementById('composerPreviewCard');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    previewStage.classList.add('tilting');
    card.style.setProperty('--rx', `${((0.5 - y) * 8).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${((x - 0.5) * 10).toFixed(2)}deg`);
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  });
  previewStage.addEventListener('mouseleave', () => previewStage.classList.remove('tilting'));
}

function updateComposerLiveLogos() {
  const title = document.getElementById('fTitle').value;
  const summary = document.getElementById('fSummary').value;
  const url = document.getElementById('fUrl').value.trim();
  if (!state.manualDomainOverride) {
    state.selectedDomain = detectDomainFromText(`${title} ${summary}`, url);
    renderDomainChips();
  }
  const dom = getDomainObj(state.selectedDomain);
  const cat = document.getElementById('fCategory');
  if (!state.manualSectionOverride && dom.section && (dom.section !== GENERAL_CATEGORY || isAdmin(getCurrentUser()))) {
    cat.value = dom.section;
  }
  if (!state.manualToneOverride && dom.defaultTone) {
    state.selectedTone = dom.defaultTone;
    renderToneSwatches();
  }
  document.getElementById('healthCautionNote').classList.toggle('visible', dom.id === 'medical');
  const plat = url ? detectPlatform(url) : null;
  document.getElementById('smartUrlIcon').innerHTML = plat ? plat.svg : DEFAULT_LINK_ICON;
  document.getElementById('domainAutoHint').textContent = `→ ${cat.value}`;
  document.getElementById('liveDetectedBadges').innerHTML = `<span class="domain-pill">${dom.svg}${escapeHtml(dom.label)}</span>${plat ? `<span class="domain-pill">${plat.svg}${escapeHtml(plat.name)}</span>` : ''}`;
  renderComposerPreview();
}

document.getElementById('domainChips').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-domain]');
  if (!chip) return;
  state.selectedDomain = chip.dataset.domain;
  state.manualDomainOverride = true;
  state.manualSectionOverride = false;
  renderDomainChips();
  updateComposerLiveLogos();
});

document.getElementById('toneSwatches').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tone-pick]');
  if (!b) return;
  state.selectedTone = b.dataset.tonePick;
  state.manualToneOverride = true;
  renderToneSwatches();
  renderComposerPreview();
});

document.getElementById('fCategory').addEventListener('change', () => {
  state.manualSectionOverride = true;
  document.getElementById('domainAutoHint').textContent = `→ ${document.getElementById('fCategory').value}`;
  renderComposerPreview();
});

['fTitle', 'fSummary', 'fUrl'].forEach((id) => document.getElementById(id).addEventListener('input', updateComposerLiveLogos));
document.getElementById('fAuthor').addEventListener('input', () => {
  setInlineError(document.getElementById('composerAuthorError'), '');
  renderComposerPreview();
});
document.getElementById('cAuthor').addEventListener('input', () => setInlineError(document.getElementById('commentAuthorError'), ''));

// Reorderable 10-Media Uploader
const fileInput = document.getElementById('fMedia');
const mediaError = document.getElementById('mediaError');
const previewGrid = document.getElementById('uploadPreviewGrid');
const mediaHeader = document.getElementById('mediaOrderHeader');

function moveMediaItem(fromIdx, toIdx) {
  if (fromIdx === toIdx || toIdx < 0 || toIdx >= state.pendingMedia.length) return;
  const [moved] = state.pendingMedia.splice(fromIdx, 1);
  state.pendingMedia.splice(toIdx, 0, moved);
  renderUploadPreviews();
}

function renderUploadPreviews() {
  const count = state.pendingMedia.length;
  mediaHeader.style.display = count ? 'flex' : 'none';
  document.getElementById('mediaCountLabel').textContent = `Media (${count} / ${MAX_MEDIA_ITEMS})`;
  if (!count) {
    previewGrid.classList.remove('active');
    previewGrid.innerHTML = '';
    renderComposerPreview();
    return;
  }
  previewGrid.classList.add('active');
  previewGrid.innerHTML = state.pendingMedia.map((m, i) => `
    <div class="preview-thumb" draggable="true" data-media-idx="${i}">
      ${m.type === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="Slide ${i + 1}" />`}
      <span class="preview-order-badge">${i === 0 ? '1 · Cover' : i + 1}</span>
      <button type="button" class="preview-remove" data-remove-media="${i}" title="Remove">✕</button>
      <div class="preview-reorder-bar">
        <button type="button" class="preview-move-btn" data-move-media="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="Move earlier">‹</button>
        <button type="button" class="preview-move-btn" data-move-media="${i}" data-dir="1" ${i === count - 1 ? 'disabled' : ''} title="Move later">›</button>
      </div>
    </div>`).join('');
  renderComposerPreview();
}

previewGrid.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-remove-media]');
  if (rm) {
    state.pendingMedia.splice(Number(rm.dataset.removeMedia), 1);
    renderUploadPreviews();
    return;
  }
  const mv = e.target.closest('[data-move-media]');
  if (mv) {
    const i = Number(mv.dataset.moveMedia);
    moveMediaItem(i, i + Number(mv.dataset.dir));
  }
});

previewGrid.addEventListener('dragstart', (e) => {
  const t = e.target.closest('.preview-thumb');
  if (!t) return;
  state.dragMediaIndex = Number(t.dataset.mediaIdx);
  t.classList.add('dragging');
});

previewGrid.addEventListener('dragend', (e) => {
  const t = e.target.closest('.preview-thumb');
  if (t) t.classList.remove('dragging');
  previewGrid.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  state.dragMediaIndex = null;
});

previewGrid.addEventListener('dragover', (e) => {
  e.preventDefault();
  const t = e.target.closest('.preview-thumb');
  if (t && state.dragMediaIndex !== null) {
    previewGrid.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    t.classList.add('drag-over');
  }
});

previewGrid.addEventListener('drop', (e) => {
  e.preventDefault();
  const t = e.target.closest('.preview-thumb');
  if (t && state.dragMediaIndex !== null) {
    moveMediaItem(state.dragMediaIndex, Number(t.dataset.mediaIdx));
    state.dragMediaIndex = null;
  }
});

function handleFiles(fileList) {
  mediaError.textContent = '';
  for (const file of Array.from(fileList || [])) {
    if (state.pendingMedia.length >= MAX_MEDIA_ITEMS) {
      mediaError.textContent = `Maximum ${MAX_MEDIA_ITEMS} media items per entry.`;
      break;
    }
    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');
    if (!isImg && !isVid) {
      mediaError.textContent = 'Only photo or video files are supported.';
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      mediaError.textContent = `${file.name} is ${formatBytes(file.size)} — maximum size is 500 MB.`;
      continue;
    }
    state.pendingMedia.push({ file, url: URL.createObjectURL(file), type: isVid ? 'video' : 'image' });
  }
  fileInput.value = '';
  renderUploadPreviews();
}

document.getElementById('triggerMediaBtn').onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFiles(e.target.files);
document.getElementById('composerDropArea').addEventListener('dragover', (e) => e.preventDefault());
document.getElementById('composerDropArea').addEventListener('drop', (e) => {
  if (state.dragMediaIndex !== null) return;
  e.preventDefault();
  handleFiles(e.dataTransfer.files);
});

function resetComposer() {
  state.editingPostId = null;
  state.pendingMedia = [];
  state.selectedDomain = 'random';
  state.selectedTone = POST_TONES[state.posts.length % POST_TONES.length].id;
  state.manualDomainOverride = false;
  state.manualSectionOverride = false;
  state.manualToneOverride = false;
  document.getElementById('postForm').reset();
  syncGeneralCategoryOption();
  document.getElementById('fCategory').value = 'Random';
  document.getElementById('composerTitle').textContent = 'New Entry';
  document.getElementById('composerSubmitBtn').textContent = 'Publish';
  fileInput.value = '';
  mediaError.textContent = '';
  setInlineError(document.getElementById('composerAuthorError'), '');
  renderUploadPreviews();
  renderDomainChips();
  renderToneSwatches();
  syncAllAuthorInputs();
  updateComposerLiveLogos();
}

function openEditComposer(postId) {
  const post = state.posts.find((p) => p.id === postId);
  if (!post) return;
  if (post.category === GENERAL_CATEGORY && !isAdmin(getCurrentUser())) {
    showToast('Only administrators may edit General Notices');
    return;
  }
  resetComposer();
  state.editingPostId = post.id;
  state.selectedDomain = post.domain || detectDomainFromText(`${post.title} ${post.summary}`, post.url);
  state.selectedTone = resolvePostTone(post);
  state.manualDomainOverride = true;
  state.manualSectionOverride = true;
  state.manualToneOverride = true;
  state.pendingMedia = getPostMedia(post).map((m) => ({ type: m.type, url: m.url }));
  document.getElementById('composerTitle').textContent = 'Edit Entry';
  document.getElementById('composerSubmitBtn').textContent = 'Save Changes';
  document.getElementById('fTitle').value = post.title || '';
  document.getElementById('fSummary').value = post.body || post.summary || '';
  document.getElementById('fUrl').value = post.url || '';
  document.getElementById('fCategory').value = [GENERAL_CATEGORY, MOMENTS_CATEGORY, ...COLLECTIONS].includes(post.category) ? post.category : 'Random';
  const user = getCurrentUser();
  const aIn = document.getElementById('fAuthor');
  if (isAdmin(user)) syncAuthorField(aIn);
  else {
    aIn.readOnly = false;
    aIn.classList.remove('admin-locked');
    aIn.value = post.author || '';
  }
  renderUploadPreviews();
  renderDomainChips();
  renderToneSwatches();
  updateComposerLiveLogos();
  openModal('composerModal');
  setTimeout(() => document.getElementById('fTitle').focus(), 60);
}

// ================= THREADS =================
let typingTimer;
document.getElementById('cText').addEventListener('input', (e) => {
  const ind = document.getElementById('typingIndicator');
  const name = document.getElementById('cAuthor').value.trim() || 'You';
  if (e.target.value.trim()) {
    document.getElementById('typingText').textContent = `${name} is typing…`;
    ind.classList.add('visible');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => ind.classList.remove('visible'), 1800);
  } else {
    ind.classList.remove('visible');
  }
});

function renderThreads(post) {
  const comments = post.comments || [];
  const total = countAllComments(post);
  document.getElementById('ppCommentCount').textContent = `(${total})`;
  const feedCounter = document.querySelector(`[data-comment-count="${post.id}"]`);
  if (feedCounter) feedCounter.textContent = total;
  const box = document.getElementById('threadList');
  if (!comments.length) {
    box.innerHTML = `<div style="text-align:center; padding:24px 10px; color:var(--text-muted); font-size:0.86rem;">No comments yet. Begin the discussion above.</div>`;
    return;
  }
  box.innerHTML = comments.map((c) => {
    const cUp = state.upvotedComments.has(c.id);
    const replies = c.replies || [];
    const rHtml = replies.length
      ? `<div class="replies-wrap">${replies.map((r) => {
          const rUp = state.upvotedComments.has(r.id);
          return `<div class="comment-box"><div class="avatar small">${escapeHtml((r.author || '?').slice(0, 2).toUpperCase())}</div><div class="comment-content"><div class="comment-head"><span class="comment-author">${escapeHtml(r.author)}</span>${renderAuthorBadge(r.authorRole, r.author)}<span class="comment-time" data-ts="${r.createdAt}">${timeAgo(r.createdAt)}</span></div><p class="comment-text">${escapeHtml(r.text)}</p><div class="comment-tools"><button type="button" class="mini-action ${rUp ? 'upvoted' : ''}" data-upvote-comment="${r.id}">${UPVOTE_SVG(rUp, 13)} <span>${r.upvotes ?? 0}</span></button></div></div></div>`;
        }).join('')}</div>`
      : '';
    const rForm = state.replyingToId === c.id
      ? `<form class="reply-form" data-reply-form="${c.id}"><div class="reply-form-inputs"><input class="reply-author" name="author" required maxlength="32" placeholder="Name" /><input class="reply-text" name="text" required maxlength="400" placeholder="Reply to ${escapeHtml(c.author)}…" /><button type="submit" class="btn-primary" style="padding:6px 12px; font-size:0.8rem;">Reply</button></div><div class="inline-field-error reply-author-error"></div></form>`
      : '';
    return `<div class="thread-item"><div class="comment-box"><div class="avatar">${escapeHtml((c.author || '?').slice(0, 2).toUpperCase())}</div><div class="comment-content"><div class="comment-head"><span class="comment-author">${escapeHtml(c.author)}</span>${renderAuthorBadge(c.authorRole, c.author)}<span class="comment-time" data-ts="${c.createdAt}">${timeAgo(c.createdAt)}</span></div><p class="comment-text">${escapeHtml(c.text)}</p><div class="comment-tools"><button type="button" class="mini-action ${cUp ? 'upvoted' : ''}" data-upvote-comment="${c.id}">${UPVOTE_SVG(cUp, 13)} <span>${c.upvotes ?? 0}</span></button><button type="button" class="mini-action" data-toggle-reply="${c.id}">↩ Reply</button></div>${rForm}</div></div>${rHtml}</div>`;
  }).join('');
  syncAllAuthorInputs();
}

document.getElementById('commentForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const post = state.posts.find((p) => p.id === state.activePostId);
  if (!post) return;
  const user = getCurrentUser();
  const author = isAdmin(user) ? user.name : document.getElementById('cAuthor').value.trim();
  const text = document.getElementById('cText').value.trim();
  if (!author || !text) return;
  if (isReservedAuthorName(author)) {
    setInlineError(document.getElementById('commentAuthorError'), 'That name is reserved');
    showToast('That name is reserved');
    return;
  }
  setInlineError(document.getElementById('commentAuthorError'), '');
  (post.comments = post.comments || []).unshift({
    id: Date.now(),
    author,
    authorRole: isAdmin(user) ? 'admin' : 'member',
    text,
    upvotes: 1,
    createdAt: new Date().toISOString(),
    replies: []
  });
  document.getElementById('cText').value = '';
  saveState();
  renderThreads(post);
  showToast('Comment published');
});

document.getElementById('threadList').addEventListener('click', (e) => {
  const rb = e.target.closest('[data-toggle-reply]');
  if (rb) {
    const cid = Number(rb.dataset.toggleReply);
    state.replyingToId = state.replyingToId === cid ? null : cid;
    const p = state.posts.find((x) => x.id === state.activePostId);
    if (p) renderThreads(p);
    return;
  }
  const ub = e.target.closest('[data-upvote-comment]');
  if (ub) {
    const cid = Number(ub.dataset.upvoteComment);
    const p = state.posts.find((x) => x.id === state.activePostId);
    if (!p) return;
    let cnt = 0;
    let up = false;
    for (const c of p.comments || []) {
      for (const item of [c, ...(c.replies || [])]) {
        if (item.id === cid) {
          item.upvotes = item.upvotes ?? 0;
          if (state.upvotedComments.has(cid)) {
            state.upvotedComments.delete(cid);
            item.upvotes = Math.max(0, item.upvotes - 1);
          } else {
            state.upvotedComments.add(cid);
            item.upvotes += 1;
            up = true;
          }
          cnt = item.upvotes;
        }
      }
    }
    ub.classList.toggle('upvoted', up);
    ub.innerHTML = `${UPVOTE_SVG(up, 13)} <span>${cnt}</span>`;
    if (up) spawnUpvoteFloat(ub, '+1');
    saveState();
  }
});

document.getElementById('threadList').addEventListener('submit', (e) => {
  const form = e.target.closest('[data-reply-form]');
  if (!form) return;
  e.preventDefault();
  const post = state.posts.find((p) => p.id === state.activePostId);
  const parent = post && (post.comments || []).find((c) => c.id === Number(form.dataset.replyForm));
  if (!parent) return;
  const user = getCurrentUser();
  const author = isAdmin(user) ? user.name : form.elements.author.value.trim();
  const text = form.elements.text.value.trim();
  if (isReservedAuthorName(author)) {
    setInlineError(form.querySelector('.reply-author-error'), 'That name is reserved');
    showToast('That name is reserved');
    return;
  }
  (parent.replies = parent.replies || []).push({
    id: Date.now(),
    author,
    authorRole: isAdmin(user) ? 'admin' : 'member',
    text,
    upvotes: 1,
    createdAt: new Date().toISOString()
  });
  state.replyingToId = null;
  saveState();
  renderThreads(post);
  showToast('Reply published');
});

// ================= MODALS, LIGHTBOX & NAVIGATION =================
const openModal = (id) => document.getElementById(id).classList.add('open');
const closeModal = (id) => document.getElementById(id).classList.remove('open');

function openScatterModal(id) {
  const post = state.posts.find((p) => p.id === id);
  if (!post) return;
  state.scatterPostId = id;
  const url = `${window.location.origin}${window.location.pathname}#post-${id}`;
  const el = document.getElementById('scatterPreview');
  el.setAttribute('data-tone', resolvePostTone(post));
  el.innerHTML = `<div class="scatter-card-top"><span><strong>canopy</strong> · ${escapeHtml(post.category)}</span><span class="section-tag">${escapeHtml(getDomainObj(post.domain).label)}</span></div><div class="scatter-card-title">${escapeHtml(post.title)}</div><div class="scatter-card-excerpt">${escapeHtml(post.summary)}</div><div class="scatter-card-foot"><span>by <strong>${escapeHtml(post.author)}</strong>${renderAuthorBadge(post.authorRole, post.author)}</span><span class="meta-stat">${EYE_SVG} ${formatViews(post.views)} · ${UPVOTE_SVG(true, 13)} ${post.upvotes}</span></div>`;
  document.getElementById('scatterUrlInput').value = url;
  openModal('scatterModal');
}

document.getElementById('copyScatterUrl').onclick = () => {
  navigator.clipboard?.writeText(document.getElementById('scatterUrlInput').value).catch(() => {});
  showToast('Link copied');
  closeModal('scatterModal');
};

document.getElementById('copyScatterQuote').onclick = () => {
  const p = state.posts.find((x) => x.id === state.scatterPostId);
  if (p) navigator.clipboard?.writeText(`"${p.title}" by ${p.author} — ${document.getElementById('scatterUrlInput').value}`).catch(() => {});
  showToast('Citation copied');
  closeModal('scatterModal');
};

const openComposer = () => {
  resetComposer();
  if (state.view === GENERAL_CATEGORY && isAdmin(getCurrentUser())) {
    state.selectedDomain = 'general';
    state.selectedTone = 'sky';
    state.manualDomainOverride = true;
    state.manualSectionOverride = true;
    document.getElementById('fCategory').value = GENERAL_CATEGORY;
    document.getElementById('composerTitle').textContent = 'New General Notice';
  } else if (state.view === MOMENTS_CATEGORY) {
    state.selectedDomain = 'moments';
    state.selectedTone = 'coral';
    state.manualDomainOverride = true;
    state.manualSectionOverride = true;
    document.getElementById('fCategory').value = MOMENTS_CATEGORY;
    document.getElementById('composerTitle').textContent = 'New Day-to-Day Moment';
  }
  renderDomainChips();
  renderToneSwatches();
  updateComposerLiveLogos();
  openModal('composerModal');
  setTimeout(() => document.getElementById('fTitle').focus(), 60);
};
document.getElementById('openComposer').onclick = openComposer;
document.getElementById('railComposer').onclick = openComposer;

document.getElementById('postForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  const cat = document.getElementById('fCategory').value;
  const errEl = document.getElementById('composerAuthorError');
  if (cat === GENERAL_CATEGORY && !isAdmin(user)) {
    setInlineError(errEl, 'Only administrators may publish in General Notices');
    return;
  }
  const author = isAdmin(user) ? user.name : document.getElementById('fAuthor').value.trim();
  if (isReservedAuthorName(author)) {
    setInlineError(errEl, 'That name is reserved (sign in as Administrator)');
    showToast('That name is reserved');
    return;
  }
  setInlineError(errEl, '');
  const title = document.getElementById('fTitle').value.trim();
  const text = document.getElementById('fSummary').value.trim();
  const first = text.split('\n')[0];
  const summary = first.length > 180 ? `${first.slice(0, 177)}…` : first;
  const url = document.getElementById('fUrl').value.trim();
  const media = state.pendingMedia.map((m) => ({ type: m.type, url: m.url }));

  if (state.editingPostId) {
    const ex = state.posts.find((p) => p.id === state.editingPostId);
    if (ex) {
      Object.assign(ex, {
        title,
        summary,
        body: text,
        url,
        category: cat,
        domain: state.selectedDomain,
        tone: state.selectedTone,
        author,
        authorRole: isAdmin(user) ? 'admin' : 'member',
        media,
        editedAt: new Date().toISOString()
      });
      saveState();
      const id = ex.id;
      resetComposer();
      closeModal('composerModal');
      if (state.activePostId === id) {
        updatePostViewHeaderAndActions(ex);
        populatePostViewBody(ex);
        state.feedNeedsRefresh = true;
      } else {
        render();
      }
      showToast('Entry updated');
      return;
    }
  }

  const newPost = {
    id: Date.now(),
    title,
    summary,
    body: text,
    url,
    category: cat,
    domain: state.selectedDomain,
    tone: state.selectedTone,
    author,
    authorRole: isAdmin(user) ? 'admin' : 'member',
    upvotes: 1,
    views: 1,
    media,
    createdAt: new Date().toISOString(),
    comments: []
  };
  if (state.activePostId) closePostView(true);
  state.posts.unshift(newPost);
  state.voted.add(newPost.id);
  saveState();
  resetComposer();
  closeModal('composerModal');
  render();
  showToast(`Published to ${cat}`);
});

document.getElementById('logoBtn').addEventListener('click', (e) => {
  e.preventDefault();
  const l = e.currentTarget;
  l.classList.remove('icon-pulse');
  void l.offsetWidth;
  l.classList.add('icon-pulse');
  if (state.activePostId) closePostView(false);
  state.view = 'All';
  state.query = '';
  document.getElementById('searchInput').value = '';
  render();
});

document.querySelector('.sidebar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b) return;
  if (state.activePostId) closePostView(true);
  state.view = b.dataset.view;
  render();
});

document.getElementById('sortTabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sort]');
  if (!b) return;
  state.sort = b.dataset.sort;
  document.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
  render();
});

// Feed Clicks: Play Video Inline on Video Click, Open Post on Card Click
document.getElementById('postList').addEventListener('click', (e) => {
  if (e.target.closest('[data-ext-link]')) return;

  const videoTile = e.target.closest('[data-inline-video]');
  if (videoTile) {
    e.stopPropagation();
    const video = videoTile.querySelector('video');
    if (!video) return;
    if (!videoTile.classList.contains('playing')) {
      pauseAllInlineVideos(video);
      video.controls = true;
      videoTile.classList.add('playing');
      video.play().catch(() => {});
      video.addEventListener('ended', () => {
        videoTile.classList.remove('playing');
        video.controls = false;
      }, { once: true });
    }
    return;
  }

  const up = e.target.closest('[data-upvote]');
  if (up) { e.stopPropagation(); toggleUpvote(Number(up.dataset.upvote), up); return; }
  const sv = e.target.closest('[data-save]');
  if (sv) { e.stopPropagation(); toggleSave(Number(sv.dataset.save)); return; }
  const ed = e.target.closest('[data-edit]');
  if (ed) { e.stopPropagation(); openEditComposer(Number(ed.dataset.edit)); return; }
  const card = e.target.closest('[data-open-post]');
  if (card) openPostView(Number(card.dataset.openPost));
});

document.getElementById('topList').addEventListener('click', (e) => {
  const i = e.target.closest('[data-open-post]');
  if (i) openPostView(Number(i.dataset.openPost));
});

document.getElementById('openSearch').onclick = () => {
  const i = document.getElementById('searchInput');
  i.value = state.query;
  openModal('searchModal');
  setTimeout(() => { i.focus(); i.select(); }, 50);
};
document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.activePostId) closePostView(true);
  state.query = document.getElementById('searchInput').value.trim();
  state.view = 'All';
  closeModal('searchModal');
  render();
});
document.getElementById('clearSearchBtn').onclick = () => {
  state.query = '';
  document.getElementById('searchInput').value = '';
  render();
};
document.querySelectorAll('[data-close]').forEach((el) => { el.onclick = () => closeModal(el.dataset.close); });
document.querySelectorAll('.modal-backdrop').forEach((bg) => bg.addEventListener('click', (e) => { if (e.target === bg) closeModal(bg.id); }));

// Lightbox
let lbTimer;
function renderLightboxFrame() {
  const post = state.posts.find((p) => p.id === state.lightboxPostId);
  const items = post ? getPostMedia(post) : [];
  if (!items.length) return;
  const idx = ((state.lightboxIndex % items.length) + items.length) % items.length;
  state.lightboxIndex = idx;
  const cur = items[idx];
  document.getElementById('lightboxMedia').innerHTML =
    cur.type === 'video'
      ? `<video src="${cur.url}" controls autoplay playsinline></video>`
      : `<img src="${cur.url}" alt="${escapeHtml(post.title)}" />`;
  document.getElementById('lightboxTitle').textContent = post.title;
  document.getElementById('lightboxSub').textContent = `${post.category} · by ${post.author} · ${timeAgo(post.createdAt)}`;
  const multi = items.length > 1;
  document.getElementById('lbPrev').classList.toggle('visible', multi);
  document.getElementById('lbNext').classList.toggle('visible', multi);
  const c = document.getElementById('lbCounter');
  c.style.display = multi ? 'inline-block' : 'none';
  c.textContent = `${idx + 1} / ${items.length}`;
}

function openLightbox(postId, index = 0) {
  const p = state.posts.find((x) => x.id === postId);
  if (!p || !getPostMedia(p).length) return;
  clearTimeout(lbTimer);
  state.lightboxPostId = postId;
  state.lightboxIndex = index;
  renderLightboxFrame();
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.querySelector('video')?.pause();
  lb.classList.remove('open');
  state.lightboxPostId = null;
  clearTimeout(lbTimer);
  lbTimer = setTimeout(() => {
    if (!lb.classList.contains('open')) document.getElementById('lightboxMedia').innerHTML = '';
  }, 300);
}

document.getElementById('lbPrev').onclick = (e) => { e.stopPropagation(); state.lightboxIndex--; renderLightboxFrame(); };
document.getElementById('lbNext').onclick = (e) => { e.stopPropagation(); state.lightboxIndex++; renderLightboxFrame(); };
document.getElementById('closeLightbox').onclick = closeLightbox;
document.getElementById('lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    document.getElementById('openSearch').click();
  } else if (document.getElementById('lightbox').classList.contains('open')) {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') { state.lightboxIndex--; renderLightboxFrame(); }
    else if (e.key === 'ArrowRight') { state.lightboxIndex++; renderLightboxFrame(); }
  } else if (e.key === 'Escape') {
    for (const id of ['adminModal', 'scatterModal', 'searchModal', 'composerModal']) {
      if (document.getElementById(id).classList.contains('open')) { closeModal(id); return; }
    }
    if (state.activePostId) closePostView(false);
  }
});

// Theme & Breeze
const SUN_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2"/></svg>';
const MOON_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#818cf8" stroke="#6366f1" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>';
const applyTheme = (t) => {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeLabel').textContent = t === 'dark' ? 'Light' : 'Dark';
  document.getElementById('themeIcon').innerHTML = t === 'dark' ? SUN_ICON : MOON_ICON;
  localStorage.setItem('canopy_theme', t);
};
applyTheme(localStorage.getItem('canopy_theme') || 'light');
document.getElementById('themeToggle').onclick = () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
document.getElementById('breezeToggle').onclick = () => {
  const c = document.body.classList.toggle('calm-mode');
  document.getElementById('breezeLabel').textContent = c ? 'Breeze Off' : 'Breeze On';
};

setInterval(() => document.querySelectorAll('[data-ts]').forEach((el) => { el.textContent = timeAgo(el.dataset.ts); }), 30000);

renderAdminToggle();
syncAllAuthorInputs();
syncGeneralCategoryOption();
renderDomainChips();
renderToneSwatches();
updateComposerLiveLogos();
render();
initAuthFromServer();
const hashMatch = window.location.hash.match(/^#post-(\d+)$/);
if (hashMatch) openPostView(Number(hashMatch[1]), true);