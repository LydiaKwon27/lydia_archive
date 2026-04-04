// ===================== SUPABASE CLIENT =====================
const SUPABASE_URL = 'https://saubsoroohbdnihlfhkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhdWJzb3Jvb2hiZG5paGxmaGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTI2NzAsImV4cCI6MjA5MDg4ODY3MH0.DWtBT4Fes3U12t4Xw4kv-QR3FxSEGTx53CEFi19WlKw';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== POST DATA =====================
let POSTS = [];

// Fetch posts from Supabase and populate POSTS array
async function fetchPostsFromDB() {
    const { data, error } = await _supabase.from('posts').select('*').order('sort_order');
    if (error) { console.error('Failed to load posts:', error); return; }
    POSTS.length = 0;
    (data || []).forEach(row => {
        POSTS.push({
            id: row.id,
            cat: row.cat,
            catLabel: row.cat_label,
            date: row.date,
            title: row.title,
            excerpt: row.excerpt || '',
            image: row.image || '',
            imageType: row.image_type || 'img',
            imageEmoji: row.image_emoji || '',
            hashtags: row.hashtags || [],
            content: row.content,
            linkedInUrl: row.linkedin_url || '',
            attachments: row.attachments || [],
            sortOrder: row.sort_order || 0
        });
    });
}



// ===================== STATE =====================
let currentCat = 'all';
let currentSearch = '';
let currentPostId = null;
let currentVisiblePosts = [...POSTS];

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch posts from Supabase DB
    await fetchPostsFromDB();
    currentVisiblePosts = [...POSTS];

    // Apply lang first, then apply settings on top of it so user edits aren't clobbered
    const savedLang = localStorage.getItem(LANG_KEY) || 'ko';
    applyLanguage(savedLang);
    applySiteSettings();

    renderGrid(POSTS);
    await applyLoginUI();
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    // Login modal enter key
    const pwInput = document.getElementById('loginPwInput');
    if (pwInput) pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitLogin(); });
    const emailInput = document.getElementById('loginEmailInput');
    if (emailInput) emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPwInput').focus(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeModalDirect(); closeAdminModal(); closeLoginModal(); }
        if (e.key === 'ArrowLeft') navigatePost(-1);
        if (e.key === 'ArrowRight') navigatePost(1);
    });
});

// ===================== RENDER =====================
function renderGrid(posts) {
    const grid = document.getElementById('postGrid');
    const empty = document.getElementById('emptyState');
    const count = document.getElementById('resultsCount');

    if (!posts.length) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        count.textContent = '';
        return;
    }
    empty.style.display = 'none';
    count.textContent = `${posts.length}개의 글`;

    const cats = loadCategories();
    grid.innerHTML = posts.map((p, i) => {
        const catObj = cats.find(c => c.id === p.cat);
        const displayLabel = catObj ? catObj.labelEn : p.catLabel;
        return `
    <article class="post-card" data-cat="${p.cat}" style="animation-delay:${i * 0.07}s" onclick="isAdminMode ? void(0) : openPost(${p.id})">
      <div class="card-admin-btns">
        <button class="card-reorder-btn" onclick="event.stopPropagation();reorderPost(${p.id},-1)" title="위로 이동">▲</button>
        <button class="card-reorder-btn" onclick="event.stopPropagation();reorderPost(${p.id},1)" title="아래로 이동">▼</button>
        <button class="card-edit-btn" onclick="event.stopPropagation();openPostEditor(${p.id})">✏ 수정</button>
        <button class="card-del-btn" onclick="event.stopPropagation();quickDeletePost(${p.id})">✕</button>
      </div>
      <div class="card-img-wrap">
        ${p.imageType === 'img'
                ? `<img src="${p.image}" alt="${p.title}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="card-img-placeholder" style="display:none">${getCatEmoji(p.cat)}</div>`
                : p.imageType === 'pdf'
                    ? `<div class="card-pdf-thumb-wrap"><iframe src="${p.image}#toolbar=0&navpanes=0&scrollbar=0&zoom=FitH&page=1" class="pdf-thumb-frame" tabindex="-1" scrolling="no"></iframe></div>`
                    : `<div class="card-img-placeholder">${p.imageEmoji}</div>`}
        <div class="card-img-overlay"></div>
      </div>
      <div class="card-body">
        <div class="card-badge-row">
          <span class="card-badge badge-${p.cat}">${displayLabel}</span>
          <span class="card-read-time">⏱ ${readTime(p.content)} min</span>
        </div>
        <h3 class="card-title">${p.title}</h3>
        <p class="card-excerpt">${p.excerpt}</p>
        <div class="card-footer">
          <span class="card-date">${formatDate(p.date)}</span>
          <span class="card-cta">읽기 →</span>
        </div>
      </div>
    </article>`;
    }).join('');
    currentVisiblePosts = posts;
}

// ===================== FILTER & SEARCH =====================
function filterPosts(cat, el) {
    currentCat = cat;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    applyFilters();
}

function handleSearch(e) {
    currentSearch = e.target.value.trim().toLowerCase();
    document.getElementById('clearSearch').style.display = currentSearch ? 'block' : 'none';
    applyFilters();
}

function clearSearch() {
    currentSearch = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    applyFilters();
}

function applyFilters() {
    let posts = POSTS;
    if (currentCat !== 'all') posts = posts.filter(p => p.cat === currentCat);
    if (currentSearch) posts = posts.filter(p =>
        p.title.toLowerCase().includes(currentSearch) ||
        p.excerpt.toLowerCase().includes(currentSearch) ||
        p.content.toLowerCase().includes(currentSearch) ||
        p.hashtags.some(h => h.toLowerCase().includes(currentSearch))
    );
    renderGrid(posts);
    currentVisiblePosts = posts;
}

// ===================== MODAL =====================
function openPost(id) {
    const p = POSTS.find(x => x.id === id);
    if (!p) return;
    currentPostId = id;

    const modal = document.getElementById('postModal');
    const cats = loadCategories();
    const catObj = cats.find(c => c.id === p.cat);
    const displayLabel = catObj ? catObj.labelEn : p.catLabel;

    document.getElementById('modalTitle').textContent = p.title;
    document.getElementById('modalBadge').textContent = displayLabel;
    document.getElementById('modalBadge').className = `modal-badge badge-${p.cat}`;
    document.getElementById('modalDate').textContent = formatDate(p.date);
    document.getElementById('modalReadTime').textContent = `⏱ ${readTime(p.content)} min read`;
    document.getElementById('modalContent').innerHTML = formatContent(p.content);
    document.getElementById('modalHashtags').innerHTML = p.hashtags.map(h => `<span class="modal-hashtag">#${h}</span>`).join('');

    const imgWrap = document.getElementById('modalImage');
    // Check for multiple image attachments
    const imageAttachments = (p.attachments || []).filter(a => a.type && a.type.startsWith('image/'));
    if (p.imageType === 'img' && imageAttachments.length > 1) {
        // Multiple images — show carousel
        const imageUrls = imageAttachments.map(a => a.data || a.url);
        imgWrap.innerHTML = `
          <div class="img-carousel" id="imgCarousel">
            <img id="imgCarouselImg" src="" alt="${p.title}" />
            <button class="img-carousel-btn-overlay prev" onclick="imageCarouselNav(-1)">&#8249;</button>
            <button class="img-carousel-btn-overlay next" onclick="imageCarouselNav(1)">&#8250;</button>
            <span class="img-carousel-counter-overlay" id="imgCarouselCounter">1 / ${imageUrls.length}</span>
          </div>`;
        initImageCarousel(imageUrls);
    } else if (p.imageType === 'img') {
        imgWrap.innerHTML = `<img src="${p.image}" alt="${p.title}" style="width:100%;border-radius:12px" />`;
    } else if (p.imageType === 'pdf') {
        // PDF carousel: render all pages
        imgWrap.innerHTML = `
          <div class="pdf-modal-carousel" id="pdfCarousel_${p.id}">
            <canvas id="pdfModalCanvas" class="pdf-modal-canvas"></canvas>
            <div class="pdf-carousel-controls">
              <button class="pdf-pg-btn" onclick="pdfPageNav(-1)">&#8249;</button>
              <span class="pdf-pg-num" id="pdfPageInfo">로딩중...</span>
              <button class="pdf-pg-btn" onclick="pdfPageNav(1)">&#8250;</button>
            </div>
          </div>`;
        initPDFCarousel(p.image);
    } else {
        imgWrap.innerHTML = `<div class="modal-img-placeholder">${p.imageEmoji}</div>`;
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderModalAttachments(p.attachments || []);
}

function handleOverlayClick(e) {
    if (e.target === document.getElementById('postModal')) closeModalDirect();
}

function closeModal(e) { handleOverlayClick(e); }

function closeModalDirect() {
    document.getElementById('postModal').classList.remove('open');
    document.body.style.overflow = '';
    currentPostId = null;
    clearInterval(_pdfAutoTimer);
    _pdfDoc = null;
    _imgCarouselImages = [];
    _imgCarouselIndex = 0;
}

// Open editor for the current post from within the modal
function editCurrentPost() {
    if (!currentPostId) return;
    closeModalDirect();
    openPostEditor(currentPostId);
}

// ===================== SHARE / COPY =====================
function copyPostLink() {
    const url = window.location.href.split('#')[0] + '#post-' + (currentPostId || '');
    navigator.clipboard.writeText(url).catch(() => { });
    const btn = document.getElementById('copyBtn');
    btn.classList.add('copied');
    showToast('링크가 클립보드에 복사되었습니다 ✓');
    setTimeout(() => btn.classList.remove('copied'), 2500);
}

function shareLinkedIn() {
    const p = POSTS.find(x => x.id === currentPostId);
    const linkedInProfile = 'https://www.linkedin.com/in/%EC%A7%80%EC%9C%A4-%EA%B6%8C-528452276/';
    const targetUrl = (p && p.linkedInUrl) ? p.linkedInUrl : linkedInProfile;
    // 모바일이면 앱으로 열기 시도
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile) {
        const appUrl = targetUrl.replace(/https?:\/\/(www\.)?linkedin\.com/, 'linkedin:/');
        window.location.href = appUrl;
        setTimeout(() => { window.open(targetUrl, '_blank'); }, 1500);
    } else {
        window.open(targetUrl, '_blank');
    }
}

