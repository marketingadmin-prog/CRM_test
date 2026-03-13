// app.js — CRM Frontend Logic (Prompt 5.1 + 5.2)

// ================================================================
// CONSTANTS
// ================================================================
const STATUS_CONFIG = {
  lead:     { label: 'Lead',     cls: 'bg-blue-900/50 text-blue-300 border border-blue-700/50' },
  prospect: { label: 'Prospect', cls: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50' },
  customer: { label: 'Customer', cls: 'bg-green-900/50 text-green-300 border border-green-700/50' },
  inactive: { label: 'Inactive', cls: 'bg-gray-800 text-gray-500 border border-gray-700' },
};

const STAGE_CONFIG = {
  new:         { label: 'New',         color: '#818cf8' },
  contacted:   { label: 'Contacted',   color: '#60a5fa' },
  proposal:    { label: 'Proposal',    color: '#a78bfa' },
  negotiation: { label: 'Negotiation', color: '#f59e0b' },
  won:         { label: 'Won',         color: '#34d399' },
  lost:        { label: 'Lost',        color: '#f87171' },
};

// ================================================================
// SECTION NAVIGATION
// ================================================================
function showSection(name) {
  ['dashboard', 'contacts', 'deals'].forEach(s => {
    document.getElementById('section-' + s).classList.toggle('hidden', s !== name);
    const btn = document.getElementById('nav-' + s);
    btn.classList.toggle('active', s === name);
    btn.classList.toggle('text-white', s === name);
    btn.classList.toggle('text-gray-300', s !== name);
  });

  const titles = {
    dashboard: { title: 'Dashboard', sub: 'ภาพรวมระบบ CRM' },
    contacts:  { title: 'Contacts',  sub: 'จัดการผู้ติดต่อ' },
    deals:     { title: 'Deals',     sub: 'โอกาสการขาย' },
  };
  document.getElementById('page-title').textContent = titles[name].title;
  document.getElementById('page-sub').textContent   = titles[name].sub;

  if (name === 'contacts') loadContacts();
  if (name === 'deals')    loadDeals();
}

// ================================================================
// TOAST
// ================================================================
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const cls   = {
    success: 'bg-green-900/90 text-green-100 border border-green-700',
    error:   'bg-red-900/90 text-red-100 border border-red-700',
    info:    'bg-gray-800 text-gray-200 border border-gray-700',
  };
  document.getElementById('toast-msg').textContent  = msg;
  document.getElementById('toast-icon').textContent = icons[type];
  toast.className = `fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3
    rounded-xl shadow-xl text-sm font-medium min-w-[220px] ${cls[type]}`;
  toast.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ================================================================
// DASHBOARD
// ================================================================
async function loadDashboard() {
  await Promise.all([loadStats(), loadPipeline()]);
}

// loadStats — GET /api/contacts/stats → อัพเดต 3 stat cards
async function loadStats() {
  try {
    const res   = await fetch('/api/contacts/stats');
    const stats = await res.json();
    const map   = Object.fromEntries(stats.map(s => [s.status, parseInt(s.count)]));
    const total = stats.reduce((sum, r) => sum + parseInt(r.count), 0);

    document.getElementById('stat-total').textContent     = total;
    document.getElementById('stat-leads').textContent     = map.lead     || 0;
    document.getElementById('stat-customers').textContent = map.customer || 0;
    document.getElementById('db-status').className =
      'ml-auto w-2 h-2 rounded-full bg-green-500';
  } catch (err) {
    console.error('loadStats error:', err);
    document.getElementById('db-status').className =
      'ml-auto w-2 h-2 rounded-full bg-red-500';
  }
}

// loadPipeline — GET /api/deals/pipeline → อัพเดต deal value card + pipeline bars
async function loadPipeline() {
  try {
    const res      = await fetch('/api/deals/pipeline');
    const pipeline = await res.json();

    const totalVal = pipeline.reduce((s, r) => s + parseFloat(r.total_value || 0), 0);
    document.getElementById('stat-deal-value').textContent =
      '฿' + totalVal.toLocaleString('th-TH');

    const maxVal = Math.max(...pipeline.map(p => parseFloat(p.total_value || 0)), 1);
    document.getElementById('pipeline-bars').innerHTML = pipeline.length
      ? pipeline.map(p => {
          const cfg = STAGE_CONFIG[p.stage] || { label: p.stage, color: '#6b7280' };
          const pct = Math.round((parseFloat(p.total_value || 0) / maxVal) * 100);
          const val = parseFloat(p.total_value || 0).toLocaleString('th-TH');
          return `
            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium" style="color:${cfg.color}">${cfg.label}</span>
                <span class="text-gray-400">${p.count} deals · ฿${val}</span>
              </div>
              <div class="w-full bg-gray-800 rounded-full h-2">
                <div class="h-2 rounded-full transition-all duration-500"
                  style="width:${pct}%;background:${cfg.color};opacity:0.8"></div>
              </div>
            </div>`;
        }).join('')
      : '<p class="text-sm text-gray-500 text-center py-4">ยังไม่มี deals</p>';
  } catch (err) {
    console.error('loadPipeline error:', err);
  }
}

// ================================================================
// CONTACTS — State
// ================================================================
let allContacts = [];
let _filterTimer = null; // debounce timer

// loadContacts — GET /api/contacts → cache + render
async function loadContacts() {
  setContactsLoading(true);
  try {
    const res   = await fetch('/api/contacts');
    allContacts = await res.json();
    filterContacts();
  } catch (err) {
    document.getElementById('contacts-tbody').innerHTML = `
      <tr><td colspan="6" class="px-5 py-10 text-center text-red-400 text-sm">
        ไม่สามารถโหลดข้อมูลได้
      </td></tr>`;
  }
}

function setContactsLoading(show) {
  if (!show) return;
  document.getElementById('contacts-tbody').innerHTML = `
    <tr>
      <td colspan="6" class="px-5 py-12 text-center">
        <div class="flex flex-col items-center gap-3">
          <div class="w-6 h-6 spinner rounded-full border-2 border-gray-700 border-t-indigo-400"></div>
          <span class="text-sm text-gray-500">กำลังโหลดข้อมูล...</span>
        </div>
      </td>
    </tr>`;
}

// debouncedFilter — เรียกจาก oninput ใน search box (300ms debounce)
function debouncedFilter() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(filterContacts, 300);

  // แสดง/ซ่อนปุ่ม clear บน search input
  const val = document.getElementById('search-input').value;
  document.getElementById('search-clear').classList.toggle('hidden', !val);
}

