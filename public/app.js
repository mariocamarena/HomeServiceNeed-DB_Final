// tab router + panel renderer

const state = {
    user: null,
    activeTab: 'home'
};

const tabs = {
    out: [
        { group: 'browse' },
        { id: 'home', label: 'Home' },
        { id: 'browse', label: 'Providers' },
        { group: 'account' },
        { id: 'login', label: 'Sign in' },
        { id: 'register', label: 'Register' }
    ],
    client: [
        { group: 'work' },
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'newReq', label: 'New request' },
        { id: 'browse', label: 'Providers' },
        { group: 'account' },
        { id: 'profile', label: 'Profile' },
        { id: 'logout', label: 'Sign out' }
    ],
    provider: [
        { group: 'work' },
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'openReqs', label: 'Open requests' },
        { group: 'account' },
        { id: 'profile', label: 'Profile' },
        { id: 'logout', label: 'Sign out' }
    ],
    both: [
        { group: 'work' },
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'newReq', label: 'New request' },
        { id: 'openReqs', label: 'Open requests' },
        { id: 'browse', label: 'Providers' },
        { group: 'account' },
        { id: 'profile', label: 'Profile' },
        { id: 'logout', label: 'Sign out' }
    ],
    admin: [
        { group: 'admin' },
        { id: 'admin', label: 'Overview' },
        { id: 'adminUsers', label: 'Users' },
        { id: 'adminChecks', label: 'Background checks' },
        { id: 'adminCategories', label: 'Categories' },
        { id: 'logout', label: 'Sign out' }
    ]
};

function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}

function renderAccount() {
    const el = document.getElementById('account');
    if (state.user) {
        el.innerHTML = `<span class="name">${state.user.first_name}</span><span class="sep">/</span><span>${state.user.role}</span>`;
    } else {
        el.textContent = '';
    }
}

function renderTabs() {
    const role = state.user ? state.user.role : 'out';
    const list = tabs[role] || tabs.out;
    const rail = document.getElementById('rail');
    rail.innerHTML = '';
    list.forEach(t => {
        if (t.group) {
            const g = document.createElement('div');
            g.className = 'group';
            g.textContent = t.group;
            rail.appendChild(g);
            return;
        }
        const el = document.createElement('div');
        el.className = 'tab' + (t.id === state.activeTab ? ' active' : '');
        el.textContent = t.label;
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.onclick = () => switchTab(t.id);
        el.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchTab(t.id);
            }
        };
        rail.appendChild(el);
    });
}

// wrap each word in h1.display in a span so we can stagger the entry animation
function splitDisplayWords(panel) {
    panel.querySelectorAll('h1.display').forEach(h => {
        let i = 0;
        const wrap = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const frag = document.createDocumentFragment();
                // split on whitespace but keep spaces as plain text nodes
                const parts = text.split(/(\s+)/);
                for (const p of parts) {
                    if (p === '') continue;
                    if (/^\s+$/.test(p)) {
                        frag.appendChild(document.createTextNode(p));
                    } else {
                        const s = document.createElement('span');
                        s.className = 'word';
                        s.style.setProperty('--i', i++);
                        s.textContent = p;
                        frag.appendChild(s);
                    }
                }
                node.parentNode.replaceChild(frag, node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                Array.from(node.childNodes).forEach(wrap);
            }
        };
        Array.from(h.childNodes).forEach(wrap);
    });
}

// returns a Promise that resolves after innerHTML is replaced; callers that
// need to query the new DOM must await it
let _panelTurning = false;
function setPanel(html) {
    return new Promise(resolve => {
        const panel = document.getElementById('panel');
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const hasContent = panel.children.length > 0;

        const render = () => {
            panel.classList.remove('panel-out');
            panel.innerHTML = html;
            // force a reflow so the panel-in animation re-fires
            void panel.offsetWidth;
            panel.classList.add('panel-in');
            splitDisplayWords(panel);
            const announce = document.getElementById('announce');
            const heading = panel.querySelector('h1.display');
            if (announce && heading) announce.textContent = heading.textContent;
            _panelTurning = false;
            resolve();
        };

        if (!hasContent || reduce) {
            panel.classList.remove('panel-in');
            render();
            return;
        }

        if (_panelTurning) {
            // already mid-turn, swap immediately
            render();
            return;
        }
        _panelTurning = true;
        panel.classList.remove('panel-in');
        panel.classList.add('panel-out');
        setTimeout(render, 240);
    });
}

async function switchTab(id) {
    if (id === 'logout') return doLogout();
    state.activeTab = id;
    renderTabs();
    const fn = panels[id];
    if (!fn) {
        setPanel('<p class="muted">not implemented</p>');
        return;
    }
    setStatus('loading...');
    try {
        await fn();
        setStatus('ready');
    } catch (e) {
        setPanel(`<div class="error">${e.message}</div>`);
        setStatus('error');
    }
}

async function api(path, opts) {
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('http ' + res.status));
    return data;
}