function shareTwitter() {
    const p = POSTS.find(x => x.id === currentPostId);
    const text = encodeURIComponent((p ? p.title : '') + ' — LinkedIn Portfolio');
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// ===================== PDF.js RENDERING =====================
let _pdfDoc = null;
let _pdfCurrentPage = 1;
let _pdfAutoTimer = null;

function pdfWorkerSrc() {
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
}

// Render a single page to a canvas
async function renderPDFPage(doc, pageNum, canvas) {
    const page = await doc.getPage(pageNum);
    const containerW = canvas.parentElement ? (canvas.parentElement.offsetWidth || 680) : 680;
    const baseVp = page.getViewport({ scale: 1 });
    const scale = containerW / baseVp.width;
    const vp = page.getViewport({ scale });
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
}

// Card thumbnail: page 1 only
async function renderPDFThumb(pdfUrl, canvas) {
    try {
        pdfWorkerSrc();
        if (typeof pdfjsLib === 'undefined') throw new Error('no pdfjsLib');
        const doc = await pdfjsLib.getDocument(pdfUrl).promise;
        await renderPDFPage(doc, 1, canvas);
        // Hide loading label
        const wrap = canvas.parentElement;
        const lbl = wrap && wrap.querySelector('.pdf-loading-label');
        if (lbl) lbl.style.display = 'none';
        canvas.style.display = 'block';
    } catch (e) {
        console.warn('PDF thumb failed:', e);
        const wrap = canvas.parentElement;
        if (wrap) wrap.innerHTML = `<div class="card-img-placeholder">📄</div>`;
    }
}

function renderAllPDFThumbs() {
    document.querySelectorAll('canvas.pdf-thumb-canvas').forEach(canvas => {
        canvas.style.display = 'none';
        renderPDFThumb(canvas.dataset.pdf, canvas);
    });
}

// Modal PDF carousel
async function initPDFCarousel(pdfUrl) {
    try {
        pdfWorkerSrc();
        if (typeof pdfjsLib === 'undefined') throw new Error('no pdfjsLib');
        _pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
        _pdfCurrentPage = 1;
        clearInterval(_pdfAutoTimer);
        await showPDFModalPage(_pdfCurrentPage);
        // Auto-advance every 4 seconds
        _pdfAutoTimer = setInterval(() => {
            const next = _pdfCurrentPage < _pdfDoc.numPages ? _pdfCurrentPage + 1 : 1;
            pdfPageNav(next - _pdfCurrentPage || 0, true);
        }, 4000);
    } catch (e) {
        console.warn('PDF carousel init failed:', e);
        const c = document.getElementById('pdfModalCanvas');
        if (c && c.parentElement) c.parentElement.innerHTML = '<div class="modal-img-placeholder">📄 PDF를 불러올 수 없습니다</div>';
    }
}

async function showPDFModalPage(pageNum) {
    if (!_pdfDoc) return;
    _pdfCurrentPage = Math.max(1, Math.min(pageNum, _pdfDoc.numPages));
    const canvas = document.getElementById('pdfModalCanvas');
    if (!canvas) return;
    const info = document.getElementById('pdfPageInfo');
    if (info) info.textContent = `${_pdfCurrentPage} / ${_pdfDoc.numPages}`;
    await renderPDFPage(_pdfDoc, _pdfCurrentPage, canvas);
}

function pdfPageNav(dir, wrap) {
    if (!_pdfDoc) return;
    clearInterval(_pdfAutoTimer);
    let next = _pdfCurrentPage + dir;
    if (next < 1) next = _pdfDoc.numPages;
    if (next > _pdfDoc.numPages) next = 1;
    // Slide animation
    const canvas = document.getElementById('pdfModalCanvas');
    if (canvas) {
        canvas.style.transition = 'opacity 0.2s, transform 0.2s';
        canvas.style.opacity = '0';
        canvas.style.transform = `translateX(${dir > 0 ? '30px' : '-30px'})`;
        setTimeout(async () => {
            await showPDFModalPage(next);
            canvas.style.transition = 'none';
            canvas.style.opacity = '0';
            canvas.style.transform = `translateX(${dir > 0 ? '-20px' : '20px'})`;
            requestAnimationFrame(() => {
                canvas.style.transition = 'opacity 0.2s, transform 0.2s';
                canvas.style.opacity = '1';
                canvas.style.transform = 'translateX(0)';
            });
        }, 200);
    }
    // Restart auto-advance
    _pdfAutoTimer = setInterval(() => pdfPageNav(1, true), 4000);
}

// ===================== IMAGE CAROUSEL =====================
let _imgCarouselImages = [];
let _imgCarouselIndex = 0;
let _imgTouchStartX = 0;

function initImageCarousel(images) {
    _imgCarouselImages = images;
    _imgCarouselIndex = 0;
    const img = document.getElementById('imgCarouselImg');
    if (img) img.src = images[0];
    _updateImgCarouselCounter();
    // Touch support
    const carousel = document.getElementById('imgCarousel');
    if (carousel) {
        carousel.addEventListener('touchstart', function (e) {
            _imgTouchStartX = e.changedTouches[0].clientX;
        }, { passive: true });
        carousel.addEventListener('touchend', function (e) {
            const dx = e.changedTouches[0].clientX - _imgTouchStartX;
            if (Math.abs(dx) > 40) {
                imageCarouselNav(dx < 0 ? 1 : -1);
            }
        }, { passive: true });
    }
}

function imageCarouselNav(dir) {
    if (!_imgCarouselImages.length) return;
    const img = document.getElementById('imgCarouselImg');
    if (!img) return;
    let next = _imgCarouselIndex + dir;
    if (next < 0) next = _imgCarouselImages.length - 1;
    if (next >= _imgCarouselImages.length) next = 0;
    // Slide animation (same pattern as pdfPageNav)
    img.style.transition = 'opacity 0.2s, transform 0.2s';
    img.style.opacity = '0';
    img.style.transform = `translateX(${dir > 0 ? '30px' : '-30px'})`;
    setTimeout(() => {
        _imgCarouselIndex = next;
        img.src = _imgCarouselImages[next];
        _updateImgCarouselCounter();
        img.style.transition = 'none';
        img.style.opacity = '0';
        img.style.transform = `translateX(${dir > 0 ? '-20px' : '20px'})`;
        requestAnimationFrame(() => {
            img.style.transition = 'opacity 0.2s, transform 0.2s';
            img.style.opacity = '1';
            img.style.transform = 'translateX(0)';
        });
    }, 200);
}

function _updateImgCarouselCounter() {
    const counter = document.getElementById('imgCarouselCounter');
    if (counter) counter.textContent = `${_imgCarouselIndex + 1} / ${_imgCarouselImages.length}`;
}

// ===================== SLIDE NAVIGATION =====================
function navigatePost(dir) {
    if (!currentPostId) return;
    const list = currentVisiblePosts.length ? currentVisiblePosts : POSTS;
    const idx = list.findIndex(p => p.id === currentPostId);
    if (idx === -1) return;
    const next = list[idx + dir];
    if (!next) return;
    // Animate slide
    const body = document.getElementById('modalBody');
    body.style.transition = 'opacity 0.18s, transform 0.18s';
    body.style.opacity = '0';
    body.style.transform = `translateX(${dir > 0 ? '30px' : '-30px'})`;
    setTimeout(() => {
        openPost(next.id);
        body.style.transition = 'none';
        body.style.opacity = '0';
        body.style.transform = `translateX(${dir > 0 ? '-20px' : '20px'})`;
        requestAnimationFrame(() => {
            body.style.transition = 'opacity 0.2s, transform 0.2s';
            body.style.opacity = '1';
            body.style.transform = 'translateX(0)';
        });
    }, 180);
}

// ===================== ABOUT NAV =====================
function scrollToAbout() {
    document.getElementById('about-section').scrollIntoView({ behavior: 'smooth' });
}

function showArchive() {
    document.getElementById('archive').scrollIntoView({ behavior: 'smooth' });
}

// ===================== HELPERS =====================
function readTime(text) {
    const words = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
}

function formatDate(d) {
    const [y, m] = d.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
}

function getCatEmoji(cat) {
    return { career: '🚀', sales: '📊', martech: '🔮', ai: '🤖' }[cat] || '✦';
}

function formatContent(text) {
    return text.split('\n').filter(l => l.trim()).map(line => {
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (/^——+/.test(line)) return '<hr style="border:none;border-top:1px solid var(--border);margin:1.5rem 0">';
        return `<p>${line}</p>`;
    }).join('');
}

// ===================== PDF RENDERING =====================
async function renderPDFToCanvas(pdfUrl, canvas) {
    try {
        if (typeof pdfjsLib === 'undefined') {
            canvas.parentElement.innerHTML = `<div class="card-img-placeholder">📄</div>`;
            return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const page = await pdf.getPage(1);
        const containerW = canvas.parentElement ? canvas.parentElement.offsetWidth || 340 : 340;
        const baseVp = page.getViewport({ scale: 1 });
        const scale = containerW / baseVp.width;
        const vp = page.getViewport({ scale });
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    } catch (e) {
        console.warn('PDF render failed:', pdfUrl, e);
        if (canvas.parentElement) {
            canvas.parentElement.innerHTML = `<div class="card-img-placeholder">📄</div>`;
        }
    }
}

function renderAllPDFs() {
    document.querySelectorAll('canvas.pdf-thumb').forEach(canvas => {
        renderPDFToCanvas(canvas.dataset.pdf, canvas);
    });
}

// ===================== ADMIN PANEL =====================
let isAdminMode = false;
let isLoggedIn = false;

const CAT_LABELS = {
    career: '\uD83D\uDE80 \ucee4\ub9ac\uc5b4 \uc5ec\uc815',
    sales: '\uD83D\uDCCA \uc138\uc77c\uc988 \ud50c\ub808\uc774\ubd81',
    martech: '\uD83D\uDD2E \ub9c8\ud14c\ud06c & \uc18c\ube44\uc790',
    ai: '\uD83E\uDD16 AI \uc2e4\ud5d8\uc2e4'
};

// ---- Login helpers (Supabase Auth) ----
async function checkLoginState() {
    const { data: { session } } = await _supabase.auth.getSession();
    return !!session;
}

async function applyLoginUI() {
    isLoggedIn = await checkLoginState();
    isAdminMode = isLoggedIn; // Sync old flag
    const loginBtn = document.getElementById('adminLoginBtn');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    const writeWrap = document.querySelector('.write-post-wrap');
    if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'inline-flex' : 'none';
    if (writeWrap) writeWrap.style.display = isLoggedIn ? 'flex' : 'none';
    if (isLoggedIn) {
        document.body.classList.add('admin-mode');
    } else {
        document.body.classList.remove('admin-mode');
    }
    const modalEditRow = document.querySelector('.modal-edit-row');
    if (modalEditRow) modalEditRow.style.display = isLoggedIn ? 'flex' : 'none';
}

// ---- Login modal ---- (NEVER auto-opens setup modal; visitors always see normal login)
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.classList.add('open');
    document.getElementById('loginEmailInput').value = '';
    document.getElementById('loginPwInput').value = '';
    document.getElementById('loginError').style.display = 'none';
    setTimeout(() => document.getElementById('loginEmailInput').focus(), 100);
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('open');
}

async function submitLogin() {
    const email = document.getElementById('loginEmailInput').value.trim();
    const pw = document.getElementById('loginPwInput').value;
    if (!email || !pw) return;
    const { error } = await _supabase.auth.signInWithPassword({ email, password: pw });
    if (!error) {
        closeLoginModal();
        isAdminMode = true; // Set BEFORE applyLoginUI draws the tabs
        await applyLoginUI();
        renderGrid(currentVisiblePosts.length ? currentVisiblePosts : POSTS);
        showToast('\u2705 \uad00\ub9ac\uc790\ub85c \ub85c\uadf8\uc778\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
    } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('loginPwInput').value = '';
        document.getElementById('loginPwInput').focus();
    }
}

// Password change: use Supabase dashboard
function openSetPasswordModal() { }
function closeSetPasswordModal() { }
function submitSetPassword() { }

async function adminLogout() {
    await _supabase.auth.signOut();
    isAdminMode = false;
    isLoggedIn = false;
    await applyLoginUI();
    renderGrid(currentVisiblePosts.length ? currentVisiblePosts : POSTS);
    showToast('\ub85c\uadf8\uc544\uc6c3 \ub418\uc5c8\uc2b5\ub2c8\ub2e4');
}

// --- Storage functions replaced by Supabase ---
// savePosts is now a no-op; actual saving happens in savePost/deleteCurrentPost/quickDeletePost
function savePosts(posts) {
    // No-op: Supabase is the source of truth. Kept for compatibility with monkey-patched code.
}

/* removed: saveImageStore, loadImageStore, loadAllPosts, initPostsFromStorage — replaced by fetchPostsFromDB */
function initPostsFromStorage() { /* no-op, kept for compatibility */ }


// Toggle admin mode (only when logged in)
function toggleAdminMode() {
    if (!isLoggedIn) { openLoginModal(); return; }
    isAdminMode ? exitAdminMode() : enterAdminMode();
}
function enterAdminMode() {
    isAdminMode = true;
    document.body.classList.add('admin-mode');
    const bar = document.getElementById('adminBar');
    const fab = document.getElementById('adminFab');
    if (bar) bar.style.display = 'flex';
    if (fab) fab.style.display = 'flex';
    renderGrid(currentVisiblePosts.length ? currentVisiblePosts : POSTS);
}
function exitAdminMode() {
    isAdminMode = false;
    document.body.classList.remove('admin-mode');
    const bar = document.getElementById('adminBar');
    const fab = document.getElementById('adminFab');
    if (bar) bar.style.display = 'none';
    if (fab) fab.style.display = 'none';
    renderGrid(currentVisiblePosts.length ? currentVisiblePosts : POSTS);
}

// Open editor — only allowed when logged in
function openPostEditor(id) {
    if (!isLoggedIn) { openLoginModal(); return; }
    const modal = document.getElementById('adminModal');
    const delBtn = document.getElementById('deletePostBtn');
    document.getElementById('editPostId').value = id ?? '';
    document.getElementById('editImageData').value = '';
    document.getElementById('editImagePreview').style.display = 'none';
    document.getElementById('editImageLabel').textContent = '클릭하여 이미지 업로드';

    // Reset attachments
    _pendingAttachments = [];
    if (id) {
        const p = POSTS.find(x => x.id === id);
        if (!p) return;
        document.getElementById('editorTitle').textContent = '글 수정';
        document.getElementById('editCat').value = p.cat;
        document.getElementById('editDate').value = p.date.length === 7 ? p.date : p.date + '-01';
        document.getElementById('editPostTitle').value = p.title;
        document.getElementById('editExcerpt').value = p.excerpt;
        document.getElementById('editContent').value = p.content;
        document.getElementById('editHashtags').value = p.hashtags.join(', ');
        document.getElementById('editLinkedInUrl').value = p.linkedInUrl || '';
        if (p.image && p.imageType === 'img') {
            document.getElementById('editImageData').value = p.image;
            const prev = document.getElementById('editImagePreview');
            prev.src = p.image; prev.style.display = 'block';
            document.getElementById('editImageLabel').textContent = '클릭하여 이미지 변경';
        }
        // Restore attachments
        if (p.attachments && p.attachments.length) {
            _pendingAttachments = [...p.attachments];
            renderAttachFileList();
        } else {
            renderAttachFileList();
        }
        delBtn.style.display = 'inline-flex';
    } else {
        document.getElementById('editorTitle').textContent = '새 글 작성';
        const firstCat = loadCategories()[0] || { id: 'career', label: '커리어' };
        document.getElementById('editCat').value = firstCat.id;
        const now = new Date();
        document.getElementById('editDate').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('editPostTitle').value = '';
        document.getElementById('editExcerpt').value = '';
        document.getElementById('editContent').value = '';
        document.getElementById('editHashtags').value = '';
        document.getElementById('editLinkedInUrl').value = '';
        renderAttachFileList();
        delBtn.style.display = 'none';
    }
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('open');
    document.body.style.overflow = '';
}

function handleAdminOverlay(e) {
    if (e.target === document.getElementById('adminModal')) closeAdminModal();
}

async function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    // Upload to Supabase Storage
    const ext = file.name.split('.').pop();
    const fileName = `post_img_${Date.now()}.${ext}`;
    const { data: uploadData, error } = await _supabase.storage.from('media').upload(fileName, file, { upsert: true });
    if (error) {
        console.error('Image upload failed:', error);
        showToast('⚠️ 이미지 업로드 실패');
        return;
    }
    const { data: { publicUrl } } = _supabase.storage.from('media').getPublicUrl(fileName);
    document.getElementById('editImageData').value = publicUrl;
    const prev = document.getElementById('editImagePreview');
    prev.src = publicUrl; prev.style.display = 'block';
    document.getElementById('editImageLabel').textContent = '클릭하여 이미지 변경';
}