// filterContacts — กรองตาม status + keyword (ซ้อนกันได้)
function filterContacts() {
  const status = document.getElementById('filter-status').value;
  const search = document.getElementById('search-input').value.trim();
  const kw     = search.toLowerCase();

  let filtered = allContacts;

  if (status) {
    filtered = filtered.filter(c => c.status === status);
  }
  if (kw) {
    filtered = filtered.filter(c =>
      (c.name    || '').toLowerCase().includes(kw) ||
      (c.company || '').toLowerCase().includes(kw) ||
      (c.email   || '').toLowerCase().includes(kw) ||
      (c.phone   || '').toLowerCase().includes(kw)
    );
  }

  // อัพเดต count label
  const total    = allContacts.length;
  const shown    = filtered.length;
  const isFiltered = status || kw;
  document.getElementById('contacts-count').textContent = isFiltered
    ? `แสดง ${shown} จาก ${total} รายการ`
    : `${total} รายการ`;

  // แสดง/ซ่อนปุ่ม "ล้าง filter"
  document.getElementById('clear-filter-btn').classList.toggle('hidden', !isFiltered);

  renderContacts(filtered, kw); // ส่ง keyword เพื่อ highlight
}

// clearSearch — ล้างเฉพาะ search input
function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-clear').classList.add('hidden');
  filterContacts();
}

