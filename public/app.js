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
        { group: 'account' },
        { id: 'profile', label: 'Profile' },
        { id: 'logout', label: 'Sign out' }
    ],
    admin: [
        { group: 'admin' },
        { id: 'admin', label: 'Overview' },
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
        el.onclick = () => switchTab(t.id);
        rail.appendChild(el);
    });
}

function setPanel(html) {
    document.getElementById('panel').innerHTML = html;
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
            ? `<button class="btn accent" onclick="switchTab('dashboard')">Dashboard</button>
               <button class="btn ghost" onclick="switchTab('browse')">Browse providers</button>`
            : `<button class="btn accent" onclick="switchTab('register')">Register</button>
               <button class="btn ghost" onclick="switchTab('login')">Sign in</button>`;
        setPanel(`
            <h1 class="display">homeneeds</h1>
            <p class="sub">// marketplace for home services</p>
            <div class="btn-row">${cta}</div>
            <h2 class="section">categories</h2>
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
        `);
    },
    async browse() {
        const [cats, all] = await Promise.all([api('/api/categories'), api('/api/providers')]);
        state.allProviders = all;
        state.catFilter = null;
        setPanel(`
            <h1 class="display">providers</h1>
            <p class="sub">// ${all.length} total</p>
            <div class="chips" id="catChips">
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
            <p class="sub">// available work</p>
            ${list.length === 0 ? '<p class="muted">none right now</p>' :
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
                <p class="sub">// client account</p>
                <p>signed in as <b>${state.user.first_name}</b> (${state.user.role})</p>
                <p class="muted">no editable fields for clients yet</p>
            `);
            return;
        }
        const data = await api('/api/dashboard/provider');
        const cats = await api('/api/categories');
        const p = data.profile || {};
        const myCatIds = (p.categories || []).map(c => c.category_id);
        setPanel(`
            <h1 class="display">profile</h1>
            <p class="sub">// provider settings</p>
            <div id="msg"></div>
            <form class="form" onsubmit="saveProfile(event)">
                <div class="field"><label>bio</label><textarea name="bio">${p.bio || ''}</textarea></div>
                <div class="field"><label>home zip</label><input name="home_zip" value="${p.home_zip || ''}" maxlength="10"></div>
                <div class="field"><label>travel radius (miles)</label><input type="number" name="travel_radius_miles" value="${p.travel_radius_miles || ''}"></div>
                <div class="field"><label>base rate</label><input type="number" step="0.01" name="base_rate" value="${p.base_rate || ''}"></div>
                <div class="btn-row"><button class="btn accent" type="submit">Save profile</button></div>
            </form>

            <h2 class="section">categories</h2>
            <p class="sub">// services you offer</p>
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
        `);
    },
    async newReq() {
        if (!state.user) return panels.login();
        const cats = await api('/api/categories');
        setPanel(`
            <h1 class="display">new request</h1>
            <p class="sub">// post a job</p>
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
    login() {
        setPanel(`
            <h1 class="display">sign in</h1>
            <p class="sub">// existing accounts</p>
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
            <p class="sub">// new account</p>
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
    if (!s) return '-';
    const d = new Date(s);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(n) {
    if (n == null) return '-';
    return '$' + Number(n).toFixed(2);
}

function statusBadge(s) {
    return `<span class="badge ${s}">${s}</span>`;
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
        r.innerHTML = '<p class="muted">no providers</p>';
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
                <div class="avatar">${initials(p.first_name, p.last_name)}</div>
                <div>
                    <div class="pcard-name">${p.first_name} ${p.last_name}</div>
                    <div class="pcard-tag ${verified ? 'verified' : ''}">${verified ? 'verified' : 'unverified'}${cats ? ' &middot; ' + cats : ''}</div>
                </div>
            </div>
            <div class="pcard-bio">${p.bio || '<span class="muted">no bio</span>'}</div>
            <div class="pcard-meta">
                <span><b>${fmtMoney(p.base_rate)}</b>/hr</span>
                <span>${Number(p.avg_rating).toFixed(1)}/5 <b>(${p.review_count})</b></span>
                <span>zip <b>${p.home_zip || '-'}</b></span>
                <span>radius <b>${p.travel_radius_miles || '-'}mi</b></span>
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
            <div class="avatar" style="width:56px;height:56px;flex:0 0 56px;font-size:18px">${initials(p.first_name, p.last_name)}</div>
            <div>
                <h1 class="display" style="margin:0">${p.first_name} ${p.last_name}</h1>
                <p class="sub" style="margin:4px 0 0 0">// <span class="${verified ? '' : 'muted'}" style="${verified ? 'color:var(--accent)' : ''}">${p.verified_status || 'unverified'}</span></p>
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
        ${p.categories.length === 0 ? '<p class="muted">none listed</p>' :
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
        ${p.reviews.length === 0 ? '<p class="muted">no reviews yet</p>' :
            p.reviews.map(r => `
                <div class="card" style="margin-bottom:8px">
                    <h3>${r.rating}/5 &mdash; ${r.client_first} ${r.client_last}</h3>
                    <div class="meta">${fmtDate(r.created_at)}</div>
                    ${r.comment ? `<p style="margin:6px 0 0 0">${r.comment}</p>` : ''}
                </div>`).join('')}
    `);
}

async function loadClientDash() {
    const data = await api('/api/dashboard/client');
    const { requests, bookings } = data;
    setPanel(`
        <h1 class="display">${state.user.first_name.toLowerCase()}'s dashboard</h1>
        <p class="sub">// client view</p>

        <h2 class="section">requests</h2>
        ${requests.length === 0 ? '<p class="muted">none yet</p>' :
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
        ${bookings.length === 0 ? '<p class="muted">none yet</p>' :
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
        <p class="sub">// provider view</p>

        <div class="cards">
            <div class="card"><h3>${bookings.length}</h3><div class="meta">total bookings</div></div>
            <div class="card"><h3>${Number(reviews.avg_rating).toFixed(1)}/5</h3><div class="meta">avg rating (${reviews.total})</div></div>
            <div class="card"><h3>${fmtMoney(profile && profile.base_rate)}</h3><div class="meta">base rate</div></div>
            <div class="card"><h3>${profile && profile.verified_status || '-'}</h3><div class="meta">verification</div></div>
        </div>

        <h2 class="section">jobs</h2>
        ${bookings.length === 0 ? '<p class="muted">none yet</p>' :
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
        ${reviews.reviews.length === 0 ? '<p class="muted">none yet</p>' :
            reviews.reviews.slice(0, 5).map(r => `
                <div class="card" style="margin-bottom:8px">
                    <h3>${r.rating}/5 &mdash; ${r.client_first} ${r.client_last}</h3>
                    <div class="meta">${fmtDate(r.created_at)}</div>
                    ${r.comment ? `<p style="margin:6px 0 0 0">${r.comment}</p>` : ''}
                </div>`).join('')}
    `;
}

async function loadProviderDash() {
    const html = await loadProviderDashHtml();
    setPanel(`<h1 class="display">${state.user.first_name.toLowerCase()}'s dashboard</h1>` + html);
}

async function loadAdmin() {
    const stats = await api('/api/admin/stats');
    setPanel(`
        <h1 class="display">admin</h1>
        <p class="sub">// system overview</p>
        <div class="cards">
            <div class="card"><h3>${stats.total_users}</h3><div class="meta">users</div></div>
            <div class="card"><h3>${stats.total_providers}</h3><div class="meta">providers</div></div>
            <div class="card"><h3>${stats.total_clients}</h3><div class="meta">clients</div></div>
            <div class="card"><h3>${stats.total_bookings}</h3><div class="meta">bookings</div></div>
        </div>
    `);
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
        showMsg('<div class="ok">saved</div>');
    } catch (e) {
        showMsg(`<div class="error">${e.message}</div>`);
    }
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
        showMsg('<div class="ok">saved</div>');
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
        <h1 class="display">booking #${b.booking_id}</h1>
        <p class="sub">// ${b.category_name}</p>
        <div id="msg"></div>

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
        <h1 class="display">book request #${req.request_id}</h1>
        <p class="sub">// ${req.category_name} for ${req.client_first} ${req.client_last}</p>
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
    if (!confirm('delete request #' + id + '?')) return;
    try {
        await api('/api/requests/' + id, { method: 'DELETE' });
        await switchTab('dashboard');
    } catch (e) { alert(e.message); }
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