async function savePost() {
    const idRaw = document.getElementById('editPostId').value;
    const cat = document.getElementById('editCat').value;
    const dateVal = document.getElementById('editDate').value;
    const title = document.getElementById('editPostTitle').value.trim();
    const excerpt = document.getElementById('editExcerpt').value.trim();
    const content = document.getElementById('editContent').value;
    const hashtagsRaw = document.getElementById('editHashtags').value;
    const linkedInUrl = document.getElementById('editLinkedInUrl').value.trim();
    const imageData = document.getElementById('editImageData').value;
    const date = dateVal ? dateVal.slice(0, 7) : '2026-03';

    if (!title) { alert('제목을 입력해주세요.'); return; }

    const hashtags = hashtagsRaw.split(',').map(h => h.trim()).filter(Boolean);

    const cats = loadCategories();
    const catObj = cats.find(c => c.id === cat);
    const catLabel = catObj ? catObj.labelEn : (CAT_LABELS[cat] || cat);

    // If imageData is a base64 data URL, upload to Supabase Storage first
    let imageUrl = imageData || '';
    if (imageUrl.startsWith('data:')) {
        const blob = await fetch(imageUrl).then(r => r.blob());
        const ext = blob.type.split('/')[1] || 'png';
        const fileName = `post_img_${Date.now()}.${ext}`;
        const { error: upErr } = await _supabase.storage.from('media').upload(fileName, blob, { upsert: true });
        if (!upErr) {
            const { data: { publicUrl } } = _supabase.storage.from('media').getPublicUrl(fileName);
            imageUrl = publicUrl;
        }
    }

    const dbRow = {
        cat,
        cat_label: catLabel,
        date,
        title,
        excerpt,
        content,
        hashtags,
        image: imageUrl,
        image_type: imageUrl ? 'img' : 'emoji',
        image_emoji: getCatEmoji(cat),
        attachments: [..._pendingAttachments],
        linkedin_url: linkedInUrl,
        updated_at: new Date().toISOString()
    };

    if (idRaw) {
        const { error } = await _supabase.from('posts').update(dbRow).eq('id', parseInt(idRaw));
        if (error) { console.error('Update failed:', error); showToast('⚠️ 저장 실패'); return; }
    } else {
        dbRow.sort_order = 0;
        const { error } = await _supabase.from('posts').insert(dbRow);
        if (error) { console.error('Insert failed:', error); showToast('⚠️ 저장 실패'); return; }
    }

    await fetchPostsFromDB();
    currentVisiblePosts = [...POSTS];
    closeAdminModal();
    applyFilters();
    showToast(idRaw ? '✅ 글이 수정되었습니다' : '✅ 새 글이 등록되었습니다');
}

async function deleteCurrentPost() {
    const id = parseInt(document.getElementById('editPostId').value);
    if (!id) return;
    if (!confirm('이 글을 삭제하시겠습니까?')) return;
    const { error } = await _supabase.from('posts').delete().eq('id', id);
    if (error) { console.error('Delete failed:', error); showToast('⚠️ 삭제 실패'); return; }
    await fetchPostsFromDB();
    currentVisiblePosts = [...POSTS];
    closeAdminModal();
    applyFilters();
    showToast('🗑 글이 삭제되었습니다');
}

async function quickDeletePost(id) {
    if (!confirm('이 글을 삭제하시겠습니까?')) return;
    const { error } = await _supabase.from('posts').delete().eq('id', id);
    if (error) { console.error('Delete failed:', error); showToast('⚠️ 삭제 실패'); return; }
    await fetchPostsFromDB();
    currentVisiblePosts = [...POSTS];
    applyFilters();
    showToast('🗑 글이 삭제되었습니다');
}