// clearAllFilters — ล้าง status + search พร้อมกัน
function clearAllFilters() {
  document.getElementById('filter-status').value = '';
  document.getElementById('search-input').value  = '';
  document.getElementById('search-clear').classList.add('hidden');
  filterContacts();
}

// ================================================================
// HIGHLIGHT HELPER
// ================================================================
// highlight(text, kw) — ห่อส่วนที่ match ด้วย <mark class="hl">
function highlight(text, kw) {
  if (!kw || !text) return escHtml(text || '');
  const safe  = escHtml(text);
  const safeK = escHtml(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(safeK, 'gi'), m => `<mark class="hl">${m}</mark>`);
}

// ================================================================
// RENDER TABLE
// ================================================================
function renderContacts(contacts, kw = '') {
  const tbody = document.getElementById('contacts-tbody');

  if (!contacts.length) {
    const isSearch = document.getElementById('search-input').value.trim() ||
                     document.getElementById('filter-status').value;
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-5 py-16 text-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
              <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-500 font-medium">
              ${isSearch ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มี contacts'}
            </p>
            ${isSearch
              ? `<button onclick="clearAllFilters()"
                   class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                   ล้าง filter
                 </button>`
              : `<p class="text-xs text-gray-600">กดปุ่ม + เพิ่ม Contact เพื่อเริ่มต้น</p>`
            }
          </div>
        </td>
      </tr>`;
    return;
  }

  const avatarColors = ['bg-indigo-700','bg-blue-700','bg-purple-700','bg-teal-700','bg-rose-700'];
  tbody.innerHTML = contacts.map((c, i) => {
    const cfg       = STATUS_CONFIG[c.status] || STATUS_CONFIG.inactive;
    const initials  = (c.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatarCls = avatarColors[i % avatarColors.length];

    // highlight fields ที่ค้นหาได้
    const hlName    = highlight(c.name,    kw);
    const hlCompany = highlight(c.company, kw);
    const hlEmail   = highlight(c.email,   kw);
    const hlPhone   = highlight(c.phone,   kw);

    return `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors group">
        <td class="px-5 py-3.5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full ${avatarCls} flex items-center justify-center
                        text-xs font-bold text-white flex-shrink-0">
              ${escHtml(initials)}
            </div>
            <div>
              <div class="text-sm font-medium text-gray-200">${hlName}</div>
              ${c.tags ? `<div class="text-xs text-gray-600 mt-0.5">${escHtml(c.tags)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="px-5 py-3.5 text-sm text-gray-400">
          ${c.company ? hlCompany : '<span class="text-gray-600">—</span>'}
        </td>
        <td class="px-5 py-3.5 text-sm text-gray-400 hidden md:table-cell">
          <a href="mailto:${escHtml(c.email)}"
            class="hover:text-indigo-400 transition-colors">${hlEmail}</a>
        </td>
        <td class="px-5 py-3.5 text-sm text-gray-500 hidden lg:table-cell">
          ${c.phone ? hlPhone : '<span class="text-gray-600">—</span>'}
        </td>
        <td class="px-5 py-3.5">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}">
            ${cfg.label}
          </span>
        </td>
        <td class="px-5 py-3.5">
          <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="openEditModal(${c.id})"
              class="p-1.5 rounded-lg text-gray-500 hover:text-indigo-400 hover:bg-gray-800 transition-colors"
              title="แก้ไข">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
              </svg>
            </button>
            <button onclick="deleteContact(${c.id}, '${escHtml(c.name)}')"
              class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
              title="ลบ">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ================================================================
// MODAL — open / close / fill helpers
// ================================================================
function _openModal(contact = null) {
  const isEdit = !!contact;
  document.getElementById('modal-title').textContent       = isEdit ? 'แก้ไข Contact' : 'เพิ่ม Contact';
  document.getElementById('modal-submit-text').textContent = isEdit ? 'บันทึกการแก้ไข' : 'บันทึก';

  document.getElementById('modal-id').value      = contact?.id      || '';
  document.getElementById('modal-name').value    = contact?.name    || '';
  document.getElementById('modal-email').value   = contact?.email   || '';
  document.getElementById('modal-phone').value   = contact?.phone   || '';
  document.getElementById('modal-company').value = contact?.company || '';
  document.getElementById('modal-status').value  = contact?.status  || 'lead';
  document.getElementById('modal-tags').value    = contact?.tags    || '';
  document.getElementById('modal-notes').value   = contact?.notes   || '';

  // reset field errors
  clearAllFieldErrors();

  const modal = document.getElementById('contact-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => document.getElementById('modal-name').focus(), 50);
}

// openAddModal — เปิด modal ว่าง (mode: Add)
function openAddModal() {
  _openModal(null);
}

// openEditModal — fetch contact by id แล้วเปิด modal พร้อม pre-fill (mode: Edit)
async function openEditModal(id) {
  // เปิด modal ก่อนพร้อม loading state
  _openModal(null);
  document.getElementById('modal-title').textContent = 'กำลังโหลด...';
  document.getElementById('modal-submit').disabled   = true;

  try {
    const res     = await fetch(`/api/contacts/${id}`);
    const contact = await res.json();
    if (!res.ok) throw new Error(contact.error);
    _openModal(contact);
  } catch (err) {
    closeContactModal();
    showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
  }
}

function closeContactModal() {
  document.getElementById('contact-modal').classList.add('hidden');
  document.getElementById('contact-modal').classList.remove('flex');
}

// ================================================================
// FORM VALIDATION — per-field errors
// ================================================================
function setFieldError(field, msg) {
  const input = document.getElementById('modal-' + field);
  const err   = document.getElementById('err-' + field);
  if (!input || !err) return;
  input.classList.add('border-red-500', 'focus:ring-red-500');
  input.classList.remove('border-gray-700', 'focus:ring-indigo-500');
  err.textContent = msg;
  err.classList.remove('hidden');
}

function clearFieldError(field) {
  const input = document.getElementById('modal-' + field);
  const err   = document.getElementById('err-' + field);
  if (!input || !err) return;
  input.classList.remove('border-red-500', 'focus:ring-red-500');
  input.classList.add('border-gray-700', 'focus:ring-indigo-500');
  err.classList.add('hidden');
}

function clearAllFieldErrors() {
  ['name', 'email'].forEach(clearFieldError);
}

function validateForm(name, email) {
  let valid = true;
  if (!name) {
    setFieldError('name', 'กรุณากรอกชื่อ-นามสกุล');
    valid = false;
  }
  if (!email) {
    setFieldError('email', 'กรุณากรอกอีเมล');
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError('email', 'รูปแบบอีเมลไม่ถูกต้อง');
    valid = false;
  }
  return valid;
}

// ================================================================
// saveContact — POST (add) หรือ PUT (edit) ตาม modal-id
// ================================================================
async function saveContact(e) {
  e.preventDefault();

  const id    = document.getElementById('modal-id').value;
  const name  = document.getElementById('modal-name').value.trim();
  const email = document.getElementById('modal-email').value.trim();

  // client-side validation
  clearAllFieldErrors();
  if (!validateForm(name, email)) return;

  const body = {
    name,
    email,
    phone:   document.getElementById('modal-phone').value.trim()   || null,
    company: document.getElementById('modal-company').value.trim() || null,
    status:  document.getElementById('modal-status').value,
    tags:    document.getElementById('modal-tags').value.trim()    || null,
    notes:   document.getElementById('modal-notes').value.trim()   || null,
  };

  // loading state
  const btn     = document.getElementById('modal-submit');
  const spinner = document.getElementById('modal-spinner');
  const btnText = document.getElementById('modal-submit-text');
  btn.disabled           = true;
  spinner.classList.remove('hidden');
  btnText.textContent    = 'กำลังบันทึก...';

  try {
    const url    = id ? `/api/contacts/${id}` : '/api/contacts';
    const method = id ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      // server-side error → แสดงใต้ field ที่เกี่ยวข้อง
      if (data.error?.toLowerCase().includes('email')) {
        setFieldError('email', data.error);
      } else {
        setFieldError('name', data.error || 'เกิดข้อผิดพลาด');
      }
      return;
    }

    closeContactModal();
    showToast(id ? 'แก้ไข Contact สำเร็จ ✓' : 'เพิ่ม Contact สำเร็จ ✓');
    await loadContacts();
    loadStats(); // refresh stat cards
  } catch {
    setFieldError('name', 'ไม่สามารถเชื่อมต่อ server');
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = id ? 'บันทึกการแก้ไข' : 'บันทึก';
  }
}

// ================================================================
// deleteContact — confirm dialog → DELETE /api/contacts/:id
// ================================================================
function deleteContact(id, name) {
  document.getElementById('delete-msg').textContent = `ต้องการลบ "${name}" หรือไม่?`;

  const modal = document.getElementById('delete-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // กำหนด handler ทุกครั้งที่เปิด dialog (ป้องกัน id ค้างจากครั้งก่อน)
  document.getElementById('delete-confirm-btn').onclick = async () => {
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      closeDeleteModal();
      showToast('ลบ Contact แล้ว', 'info');
      await loadContacts();
      loadStats();
    } catch {
      closeDeleteModal();
      showToast('ลบไม่สำเร็จ', 'error');
    }
  };
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  document.getElementById('delete-modal').classList.remove('flex');
}

// ================================================================
// DEALS — Kanban Board
// ================================================================

// Stage config: label, header color, card accent
const STAGES = [
  { key: 'new',         label: 'New',         color: '#818cf8', ring: 'border-indigo-700/50',  dot: 'bg-indigo-400' },
  { key: 'contacted',   label: 'Contacted',   color: '#60a5fa', ring: 'border-blue-700/50',    dot: 'bg-blue-400' },
  { key: 'proposal',    label: 'Proposal',    color: '#a78bfa', ring: 'border-purple-700/50',  dot: 'bg-purple-400' },
  { key: 'negotiation', label: 'Negotiation', color: '#f59e0b', ring: 'border-yellow-700/50',  dot: 'bg-yellow-400' },
  { key: 'won',         label: 'Won',         color: '#34d399', ring: 'border-green-700/50',   dot: 'bg-green-400' },
  { key: 'lost',        label: 'Lost',        color: '#f87171', ring: 'border-red-700/50',     dot: 'bg-red-400' },
];

// loadDeals — fetch deals + render kanban + update summary bar
async function loadDeals() {
  try {
    const res   = await fetch('/api/deals');
    const deals = await res.json();
    renderKanban(deals);
    renderDealSummary(deals);
  } catch (err) {
    document.getElementById('kanban-board').innerHTML =
      `<p class="text-red-400 text-sm py-10 px-4">ไม่สามารถโหลด deals ได้</p>`;
  }
}

// renderDealSummary — summary bar 3 cards
function renderDealSummary(deals) {
  const total    = deals.reduce((s, d) => s + parseFloat(d.value || 0), 0);
  const wonDeals = deals.filter(d => d.stage === 'won');
  const wonVal   = wonDeals.reduce((s, d) => s + parseFloat(d.value || 0), 0);
  const closed   = deals.filter(d => d.stage === 'won' || d.stage === 'lost').length;
  const winRate  = closed ? Math.round((wonDeals.length / closed) * 100) : 0;

  document.getElementById('deal-total-value').textContent = '฿' + total.toLocaleString('th-TH');
  document.getElementById('deal-won-value').textContent   =
    `฿${wonVal.toLocaleString('th-TH')} (${wonDeals.length})`;
  document.getElementById('deal-win-rate').textContent    = `${winRate}%`;
}

// renderKanban — สร้าง 6 columns
function renderKanban(deals) {
  const board = document.getElementById('kanban-board');

  // จัดกลุ่ม deals ตาม stage
  const grouped = {};
  STAGES.forEach(s => { grouped[s.key] = []; });
  deals.forEach(d => {
    if (grouped[d.stage] !== undefined) grouped[d.stage].push(d);
  });

  board.innerHTML = STAGES.map(stage => {
    const cards     = grouped[stage.key];
    const count     = cards.length;
    const stageVal  = cards.reduce((s, d) => s + parseFloat(d.value || 0), 0);

    return `
      <div class="flex flex-col w-64 flex-shrink-0">

        <!-- Column Header -->
        <div class="flex items-center justify-between mb-3 px-1">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${stage.dot}"></span>
            <span class="text-xs font-semibold text-gray-300 uppercase tracking-wide">${stage.label}</span>
            <span class="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">${count}</span>
          </div>
          <span class="text-xs text-gray-600">฿${stageVal.toLocaleString('th-TH')}</span>
        </div>

        <!-- Colored top-bar -->
        <div class="h-0.5 rounded-full mb-3" style="background:${stage.color};opacity:0.5"></div>

        <!-- Deal Cards -->
        <div class="flex flex-col gap-2 min-h-[80px]">
          ${count === 0
            ? `<div class="border-2 border-dashed border-gray-800 rounded-xl h-20
                          flex items-center justify-center">
                 <span class="text-xs text-gray-700">ไม่มี deals</span>
               </div>`
            : cards.map(d => dealCard(d, stage)).join('')
          }
        </div>

        <!-- Add card shortcut -->
        <button onclick="openAddDealModal('${stage.key}')"
          class="mt-3 w-full text-xs text-gray-600 hover:text-gray-400 hover:bg-gray-800/50
                 py-2 rounded-lg border border-transparent hover:border-gray-800 transition-all flex items-center justify-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          เพิ่ม
        </button>

      </div>`;
  }).join('');
}

// dealCard — render deal card HTML
function dealCard(d, stage) {
  const fmtVal    = parseFloat(d.value || 0).toLocaleString('th-TH');
  const closeDate = d.close_date
    ? new Date(d.close_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
    : null;

  // วันปิดเลย = แดง, ใกล้เลย (≤7 วัน) = เหลือง
  let dateCls = 'text-gray-600';
  if (d.close_date) {
    const diff = (new Date(d.close_date) - new Date()) / 86400000;
    if (diff < 0)  dateCls = 'text-red-400';
    else if (diff <= 7) dateCls = 'text-yellow-400';
  }

  // Stage change quick-select options (ยกเว้น stage ปัจจุบัน)
  const stageOptions = STAGES
    .filter(s => s.key !== d.stage)
    .map(s => `<option value="${s.key}">${s.label}</option>`)
    .join('');

  return `
    <div class="bg-gray-800/60 border ${stage.ring} rounded-xl p-3 hover:bg-gray-800
                hover:border-gray-600 transition-all group cursor-pointer"
         onclick="openEditDealModal(${d.id})">

      <!-- Title -->
      <div class="text-xs font-semibold text-gray-200 mb-2 leading-snug line-clamp-2">
        ${escHtml(d.title)}
      </div>

      <!-- Contact -->
      ${d.contact_name ? `
        <div class="flex items-center gap-1.5 mb-2">
          <svg class="w-3 h-3 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          <span class="text-xs text-gray-500 truncate">${escHtml(d.contact_name)}</span>
        </div>` : ''}

      <!-- Value + Close date -->
      <div class="flex items-center justify-between mt-2">
        <span class="text-xs font-bold" style="color:${stage.color}">
          ฿${fmtVal}
        </span>
        ${closeDate
          ? `<span class="text-xs ${dateCls}">${closeDate}</span>`
          : ''}
      </div>

      <!-- Quick stage change + actions (show on hover) -->
      <div class="mt-2.5 pt-2.5 border-t border-gray-700/50
                  opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5"
           onclick="event.stopPropagation()">
        <select onchange="changeStage(${d.id}, this.value); this.value='';"
          class="flex-1 bg-gray-900 border border-gray-700 text-gray-400 text-xs rounded-lg
                 px-1.5 py-1 focus:outline-none cursor-pointer">
          <option value="" disabled selected>ย้าย stage...</option>
          ${stageOptions}
        </select>
        <button onclick="deleteDeal(${d.id}, '${escHtml(d.title)}')"
          class="p-1 rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-700 transition-colors"
          title="ลบ">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>

    </div>`;
}

// ================================================================
// DEAL MODAL
// ================================================================
async function _openDealModal(deal = null, defaultStage = 'new') {
  const isEdit = !!deal;
  document.getElementById('deal-modal-title').textContent       = isEdit ? 'แก้ไข Deal' : 'New Deal';
  document.getElementById('deal-modal-submit-text').textContent = isEdit ? 'บันทึกการแก้ไข' : 'บันทึก';

  document.getElementById('deal-modal-id').value  = deal?.id         || '';
  document.getElementById('deal-title').value     = deal?.title      || '';
  document.getElementById('deal-value').value     = deal?.value      || '';
  document.getElementById('deal-stage').value     = deal?.stage      || defaultStage;
  document.getElementById('deal-close-date').value = deal?.close_date
    ? deal.close_date.split('T')[0] : '';
  document.getElementById('deal-notes').value     = deal?.notes      || '';

  // Clear errors
  clearDealFieldError('title');

  // โหลด contacts dropdown
  await populateDealContactDropdown(deal?.contact_id || null);

  const modal = document.getElementById('deal-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => document.getElementById('deal-title').focus(), 50);
}

// โหลด contacts เข้า dropdown
async function populateDealContactDropdown(selectedId = null) {
  const sel = document.getElementById('deal-contact');
  sel.innerHTML = '<option value="">— ไม่ระบุ —</option>';
  try {
    const res      = await fetch('/api/contacts');
    const contacts = await res.json();
    contacts.forEach(c => {
      const opt      = document.createElement('option');
      opt.value      = c.id;
      opt.textContent = `${c.name}${c.company ? ` (${c.company})` : ''}`;
      if (selectedId && c.id == selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  } catch { /* ใช้ "ไม่ระบุ" ไปก่อน */ }
}

// openAddDealModal — เปิด modal ว่าง, optional defaultStage
function openAddDealModal(defaultStage = 'new') {
  _openDealModal(null, defaultStage);
}

// openEditDealModal — fetch deal by id แล้วเปิด modal
async function openEditDealModal(id) {
  _openDealModal(null, 'new'); // เปิดก่อนให้ responsive
  document.getElementById('deal-modal-title').textContent = 'กำลังโหลด...';
  document.getElementById('deal-modal-submit').disabled   = true;
  try {
    const res  = await fetch(`/api/deals/${id}`);
    const deal = await res.json();
    if (!res.ok) throw new Error(deal.error);
    document.getElementById('deal-modal-submit').disabled = false;
    await _openDealModal(deal);
  } catch {
    closeDealModal();
    showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
  }
}

function closeDealModal() {
  document.getElementById('deal-modal').classList.add('hidden');
  document.getElementById('deal-modal').classList.remove('flex');
}

// ================================================================
// DEAL FIELD VALIDATION
// ================================================================
function clearDealFieldError(field) {
  const input = document.getElementById('deal-' + field);
  const err   = document.getElementById('deal-err-' + field);
  if (!input || !err) return;
  input.classList.remove('border-red-500');
  input.classList.add('border-gray-700');
  err.classList.add('hidden');
}

function setDealFieldError(field, msg) {
  const input = document.getElementById('deal-' + field);
  const err   = document.getElementById('deal-err-' + field);
  if (!input || !err) return;
  input.classList.add('border-red-500');
  input.classList.remove('border-gray-700');
  err.textContent = msg;
  err.classList.remove('hidden');
}

// ================================================================
// saveDeal — POST (add) หรือ PUT (edit)
// ================================================================
async function saveDeal(e) {
  e.preventDefault();
  const id    = document.getElementById('deal-modal-id').value;
  const title = document.getElementById('deal-title').value.trim();

  clearDealFieldError('title');
  if (!title) { setDealFieldError('title', 'กรุณากรอกชื่อ Deal'); return; }

  const body = {
    title,
    contact_id: document.getElementById('deal-contact').value    || null,
    value:      parseFloat(document.getElementById('deal-value').value) || 0,
    stage:      document.getElementById('deal-stage').value,
    close_date: document.getElementById('deal-close-date').value || null,
    notes:      document.getElementById('deal-notes').value.trim() || null,
  };

  // loading state
  const btn     = document.getElementById('deal-modal-submit');
  const spinner = document.getElementById('deal-modal-spinner');
  const btnText = document.getElementById('deal-modal-submit-text');
  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'กำลังบันทึก...';

  try {
    const url    = id ? `/api/deals/${id}` : '/api/deals';
    const method = id ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setDealFieldError('title', data.error || 'เกิดข้อผิดพลาด'); return; }

    closeDealModal();
    showToast(id ? 'แก้ไข Deal สำเร็จ ✓' : 'เพิ่ม Deal สำเร็จ ✓');
    await loadDeals();
    loadPipeline(); // refresh dashboard pipeline bar
  } catch {
    setDealFieldError('title', 'ไม่สามารถเชื่อมต่อ server');
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = id ? 'บันทึกการแก้ไข' : 'บันทึก';
  }
}

// ================================================================
// changeStage — PATCH stage จาก quick-select บน card
// ================================================================
async function changeStage(id, newStage) {
  try {
    // ดึงข้อมูลเดิมก่อนแล้ว PUT ทั้งก้อน
    const getRes = await fetch(`/api/deals/${id}`);
    const deal   = await getRes.json();
    const body   = { ...deal, stage: newStage, contact_id: deal.contact_id || null };
    const res    = await fetch(`/api/deals/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    showToast(`ย้ายไป ${newStage} แล้ว`, 'info');
    await loadDeals();
    loadPipeline();
  } catch {
    showToast('ย้าย stage ไม่สำเร็จ', 'error');
  }
}

// ================================================================
// deleteDeal — confirm → DELETE
// ================================================================
function deleteDeal(id, title) {
  document.getElementById('delete-msg').textContent = `ต้องการลบ deal "${title}" หรือไม่?`;
  const modal = document.getElementById('delete-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('delete-confirm-btn').onclick = async () => {
    try {
      await fetch(`/api/deals/${id}`, { method: 'DELETE' });
      closeDeleteModal();
      showToast('ลบ Deal แล้ว', 'info');
      await loadDeals();
      loadPipeline();
    } catch {
      closeDeleteModal();
      showToast('ลบไม่สำเร็จ', 'error');
    }
  };
}

// ================================================================
// UTILITIES
// ================================================================
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// backdrop click ปิด modal
document.getElementById('contact-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeContactModal();
});
document.getElementById('deal-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDealModal();
});
document.getElementById('delete-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDeleteModal();
});

// Escape key ปิด modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeContactModal(); closeDealModal(); closeDeleteModal(); }
});

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('th-TH', { dateStyle: 'long' });
  loadDashboard();
});
