// routes/contacts.js — Contacts REST API
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ----------------------------------------------------------------
// GET /api/contacts
// Query params: ?search=keyword  ?status=lead|prospect|customer|inactive
// ----------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    const params = [];
    const where  = [];

    // ?search= — ค้นหาใน name, email, company (case-insensitive)
    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length}
                  OR email ILIKE $${params.length}
                  OR company ILIKE $${params.length})`);
    }

    // ?status= — กรองตาม status
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const sql = `
      SELECT * FROM contacts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY name ASC
    `;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /contacts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// ----------------------------------------------------------------
// GET /api/contacts/stats
// คืน: [ { status, count } ] — สรุปจำนวนแต่ละ status
// หมายเหตุ: route นี้ต้องอยู่ก่อน /:id ไม่งั้น 'stats' จะถูกแปลเป็น id
// ----------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        status,
        COUNT(*)::INT AS count
      FROM contacts
      GROUP BY status
      ORDER BY status
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /contacts/stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ----------------------------------------------------------------
// GET /api/contacts/export
// ดึง contacts + deal count แปลงเป็น CSV พร้อม BOM สำหรับ Excel
// หมายเหตุ: ต้องอยู่ก่อน /:id
// ----------------------------------------------------------------
router.get('/export', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.company,
        c.email,
        c.phone,
        c.status,
        c.tags,
        c.notes,
        COUNT(d.id)::INT           AS deal_count,
        COALESCE(SUM(d.value), 0)  AS deal_total,
        TO_CHAR(c.created_at, 'YYYY-MM-DD') AS created_date
      FROM contacts c
      LEFT JOIN deals d ON d.contact_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);

    // CSV header
    const headers = [
      'ID', 'ชื่อ', 'บริษัท', 'อีเมล', 'เบอร์โทร',
      'สถานะ', 'Tags', 'Notes', 'จำนวน Deals', 'มูลค่า Deals', 'วันที่เพิ่ม'
    ];

    // helper: escape CSV field (ห่อ " ถ้ามี comma/newline/quote)
    const csvField = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = result.rows.map(r => [
      r.id, r.name, r.company, r.email, r.phone,
      r.status, r.tags, r.notes, r.deal_count, r.deal_total, r.created_date
    ].map(csvField).join(','));

    // BOM (\uFEFF) ทำให้ Excel (Windows/Mac) อ่านภาษาไทยได้ถูกต้อง
    const csv  = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contacts-${date}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('GET /contacts/export error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ----------------------------------------------------------------
// GET /api/contacts/:id
// ----------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /contacts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// ----------------------------------------------------------------
// POST /api/contacts
// Body: { name*, email*, company, phone, status, tags, notes }
// ----------------------------------------------------------------
router.post('/', async (req, res) => {
  const { name, email, company, phone, status, tags, notes } = req.body;

  // Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contacts (name, email, company, phone, status, tags, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name.trim(),
        email.trim(),
        company || null,
        phone   || null,
        status  || 'lead',
        tags    || null,
        notes   || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // duplicate email
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('POST /contacts error:', err.message);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// ----------------------------------------------------------------
// PUT /api/contacts/:id
// Body: { name*, email*, company, phone, status, tags, notes }
// updated_at auto-update ด้วย NOW()
// ----------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const { name, email, company, phone, status, tags, notes } = req.body;

  // Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE contacts
       SET name=$1, email=$2, company=$3, phone=$4,
           status=$5, tags=$6, notes=$7, updated_at=NOW()
       WHERE id=$8
       RETURNING *`,
      [
        name.trim(),
        email.trim(),
        company || null,
        phone   || null,
        status  || 'lead',
        tags    || null,
        notes   || null,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('PUT /contacts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// ----------------------------------------------------------------
// DELETE /api/contacts/:id
// ----------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM contacts WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ message: 'Contact deleted', id: Number(req.params.id) });
  } catch (err) {
    console.error('DELETE /contacts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