// ===================== POST REORDERING =====================
async function reorderPost(id, dir) {
    // dir: -1 = move up, 1 = move down
    const idx = POSTS.findIndex(p => p.id === id);
    if (idx === -1) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= POSTS.length) return;

    const postA = POSTS[idx];
    const postB = POSTS[swapIdx];

    // Swap sort_order values in Supabase
    const orderA = postA.sortOrder;
    const orderB = postB.sortOrder;

    try {
        const { error: err1 } = await _supabase.from('posts').update({ sort_order: orderB }).eq('id', postA.id);
        if (err1) throw err1;
        const { error: err2 } = await _supabase.from('posts').update({ sort_order: orderA }).eq('id', postB.id);
        if (err2) throw err2;

        await fetchPostsFromDB();
        currentVisiblePosts = [...POSTS];
        applyFilters();
        showToast('✅ 순서가 변경되었습니다');
    } catch (e) {
        console.error('Reorder failed:', e);
        showToast('⚠️ 순서 변경 실패');
    }
}

// ===================== FILE ATTACHMENTS =====================
let _pendingAttachments = []; // [{name, type, data}]

function handleAttachFiles(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            _pendingAttachments.push({ name: file.name, type: file.type, data: e.target.result });
            renderAttachFileList();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function renderAttachFileList() {
    const list = document.getElementById('attachFileList');
    if (!list) return;
    list.innerHTML = _pendingAttachments.map((f, i) => `
        <div class="attach-file-item">
            <span>${getFileIcon(f.type)} ${f.name}</span>
            <button onclick="removeAttachment(${i})">✕ 제거</button>
        </div>`).join('');
    document.getElementById('editAttachData').value = JSON.stringify(_pendingAttachments);
}

function removeAttachment(idx) {
    _pendingAttachments.splice(idx, 1);
    renderAttachFileList();
}

function getFileIcon(type) {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
    if (type.includes('video')) return '🎬';
    if (type.includes('audio')) return '🎵';
    return '📎';
}

// Show attachments inside the post modal
function renderModalAttachments(attachments) {
    const el = document.getElementById('modalAttachments');
    if (!el) return;
    if (!attachments || !attachments.length) { el.innerHTML = ''; return; }
    el.innerHTML = attachments.map(f => `
        <a class="modal-attach-item" href="${f.data}" download="${f.name}">
            <span class="modal-attach-icon">${getFileIcon(f.type)}</span>
            <span>${f.name}</span>
            <span style="margin-left:auto;font-size:0.75rem;color:var(--text3)">⬇ 다운로드</span>
        </a>`).join('');
}

// ===================== SITE SETTINGS (inline editing) =====================
const SITE_SETTINGS_KEY = 'lydia_site_settings';
const SITE_IMG_KEY = 'lydia_site_images';

const SITE_TEXT_IDS = [
    'heroNameKo', 'heroNameEn',
    'heroHeadline', 'heroSub',
    'statN1', 'statL1', 'statN2', 'statL2', 'statN3', 'statL3',
    'aboutLabel', 'aboutName',
    'aboutP1', 'aboutP2', 'aboutP3'
];
const SITE_TAG_CONTAINERS = ['heroTagsWrap', 'aboutTagsWrap'];

function loadSiteSettings() {
    try { return JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) || '{}'); } catch (e) { return {}; }
}
function loadSiteImages() {
    try { return JSON.parse(localStorage.getItem(SITE_IMG_KEY) || '{}'); } catch (e) { return {}; }
}
function _saveSiteImages(imgs) {
    try { localStorage.setItem(SITE_IMG_KEY, JSON.stringify(imgs)); } catch (e) { console.warn('Site image save failed:', e); }
}

function applySiteSettings() {
    const settings = loadSiteSettings();
    const imgs = loadSiteImages();

    SITE_TEXT_IDS.forEach(id => {
        const custom = settings[id + '_' + _currentLang] || (_currentLang === 'ko' ? settings[id] : undefined);
        if (custom !== undefined) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = custom;
        }
    });
    SITE_TAG_CONTAINERS.forEach(cid => {
        const custom = settings[cid + '_' + _currentLang] || (_currentLang === 'ko' ? settings[cid] : undefined);
        if (custom) {
            const wrap = document.getElementById(cid);
            if (!wrap) return;
            const tagClass = cid === 'heroTagsWrap' ? 'htag' : 'about-tag';
            const spans = wrap.querySelectorAll('.' + tagClass);
            custom.forEach((t, i) => { if (spans[i]) spans[i].textContent = t; });
        }
    });
    if (settings.linkedInUrl) {
        ['heroLinkedInLink', 'aboutLinkedInLink'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.href = settings.linkedInUrl;
        });
    }
    if (imgs.avatar) {
        ['heroAvatarImg', 'aboutPhotoImg'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.src = imgs.avatar; el.style.display = 'block'; }
        });
    }
    if (imgs.banner) {
        const el = document.getElementById('heroBannerImg');
        if (el) { el.src = imgs.banner; el.style.display = 'block'; }
    }
}

function saveSiteSettings() {
    const settings = loadSiteSettings();
    SITE_TEXT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) settings[id + '_' + _currentLang] = el.innerHTML;
    });
    SITE_TAG_CONTAINERS.forEach(cid => {
        const wrap = document.getElementById(cid);
        if (!wrap) return;
        const tagClass = cid === 'heroTagsWrap' ? 'htag' : 'about-tag';
        settings[cid + '_' + _currentLang] = Array.from(wrap.querySelectorAll('.' + tagClass)).map(s => s.textContent.trim());
    });
    const liLink = document.getElementById('heroLinkedInLink');
    if (liLink) settings.linkedInUrl = liLink.href;
    try {
        localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(settings));
        showToast('\uD83D\uDCBE \ubcc0\uacbd\uc0ac\ud56d\uc774 \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4!');
    } catch (e) {
        showToast('\u26A0\uFE0F \uc800\uc7a5 \uacf5\uac04\uc774 \ubd80\uc871\ud569\ub2c8\ub2e4.');
    }
}

function enableInlineEditing() {
    SITE_TEXT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.contentEditable = 'true'; el.classList.add('site-editable'); }
    });
    SITE_TAG_CONTAINERS.forEach(cid => {
        const wrap = document.getElementById(cid);
        if (!wrap) return;
        const tagClass = cid === 'heroTagsWrap' ? 'htag' : 'about-tag';
        wrap.querySelectorAll('.' + tagClass).forEach(span => {
            span.contentEditable = 'true';
            span.classList.add('site-editable');
        });
    });
    ['heroLinkedInLink', 'aboutLinkedInLink'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', _linkedInEditClick);
    });
    _addImageOverlay('hero-banner-wrap', 'uploadBannerInput', '🖼 배너 변경');
    _addImageOverlay('hero-avatar-wrap', 'uploadAvatarInput', '📷 프로필 변경');
    _addImageOverlay('aboutPhotoWrap', 'uploadAboutInput', '📷 사진 변경');
}

function disableInlineEditing() {
    SITE_TEXT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.contentEditable = 'false'; el.classList.remove('site-editable'); }
    });
    SITE_TAG_CONTAINERS.forEach(cid => {
        const wrap = document.getElementById(cid);
        if (!wrap) return;
        const tagClass = cid === 'heroTagsWrap' ? 'htag' : 'about-tag';
        wrap.querySelectorAll('.' + tagClass).forEach(span => {
            span.contentEditable = 'false';
            span.classList.remove('site-editable');
        });
    });
    ['heroLinkedInLink', 'aboutLinkedInLink'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.removeEventListener('click', _linkedInEditClick);
    });
    document.querySelectorAll('.img-edit-overlay').forEach(o => o.remove());
}

function _linkedInEditClick(e) {
    e.preventDefault();
    const current = document.getElementById('heroLinkedInLink').href;
    const url = prompt('LinkedIn URL\uc744 \uc785\ub825\ud558\uc138\uc694:', current);
    if (url && url.trim()) {
        ['heroLinkedInLink', 'aboutLinkedInLink'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.href = url.trim();
        });
        showToast('LinkedIn URL\uc774 \ubcc0\uacbd\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \uc800\uc7a5 \ubc84\ud2bc\uc744 \ub20c\ub7ec\uc8fc\uc138\uc694.');
    }
}

function _addImageOverlay(wrapId, inputId, label) {
    const wrap = document.getElementById(wrapId);
    if (!wrap || wrap.querySelector('.img-edit-overlay')) return;
    const type = inputId.includes('Banner') ? 'banner' : 'avatar';
    const overlay = document.createElement('div');
    overlay.className = 'img-edit-overlay';
    overlay.innerHTML = `<span>${label}</span><span class="img-crop-btn" data-crop-type="${type}">✂️ 크롭</span>`;
    // "변경" 클릭 → 새 이미지 업로드
    overlay.querySelector('span:first-child').addEventListener('click', () => {
        const inp = document.getElementById(inputId);
        if (inp) inp.click();
    });
    // "크롭" 클릭 → 현재 이미지로 크롭 창 열기
    overlay.querySelector('.img-crop-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const imgEl = wrap.querySelector('img');
        if (imgEl && imgEl.src) {
            openCropModal(imgEl.src, type);
        } else {
            showToast('크롭할 이미지가 없습니다');
        }
    });
    wrap.style.position = 'relative';
    wrap.appendChild(overlay);
}

function handleSiteImageUpload(input, type) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target.result;
        const imgs = loadSiteImages();
        if (type === 'banner') {
            imgs.banner = data;
            const el = document.getElementById('heroBannerImg');
            if (el) { el.src = data; el.style.display = 'block'; }
        } else {
            imgs.avatar = data;
            ['heroAvatarImg', 'aboutPhotoImg'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.src = data; el.style.display = 'block'; }
            });
        }
        _saveSiteImages(imgs);
        showToast('\uD83D\uDCF7 \uc774\ubbf8\uc9c0\uac00 \uc5c5\ub85c\ub4dc\ub418\uc5c8\uc2b5\ub2c8\ub2e4! \uc800\uc7a5 \ubc84\ud2bc\uc744 \ub20c\ub7ec\uc8fc\uc138\uc694.');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// Patch enterAdminMode / exitAdminMode to toggle inline editing
const _origEnterAdmin = enterAdminMode;
enterAdminMode = function () {
    _origEnterAdmin();
    enableInlineEditing();
};
const _origExitAdmin = exitAdminMode;
exitAdminMode = function () {
    _origExitAdmin();
    disableInlineEditing();
};

// Also apply when applyLoginUI enables admin on login
const _origApplyLoginUI = applyLoginUI;
applyLoginUI = async function () {
    await _origApplyLoginUI();
    if (isLoggedIn) {
        isAdminMode = true;
        enableInlineEditing();
        document.getElementById('adminBar').style.display = 'flex';
        document.getElementById('adminFab').style.display = 'flex';
    } else {
        disableInlineEditing();
    }
};

// (site settings are applied inside the main DOMContentLoaded above)

