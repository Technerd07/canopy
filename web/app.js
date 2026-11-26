// Client-side only. Real role checks must move to the server.
const ADMIN_USERS = [
  { id: 'ADMIN1_ID', name: 'ADMIN1_NAME', title: 'Founder',    passHash: 'SHA256_HASH_1' },
  { id: 'ADMIN2_ID', name: 'ADMIN2_NAME', title: 'Co-founder', passHash: 'SHA256_HASH_2' }
];
const SESSION_KEY = 'canopy_session';

const MAX_FILE_BYTES = 500 * 1024 * 1024;
const MAX_MEDIA_ITEMS = 6;
const STORAGE_KEY = 'canopy_posts_v10';
const VOTED_KEY = 'canopy_voted_v10';
const SAVED_KEY = 'canopy_saved_v10';
const EMOJIS = ['🌿', '🌱', '🌸', '🍁', '☀️', '✨', '🔥', '💡', '🚀', '🕉️', '📰', '🎲', '👏', '❤️', '😂', '🎉'];

const COLLECTIONS = ['Snapshots', 'Technology', 'News & Politics', 'Journal & Mindfulness', 'Random'];

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

// ================= ROLE & AUTH LAYER (SWAP FOR BACKEND LATER) =================
function normalizeAuthorName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string' && typeof parsed.role === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function isAdmin(user) {
  return Boolean(user && user.role === 'admin');
}

function getAdminTitle(authorName) {
  const norm = normalizeAuthorName(authorName);
  const match = ADMIN_USERS.find(u => normalizeAuthorName(u.name) === norm);
  return match ? match.title : '';
}

function renderAuthorBadge(role, authorName = '') {
  if (role !== 'admin') return '';
  const title = authorName ? getAdminTitle(authorName) : '';
  const tooltip = title ? `Site admin · ${title}` : 'Site admin';
  return `<span class="admin-badge" title="${escapeHtml(tooltip)}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>Admin</span>`;
}

function isReservedAuthorName(name) {
  if (isAdmin(getCurrentUser())) return false;
  const norm = normalizeAuthorName(name);
  if (!norm) return false;
  return ADMIN_USERS.some(u => normalizeAuthorName(u.name) === norm);
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdminCredentials(adminId, passphrase) {
  const account = ADMIN_USERS.find(u => u.id === adminId);
  if (!account) return null;
  const hash = await sha256Hex(passphrase);
  if (hash.toLowerCase() !== String(account.passHash || '').trim().toLowerCase()) return null;
  return { id: account.id, name: account.name, role: 'admin' };
}

function signInAdminSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: session.id, name: session.name, role: 'admin' }));
}

function signOutAdminSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ================= DOMAIN LOGOS & AUTOMATIC SECTION ROUTING =================
const DOMAINS = [
  {
    id: 'tech', label: 'Tech & Code', section: 'Technology',
    keywords: /\b(code|linux|docker|podman|nginx|k8s|kubernetes|postgres|sql|rust|python|js|react|api|server|cli|bash|git|dev|software|kernel|network|hardware|build)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
  },
  {
    id: 'ai', label: 'AI & ML', section: 'Technology',
    keywords: /\b(ai|llm|neural|transformer|gpt|mistral|model|machine learning|deep learning|lora|gguf|weights|inference)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></svg>'
  },
  {
    id: 'photo', label: 'Photo & Film', section: 'Snapshots',
    keywords: /\b(photo|photography|camera|lens|film|cinema|video|sunset|golden hour|shot|portrait|timelapse|time-lapse|snapshot|insta)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>'
  },
  {
    id: 'nature', label: 'Nature & Life', section: 'Snapshots',
    keywords: /\b(nature|forest|tree|mountain|coast|walk|garden|flower|blossom|autumn|spring|hiking|travel|coffee|morning)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>'
  },
  {
    id: 'design', label: 'Design & Art', section: 'Snapshots',
    keywords: /\b(design|ui|ux|figma|art|sketch|typography|aesthetic|minimalist|architecture|illustration)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="#f97316"/><circle cx="17.5" cy="10.5" r=".5" fill="#f97316"/><circle cx="8.5" cy="7.5" r=".5" fill="#f97316"/><circle cx="6.5" cy="12.5" r=".5" fill="#f97316"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>'
  },
  {
    id: 'politics', label: 'Politics & World', section: 'News & Politics',
    keywords: /\b(politics|policy|government|election|parliament|geopolitics|news|world|summit|law|diplomacy|economy|budget|market)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
  },
  {
    id: 'medical', label: 'Health News', section: 'News & Politics',
    keywords: /\b(medical|medicine|clinical|health|hospital|pharma|vaccine|pubmed|who|trial|epidemiology|public health)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="rgba(239,68,68,0.1)"/><path d="M12 8v8M8 12h8"/></svg>'
  },
  {
    id: 'bio', label: 'Bio & Science', section: 'News & Politics',
    keywords: /\b(bio|biology|dna|rna|crispr|gene|genetics|protein|cell|genome|physics|chemistry|space|arxiv|research|discovery)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v6.5L4.8 18.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9.5V3"/><path d="M7 15h10"/></svg>'
  },
  {
    id: 'mindfulness', label: 'Vedanta & Mind', section: 'Journal & Mindfulness',
    keywords: /\b(vedanta|advaita|upanishad|gita|mindfulness|meditation|dharma|awareness|stillness|philosophy|consciousness|zen|stoic|self-inquiry)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/></svg>'
  },
  {
    id: 'writing', label: 'Journal & Essays', section: 'Journal & Mindfulness',
    keywords: /\b(journal|diary|book|essay|poetry|poem|history|literature|substack|reflection|thoughts|reading|notes)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>'
  },
  {
    id: 'random', label: 'Random', section: 'Random',
    keywords: /\b(random|misc|anything|showerthought|weird|funny|meme|offbeat|curious|trivia)\b/i,
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="#8b5cf6"/><circle cx="15.5" cy="8.5" r="1.2" fill="#8b5cf6"/><circle cx="12" cy="12" r="1.2" fill="#8b5cf6"/><circle cx="8.5" cy="15.5" r="1.2" fill="#8b5cf6"/><circle cx="15.5" cy="15.5" r="1.2" fill="#8b5cf6"/></svg>'
  }
];