const panels = {
    home() {
        const cta = state.user
            ? `<button class="btn accent" onclick="switchTab('dashboard')">Open dashboard</button>
               <button class="btn ghost" onclick="switchTab('browse')">Browse the directory</button>`
            : `<button class="btn accent" onclick="switchTab('register')">Begin an account</button>
               <button class="btn ghost" onclick="switchTab('login')">Sign in</button>`;
        setPanel(`
            <p class="eyebrow">Vol. I &nbsp;·&nbsp; No. 1 &nbsp;·&nbsp; The Directory</p>
            <h1 class="display">A trusted hand for <em>every corner</em> of the home.</h1>
            <div class="btn-row">${cta}</div>
            <h2 class="section">The trades</h2>
            <div class="chips">
                <span class="chip" onclick="switchTab('browse')">Plumbing</span>
                <span class="chip" onclick="switchTab('browse')">Cleaning</span>
                <span class="chip" onclick="switchTab('browse')">HVAC</span>
                <span class="chip" onclick="switchTab('browse')">Electrical</span>
                <span class="chip" onclick="switchTab('browse')">Landscaping</span>
                <span class="chip" onclick="switchTab('browse')">Painting</span>
                <span class="chip" onclick="switchTab('browse')">Appliance Repair</span>
                <span class="chip" onclick="switchTab('browse')">Pest Control</span>
            </div>
            <h2 class="section">How it works</h2>
            <div class="cards">
                <div class="card"><h3>I.</h3><div class="meta">Post a request</div></div>
                <div class="card"><h3>II.</h3><div class="meta">A vetted craftsperson responds</div></div>
                <div class="card"><h3>III.</h3><div class="meta">Agree on time and price</div></div>
                <div class="card"><h3>IV.</h3><div class="meta">Pay and review on completion</div></div>
            </div>
        `);
    },
    async browse() {
        const [cats, all] = await Promise.all([api('/api/categories'), api('/api/providers')]);
        state.allProviders = all;
        state.allCategories = cats;
        state.catFilter = null;
        await setPanel(`
            <h1 class="display">providers</h1>

            <form class="form" onsubmit="searchProviders(event)" style="max-width:none">
                <div class="btn-row" style="margin-top:0;align-items:flex-end">
                    <div class="field" style="margin-bottom:0">
                        <label>category</label>
                        <select name="categoryId">
                            <option value="">- any -</option>
                            ${cats.map(c => `<option value="${c.category_id}">${c.category_name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="field" style="margin-bottom:0">
                        <label>zip</label>
                        <input name="zip" pattern="\\d{5}" maxlength="5" placeholder="optional">
                    </div>
                    <div class="field" style="margin-bottom:0">
                        <label>radius (mi)</label>
                        <input type="number" name="radius" value="50" min="1" max="500">
                    </div>
                    <button class="btn accent" type="submit">Search</button>
                    <button class="btn ghost" type="button" onclick="switchTab('browse')">Reset</button>
                </div>
            </form>

            <div class="chips" id="catChips" style="margin-top:14px">
                <span class="chip active" data-id="">All</span>
                ${cats.map(c => `<span class="chip" data-id="${c.category_id}">${c.category_name}</span>`).join('')}
            </div>
            <div id="results" style="margin-top:18px"></div>
        `);
        document.querySelectorAll('#catChips .chip').forEach(el => {
            el.onclick = () => filterProviders(el);
        });
        renderProviders();
    },
    async dashboard() {
        if (!state.user) return panels.home();
        if (state.user.role === 'provider') return loadProviderDash();
        if (state.user.role === 'admin') return loadAdmin();
        if (state.user.role === 'both') {
            // show both panels stacked
            await loadClientDash();
            const provHtml = await loadProviderDashHtml();
            document.getElementById('panel').insertAdjacentHTML('beforeend', '<hr class="rule">' + provHtml);
            return;
        }
        return loadClientDash();
    },
    async openReqs() {
        const list = await api('/api/openRequests');
        setPanel(`
            <h1 class="display">open requests</h1>
            ${list.length === 0 ? '<p class="muted">✦ &nbsp;No open requests at the moment.</p>' :
                `<table class="grid">
                    <thead><tr><th>#</th><th>category</th><th>where</th><th>when</th><th>client</th></tr></thead>
                    <tbody>
                        ${list.map(r => `
                            <tr style="cursor:pointer" onclick='openRequestBooking(${JSON.stringify(r).replace(/'/g, "&#39;")})'>
                                <td>${r.request_id}</td>
                                <td>${r.category_name}</td>
                                <td>${r.city}, ${r.state} ${r.zip}</td>
                                <td>${fmtDate(r.preferred_start)}</td>
                                <td>${r.client_first} ${r.client_last}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>`}
        `);
    },
    async profile() {
        if (!state.user) return panels.home();
        if (state.user.role === 'client') {
            setPanel(`
                <h1 class="display">profile</h1>
                <p>Signed in as <b>${state.user.first_name}</b> (${state.user.role}).</p>
            `);
            return;
        }
        const [data, cats, checks] = await Promise.all([
            api('/api/dashboard/provider'),
            api('/api/categories'),
            api('/api/provider/checks').catch(() => [])
        ]);
        const p = data.profile || {};
        const myCatIds = (p.categories || []).map(c => c.category_id);
        setPanel(`
            <h1 class="display">profile</h1>
            <div id="msg"></div>
            <form class="form" onsubmit="saveProfile(event)">
                <div class="field"><label>bio</label><textarea name="bio">${p.bio || ''}</textarea></div>
                <div class="field"><label>home zip</label><input name="home_zip" value="${p.home_zip || ''}" maxlength="10"></div>
                <div class="field"><label>travel radius (miles)</label><input type="number" name="travel_radius_miles" value="${p.travel_radius_miles || ''}"></div>
                <div class="field"><label>base rate</label><input type="number" step="0.01" name="base_rate" value="${p.base_rate || ''}"></div>
                <div class="btn-row"><button class="btn accent" type="submit">Save profile</button></div>
            </form>

            <h2 class="section">categories</h2>
            <form class="form" onsubmit="saveServices(event)" style="max-width:none">
                <div class="chips" id="catPicker">
                    ${cats.map(c => `
                        <label class="chip" style="cursor:pointer">
                            <input type="checkbox" name="cat" value="${c.category_id}" ${myCatIds.includes(c.category_id) ? 'checked' : ''} style="margin-right:6px">
                            ${c.category_name}
                        </label>`).join('')}
                </div>
                <div class="btn-row"><button class="btn accent" type="submit">Save categories</button></div>
            </form>

            <h2 class="section">background checks</h2>
            <p>Status: <b>${p.verified_status || 'unverified'}</b></p>
            ${checks.length === 0 ? '<p class="muted">✦ &nbsp;No background checks on file yet.</p>' :
                `<table class="grid">
                    <thead><tr><th>#</th><th>type</th><th>status</th><th>requested</th><th>completed</th></tr></thead>
                    <tbody>
                        ${checks.map(c => `
                            <tr>
                                <td>${c.check_id}</td>
                                <td>${c.check_type}</td>
                                <td>${statusBadge(c.status)}</td>
                                <td>${fmtDate(c.requested_at)}</td>
                                <td>${c.completed_at ? fmtDate(c.completed_at) : '-'}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>`}
            <form class="form" onsubmit="requestCheck(event)" style="margin-top:10px">
                <div class="field">
                    <label>request new check</label>
                    <select name="check_type">
                        <option value="identity">identity</option>
                        <option value="background">background</option>
                    </select>
                </div>
                <div class="btn-row"><button class="btn accent" type="submit">Request background check</button></div>
            </form>
        `);
    },
    async newReq() {
        if (!state.user) return panels.login();
        const cats = await api('/api/categories');
        setPanel(`
            <h1 class="display">new request</h1>
            <div id="msg"></div>
            <form class="form" onsubmit="createRequest(event)">
                <div class="field">
                    <label>category</label>
                    <select name="categoryId">${cats.map(c => `<option value="${c.category_id}">${c.category_name}</option>`).join('')}</select>
                </div>
                <div class="field"><label>description</label><textarea name="description" required></textarea></div>
                <div class="field"><label>street</label><input name="street" required></div>
                <div class="field"><label>city</label><input name="city" required></div>
                <div class="field"><label>state</label><input name="state" maxlength="2" required></div>
                <div class="field"><label>zip</label><input name="zip" pattern="\\d{5}" maxlength="5" required></div>
                <div class="field"><label>preferred start</label><input type="datetime-local" name="preferredStart" required></div>
                <div class="field"><label>preferred end</label><input type="datetime-local" name="preferredEnd" required></div>
                <div class="btn-row"><button type="submit" class="btn accent">Submit</button></div>
            </form>
        `);
    },
    admin() {
        return loadAdmin();
    },
    adminUsers() {
        return loadAdminUsers();
    },
    adminChecks() {
        return loadAdminChecks();
    },
    adminCategories() {
        return loadAdminCategories();
    },
    login() {
        setPanel(`
            <h1 class="display">sign in</h1>
            <div id="msg"></div>
            <form class="form" onsubmit="doLogin(event)">
                <div class="field"><label>email</label><input type="email" name="email" required></div>
                <div class="field"><label>password</label><input type="password" name="password" required></div>
                <div class="btn-row">
                    <button type="submit" class="btn accent">Sign in</button>
                    <button type="button" class="btn ghost" onclick="switchTab('register')">Register instead</button>
                </div>
            </form>
        `);
    },
    register() {
        setPanel(`
            <h1 class="display">register</h1>
            <div id="msg"></div>
            <form class="form" onsubmit="doRegister(event)">
                <div class="field"><label>first name</label><input name="firstName" required></div>
                <div class="field"><label>last name</label><input name="lastName" required></div>
                <div class="field"><label>email</label><input type="email" name="email" required></div>
                <div class="field"><label>phone</label><input name="phone"></div>
                <div class="field"><label>password</label><input type="password" name="password" minlength="8" required></div>
                <div class="field">
                    <label>role</label>
                    <select name="role">
                        <option value="client">client</option>
                        <option value="provider">provider</option>
                        <option value="both">both</option>
                    </select>
                </div>
                <div class="btn-row">
                    <button type="submit" class="btn accent">Create account</button>
                    <button type="button" class="btn ghost" onclick="switchTab('login')">Sign in instead</button>
                </div>
            </form>
        `);
    }
};

function fmtDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    const day = d.toLocaleDateString([], { weekday: 'short' });
    const month = d.toLocaleDateString([], { month: 'short' });
    const date = d.getDate();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${day}, ${month} ${date} · ${time}`;
}

function fmtMoney(n) {
    if (n == null) return '—';
    return '$' + Number(n).toFixed(2);
}

function statusBadge(s) {
    return `<span class="badge ${s}">${(s || '').replace(/_/g, ' ')}</span>`;
}

// star rating display
function fmtStars(rating, count) {
    const r = Number(rating) || 0;
    const rounded = Math.round(r);
    let stars = '';
    for (let i = 0; i < 5; i++) {
        stars += `<span class="star ${i < rounded ? 'full' : 'empty'}">${i < rounded ? '★' : '☆'}</span>`;
    }
    const num = `<span class="rating-num">${r.toFixed(1)}</span>`;
    const cnt = (count != null) ? `<span class="rating-count">(${count})</span>` : '';
    return `<span class="rating">${stars} ${num} ${cnt}</span>`;
}

// avatar background colors, picked by hashing the provider's name
const _avatarPalette = [
    { bg: '#1A1612', fg: '#F3EDDF' },
    { bg: '#8E3A1E', fg: '#F3EDDF' },
    { bg: '#6E7A52', fg: '#F3EDDF' },
    { bg: '#C09040', fg: '#1A1612' }
];
function hueForName(first, last) {
    const s = ((first || '') + (last || '')).toLowerCase();
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return _avatarPalette[Math.abs(h) % _avatarPalette.length];
}
function avatarTag(first, last, sizeStyle = '') {
    const t = hueForName(first, last);
    return `<div class="avatar" style="background:${t.bg};color:${t.fg};${sizeStyle}">${initials(first, last)}</div>`;
}

// booking status timeline
function statusTimeline(status) {
    if (status === 'cancelled') {
        return `<div class="timeline timeline-cancelled"><span>Cancelled</span></div>`;
    }
    const steps = [
        { key: 'scheduled',   label: 'Scheduled' },
        { key: 'in_progress', label: 'In progress' },
        { key: 'completed',   label: 'Completed' }
    ];
    const idx = steps.findIndex(s => s.key === status);
    const cur = idx < 0 ? 0 : idx;
    const parts = steps.map((s, i) => {
        const cls = i < cur ? 'past' : (i === cur ? 'current' : 'future');
        const dot = i < cur ? '✦' : (i === cur ? '◆' : '·');
        return `<div class="step ${cls}"><span class="dot">${dot}</span><span class="lbl">${s.label}</span></div>`;
    });
    return `<div class="timeline">${parts.join('<div class="line"></div>')}</div>`;
}

// transient toast notification - dedupes by message so spam clicks don't stack
function toast(message, kind = 'ok') {
    const root = document.getElementById('toasts');
    if (!root) return;
    const armDismiss = (el) => {
        if (el._dismiss) clearTimeout(el._dismiss);
        el._dismiss = setTimeout(() => {
            el.classList.remove('toast-in');
            el.classList.add('toast-out');
            setTimeout(() => el.remove(), 420);
        }, 3200);
    };
    const existing = Array.from(root.children).find(c => c._msg === message);
    if (existing) {
        existing.classList.remove('toast-out');
        existing.classList.add('toast-in');
        armDismiss(existing);
        return;
    }
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el._msg = message;
    el.innerHTML = `<span class="toast-mark">✦</span><span>${message}</span>`;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-in'));
    armDismiss(el);
}

// confirm dialog (replaces native confirm)
function confirmDialog(message, opts = {}) {
    return new Promise(resolve => {
        const root = document.getElementById('modal-root');
        if (!root) return resolve(window.confirm(message));
        const ok = opts.okLabel || 'Confirm';
        const cancel = opts.cancelLabel || 'Cancel';
        root.innerHTML = `
            <div class="modal-backdrop" data-close></div>
            <div class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="modal-msg">
                <p class="modal-eyebrow">✦ &nbsp;Confirm</p>
                <p class="modal-message" id="modal-msg">${message}</p>
                <div class="modal-actions">
                    <button class="btn ghost" type="button" data-cancel>${cancel}</button>
                    <button class="btn accent" type="button" data-ok>${ok}</button>
                </div>
            </div>
        `;
        root.classList.add('open');
        const close = (val) => {
            root.classList.remove('open');
            document.removeEventListener('keydown', esc);
            setTimeout(() => { root.innerHTML = ''; }, 220);
            resolve(val);
        };
        const esc = (e) => {
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter')  close(true);
        };
        root.querySelector('[data-ok]').onclick = () => close(true);
        root.querySelector('[data-cancel]').onclick = () => close(false);
        root.querySelector('[data-close]').onclick = () => close(false);
        document.addEventListener('keydown', esc);
        setTimeout(() => root.querySelector('[data-cancel]').focus(), 60);
    });
}

async function searchProviders(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const categoryId = fd.get('categoryId');
    const zip = fd.get('zip') || '';
    const radius = fd.get('radius') || 50;
    if (Number(radius) > 0 && !zip) {
        toast('Enter a ZIP to filter by distance — radius needs an anchor location.', 'error');
    }
    const qs = `zip=${encodeURIComponent(zip)}&radius=${radius}` + (categoryId ? `&categoryId=${categoryId}` : '');
    const list = await api(`/api/providers/search?${qs}`);
    if (categoryId) {
        // server returns one starting_price per row for the chosen category;
        // build a categories array so the card render still works
        state.allProviders = list.map(p => ({
            ...p,
            categories: [{
                category_id: Number(categoryId),
                category_name: (state.allCategories.find(c => c.category_id == categoryId) || {}).category_name
            }]
        }));
    } else {
        // server already returns providers with their full categories array
        state.allProviders = list;
    }
    state.catFilter = null;
    document.querySelectorAll('#catChips .chip').forEach(c => c.classList.remove('active'));
    const allChip = document.querySelector('#catChips .chip[data-id=""]');
    if (allChip) allChip.classList.add('active');
    renderProviders();
}

function filterProviders(el) {
    document.querySelectorAll('#catChips .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const id = el.dataset.id ? Number(el.dataset.id) : null;
    state.catFilter = id;
    renderProviders();
}

function renderProviders() {
    const r = document.getElementById('results');
    if (!r) return;
    const list = state.catFilter
        ? state.allProviders.filter(p => p.categories.some(c => c.category_id === state.catFilter))
        : state.allProviders;
    if (list.length === 0) {
        r.innerHTML = '<p class="muted">✦ &nbsp;The directory holds no entries for this filter.</p>';
        return;
    }
    r.innerHTML = `<div class="cards">${list.map(renderProviderCard).join('')}</div>`;
}

function initials(first, last) {
    return ((first || '?')[0] + (last || '?')[0]).toUpperCase();
}

function renderProviderCard(p) {
    const verified = p.verified_status === 'verified';
    const cats = (p.categories || []).slice(0, 3).map(c => c.category_name).join(' &middot; ');
    return `
        <div class="pcard" onclick="openProvider(${p.user_id})">
            <div class="pcard-head">
                ${avatarTag(p.first_name, p.last_name)}
                <div>
                    <div class="pcard-name">${p.first_name} ${p.last_name}</div>
                    <div class="pcard-tag ${verified ? 'verified' : ''}">${verified ? 'verified' : 'unverified'}${cats ? ' &middot; ' + cats : ''}</div>
                </div>
            </div>
            <div class="pcard-bio">${p.bio || '<span class="muted">no bio</span>'}</div>
            <div class="pcard-meta">
                <span><b>${fmtMoney(p.base_rate)}</b>/hr</span>
                <span>${fmtStars(p.avg_rating, p.review_count)}</span>
                <span>zip <b>${p.home_zip || '—'}</b></span>
                <span>${p.distance_miles != null
                    ? (p.distance_miles === 0 ? 'at your <b>zip</b>' : `<b>${p.distance_miles}</b> miles away`)
                    : `travels up to <b>${p.travel_radius_miles || '—'}mi</b>`}</span>
            </div>
        </div>`;
}

async function openProvider(id) {
    const p = await api('/api/providers/' + id);
    const verified = p.verified_status === 'verified';
    setPanel(`
        <div class="btn-row" style="margin:0 0 14px 0">
            <button class="btn ghost" onclick="switchTab('browse')">&larr; back</button>
        </div>
        <div class="pcard-head" style="gap:14px;margin-bottom:8px">
            ${avatarTag(p.first_name, p.last_name, 'width:56px;height:56px;flex:0 0 56px;font-size:18px')}
            <div>
                <h1 class="display" style="margin:0">${p.first_name} ${p.last_name}</h1>
                <div class="pcard-tag ${verified ? 'verified' : ''}" style="margin-top:6px">${p.verified_status || 'unverified'}</div>
            </div>
        </div>

        <p>${p.bio || '<span class="muted">no bio</span>'}</p>

        <div class="cards" style="margin-top:14px">
            <div class="card"><h3>${fmtMoney(p.base_rate)}/hr</h3><div class="meta">base rate</div></div>
            <div class="card"><h3>${Number(p.avg_rating).toFixed(1)}/5</h3><div class="meta">${p.total_reviews} reviews</div></div>
            <div class="card"><h3>${p.home_zip || '-'}</h3><div class="meta">home zip</div></div>
            <div class="card"><h3>${p.travel_radius_miles || '-'} mi</h3><div class="meta">travel radius</div></div>
        </div>

        <h2 class="section">services</h2>
        ${p.categories.length === 0 ? '<p class="muted">✦ &nbsp;No services listed.</p>' :
            `<table class="grid">
                <thead><tr><th>category</th><th>starting</th><th>notes</th></tr></thead>
                <tbody>
                    ${p.categories.map(c => `
                        <tr>
                            <td>${c.category_name}</td>
                            <td>${c.starting_price ? fmtMoney(c.starting_price) : '-'}</td>
                            <td>${c.notes || ''}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`}

        <h2 class="section">reviews</h2>
        ${p.reviews.length === 0 ? '<p class="muted">✦ &nbsp;No reviews on record yet.</p>' :
            p.reviews.map(r => `
                <div class="card" style="margin-bottom:8px">
                    <h3>${r.client_first} ${r.client_last}</h3>
                    <div class="meta">${fmtStars(r.rating)} &nbsp;·&nbsp; ${fmtDate(r.created_at)}</div>
                    ${r.comment ? `<p style="margin:8px 0 0 0">${r.comment}</p>` : ''}
                </div>`).join('')}
    `);
}

async function loadClientDash() {
    const data = await api('/api/dashboard/client');
    const { requests, bookings } = data;
    await setPanel(`
        <h1 class="display">Dashboard</h1>

        <h2 class="section">requests</h2>
        ${requests.length === 0 ? '<p class="muted">✦ &nbsp;No requests posted yet.</p>' :
            `<table class="grid">
                <thead><tr><th>#</th><th>category</th><th>status</th><th>when</th><th></th></tr></thead>
                <tbody>
                    ${requests.map(r => `
                        <tr>
                            <td>${r.request_id}</td>
                            <td>${r.category_name}</td>
                            <td>${statusBadge(r.status)}</td>
                            <td>${fmtDate(r.preferred_start)}</td>
                            <td>${r.status === 'open' ? `<button class="btn ghost" style="padding:3px 8px;font-size:11px" onclick="deleteRequest(${r.request_id})">delete</button>` : ''}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`}

        <h2 class="section">bookings</h2>
        ${bookings.length === 0 ? '<p class="muted">✦ &nbsp;No bookings yet.</p>' :
            `<table class="grid">
                <thead><tr><th>#</th><th>category</th><th>provider</th><th>when</th><th>price</th><th>status</th><th>paid</th></tr></thead>
                <tbody>
                    ${bookings.map(b => `
                        <tr style="cursor:pointer" onclick="openBooking(${b.booking_id})">
                            <td>${b.booking_id}</td>
                            <td>${b.category_name}</td>
                            <td>${b.provider_first} ${b.provider_last}</td>
                            <td>${fmtDate(b.scheduled_start)}</td>
                            <td>${fmtMoney(b.agreed_price)}</td>
                            <td>${statusBadge(b.status)}</td>
                            <td>${b.paid ? 'yes' : 'no'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`}
    `);
}

async function loadProviderDashHtml() {
    const data = await api('/api/dashboard/provider');
    const { profile, bookings, reviews } = data;
    return `
        <div class="cards">
            <div class="card"><h3>${bookings.length}</h3><div class="meta">total bookings</div></div>
            <div class="card"><h3>${Number(reviews.avg_rating).toFixed(1)}/5</h3><div class="meta">avg rating (${reviews.total})</div></div>
            <div class="card"><h3>${fmtMoney(profile && profile.base_rate)}</h3><div class="meta">base rate</div></div>
            <div class="card"><h3>${profile && profile.verified_status || '-'}</h3><div class="meta">verification</div></div>
        </div>

        <h2 class="section">jobs</h2>
        ${bookings.length === 0 ? '<p class="muted">✦ &nbsp;No jobs accepted yet.</p>' :
            `<table class="grid">
                <thead><tr><th>#</th><th>category</th><th>client</th><th>when</th><th>price</th><th>status</th></tr></thead>
                <tbody>
                    ${bookings.map(b => `
                        <tr style="cursor:pointer" onclick="openBooking(${b.booking_id})">
                            <td>${b.booking_id}</td>
                            <td>${b.category_name}</td>
                            <td>${b.client_first} ${b.client_last}</td>
                            <td>${fmtDate(b.scheduled_start)}</td>
                            <td>${fmtMoney(b.agreed_price)}</td>
                            <td>${statusBadge(b.status)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`}

        <h2 class="section">recent reviews</h2>
        ${reviews.reviews.length === 0 ? '<p class="muted">✦ &nbsp;No reviews on record yet.</p>' :
            reviews.reviews.slice(0, 5).map(r => `
                <div class="card" style="margin-bottom:8px">
                    <h3>${r.client_first} ${r.client_last}</h3>
                    <div class="meta">${fmtStars(r.rating)} &nbsp;·&nbsp; ${fmtDate(r.created_at)}</div>
                    ${r.comment ? `<p style="margin:8px 0 0 0">${r.comment}</p>` : ''}
                </div>`).join('')}
    `;
}

async function loadProviderDash() {
    const html = await loadProviderDashHtml();
    setPanel(`<h1 class="display">Dashboard</h1>` + html);
}

async function loadAdmin() {
    const stats = await api('/api/admin/stats');
    setPanel(`
        <h1 class="display">admin</h1>
        <div class="cards">
            <div class="card"><h3>${stats.total_users}</h3><div class="meta">users</div></div>
            <div class="card"><h3>${stats.total_providers}</h3><div class="meta">providers</div></div>
            <div class="card"><h3>${stats.total_clients}</h3><div class="meta">clients</div></div>
            <div class="card"><h3>${stats.total_bookings}</h3><div class="meta">bookings</div></div>
        </div>
        <div class="btn-row">
            <button class="btn ghost" onclick="switchTab('adminUsers')">View users</button>
            <button class="btn ghost" onclick="switchTab('adminChecks')">Manage checks</button>
            <button class="btn ghost" onclick="switchTab('adminCategories')">Manage categories</button>
        </div>
    `);
}

async function loadAdminUsers() {
    const users = await api('/api/admin/users');
    setPanel(`
        <h1 class="display">users</h1>
        ${users.length === 0 ? '<p class="muted">✦ &nbsp;No users on file.</p>' :
            `<table class="grid">
                <thead><tr><th>id</th><th>name</th><th>email</th><th>phone</th><th>role</th><th>joined</th></tr></thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td>${u.user_id}</td>
                            <td>${u.first_name} ${u.last_name}</td>
                            <td>${u.email}</td>
                            <td>${u.phone || '-'}</td>
                            <td>${statusBadge(u.role_type)}</td>
                            <td>${fmtDate(u.created_at)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`}
    `);
}

async function loadAdminChecks() {
    const checks = await api('/api/admin/checks');
    setPanel(`
        <h1 class="display">background checks</h1>
        <div id="msg"></div>
        ${checks.length === 0 ? '<p class="muted">✦ &nbsp;No background-check records yet.</p>' :
            `<table class="grid">
                <thead><tr><th>#</th><th>user</th><th>type</th><th>status</th><th>requested</th><th>completed</th><th>action</th></tr></thead>
                <tbody>
                    ${checks.map(c => `
                        <tr>
                            <td>${c.check_id}</td>
                            <td>${c.first_name} ${c.last_name} <span class="muted">&middot; ${c.email}</span></td>
                            <td>${c.check_type}</td>
                            <td>${statusBadge(c.status)}</td>
                            <td>${fmtDate(c.requested_at)}</td>
                            <td>${c.completed_at ? fmtDate(c.completed_at) : '-'}</td>
                            <td>
                                <select id="cs-${c.check_id}">
                                    ${['pending','approved','rejected'].map(s =>
                                        `<option value="${s}" ${s===c.status?'selected':''}>${s}</option>`).join('')}
                                </select>
                                <button class="btn ghost" style="padding:3px 8px;font-size:11px"
                                    onclick="updateCheck(${c.check_id})">Set</button>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>`}
    `);
}

async function updateCheck(id) {
    const status = document.getElementById('cs-' + id).value;
    try {
        await api(`/api/admin/checks/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        await loadAdminChecks();
    } catch (e) { showMsg(`<div class="error">${e.message}</div>`); }
}

async function loadAdminCategories() {
    const cats = await api('/api/categories');
    setPanel(`
        <h1 class="display">categories</h1>
        <div id="msg"></div>

        <h2 class="section">add category</h2>
        <form class="form" onsubmit="addCategory(event)">
            <div class="field"><label>name</label><input name="name" required maxlength="60"></div>
            <div class="btn-row"><button type="submit" class="btn accent">Add category</button></div>
        </form>

        <h2 class="section">existing</h2>
        ${cats.length === 0 ? '<p class="muted">✦ &nbsp;No categories defined.</p>' :
            `<table class="grid">
                <thead><tr><th>id</th><th>name</th><th></th></tr></thead>
                <tbody>
                    ${cats.map(c => `
                        <tr>
                            <td>${c.category_id}</td>
                            <td>${c.category_name}</td>
                            <td>
                                <button class="btn ghost" style="padding:3px 8px;font-size:11px"
                                    onclick="deleteCategory(${c.category_id}, '${c.category_name.replace(/'/g, "\\'")}')">delete</button>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>`}
    `);
}

async function addCategory(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
        await api('/api/admin/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: fd.get('name') })
        });
        await loadAdminCategories();
    } catch (e) { showMsg(`<div class="error">${e.message}</div>`); }
}

async function deleteCategory(id, name) {
    if (!await confirmDialog(`Delete category "${name}"? This cannot be undone.`, { okLabel: 'Delete' })) return;
    try {
        await api('/api/admin/categories/' + id, { method: 'DELETE' });
        toast('Category deleted.');
        await loadAdminCategories();
    } catch (e) { toast(e.message, 'error'); }
}

function showMsg(html) {
    const el = document.getElementById('msg');
    if (el) el.innerHTML = html;
}

async function createRequest(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    try {
        await api('/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        await switchTab('dashboard');
    } catch (e) {
        showMsg(`<div class="error">${e.message}</div>`);
    }
}

async function saveProfile(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    if (body.travel_radius_miles) body.travel_radius_miles = Number(body.travel_radius_miles);
    if (body.base_rate) body.base_rate = Number(body.base_rate);
    try {
        await api('/api/provider/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        toast('Profile saved.');
    } catch (e) {
        showMsg(`<div class="error">${e.message}</div>`);
    }
}

async function requestCheck(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
        await api('/api/provider/checks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ check_type: fd.get('check_type') })
        });
        toast('Background check requested.');
        await switchTab('profile');
    } catch (e) { showMsg(`<div class="error">${e.message}</div>`); }
}

async function saveServices(ev) {
    ev.preventDefault();
    const ids = [...document.querySelectorAll('#catPicker input:checked')].map(i => ({ category_id: Number(i.value) }));
    try {
        await api('/api/provider/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories: ids })
        });
        toast('Categories saved.');
    } catch (e) {
        showMsg(`<div class="error">${e.message}</div>`);
    }
}

async function openBooking(id) {
    const b = await api('/api/booking/' + id);
    const role = state.user ? state.user.role : null;
    const canActAsClient = role === 'client' || role === 'both';
    const showPay = canActAsClient && !b.payment_id && b.status !== 'cancelled';
    const showReview = canActAsClient && !b.review_id && b.status === 'completed';
    setPanel(`
        <h1 class="display">${b.category_name} <em>booking #${b.booking_id}</em></h1>
        <div id="msg"></div>
        ${statusTimeline(b.status)}

        <div class="cards">
            <div class="card"><h3>${statusBadge(b.status)}</h3><div class="meta">status</div></div>
            <div class="card"><h3>${fmtMoney(b.agreed_price)}</h3><div class="meta">agreed price</div></div>
            <div class="card"><h3>${b.payment_status || '-'}</h3><div class="meta">payment</div></div>
            <div class="card"><h3>${b.rating ? b.rating + '/5' : '-'}</h3><div class="meta">review</div></div>
        </div>

        <h2 class="section">details</h2>
        <table class="grid">
            <tr><th>provider</th><td>${b.provider_first} ${b.provider_last}</td></tr>
            <tr><th>client</th><td>${b.client_first} ${b.client_last}</td></tr>
            <tr><th>where</th><td>${b.street || ''}, ${b.city || ''} ${b.state || ''} ${b.zip || ''}</td></tr>
            <tr><th>start</th><td>${fmtDate(b.scheduled_start)}</td></tr>
            <tr><th>end</th><td>${fmtDate(b.scheduled_end)}</td></tr>
            <tr><th>description</th><td>${b.description || ''}</td></tr>
        </table>

        <h2 class="section">actions</h2>
        <div class="btn-row">
            <select id="bkStatus">
                ${['scheduled','in_progress','completed','cancelled'].map(s =>
                    `<option value="${s}" ${s===b.status?'selected':''}>${s}</option>`).join('')}
            </select>
            <button class="btn ghost" onclick="changeBookingStatus(${b.booking_id})">Update status</button>
            ${showPay ? `<button class="btn accent" onclick="openPay(${b.booking_id}, ${b.agreed_price})">Make payment</button>` : ''}
            ${showReview ? `<button class="btn accent" onclick="openReview(${b.booking_id})">Write review</button>` : ''}
        </div>

        <div id="extra"></div>
    `);
}

async function changeBookingStatus(id) {
    const status = document.getElementById('bkStatus').value;
    try {
        await api(`/api/bookings/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        await openBooking(id);
    } catch (e) { showMsg(`<div class="error">${e.message}</div>`); }
}

function openPay(bookingId, agreed) {
    document.getElementById('extra').innerHTML = `
        <h2 class="section">payment</h2>
        <form class="form" onsubmit="submitPayment(event, ${bookingId})">
            <div class="field"><label>amount</label><input type="number" step="0.01" name="amount" value="${agreed}" required></div>
            <div class="field">
                <label>method</label>
                <select name="method">
                    <option value="credit_card">credit_card</option>
                    <option value="debit">debit</option>
                    <option value="cash">cash</option>
                    <option value="other">other</option>
                </select>
            </div>
            <div class="btn-row"><button class="btn accent" type="submit">Pay</button></div>
        </form>`;
}

async function submitPayment(ev, bookingId) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
        await api('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId, amount: Number(fd.get('amount')), method: fd.get('method') })
        });
        await openBooking(bookingId);
    } catch (e) { showMsg(`<div class="error">${e.message}</div>`); }
}

function openReview(bookingId) {
    document.getElementById('extra').innerHTML = `
        <h2 class="section">review</h2>
        <form class="form" onsubmit="submitReview(event, ${bookingId})">
            <div class="field">
                <label>rating</label>
                <select name="rating">
                    ${[1,2,3,4,5].map(n => `<option value="${n}" ${n===5?'selected':''}>${n}</option>`).join('')}
                </select>
            </div>
            <div class="field"><label>comment</label><textarea name="comment"></textarea></div>
            <div class="btn-row"><button class="btn accent" type="submit">Submit</button></div>
        </form>`;
}

async function submitReview(ev, bookingId) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
        await api('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId, rating: Number(fd.get('rating')), comment: fd.get('comment') })
        });
        await openBooking(bookingId);
    } catch (e) { showMsg(`<div class="error">${e.message}</div>`); }
}

function openRequestBooking(req) {
    setPanel(`
        <h1 class="display">${req.category_name} <em>request #${req.request_id}</em></h1>
        <p>For ${req.client_first} ${req.client_last}</p>
        <div id="msg"></div>
        <p>${req.description || ''}</p>
        <p class="muted">${req.street || ''}, ${req.city}, ${req.state} ${req.zip}</p>
        <form class="form" onsubmit="confirmBooking(event, ${req.request_id})">
            <div class="field"><label>start</label><input type="datetime-local" name="scheduledStart" required></div>
            <div class="field"><label>end</label><input type="datetime-local" name="scheduledEnd" required></div>
            <div class="field"><label>agreed price</label><input type="number" step="0.01" name="agreedPrice" required></div>
            <div class="btn-row">
                <button type="submit" class="btn accent">Confirm booking</button>
                <button type="button" class="btn ghost" onclick="switchTab('openReqs')">Cancel</button>
            </div>
        </form>
    `);
}

async function deleteRequest(id) {
    if (!await confirmDialog(`Delete request #${id}? This cannot be undone.`, { okLabel: 'Delete' })) return;
    try {
        await api('/api/requests/' + id, { method: 'DELETE' });
        toast('Request deleted.');
        await switchTab('dashboard');
    } catch (e) { toast(e.message, 'error'); }
}

async function confirmBooking(ev, requestId) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = { requestId, ...Object.fromEntries(fd.entries()) };
    try {
        const r = await api('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        await openBooking(r.booking_id);
    } catch (e) { showMsg(`<div class="error">${e.message}</div>`); }
}

async function doLogin(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
        const u = await api('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') })
        });
        if (!u || !u.user_id || !u.role) throw new Error('login response was empty');
        state.user = { user_id: u.user_id, role: u.role, first_name: u.first_name };
        renderAccount();
        renderTabs();
        await switchTab(state.user.role === 'admin' ? 'admin' : 'dashboard');
        setStatus('signed in');
    } catch (e) {
        showMsg(`<div class="error">${e.message}</div>`);
        setStatus('error');
    }
}

async function doRegister(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    try {
        const u = await api('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        state.user = { user_id: u.user_id, role: u.role, first_name: u.first_name };
        renderAccount();
        renderTabs();
        await switchTab('dashboard');
        setStatus('signed in');
    } catch (e) {
        showMsg(`<div class="error">${e.message}</div>`);
    }
}

async function doLogout() {
    try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
    state.user = null;
    state.activeTab = 'home';
    renderAccount();
    renderTabs();
    panels.home();
    setStatus('signed out');
}

async function bootstrap() {
    try {
        const me = await api('/api/me');
        if (me && me.user_id) state.user = me;
    } catch (e) { /* not logged in */ }
    renderAccount();
    renderTabs();
    panels.home();
    setStatus('ready');
}

bootstrap();