// ===================== RICH TEXT FORMAT TOOLBAR =====================
let _fmtActiveEl = null; // currently focused site-editable element

function showFormatToolbar(el) {
    _fmtActiveEl = el;
    const tb = document.getElementById('formatToolbar');
    if (!tb) return;
    tb.style.display = 'flex';
    // Reflect current state
    try {
        const col = document.queryCommandValue('foreColor');
        if (col) {
            const hex = rgbToHex(col);
            if (hex) document.getElementById('fmtColor').value = hex;
        }
    } catch (e) { }
}

function hideFormatToolbar() {
    const tb = document.getElementById('formatToolbar');
    if (tb) tb.style.display = 'none';
    _fmtActiveEl = null;
}

function applyFmt(cmd, val) {
    // Restore focus to the editable element first
    if (_fmtActiveEl) {
        _fmtActiveEl.focus();
        // Small delay so selection is restored
        document.execCommand('styleWithCSS', false, true);
        if (val !== undefined) {
            if (cmd === 'fontName') {
                // execCommand fontName doesn't support full CSS font-family strings well,
                // so we wrap selection in a span with inline style instead
                applyStyleToSelection('fontFamily', val);
            } else if (cmd === 'fontSize') {
                // Map execCommand sizes to actual px via span
                const pxMap = { 1: '10px', 2: '12px', 3: '14px', 4: '18px', 5: '24px', 6: '32px', 7: '48px' };
                applyStyleToSelection('fontSize', pxMap[val] || '14px');
            } else {
                document.execCommand(cmd, false, val);
            }
        } else {
            document.execCommand(cmd, false, null);
        }
    }
}

// Apply an inline CSS style to the current selection using a <span>
function applyStyleToSelection(prop, value) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
        // No selection: apply to parent element
        if (_fmtActiveEl) _fmtActiveEl.style[prop] = value;
        return;
    }
    const span = document.createElement('span');
    span.style[prop] = value;
    try {
        range.surroundContents(span);
    } catch (e) {
        // Range spans multiple elements — use execCommand fallback
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
    }
    // Restore selection
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
}

function rgbToHex(rgb) {
    const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

// Patch enableInlineEditing to add focus/blur hooks for toolbar
const _origEnableInline = enableInlineEditing;
enableInlineEditing = function () {
    _origEnableInline();
    SITE_TEXT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('focus', () => showFormatToolbar(el), true);
            el.addEventListener('blur', _onEditableBlur, true);
        }
    });
    SITE_TAG_CONTAINERS.forEach(cid => {
        const wrap = document.getElementById(cid);
        if (!wrap) return;
        const tagClass = cid === 'heroTagsWrap' ? 'htag' : 'about-tag';
        wrap.querySelectorAll('.' + tagClass).forEach(span => {
            span.addEventListener('focus', () => showFormatToolbar(span), true);
            span.addEventListener('blur', _onEditableBlur, true);
        });
    });
};

function _onEditableBlur(e) {
    // Hide toolbar after brief delay (allows toolbar button clicks to register first)
    setTimeout(() => {
        const tb = document.getElementById('formatToolbar');
        if (!tb) return;
        const focused = document.activeElement;
        // Keep toolbar if focus moved to the toolbar itself
        if (tb.contains(focused)) return;
        // Keep if focused element is still site-editable
        if (focused && focused.classList.contains('site-editable')) return;
        hideFormatToolbar();
    }, 150);
}

// ===================== IMAGE CROP MODAL =====================
let _cropImageSrc = '';
let _cropType = '';
let _cropImg = null;
let _cropRatio = null;  // null = free
let _cropDragging = false;
let _cropStart = { x: 0, y: 0 };
let _cropRect = { x: 0, y: 0, w: 0, h: 0 };
let _cropScale = 1;  // canvas display scale
let _cropCanvas = null;
let _cropCtx = null;

function openCropModal(imageSrc, type) {
    _cropImageSrc = imageSrc;
    _cropType = type;
    _cropRatio = null;
    document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.remove('active'));
    const freeBtn = document.querySelector('.crop-ratio-btn');
    if (freeBtn) freeBtn.classList.add('active');

    const modal = document.getElementById('cropModal');
    modal.style.display = 'flex';

    _cropImg = new Image();
    _cropImg.onload = () => {
        _cropCanvas = document.getElementById('cropCanvas');
        _cropCtx = _cropCanvas.getContext('2d');
        const maxW = Math.min(window.innerWidth * 0.85, 800);
        const maxH = window.innerHeight * 0.55;
        _cropScale = Math.min(maxW / _cropImg.width, maxH / _cropImg.height, 1);
        _cropCanvas.width = Math.round(_cropImg.width * _cropScale);
        _cropCanvas.height = Math.round(_cropImg.height * _cropScale);
        _drawCropCanvas();
        // Default rect = full image
        _cropRect = { x: 0, y: 0, w: _cropCanvas.width, h: _cropCanvas.height };
        _drawCropRect();
    };
    _cropImg.src = imageSrc;

    const overlay = document.getElementById('cropOverlay');
    overlay.addEventListener('mousedown', _cropMouseDown);
    overlay.addEventListener('mousemove', _cropMouseMove);
    overlay.addEventListener('mouseup', _cropMouseUp);
    // Touch support
    overlay.addEventListener('touchstart', _cropTouchStart, { passive: false });
    overlay.addEventListener('touchmove', _cropTouchMove, { passive: false });
    overlay.addEventListener('touchend', _cropMouseUp);
}

function closeCropModal() {
    document.getElementById('cropModal').style.display = 'none';
    _cleanCropListeners();
}

function _cleanCropListeners() {
    const overlay = document.getElementById('cropOverlay');
    if (!overlay) return;
    overlay.removeEventListener('mousedown', _cropMouseDown);
    overlay.removeEventListener('mousemove', _cropMouseMove);
    overlay.removeEventListener('mouseup', _cropMouseUp);
    overlay.removeEventListener('touchstart', _cropTouchStart);
    overlay.removeEventListener('touchmove', _cropTouchMove);
    overlay.removeEventListener('touchend', _cropMouseUp);
}

function _drawCropCanvas() {
    _cropCtx.clearRect(0, 0, _cropCanvas.width, _cropCanvas.height);
    _cropCtx.drawImage(_cropImg, 0, 0, _cropCanvas.width, _cropCanvas.height);
}

function _drawCropRect() {
    const overlay = document.getElementById('cropOverlay');
    const rect = document.getElementById('cropRect');
    if (!overlay || !rect || !_cropCanvas) return;
    overlay.style.width = _cropCanvas.width + 'px';
    overlay.style.height = _cropCanvas.height + 'px';
    rect.style.left = _cropRect.x + 'px';
    rect.style.top = _cropRect.y + 'px';
    rect.style.width = Math.abs(_cropRect.w) + 'px';
    rect.style.height = Math.abs(_cropRect.h) + 'px';
}

function _getOverlayPos(e) {
    const overlay = document.getElementById('cropOverlay');
    const r = overlay.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function _cropMouseDown(e) {
    const pos = _getOverlayPos(e);
    _cropStart = pos;
    _cropDragging = true;
    _cropRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
    _drawCropRect();
}
function _cropMouseMove(e) {
    if (!_cropDragging) return;
    const pos = _getOverlayPos(e);
    let w = pos.x - _cropStart.x;
    let h = pos.y - _cropStart.y;
    if (_cropRatio) {
        h = Math.sign(h) * Math.abs(w) / _cropRatio;
    }
    _cropRect = {
        x: w < 0 ? pos.x : _cropStart.x,
        y: h < 0 ? pos.y : _cropStart.y,
        w: Math.abs(w),
        h: Math.abs(h)
    };
    // Clamp to canvas
    _cropRect.x = Math.max(0, Math.min(_cropRect.x, _cropCanvas.width - 1));
    _cropRect.y = Math.max(0, Math.min(_cropRect.y, _cropCanvas.height - 1));
    _cropRect.w = Math.min(_cropRect.w, _cropCanvas.width - _cropRect.x);
    _cropRect.h = Math.min(_cropRect.h, _cropCanvas.height - _cropRect.y);
    _drawCropRect();
}
function _cropMouseUp() { _cropDragging = false; }

function _cropTouchStart(e) {
    e.preventDefault();
    _cropMouseDown(e.touches[0]);
}
function _cropTouchMove(e) {
    e.preventDefault();
    _cropMouseMove(e.touches[0]);
}

function setCropRatio(ratio, btn) {
    _cropRatio = ratio;
    document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function confirmCrop() {
    if (!_cropCanvas || !_cropImg) return;
    if (_cropRect.w < 5 || _cropRect.h < 5) {
        // No meaningful crop – use full image
        _cropRect = { x: 0, y: 0, w: _cropCanvas.width, h: _cropCanvas.height };
    }
    // Convert display coords back to original image coords
    const sx = _cropRect.x / _cropScale;
    const sy = _cropRect.y / _cropScale;
    const sw = _cropRect.w / _cropScale;
    const sh = _cropRect.h / _cropScale;

    const out = document.createElement('canvas');
    out.width = Math.round(sw);
    out.height = Math.round(sh);
    out.getContext('2d').drawImage(_cropImg, sx, sy, sw, sh, 0, 0, sw, sh);
    const data = out.toDataURL('image/jpeg', 0.92);

    closeCropModal();
    // Apply the cropped image
    _applyCroppedImage(data, _cropType);
}

function _applyCroppedImage(data, type) {
    const imgs = loadSiteImages();
    if (type === 'banner') {
        imgs.banner = data;
        const el = document.getElementById('heroBannerImg');
        if (el) { el.src = data; el.style.display = 'block'; }
    } else {
        imgs.avatar = data;
        ['heroAvatarImg', 'aboutPhotoImg'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.src = data; el.style.display = 'block'; }
        });
    }
    _saveSiteImages(imgs);
    showToast('\uD83D\uDCF7 \uc774\ubbf8\uc9c0\uac00 \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4!');
}

// Override handleSiteImageUpload to open crop modal instead of applying directly
handleSiteImageUpload = function (input, type) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => openCropModal(e.target.result, type);
    reader.readAsDataURL(file);
    input.value = '';
};

// ===================== DYNAMIC CATEGORIES =====================
const CATEGORIES_KEY = 'lydia_categories';

