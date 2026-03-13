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

// loadContacts — GET /api/contacts → render ตาราง
async function loadContacts() {
  setContactsLoading(true);
  try {
    const res   = await fetch('/api/contacts');
    allContacts = await res.json();
    filterContacts(); // render ผ่าน filter เพื่อ respect dropdown/search ที่เลือกไว้
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

// filterContacts — กรองตาม status dropdown + search keyword
function filterContacts() {
  const status = document.getElementById('filter-status').value;
  const search = document.getElementById('search-input').value.trim().toLowerCase();

  let filtered = allContacts;
  if (status) {
    filtered = filtered.filter(c => c.status === status);
  }
  if (search) {
    filtered = filtered.filter(c =>
      (c.name    || '').toLowerCase().includes(search) ||
      (c.email   || '').toLowerCase().includes(search) ||
      (c.company || '').toLowerCase().includes(search)
    );
  }
  renderContacts(filtered);
}

function renderContacts(contacts) {
  const tbody = document.getElementById('contacts-tbody');
  document.getElementById('contacts-count').textContent = `${contacts.length} รายการ`;

  if (!contacts.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-5 py-16 text-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
              <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-500 font-medium">ไม่พบข้อมูล</p>
            <p class="text-xs text-gray-600">ลองเปลี่ยน filter หรือเพิ่ม contact ใหม่</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  const avatarColors = ['bg-indigo-700','bg-blue-700','bg-purple-700','bg-teal-700','bg-rose-700'];
  tbody.innerHTML = contacts.map((c, i) => {
    const cfg      = STATUS_CONFIG[c.status] || STATUS_CONFIG.inactive;
    const initials = (c.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatarCls = avatarColors[i % avatarColors.length];
    return `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors group">
        <td class="px-5 py-3.5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full ${avatarCls} flex items-center justify-center
                        text-xs font-bold text-white flex-shrink-0">
              ${escHtml(initials)}
            </div>
            <div>
              <div class="text-sm font-medium text-gray-200">${escHtml(c.name)}</div>
              ${c.tags ? `<div class="text-xs text-gray-600 mt-0.5">${escHtml(c.tags)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="px-5 py-3.5 text-sm text-gray-400">${escHtml(c.company || '—')}</td>
        <td class="px-5 py-3.5 text-sm text-gray-400 hidden md:table-cell">
          <a href="mailto:${escHtml(c.email)}"
            class="hover:text-indigo-400 transition-colors">${escHtml(c.email)}</a>
        </td>
        <td class="px-5 py-3.5 text-sm text-gray-500 hidden lg:table-cell">
          ${escHtml(c.phone || '—')}
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
// DEALS (placeholder)
// ================================================================
async function loadDeals() {
  // implement ใน Prompt ถัดไป
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
document.getElementById('delete-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDeleteModal();
});

// Escape key ปิด modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeContactModal(); closeDeleteModal(); }
});

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('th-TH', { dateStyle: 'long' });
  loadDashboard();
});