const PLATFORMS = [
  { match: /github\.com/i, name: 'GitHub', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.02c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>' },
  { match: /youtube\.com|youtu\.be/i, name: 'YouTube', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-3.8.5-5.8s-.1-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>' },
  { match: /(^|\.)x\.com|twitter\.com/i, name: 'X', svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
  { match: /pubmed|ncbi\.nlm\.nih\.gov|who\.int|nejm\.org|thelancet/i, name: 'Health News', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.4" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="rgba(239,68,68,0.12)"/><path d="M12 8v8M8 12h8"/></svg>' },
  { match: /arxiv\.org|nature\.com|science\.org|biorxiv/i, name: 'Research', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.2" stroke-linecap="round"><path d="M9 3h6M10 3v6.5L5 18a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-8.5V3"/></svg>' },
  { match: /huggingface\.co/i, name: 'HuggingFace', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10" r="1.4" fill="#111"/><circle cx="15" cy="10" r="1.4" fill="#111"/><path d="M8.5 14.5c1 1.5 6 1.5 7 0" stroke="#111" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>' },
  { match: /figma\.com/i, name: 'Figma', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 3h4v6H8a3 3 0 0 1 0-6z" fill="#f24e1e"/><path d="M12 3h4a3 3 0 0 1 0 6h-4V3z" fill="#ff7262"/><path d="M12 9h4a3 3 0 1 1 0 6h-4V9z" fill="#1abcfe"/><path d="M8 9h4v6H8a3 3 0 0 1 0-6z" fill="#a259ff"/><path d="M8 15h4v3a3 3 0 1 1-4-3z" fill="#0acf83"/></svg>' },
  { match: /substack\.com/i, name: 'Substack', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#ff6719"><path d="M4 4h16v2.5H4V4zm0 4.5h16V11H4V8.5zM4 13h16v8l-8-4.5L4 21v-8z"/></svg>' },
  { match: /reuters\.com|apnews\.com|bbc\.com|thehindu\.com/i, name: 'News', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.1"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h10"/></svg>' },
  { match: /unsplash\.com|instagram\.com/i, name: 'Photo', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg>' }
];

const DEFAULT_LINK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

function detectPlatform(url) {
  if (!url) return null;
  for (const p of PLATFORMS) if (p.match.test(url)) return p;
  return { name: getHostname(url) || 'Link', svg: DEFAULT_LINK_ICON };
}

function detectDomainFromText(text, url = '') {
  const combined = `${text} ${url}`;
  for (const d of DOMAINS) if (d.keywords.test(combined)) return d.id;
  if (/pubmed|who\.int|nejm|thelancet/i.test(url)) return 'medical';
  if (/biorxiv|nature\.com|arxiv/i.test(url)) return 'bio';
  if (/reuters|apnews|bbc|thehindu/i.test(url)) return 'politics';
  if (/github\.com|podman\.io|docker\.com/i.test(url)) return 'tech';
  if (/huggingface\.co/i.test(url)) return 'ai';
  if (/figma\.com/i.test(url)) return 'design';
  if (/substack\.com/i.test(url)) return 'writing';
  if (/unsplash\.com|instagram\.com/i.test(url)) return 'photo';
  return 'random';
}

const getDomainObj = (id) => DOMAINS.find(d => d.id === id) || DOMAINS[DOMAINS.length - 1];

const SEED_POSTS = [
  {
    id: 601,
    title: 'Golden hour forest & coast photo set (Autumn View)',
    summary: 'A 3-photo minimalist bento set—105 upvotes unlocks the Autumn Season view with golden sun rays and falling leaves.',
    body: 'Shot these three frames during a quiet evening walk. Click any photo to open the multi-photo lightbox and cycle through with arrow keys.\n\nSince this post has 100+ upvotes, opening it activates the Golden Autumn seasonal view while keeping your sidebars accessible.',
    url: 'https://unsplash.com',
    category: 'Snapshots',
    domain: 'photo',
    author: 'Damodar',
    authorRole: 'admin',
    upvotes: 105,
    views: 1420,
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85' },
      { type: 'image', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=85' },
      { type: 'image', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=900&q=85' }
    ],
    createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    comments: [
      {
        id: 9001,
        author: 'Sam',
        authorRole: 'member',
        text: 'Love the renamed Collections and the 3-photo bento grid 🍁✨',
        upvotes: 4,
        createdAt: new Date(Date.now() - 3600_000 * 1.5).toISOString(),
        replies: []
      }
    ]
  },
  {
    id: 602,
    title: 'Botanical time-lapse video demo (99 → 100 Autumn trigger)',
    summary: 'Sitting at 99 upvotes (Bloom). Open this post and click Upvote once to watch Bloom evolve into Autumn live!',
    body: 'Testing native HTML5 HD video streaming inside the post panel and fullscreen lightbox.\n\nClick the Upvote button once to cross 100 upvotes and trigger the live seasonal shift.',
    url: 'https://www.youtube.com',
    category: 'Snapshots',
    domain: 'nature',
    author: 'Damodar',
    authorRole: 'admin',
    upvotes: 99,
    views: 1190,
    media: [{ type: 'video', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' }],
    createdAt: new Date(Date.now() - 3600_000 * 4).toISOString(),
    comments: []
  },
  {
    id: 603,
    title: 'Notes on Advaita Vedanta: The Witness (Sakshi) in daily noise',
    summary: 'Reflections on separating observation from mental commentary during busy days—quiet stillness without escaping work.',
    body: 'In Vedanta, the mind is treated as an instrument rather than identity itself.\n\nA simple daily practice: notice the thought arising, notice the space in which it appears, and let the reaction pause for two breaths before acting.',
    url: '',
    category: 'Journal & Mindfulness',
    domain: 'mindfulness',
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
    title: 'Rootless Podman + Nginx Alpine edge setup',
    summary: 'Serving static assets and proxying API routes with minimal footprint and plain systemd user units.',
    body: 'Built a lightweight static edge container using nginx:alpine running rootless under Podman.\n\n• Zero host port conflicts via rootless networking\n• 512M client_max_body_size ready for video uploads\n• Managed with a plain systemd user unit.',
    url: 'https://github.com',
    category: 'Technology',
    domain: 'tech',
    author: 'Damodar',
    authorRole: 'admin',
    upvotes: 24,
    views: 462,
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=85' }],
    createdAt: new Date(Date.now() - 3600_000 * 11).toISOString(),
    comments: []
  },
  {
    id: 605,
    title: 'WHO & PubMed brief: Global mRNA thermal-stability research update',
    summary: 'News digest on new lyophilized delivery studies aiming to reduce cold-chain requirements in rural clinics.',
    body: 'Shared strictly as a public-health and research news update. Recent peer-reviewed studies report promising stability benchmarks for freeze-dried formulations at ambient temperatures.',
    url: 'https://pubmed.ncbi.nlm.nih.gov',
    category: 'News & Politics',
    domain: 'medical',
    author: 'Sam',
    authorRole: 'member',
    upvotes: 16,
    views: 318,
    media: [],
    createdAt: new Date(Date.now() - 3600_000 * 16).toISOString(),
    comments: []
  },
  {
    id: 606,
    title: 'Why rain on dry red soil smells stronger at dusk',
    summary: 'Random evening curiosity: petrichor, geosmin, and how warm evening air carries earth scents differently.',
    body: 'Just a random thought while watching clouds gather—soil bacteria release geosmin, and light rain traps tiny air bubbles that burst upward as aerosols.',
    url: '',
    category: 'Random',
    domain: 'random',
    author: 'Alex',
    authorRole: 'member',
    upvotes: 7,
    views: 154,
    media: [],
    createdAt: new Date(Date.now() - 86400_000 * 1).toISOString(),
    comments: []
  }
];

// Backward-compatible migration: default missing authorRole to 'member' without wiping saved data
function migratePosts(rawPosts) {
  return (rawPosts || []).map(p => ({
    ...p,
    authorRole: p.authorRole || 'member',
    comments: (p.comments || []).map(c => ({
      ...c,
      authorRole: c.authorRole || 'member',
      replies: (c.replies || []).map(r => ({
        ...r,
        authorRole: r.authorRole || 'member'
      }))
    }))
  }));
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
  replyingToId: null,
  scatterPostId: null,
  lightboxPostId: null,
  lightboxIndex: 0,
  selectedDomain: 'random',
  manualDomainOverride: false,
  manualSectionOverride: false,
  pendingMedia: []
};

const getHostname = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const formatViews = (n = 0) => n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
const formatBytes = (b) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const timeAgo = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

function getPostMedia(post) {
  if (Array.isArray(post.media)) return post.media;
  if (post.mediaUrl) return [{ type: post.mediaType || 'image', url: post.mediaUrl }];
  return [];
}

function getGrowthStage(count) {
  if (count >= 100) return { key: 'autumn', label: 'Autumn', icon: '🍁', cls: 'stage-autumn', banner: '🍁 Golden Autumn Unlocked — 100+ upvotes! Warm sunlight & falling leaves.' };
  if (count >= 50)  return { key: 'bloom',  label: 'Bloom',  icon: '🌸', cls: 'stage-bloom',  banner: '🌸 Spring Bloom Active — 50+ upvotes! Cherry blossom petals drifting.' };
  if (count >= 10)  return { key: 'bud',    label: 'Bud',    icon: '🌱', cls: 'stage-bud',    banner: '🌱 Fresh Bud Stage — 10+ upvotes! Rising spring vitality.' };
  return { key: 'seed', label: 'Seed', icon: '🌰', cls: 'stage-seed', banner: '🌰 Seed Stage — Upvote this post to help it grow into Bud, Bloom & Autumn.' };
}

function countAllComments(post) {
  return (post.comments || []).reduce((acc, c) => acc + 1 + (c.replies ? c.replies.length : 0), 0);
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}

function spawnUpvoteFloat(btnEl, text = '+1 ▲') {
  if (!btnEl) return;
  btnEl.classList.remove('upvote-burst');
  void btnEl.offsetWidth;
  btnEl.classList.add('upvote-burst');
  const rect = btnEl.getBoundingClientRect();
  const tag = document.createElement('span');
  tag.className = 'upvote-float';
  tag.textContent = text;
  tag.style.left = `${rect.left + rect.width / 2}px`;
  tag.style.top = `${rect.top - 4}px`;
  document.body.appendChild(tag);
  setTimeout(() => tag.remove(), 900);
}

function saveState() {
  const persistable = state.posts.map((p) => ({
    ...p,
    media: getPostMedia(p).filter(m => m.url && !m.url.startsWith('blob:'))
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  localStorage.setItem(VOTED_KEY, JSON.stringify([...state.voted]));
  localStorage.setItem(SAVED_KEY, JSON.stringify([...state.saved]));
}

function renderTopRailOnly() {
  const top = [...state.posts].sort((a, b) => b.upvotes - a.upvotes).slice(0, 4);
  document.getElementById('topList').innerHTML = top.map((p) => {
    const st = getGrowthStage(p.upvotes);
    return `<li class="mini-item" data-open-post="${p.id}"><span>${escapeHtml(p.title)}</span><span>${st.icon} ▲ ${p.upvotes}</span></li>`;
  }).join('');
}

// ================= ADMIN UI SYNC =================
function renderAdminToggle() {
  const btn = document.getElementById('adminToggle');
  const user = getCurrentUser();
  if (isAdmin(user)) {
    btn.classList.add('admin-signed-in');
    btn.title = 'Signed in as admin · click to sign out';
    btn.innerHTML = `<span class="admin-dot"></span><span>${escapeHtml(user.name)} · Sign out</span>`;
  } else {
    btn.classList.remove('admin-signed-in');
    btn.title = 'Admin sign-in';
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Admin</span>`;
  }
}

function syncAuthorField(inputEl) {
  if (!inputEl) return;
  const user = getCurrentUser();
  if (isAdmin(user)) {
    inputEl.value = user.name;
    inputEl.readOnly = true;
    inputEl.classList.add('admin-locked');
  } else {
    if (inputEl.classList.contains('admin-locked')) {
      inputEl.value = '';
    }
    inputEl.readOnly = false;
    inputEl.classList.remove('admin-locked');
  }
}

function syncAllAuthorInputs() {
  syncAuthorField(document.getElementById('fAuthor'));
  syncAuthorField(document.getElementById('cAuthor'));
  document.querySelectorAll('.reply-author').forEach(syncAuthorField);
}

function setInlineError(el, msg) {
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('visible', Boolean(msg));
}

function populateAdminSelect() {
  const sel = document.getElementById('adminSelect');
  sel.innerHTML = ADMIN_USERS.map(u =>
    `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}${u.title ? ` (${escapeHtml(u.title)})` : ''}</option>`
  ).join('');
}

function openAdminModal() {
  const user = getCurrentUser();
  const signInForm = document.getElementById('adminSignInForm');
  const signOutView = document.getElementById('adminSignOutView');
  const titleEl = document.getElementById('adminModalTitle');
  setInlineError(document.getElementById('adminSignInError'), '');

  if (isAdmin(user)) {
    titleEl.textContent = 'Admin Session';
    signInForm.style.display = 'none';
    signOutView.style.display = 'block';
    document.getElementById('adminActiveName').textContent = user.name;
    document.getElementById('adminActiveBadge').innerHTML = renderAuthorBadge(user.role, user.name);
    const roleTitle = getAdminTitle(user.name);
    document.getElementById('adminActiveTitle').textContent = roleTitle ? `${roleTitle} · Signed in` : 'Signed in as admin';
    openModal('adminModal');
  } else {
    titleEl.textContent = 'Admin Sign In';
    signInForm.style.display = 'flex';
    signOutView.style.display = 'none';
    document.getElementById('adminPassphrase').value = '';
    openModal('adminModal');
    setTimeout(() => document.getElementById('adminPassphrase').focus(), 50);
  }
}

document.getElementById('adminToggle').onclick = openAdminModal;

document.getElementById('adminSignInForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const adminId = document.getElementById('adminSelect').value;
  const passphrase = document.getElementById('adminPassphrase').value;
  const errEl = document.getElementById('adminSignInError');

  if (!window.crypto || !window.crypto.subtle) {
    setInlineError(errEl, 'Secure context required (use localhost or HTTPS).');
    showToast('Sign in requires localhost or HTTPS');
    return;
  }

  const session = await verifyAdminCredentials(adminId, passphrase);
  if (!session) {
    setInlineError(errEl, 'Incorrect passphrase. Please try again.');
    showToast('Wrong admin passphrase');
    document.getElementById('adminPassphrase').select();
    return;
  }

  signInAdminSession(session);
  setInlineError(errEl, '');
  document.getElementById('adminPassphrase').value = '';
  closeModal('adminModal');
  renderAdminToggle();
  syncAllAuthorInputs();
  showToast(`Signed in as ${session.name} (Admin)`);
});

document.getElementById('confirmSignOutBtn').onclick = () => {
  const prev = getCurrentUser();
  signOutAdminSession();
  closeModal('adminModal');
  renderAdminToggle();
  syncAllAuthorInputs();
  showToast(prev ? `Signed out (${prev.name})` : 'Signed out');
};

// Zero-Flicker In-Place Upvote & Save
function toggleUpvote(id, triggerEl = null) {
  const post = state.posts.find(p => p.id === id);
  if (!post) return;
  const prevStage = getGrowthStage(post.upvotes).key;
  const nowVoted = !state.voted.has(id);

  if (nowVoted) {
    state.voted.add(id);
    post.upvotes += 1;
    spawnUpvoteFloat(triggerEl, '+1 ▲');
  } else {
    state.voted.delete(id);
    post.upvotes = Math.max(0, post.upvotes - 1);
  }

  const nextStage = getGrowthStage(post.upvotes);
  if (prevStage !== nextStage.key && nowVoted) {
    showToast(`${nextStage.icon} Evolved into ${nextStage.label} stage!`);
  }
  saveState();

  const card = document.querySelector(`.post-card[data-open-post="${id}"]`);
  if (card) {
    const btn = card.querySelector(`[data-upvote="${id}"]`);
    if (btn) {
      btn.classList.toggle('voted', nowVoted);
      btn.innerHTML = `${UPVOTE_SVG(nowVoted)}<span>${post.upvotes}</span>`;
    }
    const badge = card.querySelector('.stage-badge');
    if (badge) {
      badge.className = `stage-badge ${nextStage.cls}`;
      badge.textContent = `${nextStage.icon} ${nextStage.label}`;
    }
  }

  renderTopRailOnly();
  if (state.activePostId === id) updatePostViewHeaderAndActions(post);
}

function toggleSave(id) {
  const nowSaved = !state.saved.has(id);
  if (nowSaved) { state.saved.add(id); showToast('Saved to your collection'); }
  else { state.saved.delete(id); showToast('Removed from Saved'); }
  saveState();

  const card = document.querySelector(`.post-card[data-open-post="${id}"]`);
  if (card) {
    if (state.view === 'Saved' && !nowSaved) {
      card.remove();
      if (!document.querySelectorAll('#postList .post-card').length) render();
    } else {
      const btn = card.querySelector(`[data-save="${id}"]`);
      if (btn) {
        btn.classList.toggle('saved', nowSaved);
        btn.title = nowSaved ? 'Remove from Saved' : 'Save post';
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${nowSaved ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="2.2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>`;
      }
    }
  }

  const savedCountEl = document.querySelector('#primaryNav [data-view="Saved"] .count-pill');
  if (savedCountEl) savedCountEl.textContent = state.posts.filter(p => state.saved.has(p.id)).length;

  if (state.activePostId === id) {
    const post = state.posts.find(p => p.id === id);
    if (post) updatePostViewHeaderAndActions(post);
  }
}

function renderMediaGallery(post) {
  const items = getPostMedia(post);
  if (!items.length) return '';
  const visibleCount = Math.min(items.length, 4);
  const extraCount = items.length - 4;

  const tilesHtml = items.slice(0, 4).map((item, idx) => {
    const isLastWithMore = idx === 3 && extraCount > 0;
    if (item.type === 'video') {
      return `
        <div class="gallery-tile" data-lightbox="${post.id}" data-media-index="${idx}">
          <video src="${item.url}" muted playsinline preload="metadata"></video>
          <div class="play-overlay"><div class="play-circle"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-left:2px;"><polygon points="6 4 20 12 6 20 6 4"/></svg></div></div>
          <span class="media-badge">HD Video</span>
        </div>`;
    }
    return `
      <div class="gallery-tile" data-lightbox="${post.id}" data-media-index="${idx}">
        <img src="${item.url}" alt="${escapeHtml(post.title)} (${idx + 1})" loading="lazy" />
        ${isLastWithMore ? `<div class="more-overlay">+${extraCount}</div>` : ''}
        ${items.length === 1 ? `<span class="media-badge">HD Photo</span>` : ''}
      </div>`;
  }).join('');

  return `<div class="media-gallery count-${visibleCount}">${tilesHtml}</div>`;
}

function openScatterModal(id) {
  const post = state.posts.find(p => p.id === id);
  if (!post) return;
  state.scatterPostId = id;
  const stage = getGrowthStage(post.upvotes);
  const shareUrl = `${window.location.origin}${window.location.pathname}#post-${id}`;

  document.getElementById('scatterPreview').innerHTML = `
    <div class="scatter-card-top">
      <span><strong>canopy</strong> · ${escapeHtml(post.category)}</span>
      <span class="stage-badge ${stage.cls}">${stage.icon} ${stage.label}</span>
    </div>
    <div class="scatter-card-title">${escapeHtml(post.title)}</div>
    <div class="scatter-card-excerpt">${escapeHtml(post.summary)}</div>
    <div class="scatter-card-foot">
      <span>by <strong>${escapeHtml(post.author)}</strong>${renderAuthorBadge(post.authorRole, post.author)}</span>
      <span>👁 ${formatViews(post.views)} · ▲ ${post.upvotes}</span>
    </div>`;
  document.getElementById('scatterUrlInput').value = shareUrl;
  openModal('scatterModal');
}

document.getElementById('copyScatterUrl').onclick = () => {
  const url = document.getElementById('scatterUrlInput').value;
  if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
  showToast('Post link copied to clipboard');
  closeModal('scatterModal');
};

document.getElementById('copyScatterQuote').onclick = () => {
  const post = state.posts.find(p => p.id === state.scatterPostId);
  if (!post) return;
  const url = document.getElementById('scatterUrlInput').value;
  if (navigator.clipboard) navigator.clipboard.writeText(`"${post.title}" by ${post.author} on Canopy — ${url}`).catch(() => {});
  showToast('Quote snippet copied');
  closeModal('scatterModal');
};

// Colored Icons for Renamed Collections
const ICONS = {
  All: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="#3b82f6"/><rect x="13" y="3" width="8" height="8" rx="2" fill="#60a5fa"/><rect x="3" y="13" width="8" height="8" rx="2" fill="#93c5fd"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#2563eb"/></svg>',
  Saved: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" stroke-width="2.1" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>',
  Snapshots: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(236,72,153,0.15)" stroke="#ec4899" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="3.2"/></svg>',
  Technology: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(99,102,241,0.14)" stroke="#6366f1" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>',
  'News & Politics': '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(59,130,246,0.14)" stroke="#3b82f6" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/></svg>',
  'Journal & Mindfulness': '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(245,158,11,0.14)" stroke="#f59e0b" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  Random: '<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(139,92,246,0.14)" stroke="#8b5cf6" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="#8b5cf6"/><circle cx="15.5" cy="8.5" r="1.2" fill="#8b5cf6"/><circle cx="12" cy="12" r="1.2" fill="#8b5cf6"/><circle cx="8.5" cy="15.5" r="1.2" fill="#8b5cf6"/><circle cx="15.5" cy="15.5" r="1.2" fill="#8b5cf6"/></svg>'
};

const UPVOTE_SVG = (active) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${active ? '#16a34a' : '#22c55e'}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
const EYE_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.1" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

function render() {
  const primaryItems = [
    { id: 'All', label: 'All Feed', count: state.posts.length },
    { id: 'Saved', label: 'Saved', count: state.posts.filter(p => state.saved.has(p.id)).length }
  ];

  document.getElementById('primaryNav').innerHTML = primaryItems.map((item) => `
    <li>
      <button type="button" class="nav-btn ${state.view === item.id && !state.activePostId ? 'active' : ''}" data-view="${item.id}">
        <span class="nav-btn-left">${ICONS[item.id]}${item.label}</span>
        <span class="count-pill">${item.count}</span>
      </button>
    </li>`).join('');

  document.getElementById('categoryNav').innerHTML = COLLECTIONS.map((cat) => {
    const count = state.posts.filter(p => p.category === cat).length;
    return `
      <li>
        <button type="button" class="nav-btn ${state.view === cat && !state.activePostId ? 'active' : ''}" data-view="${cat}">
          <span class="nav-btn-left">${ICONS[cat]}${escapeHtml(cat)}</span>
          <span class="count-pill">${count}</span>
        </button>
      </li>`;
  }).join('');

  const q = state.query.trim().toLowerCase();
  let filtered = state.posts.filter((p) => {
    if (state.view === 'Saved') return state.saved.has(p.id);
    if (state.view !== 'All') return p.category === state.view;
    return true;
  });
  if (state.sort === 'media') filtered = filtered.filter((p) => getPostMedia(p).length > 0);
  if (q) filtered = filtered.filter((p) => `${p.title} ${p.summary} ${p.body || ''} ${p.author} ${p.category} ${p.domain || ''}`.toLowerCase().includes(q));

  filtered.sort((a, b) => state.sort === 'latest'
    ? new Date(b.createdAt) - new Date(a.createdAt)
    : b.upvotes - a.upvotes || new Date(b.createdAt) - new Date(a.createdAt));

  document.getElementById('feedHeading').textContent = q ? `Results for "${state.query}"` : (state.view === 'All' ? 'All Posts' : state.view);
  document.getElementById('clearSearchBtn').classList.toggle('visible', Boolean(q));
  document.getElementById('searchTriggerText').textContent = q ? `Search: ${state.query}` : 'Search posts…';
  document.getElementById('feedMeta').textContent =
    `${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'} · ${state.sort === 'latest' ? 'newest first' : state.sort === 'media' ? 'photos & videos' : 'top upvoted'}`;

  const list = document.getElementById('postList');
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">${
      q ? `No posts matched "${escapeHtml(state.query)}".`
        : state.view === 'Saved' ? 'No saved posts yet. Click the bookmark icon on any post to save it here.'
        : 'No posts in this collection yet. Plant the first one!'
    }</div>`;
  } else {
    list.innerHTML = filtered.map((post, idx) => {
      const voted = state.voted.has(post.id);
      const saved = state.saved.has(post.id);
      const stage = getGrowthStage(post.upvotes);
      const domainObj = getDomainObj(post.domain || detectDomainFromText(post.title + ' ' + post.summary, post.url));
      const commentCount = countAllComments(post);
      const hasValidUrl = post.url && /^https?:\/\//i.test(post.url);
      const plat = hasValidUrl ? detectPlatform(post.url) : null;

      return `
        <article class="post-card" data-open-post="${post.id}" style="animation-delay:${idx * 25}ms">
          <div>
            <div class="post-eyebrow">
              <span class="domain-pill">${domainObj.svg}${escapeHtml(domainObj.label)}</span>
              <span class="section-tag">${escapeHtml(post.category)}</span>
              <span class="stage-badge ${stage.cls}">${stage.icon} ${stage.label}</span>
              <span>·</span>
              <span><strong>${escapeHtml(post.author)}</strong>${renderAuthorBadge(post.authorRole, post.author)}</span>
              <span>·</span>
              <span data-ts="${post.createdAt}">${timeAgo(post.createdAt)}</span>
            </div>
            <h2 class="post-title">${escapeHtml(post.title)}</h2>
            <p class="post-summary">${escapeHtml(post.summary)}</p>
            ${renderMediaGallery(post)}
            <div class="post-footer">
              <span class="meta-stat">${EYE_SVG} ${formatViews(post.views)}</span>
              <span>·</span>
              <span class="meta-stat">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                ${commentCount} ${commentCount === 1 ? 'thread' : 'threads'}
              </span>
              ${hasValidUrl && plat ? `
                <span>·</span>
                <a class="ext-pill" href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer" data-ext-link="true">
                  ${plat.svg}
                  <span>${escapeHtml(plat.name)}</span>
                </a>` : ''}
            </div>
          </div>
          <div class="card-actions">
            <button type="button" class="action-btn ${voted ? 'voted' : ''}" data-upvote="${post.id}" title="Upvote">
              ${UPVOTE_SVG(voted)}
              <span>${post.upvotes}</span>
            </button>
            <button type="button" class="action-btn ${saved ? 'saved' : ''}" data-save="${post.id}" title="${saved ? 'Remove from Saved' : 'Save post'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${saved ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="2.2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>
            </button>
          </div>
        </article>`;
    }).join('');
  }

  renderTopRailOnly();
}

// ================= SEASONAL POST VIEW =================
function buildSeasonParticles(stageKey) {
  let html = `<div class="s-sun"></div><div class="s-sun-rays"></div>`;
  if (stageKey === 'autumn') {
    const icons = ['🍁', '🍂', '🌸', '🌼', '🍁', '🌺', '🍂', '🌻'];
    for (let i = 0; i < 10; i++) html += `<span class="s-particle" style="left:${5 + i * 9.5}%; font-size:${16 + (i % 3) * 4}px; animation-duration:${12 + (i % 5) * 2.4}s; animation-delay:${-(i * 1.9)}s;">${icons[i % icons.length]}</span>`;
  } else if (stageKey === 'bloom') {
    const icons = ['🌸', '🌺', '🌷', '🌸', '💮', '🌸'];
    for (let i = 0; i < 8; i++) html += `<span class="s-particle" style="left:${8 + i * 11.5}%; font-size:${15 + (i % 3) * 3}px; animation-duration:${14 + (i % 4) * 2.5}s; animation-delay:${-(i * 2.1)}s;">${icons[i % icons.length]}</span>`;
  } else if (stageKey === 'bud') {
    const icons = ['🌱', '🌿', '✨', '🍃'];
    for (let i = 0; i < 7; i++) html += `<span class="s-particle rise" style="left:${10 + i * 13}%; font-size:${14 + (i % 2) * 3}px; animation-duration:${11 + (i % 4) * 2}s; animation-delay:${-(i * 1.7)}s;">${icons[i % icons.length]}</span>`;
  } else {
    const icons = ['✨', '🌰', '🌿'];
    for (let i = 0; i < 5; i++) html += `<span class="s-particle" style="left:${14 + i * 18}%; font-size:13px; opacity:0.65; animation-duration:${15 + i * 2}s; animation-delay:${-(i * 2.5)}s;">${icons[i % icons.length]}</span>`;
  }
  return html;
}

let currentRenderedSeason = null;

function updatePostViewHeaderAndActions(post) {
  const stage = getGrowthStage(post.upvotes);
  const domainObj = getDomainObj(post.domain || detectDomainFromText(post.title + ' ' + post.summary, post.url));
  document.getElementById('postView').className = `post-view-panel active season-${stage.key}`;
  document.getElementById('seasonBanner').innerHTML = `<span>${stage.banner}</span><span style="opacity:0.8;">${stage.label} Stage</span>`;

  if (currentRenderedSeason !== stage.key) {
    document.getElementById('seasonStageBg').innerHTML = buildSeasonParticles(stage.key);
    currentRenderedSeason = stage.key;
  }

  document.getElementById('ppMeta').innerHTML = `
    <span class="domain-pill">${domainObj.svg}${escapeHtml(domainObj.label)}</span>
    <span class="section-tag">${escapeHtml(post.category)}</span>
    <span class="stage-badge ${stage.cls}">${stage.icon} ${stage.label}</span>
    <span>by <strong>${escapeHtml(post.author)}</strong>${renderAuthorBadge(post.authorRole, post.author)}</span>
    <span>·</span>
    <span data-ts="${post.createdAt}">${timeAgo(post.createdAt)}</span>
    <span>·</span>
    <span class="meta-stat">${EYE_SVG} ${formatViews(post.views)} views</span>`;

  const voted = state.voted.has(post.id);
  const saved = state.saved.has(post.id);
  document.getElementById('ppActions').innerHTML = `
    <button type="button" class="pp-btn ${voted ? 'voted' : ''}" id="ppUpvoteBtn">
      ${UPVOTE_SVG(voted)} <span>${voted ? 'Upvoted' : 'Upvote'} · ${post.upvotes}</span>
    </button>
    <button type="button" class="pp-btn ${saved ? 'saved' : ''}" id="ppSaveBtn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="${saved ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="2.2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>
      <span>${saved ? 'Saved' : 'Save'}</span>
    </button>
    <button type="button" class="pp-btn" id="ppScatterBtn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      <span>Scatter</span>
    </button>`;
  document.getElementById('ppUpvoteBtn').onclick = (e) => toggleUpvote(post.id, e.currentTarget);
  document.getElementById('ppSaveBtn').onclick = () => toggleSave(post.id);
  document.getElementById('ppScatterBtn').onclick = () => openScatterModal(post.id);
}

function openPostView(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  post.views = (post.views || 0) + 1;
  saveState();

  state.activePostId = postId;
  state.replyingToId = null;
  currentRenderedSeason = null;
  updatePostViewHeaderAndActions(post);

  document.getElementById('ppTitle').textContent = post.title;
  document.getElementById('ppBody').textContent = post.body || post.summary;

  const items = getPostMedia(post);
  const mediaEl = document.getElementById('ppMedia');
  if (items.length === 1 && items[0].type === 'video') {
    mediaEl.style.display = 'block';
    mediaEl.innerHTML = `<div class="media-gallery count-1"><div class="gallery-tile" style="cursor:default;"><video src="${items[0].url}" controls playsinline></video></div></div>`;
  } else if (items.length > 0) {
    mediaEl.style.display = 'block';
    mediaEl.innerHTML = renderMediaGallery(post);
  } else {
    mediaEl.style.display = 'none';
    mediaEl.innerHTML = '';
  }

  const ext = document.getElementById('ppExtLink');
  if (post.url && /^https?:\/\//i.test(post.url)) {
    const plat = detectPlatform(post.url);
    ext.href = post.url;
    ext.innerHTML = `${plat ? plat.svg : ''} <span>Visit ${escapeHtml(plat ? plat.name : 'Link')} ↗</span>`;
    ext.style.display = 'inline-flex';
  } else {
    ext.style.display = 'none';
  }

  const readers = 2 + (post.id % 5) + Math.min(8, Math.floor(post.upvotes / 18));
  document.getElementById('ppLiveStatus').textContent = `Live thread · ${readers} reading`;
  setInlineError(document.getElementById('commentAuthorError'), '');
  syncAllAuthorInputs();
  renderThreads(post);

  document.getElementById('feedView').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  history.replaceState(null, '', `#post-${post.id}`);
}

function closePostView() {
  const panel = document.getElementById('postView');
  panel.querySelector('video')?.pause();
  panel.classList.remove('active');
  document.getElementById('ppMedia').innerHTML = '';
  document.getElementById('feedView').style.display = 'block';
  state.activePostId = null;
  state.replyingToId = null;
  currentRenderedSeason = null;
  history.replaceState(null, '', window.location.pathname);
  render();
}

document.getElementById('closePostView').onclick = closePostView;
document.getElementById('ppMedia').addEventListener('click', (e) => {
  const tile = e.target.closest('[data-lightbox]');
  if (tile) openLightbox(Number(tile.dataset.lightbox), Number(tile.dataset.mediaIndex || 0));
});

// ================= COMPOSER AUTO-DETECTION & SECTION SYNC =================
function renderDomainChips() {
  document.getElementById('domainChips').innerHTML = DOMAINS.map(d => `
    <button type="button" class="domain-chip ${state.selectedDomain === d.id ? 'selected' : ''}" data-domain="${d.id}" title="Routes to ${escapeHtml(d.section)}">
      ${d.svg}<span>${escapeHtml(d.label)}</span>
    </button>`).join('');
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
  const catSelect = document.getElementById('fCategory');
  if (!state.manualSectionOverride && dom.section) {
    catSelect.value = dom.section;
  }

  document.getElementById('healthCautionNote').classList.toggle('visible', dom.id === 'medical');

  const plat = url ? detectPlatform(url) : null;
  document.getElementById('smartUrlIcon').innerHTML = plat ? plat.svg : DEFAULT_LINK_ICON;

  document.getElementById('domainAutoHint').textContent = `→ ${catSelect.value}`;
  document.getElementById('liveDetectedBadges').innerHTML = `
    <span class="domain-pill">${dom.svg}${escapeHtml(dom.label)}</span>
    ${plat ? `<span class="domain-pill">${plat.svg}${escapeHtml(plat.name)}</span>` : ''}`;
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

document.getElementById('fCategory').addEventListener('change', () => {
  state.manualSectionOverride = true;
  document.getElementById('domainAutoHint').textContent = `→ ${document.getElementById('fCategory').value}`;
});

['fTitle', 'fSummary', 'fUrl'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateComposerLiveLogos);
});

document.getElementById('fAuthor').addEventListener('input', () => {
  setInlineError(document.getElementById('composerAuthorError'), '');
});

document.getElementById('cAuthor').addEventListener('input', () => {
  setInlineError(document.getElementById('commentAuthorError'), '');
});

document.getElementById('toggleComposerEmoji').onclick = () => {
  document.getElementById('composerEmojiDrawer').classList.toggle('open');
};

// Emoji Bar & Threads
const renderEmojiButtons = () => EMOJIS.map(em => `<button type="button" class="emoji-btn" data-emoji="${em}">${em}</button>`).join('');
document.querySelectorAll('.emoji-bar').forEach(bar => { bar.innerHTML = renderEmojiButtons(); });

function insertAtCursor(inputEl, emoji) {
  if (!inputEl) return;
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? inputEl.value.length;
  inputEl.value = inputEl.value.slice(0, start) + emoji + inputEl.value.slice(end);
  inputEl.focus();
  inputEl.setSelectionRange(start + emoji.length, start + emoji.length);
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

document.addEventListener('click', (e) => {
  const emBtn = e.target.closest('.emoji-btn');
  if (!emBtn) return;
  const bar = emBtn.closest('.emoji-bar');
  if (!bar) return;
  const targetId = bar.dataset.emojiTarget;
  const inputEl = targetId ? document.getElementById(targetId) : bar.closest('form')?.querySelector('.reply-text');
  insertAtCursor(inputEl, emBtn.dataset.emoji);
});

let typingHideTimer;
document.getElementById('cText').addEventListener('input', (e) => {
  const indicator = document.getElementById('typingIndicator');
  const name = document.getElementById('cAuthor').value.trim() || 'You';
  if (e.target.value.trim()) {
    document.getElementById('typingText').textContent = `${name} is typing…`;
    indicator.classList.add('visible');
    clearTimeout(typingHideTimer);
    typingHideTimer = setTimeout(() => indicator.classList.remove('visible'), 1800);
  } else {
    indicator.classList.remove('visible');
  }
});

document.getElementById('threadList').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('reply-author')) {
    e.preventDefault();
    e.target.closest('form')?.querySelector('.reply-text')?.focus();
  }
});

document.getElementById('threadList').addEventListener('input', (e) => {
  if (e.target.classList.contains('reply-author')) {
    setInlineError(e.target.closest('form')?.querySelector('.reply-author-error'), '');
  }
});

function renderThreads(post) {
  const comments = post.comments || [];
  document.getElementById('ppCommentCount').textContent = `(${countAllComments(post)})`;
  const container = document.getElementById('threadList');

  if (!comments.length) {
    container.innerHTML = `<div style="text-align:center; padding:24px 10px; color:var(--text-muted); font-size:0.86rem;">No threads yet. Start the conversation above!</div>`;
    return;
  }

  container.innerHTML = comments.map((c) => {
    const initials = (c.author || '?').slice(0, 2).toUpperCase();
    const cUpvoted = state.upvotedComments.has(c.id);
    const cCount = c.upvotes ?? 0;
    const replies = c.replies || [];

    const repliesHtml = replies.length ? `
      <div class="replies-wrap">
        ${replies.map((r) => {
          const rInit = (r.author || '?').slice(0, 2).toUpperCase();
          const rUpvoted = state.upvotedComments.has(r.id);
          return `
            <div class="comment-box">
              <div class="avatar small">${escapeHtml(rInit)}</div>
              <div class="comment-content">
                <div class="comment-head">
                  <span class="comment-author">${escapeHtml(r.author)}</span>${renderAuthorBadge(r.authorRole, r.author)}
                  <span class="comment-time" data-ts="${r.createdAt}">${timeAgo(r.createdAt)}</span>
                </div>
                <p class="comment-text">${escapeHtml(r.text)}</p>
                <div class="comment-tools">
                  <button type="button" class="mini-action ${rUpvoted ? 'upvoted' : ''}" data-upvote-comment="${r.id}">
                    ${UPVOTE_SVG(rUpvoted)} <span>${r.upvotes ?? 0}</span>
                  </button>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>` : '';

    const replyFormHtml = state.replyingToId === c.id ? `
      <form class="reply-form" data-reply-form="${c.id}">
        <div class="reply-form-inputs">
          <input class="reply-author" name="author" required maxlength="32" placeholder="Name" />
          <input class="reply-text" name="text" required maxlength="400" placeholder="Reply to ${escapeHtml(c.author)}…" />
          <button type="submit" class="btn-primary" style="padding:6px 12px; font-size:0.8rem;">Reply</button>
        </div>
        <div class="inline-field-error reply-author-error"></div>
        <div class="emoji-bar">${renderEmojiButtons()}</div>
      </form>` : '';

    return `
      <div class="thread-item">
        <div class="comment-box">
          <div class="avatar">${escapeHtml(initials)}</div>
          <div class="comment-content">
            <div class="comment-head">
              <span class="comment-author">${escapeHtml(c.author)}</span>${renderAuthorBadge(c.authorRole, c.author)}
              <span class="comment-time" data-ts="${c.createdAt}">${timeAgo(c.createdAt)}</span>
            </div>
            <p class="comment-text">${escapeHtml(c.text)}</p>
            <div class="comment-tools">
              <button type="button" class="mini-action ${cUpvoted ? 'upvoted' : ''}" data-upvote-comment="${c.id}">
                ${UPVOTE_SVG(cUpvoted)} <span>${cCount}</span>
              </button>
              <button type="button" class="mini-action" data-toggle-reply="${c.id}">↩ Reply</button>
            </div>
            ${replyFormHtml}
          </div>
        </div>
        ${repliesHtml}
      </div>`;
  }).join('');

  syncAllAuthorInputs();
}

document.getElementById('commentForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const post = state.posts.find(p => p.id === state.activePostId);
  if (!post) return;
  if (!post.comments) post.comments = [];

  const user = getCurrentUser();
  const author = isAdmin(user) ? user.name : document.getElementById('cAuthor').value.trim();
  const text = document.getElementById('cText').value.trim();
  const errEl = document.getElementById('commentAuthorError');
  if (!author || !text) return;

  if (isReservedAuthorName(author)) {
    setInlineError(errEl, 'That name is reserved');
    showToast('That name is reserved');
    return;
  }

  setInlineError(errEl, '');
  post.comments.unshift({
    id: Date.now(),
    author,
    authorRole: isAdmin(user) ? 'admin' : 'member',
    text,
    upvotes: 1,
    createdAt: new Date().toISOString(),
    replies: []
  });
  document.getElementById('cText').value = '';
  document.getElementById('typingIndicator').classList.remove('visible');
  saveState();
  renderThreads(post);
  showToast('Added to thread');
});

document.getElementById('threadList').addEventListener('click', (e) => {
  const replyBtn = e.target.closest('[data-toggle-reply]');
  if (replyBtn) {
    const cid = Number(replyBtn.dataset.toggleReply);
    state.replyingToId = state.replyingToId === cid ? null : cid;
    const post = state.posts.find(p => p.id === state.activePostId);
    if (post) {
      renderThreads(post);
      const form = document.querySelector(`[data-reply-form="${cid}"]`);
      const targetInput = isAdmin(getCurrentUser())
        ? form?.querySelector('.reply-text')
        : form?.querySelector('.reply-author');
      targetInput?.focus();
    }
    return;
  }

  const upBtn = e.target.closest('[data-upvote-comment]');
  if (upBtn) {
    const cid = Number(upBtn.dataset.upvoteComment);
    const post = state.posts.find(p => p.id === state.activePostId);
    if (!post) return;
    let newCount = 0, isNowUpvoted = false;
    for (const c of post.comments || []) {
      if (c.id === cid) {
        c.upvotes = c.upvotes ?? 0;
        if (state.upvotedComments.has(cid)) { state.upvotedComments.delete(cid); c.upvotes = Math.max(0, c.upvotes - 1); }
        else { state.upvotedComments.add(cid); c.upvotes += 1; isNowUpvoted = true; }
        newCount = c.upvotes;
      }
      for (const r of c.replies || []) {
        if (r.id === cid) {
          r.upvotes = r.upvotes ?? 0;
          if (state.upvotedComments.has(cid)) { state.upvotedComments.delete(cid); r.upvotes = Math.max(0, r.upvotes - 1); }
          else { state.upvotedComments.add(cid); r.upvotes += 1; isNowUpvoted = true; }
          newCount = r.upvotes;
        }
      }
    }
    upBtn.classList.toggle('upvoted', isNowUpvoted);
    const countSpan = upBtn.querySelector('span');
    if (countSpan) countSpan.textContent = newCount;
    if (isNowUpvoted) spawnUpvoteFloat(upBtn, '+1 ▲');
    saveState();
  }
});

document.getElementById('threadList').addEventListener('submit', (e) => {
  const form = e.target.closest('[data-reply-form]');
  if (!form) return;
  e.preventDefault();
  const cid = Number(form.dataset.replyForm);
  const post = state.posts.find(p => p.id === state.activePostId);
  const parent = post && (post.comments || []).find(c => c.id === cid);
  if (!parent) return;

  const user = getCurrentUser();
  const author = isAdmin(user) ? user.name : form.elements.author.value.trim();
  const text = form.elements.text.value.trim();
  const errEl = form.querySelector('.reply-author-error');
  if (!author || !text) return;

  if (isReservedAuthorName(author)) {
    setInlineError(errEl, 'That name is reserved');
    showToast('That name is reserved');
    return;
  }

  setInlineError(errEl, '');
  if (!parent.replies) parent.replies = [];
  parent.replies.push({
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
  showToast('Reply posted');
});

// Logo Burst
document.getElementById('logoBtn').addEventListener('click', (e) => {
  e.preventDefault();
  const logo = e.currentTarget;
  logo.classList.remove('spin-burst');
  void logo.offsetWidth;
  logo.classList.add('spin-burst');

  const rect = logo.getBoundingClientRect();
  const icons = ['🌿', '🍃', '🌱', '✨', '🌸'];
  for (let i = 0; i < 7; i++) {
    const el = document.createElement('span');
    el.className = 'logo-leaf-particle';
    el.textContent = icons[i % icons.length];
    const angle = (Math.PI * 2 * i) / 7;
    const dist = 42 + Math.random() * 34;
    el.style.left = `${rect.left + 18}px`;
    el.style.top = `${rect.top + 18}px`;
    el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    el.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 280}deg`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 960);
  }

  if (state.activePostId) closePostView();
  state.view = 'All';
  state.query = '';
  document.getElementById('searchInput').value = '';
  render();
});

// Navigation & Feed Clicks
document.querySelector('.sidebar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  if (state.activePostId) closePostView();
  state.view = btn.dataset.view;
  render();
});

document.getElementById('sortTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-sort]');
  if (!btn) return;
  state.sort = btn.dataset.sort;
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
  render();
});

document.getElementById('postList').addEventListener('click', (e) => {
  if (e.target.closest('[data-ext-link]')) return;
  const upBtn = e.target.closest('[data-upvote]');
  if (upBtn) { e.stopPropagation(); toggleUpvote(Number(upBtn.dataset.upvote), upBtn); return; }
  const saveBtn = e.target.closest('[data-save]');
  if (saveBtn) { e.stopPropagation(); toggleSave(Number(saveBtn.dataset.save)); return; }
  const tile = e.target.closest('[data-lightbox]');
  if (tile) { e.stopPropagation(); openLightbox(Number(tile.dataset.lightbox), Number(tile.dataset.mediaIndex || 0)); return; }
  const card = e.target.closest('[data-open-post]');
  if (card) { openPostView(Number(card.dataset.openPost)); }
});

document.getElementById('topList').addEventListener('click', (e) => {
  const item = e.target.closest('[data-open-post]');
  if (item) openPostView(Number(item.dataset.openPost));
});

// Multi-Photo Lightbox
let lightboxClearTimer;
function renderLightboxFrame() {
  const post = state.posts.find(p => p.id === state.lightboxPostId);
  const items = post ? getPostMedia(post) : [];
  if (!items.length) return;
  const idx = ((state.lightboxIndex % items.length) + items.length) % items.length;
  state.lightboxIndex = idx;
  const current = items[idx];

  document.getElementById('lightboxMedia').innerHTML = current.type === 'video'
    ? `<video src="${current.url}" controls autoplay playsinline></video>`
    : `<img src="${current.url}" alt="${escapeHtml(post.title)}" />`;
  document.getElementById('lightboxTitle').textContent = post.title;
  document.getElementById('lightboxSub').textContent = `${post.category} · by ${post.author} · ${timeAgo(post.createdAt)}`;

  const multi = items.length > 1;
  document.getElementById('lbPrev').classList.toggle('visible', multi);
  document.getElementById('lbNext').classList.toggle('visible', multi);
  const counter = document.getElementById('lbCounter');
  counter.style.display = multi ? 'inline-block' : 'none';
  counter.textContent = `${idx + 1} / ${items.length}`;
}

function openLightbox(postId, index = 0) {
  const post = state.posts.find(p => p.id === postId);
  if (!post || !getPostMedia(post).length) return;
  clearTimeout(lightboxClearTimer);
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
  clearTimeout(lightboxClearTimer);
  lightboxClearTimer = setTimeout(() => {
    if (!lb.classList.contains('open')) document.getElementById('lightboxMedia').innerHTML = '';
  }, 320);
}

document.getElementById('lbPrev').onclick = (e) => { e.stopPropagation(); state.lightboxIndex--; renderLightboxFrame(); };
document.getElementById('lbNext').onclick = (e) => { e.stopPropagation(); state.lightboxIndex++; renderLightboxFrame(); };
document.getElementById('closeLightbox').onclick = closeLightbox;
document.getElementById('lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });

// Multi-File Uploader
const fileInput = document.getElementById('fMedia');
const mediaError = document.getElementById('mediaError');
const previewGrid = document.getElementById('uploadPreviewGrid');
const dropArea = document.getElementById('composerDropArea');

function renderUploadPreviews() {
  if (!state.pendingMedia.length) {
    previewGrid.classList.remove('active');
    previewGrid.innerHTML = '';
    return;
  }
  previewGrid.classList.add('active');
  previewGrid.innerHTML = state.pendingMedia.map((m, i) => `
    <div class="preview-thumb">
      ${m.type === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="Preview ${i + 1}" />`}
      <button type="button" class="preview-remove" data-remove-media="${i}" title="Remove">✕</button>
    </div>`).join('');
}

function resetComposer() {
  state.pendingMedia = [];
  state.selectedDomain = 'random';
  state.manualDomainOverride = false;
  state.manualSectionOverride = false;
  fileInput.value = '';
  mediaError.textContent = '';
  setInlineError(document.getElementById('composerAuthorError'), '');
  document.getElementById('composerEmojiDrawer').classList.remove('open');
  renderUploadPreviews();
  renderDomainChips();
  updateComposerLiveLogos();
  syncAllAuthorInputs();
}

function handleFiles(fileList) {
  mediaError.textContent = '';
  for (const file of Array.from(fileList || [])) {
    if (state.pendingMedia.length >= MAX_MEDIA_ITEMS) { mediaError.textContent = `Maximum ${MAX_MEDIA_ITEMS} media items per post.`; break; }
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { mediaError.textContent = 'Only photo or video files are supported.'; continue; }
    if (file.size > MAX_FILE_BYTES) { mediaError.textContent = `${file.name} is ${formatBytes(file.size)} — max allowed is 500 MB.`; continue; }
    state.pendingMedia.push({ file, url: URL.createObjectURL(file), type: isVideo ? 'video' : 'image' });
  }
  fileInput.value = '';
  renderUploadPreviews();
}

previewGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-media]');
  if (!btn) return;
  state.pendingMedia.splice(Number(btn.dataset.removeMedia), 1);
  renderUploadPreviews();
});

document.getElementById('triggerMediaBtn').onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFiles(e.target.files);
dropArea.addEventListener('dragover', (e) => e.preventDefault());
dropArea.addEventListener('drop', (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); });

// Modals & Search
const openModal = (id) => document.getElementById(id).classList.add('open');
const closeModal = (id) => document.getElementById(id).classList.remove('open');

const openComposer = () => {
  resetComposer();
  openModal('composerModal');
  setTimeout(() => document.getElementById('fTitle').focus(), 60);
};
document.getElementById('openComposer').onclick = openComposer;
document.getElementById('railComposer').onclick = openComposer;

document.getElementById('openSearch').onclick = () => {
  const input = document.getElementById('searchInput');
  input.value = state.query;
  openModal('searchModal');
  setTimeout(() => { input.focus(); input.select(); }, 50);
};

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('searchInput');
  if (state.activePostId) closePostView();
  state.query = input.value.trim();
  state.view = 'All';
  input.blur();
  closeModal('searchModal');
  render();
});

document.getElementById('clearSearchBtn').onclick = () => { state.query = ''; document.getElementById('searchInput').value = ''; render(); };
document.querySelectorAll('[data-close]').forEach(el => { el.onclick = () => closeModal(el.dataset.close); });
document.querySelectorAll('.modal-backdrop').forEach(bg => { bg.addEventListener('click', (e) => { if (e.target === bg) closeModal(bg.id); }); });

document.getElementById('postForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  const author = isAdmin(user) ? user.name : document.getElementById('fAuthor').value.trim();
  const errEl = document.getElementById('composerAuthorError');

  if (isReservedAuthorName(author)) {
    setInlineError(errEl, 'That name is reserved');
    showToast('That name is reserved');
    return;
  }

  setInlineError(errEl, '');
  const text = document.getElementById('fSummary').value.trim();
  const firstLine = text.split('\n')[0];
  const summary = firstLine.length > 180 ? firstLine.slice(0, 177) + '…' : firstLine;
  const chosenCategory = document.getElementById('fCategory').value;
  const newPost = {
    id: Date.now(),
    title: document.getElementById('fTitle').value.trim(),
    summary,
    body: text,
    url: document.getElementById('fUrl').value.trim(),
    category: chosenCategory,
    domain: state.selectedDomain,
    author,
    authorRole: isAdmin(user) ? 'admin' : 'member',
    upvotes: 1,
    views: 1,
    media: state.pendingMedia.map(m => ({ type: m.type, url: m.url })),
    createdAt: new Date().toISOString(),
    comments: []
  };
  if (state.activePostId) closePostView();
  state.posts.unshift(newPost);
  state.voted.add(newPost.id);
  saveState();
  e.target.reset();
  resetComposer();
  closeModal('composerModal');
  render();
  showToast(`Posted to ${chosenCategory}`);
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    document.getElementById('openSearch').click();
  } else if (document.getElementById('lightbox').classList.contains('open')) {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') { state.lightboxIndex--; renderLightboxFrame(); }
    else if (e.key === 'ArrowRight') { state.lightboxIndex++; renderLightboxFrame(); }
  } else if (e.key === 'Escape') {
    if (document.getElementById('adminModal').classList.contains('open')) { closeModal('adminModal'); return; }
    if (document.getElementById('scatterModal').classList.contains('open')) { closeModal('scatterModal'); return; }
    if (document.getElementById('searchModal').classList.contains('open')) { closeModal('searchModal'); return; }
    if (document.getElementById('composerModal').classList.contains('open')) { closeModal('composerModal'); return; }
    if (state.activePostId) closePostView();
  }
});

// Light / Black Theme Toggle
const SUN_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#818cf8" stroke="#6366f1" stroke-width="2" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>';

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeLabel').textContent = theme === 'dark' ? 'Light' : 'Black';
  document.getElementById('themeIcon').innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
  localStorage.setItem('canopy_theme', theme);
};
applyTheme(localStorage.getItem('canopy_theme') || 'light');
document.getElementById('themeToggle').onclick = () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
};

document.getElementById('breezeToggle').onclick = () => {
  const calm = document.body.classList.toggle('calm-mode');
  document.getElementById('breezeLabel').textContent = calm ? 'Breeze Off' : 'Breeze On';
};

// Safe in-place timestamp refresh
setInterval(() => {
  document.querySelectorAll('[data-ts]').forEach(el => { el.textContent = timeAgo(el.dataset.ts); });
}, 30000);

populateAdminSelect();
renderAdminToggle();
syncAllAuthorInputs();
renderDomainChips();
updateComposerLiveLogos();
render();
const hashMatch = window.location.hash.match(/^#post-(\d+)$/);
if (hashMatch) openPostView(Number(hashMatch[1]));