// Default categories (matches original CAT_LABELS)
const DEFAULT_CATEGORIES = [
    { id: 'career', labelKo: '🚀 커리어 여정', labelEn: 'Career Journey' },
    { id: 'sales', labelKo: '📊 세일즈 플레이북', labelEn: 'Sales Playbook' },
    { id: 'martech', labelKo: '🔮 마테크 & 소비자', labelEn: 'MarTech & Consumer' },
    { id: 'ai', labelKo: '🤖 AI 실험실', labelEn: 'AI Experiments' },
    { id: 'networking', labelKo: '🤝 네트워킹', labelEn: 'Networking' },
    { id: 'claudecode', labelKo: '🧑‍💻 Claude Code', labelEn: 'Claude Code' },
    { id: 'linkedin', labelKo: '💬 링크드인 일기', labelEn: 'LinkedIn Diary' }
];

function loadCategories() {
    try {
        const s = localStorage.getItem(CATEGORIES_KEY);
        if (s) {
            const parsed = JSON.parse(s);
            // Migrate old {id, label} objects
            return parsed.map(c => ({
                id: c.id,
                labelKo: c.labelKo || c.label || c.id,
                labelEn: c.labelEn || c.label || c.id
            }));
        }
        return DEFAULT_CATEGORIES;
    } catch (e) { return DEFAULT_CATEGORIES; }
}

function saveCategories(cats) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
    // Sync live CAT_LABELS object so savePost picks up labels
    cats.forEach(c => { CAT_LABELS[c.id] = c.label; });
}

function getCategoryById(id) {
    return loadCategories().find(c => c.id === id) || { id, label: id };
}

// Render the filter tabs from current categories
function renderCategoryTabs() {
    const wrap = document.getElementById('tabsWrap');
    if (!wrap) return;
    const cats = loadCategories();
    // Sync CAT_LABELS (for backward compat if needed)
    cats.forEach(c => { CAT_LABELS[c.id] = c.labelEn; });

    const allLabel = (TRANSLATIONS[_currentLang] && TRANSLATIONS[_currentLang].tabAll) || '전체';
    let html = `<button class="tab ${currentCat === 'all' ? 'active' : ''}" data-cat="all" onclick="filterPosts('all',this)">${allLabel}</button>`;
    cats.forEach(c => {
        const displayLabel = _currentLang === 'en' ? c.labelEn : c.labelKo;
        html += `<button class="tab ${currentCat === c.id ? 'active' : ''}" data-cat="${c.id}" onclick="filterPosts('${c.id}',this)">${displayLabel}</button>`;
        if (isAdminMode) {
            html += `<button class="tab-edit-btn cat-rename-btn" onclick="renameCategoryUI('${c.id}')" title="이름 변경">✏</button>
                     <button class="tab-edit-btn cat-del-btn" onclick="deleteCategoryUI('${c.id}')" title="삭제">✕</button>`;
        }
    });
    if (isAdminMode) {
        html += `<button class="tab tab-add-btn" onclick="addCategoryUI()">+ 카테고리 추가</button>`;
    }
    wrap.innerHTML = html;
}

// Render the category <select> in the admin editor
function renderCatSelect() {
    const sel = document.getElementById('editCat');
    if (!sel) return;
    const cats = loadCategories();
    const cur = sel.value;
    sel.innerHTML = cats.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${c.labelKo} / ${c.labelEn}</option>`).join('');
}

function addCategoryUI() {
    const ko = prompt('상단 탭에 표시될 이름 (한국어)을 입력하세요:\n예: 🌍 글로벌 인사이트');
    if (!ko || !ko.trim()) return;
    const en = prompt('썸네일 배지에 표시될 이름 (영어)을 입력하세요:\n예: Global Insights');
    if (!en || !en.trim()) return;
    const id = 'cat_' + Date.now();
    const cats = loadCategories();
    cats.push({ id, labelKo: ko.trim(), labelEn: en.trim() });
    saveCategories(cats);
    renderCategoryTabs();
    if (document.getElementById('editCat')) renderCatSelect();
    setTimeout(() => { if (document.getElementById('editCat')) document.getElementById('editCat').value = id; }, 50);
    showToast('✅ 카테고리가 추가되었습니다');
}

function renameCategoryUI(id) {
    const cats = loadCategories();
    const cat = cats.find(c => c.id === id);
    if (!cat) return;
    const newKo = prompt('상단 탭에 표시될 이름 (한국어):', cat.labelKo);
    if (!newKo || !newKo.trim()) return;
    const newEn = prompt('썸네일 배지에 표시될 이름 (영어):', cat.labelEn);
    if (!newEn || !newEn.trim()) return;
    cat.labelKo = newKo.trim();
    cat.labelEn = newEn.trim();
    // Update all posts with this category
    POSTS.forEach(p => { if (p.cat === id) p.catLabel = cat.labelEn; });
    savePosts(POSTS);
    saveCategories(cats);
    renderCategoryTabs();
    if (document.getElementById('editCat')) renderCatSelect();
    applyFilters();
    showToast('✅ 카테고리 이름이 변경되었습니다');
}

function deleteCategoryUI(id) {
    const cats = loadCategories();
    if (cats.length <= 1) { showToast('⚠️ 카테고리는 최소 1개 이상이어야 합니다'); return; }
    const cat = cats.find(c => c.id === id);
    if (!confirm(`"${cat?.label}" 카테고리를 삭제하시겠습니까?\n이 카테고리의 글들은 첫 번째 카테고리로 이동됩니다.`)) return;
    const fallback = cats.find(c => c.id !== id);
    // Move posts to fallback category
    POSTS.forEach(p => {
        if (p.cat === id) { p.cat = fallback.id; p.catLabel = fallback.label; }
    });
    const newCats = cats.filter(c => c.id !== id);
    savePosts(POSTS);
    saveCategories(newCats);
    if (currentCat === id) currentCat = 'all';
    renderCategoryTabs();
    if (document.getElementById('editCat')) renderCatSelect();
    applyFilters();
    showToast('🗑 카테고리가 삭제되었습니다');
}

// Patch the init to use dynamic categories
const _origDOMReady = document.addEventListener.bind(document);
// Instead, wrap renderGrid call and add category tab rendering on startup
const _catInitDone = false;
function initDynamicCategories() {
    const cats = loadCategories();
    cats.forEach(c => { CAT_LABELS[c.id] = c.labelEn; });
    renderCategoryTabs();
    renderCatSelect();
}

// Patch openPostEditor to re-render cat select each time
const _origOpenPostEditor = openPostEditor;
openPostEditor = function (id) {
    renderCatSelect(); // 카테고리 목록을 먼저 렌더링해야 값이 제대로 세팅됨
    _origOpenPostEditor(id);
    renderCatSelect(); // 값 세팅 후 다시 한번 동기화
};

// Patch applyLoginUI to re-render tabs (show/hide add/edit buttons)
const _origApplyLoginUI2 = applyLoginUI;
applyLoginUI = async function () {
    await _origApplyLoginUI2();
    renderCategoryTabs();
};

// Call on DOMContentLoaded (append to existing handler by using a second listener)
document.addEventListener('DOMContentLoaded', () => {
    initDynamicCategories();

    // Scroll-to-top button
    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTopBtn');
        if (btn) btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
    });

    // LinkedIn 링크: 모바일이면 앱으로 열기 시도 → 실패 시 웹으로
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile) {
        document.querySelectorAll('a[href*="linkedin.com/in/"]').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const webUrl = this.href;
                const profilePath = webUrl.replace(/https?:\/\/(www\.)?linkedin\.com/, '');
                const appUrl = 'linkedin:/' + profilePath;
                // 앱 열기 시도
                window.location.href = appUrl;
                // 1.5초 안에 앱이 안 열리면 웹으로
                setTimeout(() => { window.open(webUrl, '_blank'); }, 1500);
            });
        });
    }
});

// Update HTML: tabs wrap needs id="tabsWrap"
// (This is set in HTML - must ensure the tabs-wrap div has id="tabsWrap")

// ===================== PDF AUTO-THUMBNAIL =====================
// When a PDF is attached, auto-generate thumbnail from page 1

const _origHandleAttachFiles = handleAttachFiles;
handleAttachFiles = function (input) {
    const files = Array.from(input.files);
    let pdfAutoThumb = false;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const attachment = { name: file.name, type: file.type, data: e.target.result };
            _pendingAttachments.push(attachment);
            renderAttachFileList();

            // Auto-thumbnail: if first PDF attached and no thumbnail set yet, use page 1
            if (file.type === 'application/pdf' && !pdfAutoThumb) {
                pdfAutoThumb = true;
                _autoGenPDFThumbnail(e.target.result);
            }
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
};

async function _autoGenPDFThumbnail(pdfDataUrl) {
    try {
        pdfWorkerSrc();
        if (typeof pdfjsLib === 'undefined') return;
        const doc = await pdfjsLib.getDocument(pdfDataUrl).promise;
        const page = await doc.getPage(1);
        const vp = page.getViewport({ scale: 2 }); // higher scale = better quality thumb
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        const thumbData = canvas.toDataURL('image/jpeg', 0.88);

        // Set as current thumbnail in editor
        const imgDataInput = document.getElementById('editImageData');
        const imgPreview = document.getElementById('editImagePreview');
        const imgLabel = document.getElementById('editImageLabel');
        if (imgDataInput) imgDataInput.value = thumbData;
        if (imgPreview) { imgPreview.src = thumbData; imgPreview.style.display = 'block'; }
        if (imgLabel) imgLabel.textContent = 'PDF 첫 슬라이드 (자동 생성됨)';
        showToast('📄 PDF 첫 슬라이드가 썸네일로 자동 설정되었습니다');
    } catch (e) {
        console.warn('PDF auto-thumbnail failed:', e);
    }
}

// ===================== PDF ATTACHMENT CAROUSEL IN MODAL =====================
// Shows PDF attachments as an inline slide carousel below the post content

let _attachPdfDoc = null;
let _attachPdfPage = 1;
let _attachPdfAttachmentIndex = 0;
let _attachPdfAttachments = [];

async function renderPDFAttachmentCarousel(attachments) {
    const container = document.getElementById('pdfAttachCarousel');
    if (!container) return;

    // Find all PDF attachments
    _attachPdfAttachments = attachments.filter(a => a.type === 'application/pdf' || a.name?.endsWith('.pdf'));
    if (!_attachPdfAttachments.length) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';
    _attachPdfAttachmentIndex = 0;
    await _loadAttachPDF(_attachPdfAttachments[0]);
}

async function _loadAttachPDF(attachment) {
    const container = document.getElementById('pdfAttachCarousel');
    if (!container) return;
    container.innerHTML = `
        <div class="attach-pdf-header">
            <span class="attach-pdf-name">📄 ${attachment.name}</span>
            ${_attachPdfAttachments.length > 1 ? `
            <div class="attach-pdf-file-nav">
                <button onclick="attachPdfFileNav(-1)">‹ 이전 파일</button>
                <span>${_attachPdfAttachmentIndex + 1} / ${_attachPdfAttachments.length}</span>
                <button onclick="attachPdfFileNav(1)">다음 파일 ›</button>
            </div>` : ''}
        </div>
        <div class="attach-pdf-canvas-wrap">
            <canvas id="attachPdfCanvas" class="attach-pdf-canvas"></canvas>
        </div>
        <div class="attach-pdf-controls">
            <button class="pdf-pg-btn" onclick="attachPdfPageNav(-1)">&#8249;</button>
            <span class="pdf-pg-num" id="attachPdfPageInfo">로딩중...</span>
            <button class="pdf-pg-btn" onclick="attachPdfPageNav(1)">&#8250;</button>
            <a class="attach-pdf-dl" href="${attachment.data}" download="${attachment.name}">⬇ 다운로드</a>
        </div>`;

    try {
        pdfWorkerSrc();
        _attachPdfDoc = await pdfjsLib.getDocument(attachment.data).promise;
        _attachPdfPage = 1;
        await _renderAttachPdfPage();
    } catch (e) {
        container.innerHTML = `<div style="padding:1rem;color:var(--text3)">📄 PDF를 불러올 수 없습니다</div>`;
    }
}

async function _renderAttachPdfPage() {
    if (!_attachPdfDoc) return;
    _attachPdfPage = Math.max(1, Math.min(_attachPdfPage, _attachPdfDoc.numPages));
    const canvas = document.getElementById('attachPdfCanvas');
    if (!canvas) return;
    const info = document.getElementById('attachPdfPageInfo');
    if (info) info.textContent = `${_attachPdfPage} / ${_attachPdfDoc.numPages}`;
    const containerW = canvas.parentElement ? (canvas.parentElement.offsetWidth || 680) : 680;
    const page = await _attachPdfDoc.getPage(_attachPdfPage);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = Math.min(containerW / baseVp.width, 2);
    const vp = page.getViewport({ scale });
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
}

function attachPdfPageNav(dir) {
    if (!_attachPdfDoc) return;
    // Animate
    const canvas = document.getElementById('attachPdfCanvas');
    if (canvas) {
        canvas.style.transition = 'opacity 0.15s, transform 0.15s';
        canvas.style.opacity = '0';
        canvas.style.transform = `translateX(${dir > 0 ? '20px' : '-20px'})`;
        setTimeout(async () => {
            _attachPdfPage += dir;
            await _renderAttachPdfPage();
            canvas.style.transition = 'none';
            canvas.style.opacity = '0';
            canvas.style.transform = `translateX(${dir > 0 ? '-15px' : '15px'})`;
            requestAnimationFrame(() => {
                canvas.style.transition = 'opacity 0.15s, transform 0.15s';
                canvas.style.opacity = '1';
                canvas.style.transform = 'translateX(0)';
            });
        }, 150);
    }
}

async function attachPdfFileNav(dir) {
    _attachPdfAttachmentIndex = Math.max(0, Math.min(_attachPdfAttachmentIndex + dir, _attachPdfAttachments.length - 1));
    _attachPdfDoc = null;
    await _loadAttachPDF(_attachPdfAttachments[_attachPdfAttachmentIndex]);
}

// Patch renderModalAttachments to also render PDF carousel and exclude carousel images
const _origRenderModalAttachments = renderModalAttachments;
renderModalAttachments = function (attachments) {
    const all = attachments || [];
    // Exclude PDFs (shown in PDF carousel)
    let filtered = all.filter(a => !(a.type === 'application/pdf' || a.name?.endsWith('.pdf')));
    // Exclude images if image carousel is active (multiple image attachments)
    const imageAtts = all.filter(a => a.type && a.type.startsWith('image/'));
    if (imageAtts.length > 1) {
        filtered = filtered.filter(a => !(a.type && a.type.startsWith('image/')));
    }
    _origRenderModalAttachments(filtered);
    // Render PDF carousel if PDFs present
    renderPDFAttachmentCarousel(all);
};

// Patch openPost to clear old PDF state
const _origOpenPost = openPost;
openPost = function (id) {
    _attachPdfDoc = null;
    _origOpenPost(id);
};

// ===================== EN / KO LANGUAGE TOGGLE =====================
const LANG_KEY = 'lydia_lang';
let _currentLang = 'ko';

const TRANSLATIONS = {
    ko: {
        langToggleBtn: '\ud83c\udf10 English Version',
        heroArchiveTagline: 'Lydia\uc758 \ub9c1\ud06c\ub4dc\uc778 \ucee8\ud150\uce20 \uc544\uce74\uc774\ube0c\uc785\ub2c8\ub2e4.',
        heroNameKo: '\uad8c\uc9c0\uc724',
        heroNameEn: '(Lydia Kwon)',
        heroSub: 'Sales in SaaS X Marketing Tech X AI \u00b7 \ub300\ud55c\ubbfc\uad6d \uc11c\uc6b8',
        heroScrollBtn: '\uae00 \ubcf4\ub7ec\uac00\uae30 \u2193',
        heroLinkedInLink: 'LinkedIn \uc5f0\uacb0\ud558\uae30',
        aboutLabel: 'About Me',
        aboutName: '\uad8c\uc9c0\uc724 (Lydia Kwon)',
        aboutP1: 'K-\ub4f7\ud2f0 \uae00\ub85c\ubc8c \uc138\uc77c\uc988 \uc778\ud134\uc744 \uc2dc\uc791\uc73c\ub85c, SaaS/IT \uc601\uc5c5 \uc778\ud134\uc744 \uac70\uce58\uba70 <strong>B2B \uc138\uc77c\uc988</strong>\uc5d0 \ud478 \ube60\uc9c4 \uc8fc\ub2c8\uc5b4\uc785\ub2c8\ub2e4.',
        aboutP2: '\ucf5c\ub4dc\ucf5c 5\uc8fc \ub9cc\uc5d0 <strong>70\uac1c \ubbf8\ud305</strong>\uc744 \ub9cc\ub4e4\uace0, 7\uac1c \uc774\uc0c1\uc758 \uc0b0\uc5c5\uc5d0\uc11c \ud30c\uc774\ud504\ub77c\uc778\uc744 \uad6c\ucd95\ud55c \uacbd\ud5d8\uc744 \uac00\uc9c0\uace0 \uc788\uc2b5\ub2c8\ub2e4. \uace0\uac1d\uc758 \uc5b8\uc5b4\ub85c \uc194\ub8e8\uc158\uc744 \ubc88\uc5ed\ud558\ub294 \uac83\uc774 \uc138\uc77c\uc988\uc758 \ubcf8\uc9c8\uc774\ub77c\uace0 \ubbff\uc2b5\ub2c8\ub2e4.',
        aboutP3: '\ub9c1\ud06c\ub4dc\uc778\uc5d0 \uae00\uc744 \uc4f0\ub294 \uc774\uc720\ub294 \ud558\ub098\uc785\ub2c8\ub2e4 \u2014 \uae34 \uace0\ubbfc\uc5d0 \ub9c8\uce68\ud45c\ub97c \uc2f9\uace0, \uac19\uc740 \uace0\ubbfc\uc744 \ud558\ub294 \uc8fc\ub2c8\uc5b4\ub4e4\uacfc \ub098\ub204\uae30 \uc704\ud574\uc11c\uc785\ub2c8\ub2e4.',
        aboutLinkedInLink: 'LinkedIn \uc5f0\uacb0\ud558\uae30 \u2192',
        archiveTitle: 'Writing Archive',
        archiveSub: 'Sales \u00b7 MarTech \u00b7 AI \u00b7 Career\uc5d0 \uad00\ud55c \uc0dd\uac01\ub4e4',
        searchPlaceholder: '\uae00 \uc81c\ubaa9\uc774\ub098 \ud0a4\uc6cc\ub4dc\ub85c \uac80\uc0c9...',
        tabAll: '\uc804\uccb4',
    },
    en: {
        langToggleBtn: '\ud83c\udf10 \ud55c\uad6d\uc5b4 \ubc84\uc804',
        heroArchiveTagline: "Lydia's LinkedIn Content Archive.",
        heroNameKo: 'Lydia',
        heroNameEn: '',
        heroSub: 'Sales in SaaS X Marketing Tech X AI \u00b7 Seoul, South Korea',
        heroScrollBtn: 'Read Writing \u2193',
        heroLinkedInLink: 'Connect on LinkedIn',
        aboutLabel: 'About Me',
        aboutName: 'Lydia Kwon',
        aboutP1: 'Starting from a K-Beauty global sales internship then SaaS/IT sales, I became deeply passionate about <strong>B2B sales</strong>.',
        aboutP2: 'I generated <strong>70+ meetings</strong> in 5 weeks of cold calling and built pipelines across 7+ industries. I believe translating solutions in the customer\'s language is the essence of sales.',
        aboutP3: 'My reason for writing on LinkedIn is simple \u2014 to put a period on long thoughts and share them with juniors facing the same questions.',
        aboutLinkedInLink: 'Connect on LinkedIn \u2192',
        archiveTitle: 'Writing Archive',
        archiveSub: 'Thoughts on Sales \u00b7 MarTech \u00b7 AI \u00b7 Career',
        searchPlaceholder: 'Search by title or keyword...',
        tabAll: 'All',
    }
};

function applyLanguage(lang) {
    const t = TRANSLATIONS[lang];
    if (!t) return;
    _currentLang = lang;

    function setText(id, val) {
        const el = document.getElementById(id);
        if (!el) return;
        if (val.includes('<')) el.innerHTML = val;
        else el.textContent = val;
    }

    setText('langToggleBtn', t.langToggleBtn);
    setText('heroArchiveTagline', t.heroArchiveTagline);
    setText('heroNameKo', t.heroNameKo);
    setText('heroNameEn', t.heroNameEn);
    setText('heroSub', t.heroSub);
    setText('heroScrollBtn', t.heroScrollBtn);
    setText('heroLinkedInLink', t.heroLinkedInLink);
    setText('aboutLabel', t.aboutLabel);
    setText('aboutName', t.aboutName);
    setText('aboutP1', t.aboutP1);
    setText('aboutP2', t.aboutP2);
    setText('aboutP3', t.aboutP3);
    setText('aboutLinkedInLink', t.aboutLinkedInLink);

    const si = document.getElementById('searchInput');
    if (si) si.placeholder = t.searchPlaceholder;

    const archTitle = document.querySelector('#archive .sec-title');
    const archSub = document.querySelector('#archive .sec-sub');
    if (archTitle) archTitle.textContent = t.archiveTitle;
    if (archSub) archSub.textContent = t.archiveSub;

    // "All" tab
    const allTab = document.querySelector('[data-cat="all"]');
    if (allTab) allTab.textContent = t.tabAll;

    document.body.classList.toggle('lang-en', lang === 'en');
}

function toggleLanguage() {
    const next = _currentLang === 'ko' ? 'en' : 'ko';
    localStorage.setItem(LANG_KEY, next);
    applyLanguage(next);
    applySiteSettings(); // Re-apply user custom edits for this language
}

// ===================== POST PREVIEW =====================
function previewPost() {
    const cat = document.getElementById('editCat').value;
    const dateVal = document.getElementById('editDate').value;
    const title = document.getElementById('editPostTitle').value.trim() || '(제목 없음)';
    const excerpt = document.getElementById('editExcerpt').value.trim();
    const content = document.getElementById('editContent').value;
    const hashtagsRaw = document.getElementById('editHashtags').value;
    const imageData = document.getElementById('editImageData').value;
    const linkedInUrl = document.getElementById('editLinkedInUrl').value.trim();
    const date = dateVal ? dateVal.slice(0, 7) : '2026-03';
    const hashtags = hashtagsRaw.split(',').map(h => h.trim()).filter(Boolean);

    const cats = loadCategories();
    const catObj = cats.find(c => c.id === cat);
    const catLabel = catObj ? catObj.labelEn : (CAT_LABELS[cat] || cat);

    // Build a temporary post object
    const tempPost = {
        id: '__preview__',
        cat,
        catLabel,
        date,
        title,
        excerpt,
        image: imageData || '',
        imageType: imageData ? 'img' : 'emoji',
        imageEmoji: getCatEmoji(cat),
        hashtags,
        content,
        linkedInUrl,
        attachments: [..._pendingAttachments],
        sortOrder: 0
    };

    // Hide admin modal temporarily
    document.getElementById('adminModal').style.display = 'none';

    // Render into the post modal
    const modal = document.getElementById('postModal');
    const displayLabel = catObj ? catObj.labelEn : catLabel;

    document.getElementById('modalTitle').textContent = tempPost.title;
    document.getElementById('modalBadge').textContent = displayLabel;
    document.getElementById('modalBadge').className = `modal-badge badge-${tempPost.cat}`;
    document.getElementById('modalDate').textContent = formatDate(tempPost.date);
    document.getElementById('modalReadTime').textContent = `⏱ ${readTime(tempPost.content)} min read`;
    document.getElementById('modalContent').innerHTML = formatContent(tempPost.content);
    document.getElementById('modalHashtags').innerHTML = tempPost.hashtags.map(h => `<span class="modal-hashtag">#${h}</span>`).join('');

    const imgWrap = document.getElementById('modalImage');
    if (tempPost.imageType === 'img' && tempPost.image) {
        imgWrap.innerHTML = `<img src="${tempPost.image}" alt="${tempPost.title}" style="width:100%;border-radius:12px" />`;
    } else {
        imgWrap.innerHTML = `<div class="modal-img-placeholder">${tempPost.imageEmoji}</div>`;
    }

    // Hide nav buttons and edit row for preview
    document.querySelector('.modal-nav').style.visibility = 'hidden';
    const editRow = document.querySelector('.modal-edit-row');
    if (editRow) editRow.style.display = 'none';

    renderModalAttachments(tempPost.attachments);

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Override close to return to editor
    const origClose = closeModalDirect;
    closeModalDirect = function () {
        modal.classList.remove('open');
        document.body.style.overflow = 'hidden'; // keep body locked for editor
        document.getElementById('adminModal').style.display = '';
        document.querySelector('.modal-nav').style.visibility = '';
        if (editRow && isLoggedIn) editRow.style.display = 'flex';
        closeModalDirect = origClose; // restore original
    };
}

// ===================== PASSWORD CHANGE =====================
function openPwChangeModal() {
    const modal = document.getElementById('pwChangeModal');
    modal.classList.add('open');
    document.getElementById('pwChangeCurrent').value = '';
    document.getElementById('pwChangeNew').value = '';
    document.getElementById('pwChangeConfirm').value = '';
    document.getElementById('pwChangeError').style.display = 'none';
    setTimeout(() => document.getElementById('pwChangeCurrent').focus(), 100);
}

function closePwChangeModal() {
    document.getElementById('pwChangeModal').classList.remove('open');
}

async function submitPwChange() {
    const current = document.getElementById('pwChangeCurrent').value;
    const newPw = document.getElementById('pwChangeNew').value;
    const confirm = document.getElementById('pwChangeConfirm').value;
    const errEl = document.getElementById('pwChangeError');

    if (!current || !newPw || !confirm) {
        errEl.textContent = '모든 필드를 입력해주세요.';
        errEl.style.display = 'block';
        return;
    }
    if (newPw !== confirm) {
        errEl.textContent = '새 비밀번호가 일치하지 않습니다.';
        errEl.style.display = 'block';
        return;
    }
    if (newPw.length < 6) {
        errEl.textContent = '비밀번호는 최소 6자 이상이어야 합니다.';
        errEl.style.display = 'block';
        return;
    }

    try {
        const { error } = await _supabase.auth.updateUser({ password: newPw });
        if (error) {
            errEl.textContent = '비밀번호 변경 실패: ' + error.message;
            errEl.style.display = 'block';
            return;
        }
        closePwChangeModal();
        showToast('✅ 비밀번호가 변경되었습니다');
    } catch (e) {
        errEl.textContent = '오류가 발생했습니다: ' + e.message;
        errEl.style.display = 'block';
    }
}

// Show/hide password change button based on login state
const _origApplyLoginUI3 = applyLoginUI;
applyLoginUI = async function () {
    await _origApplyLoginUI3();
    const pwBtn = document.getElementById('pwChangeBtn');
    if (pwBtn) pwBtn.style.display = isLoggedIn ? 'inline-flex' : 'none';
};

// Enter key support for password change modal
document.addEventListener('DOMContentLoaded', () => {
    const pwConfirmInput = document.getElementById('pwChangeConfirm');
    if (pwConfirmInput) pwConfirmInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitPwChange(); });
    // Escape key to close
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closePwChangeModal();
    });
});

// ===================== AUTO-SAVE DRAFT =====================
let _draftAutoSaveTimer = null;
const DRAFT_PREFIX = 'lydia_draft_';

function _getDraftKey() {
    const idRaw = document.getElementById('editPostId').value;
    return DRAFT_PREFIX + (idRaw || 'new');
}

function _saveDraftToStorage() {
    const modal = document.getElementById('adminModal');
    if (!modal.classList.contains('open')) return;

    const draft = {
        title: document.getElementById('editPostTitle').value,
        cat: document.getElementById('editCat').value,
        date: document.getElementById('editDate').value,
        excerpt: document.getElementById('editExcerpt').value,
        content: document.getElementById('editContent').value,
        hashtags: document.getElementById('editHashtags').value,
        linkedInUrl: document.getElementById('editLinkedInUrl').value,
        imageData: document.getElementById('editImageData').value,
        savedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(_getDraftKey(), JSON.stringify(draft));
    } catch (e) {
        console.warn('Draft save failed:', e);
    }
}

function _loadDraftFromStorage(postId) {
    const key = DRAFT_PREFIX + (postId || 'new');
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) { return null; }
}

function _clearDraft(postId) {
    const key = DRAFT_PREFIX + (postId || 'new');
    localStorage.removeItem(key);
}

function _applyDraft(draft) {
    if (draft.title) document.getElementById('editPostTitle').value = draft.title;
    if (draft.cat) document.getElementById('editCat').value = draft.cat;
    if (draft.date) document.getElementById('editDate').value = draft.date;
    if (draft.excerpt !== undefined) document.getElementById('editExcerpt').value = draft.excerpt;
    if (draft.content !== undefined) document.getElementById('editContent').value = draft.content;
    if (draft.hashtags !== undefined) document.getElementById('editHashtags').value = draft.hashtags;
    if (draft.linkedInUrl !== undefined) document.getElementById('editLinkedInUrl').value = draft.linkedInUrl;
    if (draft.imageData) {
        document.getElementById('editImageData').value = draft.imageData;
        const prev = document.getElementById('editImagePreview');
        prev.src = draft.imageData;
        prev.style.display = 'block';
        document.getElementById('editImageLabel').textContent = '클릭하여 이미지 변경';
    }
}

function _startDraftAutoSave() {
    _stopDraftAutoSave();
    _draftAutoSaveTimer = setInterval(() => {
        _saveDraftToStorage();
    }, 30000); // 30 seconds
}

function _stopDraftAutoSave() {
    if (_draftAutoSaveTimer) {
        clearInterval(_draftAutoSaveTimer);
        _draftAutoSaveTimer = null;
    }
}

// Patch openPostEditor to check for drafts and start auto-save
const _origOpenPostEditor2 = openPostEditor;
openPostEditor = function (id) {
    _origOpenPostEditor2(id);

    // Check for saved draft
    const draft = _loadDraftFromStorage(id);
    if (draft) {
        const savedTime = draft.savedAt ? new Date(draft.savedAt).toLocaleString('ko-KR') : '';
        if (window.confirm(`임시저장된 내용이 있습니다.${savedTime ? ' (' + savedTime + ')' : ''}\n불러올까요?`)) {
            _applyDraft(draft);
            showToast('📝 임시저장 내용을 불러왔습니다');
        } else {
            _clearDraft(id);
        }
    }

    _startDraftAutoSave();
};

// Patch closeAdminModal to stop auto-save
const _origCloseAdminModal = closeAdminModal;
closeAdminModal = function () {
    _stopDraftAutoSave();
    _origCloseAdminModal();
};

// Patch savePost to clear draft on successful save
const _origSavePost = savePost;
savePost = async function () {
    const idRaw = document.getElementById('editPostId').value;
    await _origSavePost();
    // If modal closed (save succeeded), clear draft
    if (!document.getElementById('adminModal').classList.contains('open')) {
        _clearDraft(idRaw || null);
        _stopDraftAutoSave();
    }
};
