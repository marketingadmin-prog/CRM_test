// routes/deals.js — Deals REST API
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ----------------------------------------------------------------
// GET /api/deals
// JOIN contacts เพื่อเอาชื่อมาด้วย, เรียงล่าสุดก่อน
// ----------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.*,
        c.name    AS contact_name,
        c.company AS contact_company
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /deals error:', err.message);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// ----------------------------------------------------------------
// GET /api/deals/pipeline
// คืน: [ { stage, count, total_value } ] — สรุปมูลค่าแต่ละ stage
// หมายเหตุ: ต้องอยู่ก่อน /:id ไม่งั้น 'pipeline' จะถูกแปลเป็น id
// ----------------------------------------------------------------
router.get('/pipeline', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        stage,
        COUNT(*)::INT            AS count,
        COALESCE(SUM(value), 0)  AS total_value
      FROM deals
      GROUP BY stage
      ORDER BY
        CASE stage
          WHEN 'new'         THEN 1
          WHEN 'contacted'   THEN 2
          WHEN 'proposal'    THEN 3
          WHEN 'negotiation' THEN 4
          WHEN 'won'         THEN 5
          WHEN 'lost'        THEN 6
          ELSE 7
        END
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /deals/pipeline error:', err.message);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// ----------------------------------------------------------------
// POST /api/deals
// Body: { title*, contact_id, value, stage, close_date, notes }
// ----------------------------------------------------------------
router.post('/', async (req, res) => {
  const { title, contact_id, value, stage, close_date, notes } = req.body;

  // Validation
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO deals (title, contact_id, value, stage, close_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title.trim(),
        contact_id  || null,
        value       || 0,
        stage       || 'new',
        close_date  || null,
        notes       || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // foreign key violation (contact_id ไม่มีอยู่)
    if (err.code === '23503') {
      return res.status(400).json({ error: 'contact_id does not exist' });
    }
    console.error('POST /deals error:', err.message);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// ----------------------------------------------------------------
// PUT /api/deals/:id
// Body: { title*, contact_id, value, stage, close_date, notes }
// ----------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const { title, contact_id, value, stage, close_date, notes } = req.body;

  // Validation
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE deals
       SET title=$1, contact_id=$2, value=$3,
           stage=$4, close_date=$5, notes=$6
       WHERE id=$7
       RETURNING *`,
      [
        title.trim(),
        contact_id || null,
        value      || 0,
        stage      || 'new',
        close_date || null,
        notes      || null,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'contact_id does not exist' });
    }
    console.error('PUT /deals/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// ----------------------------------------------------------------
// DELETE /api/deals/:id
// ----------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM deals WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json({ message: 'Deal deleted', id: Number(req.params.id) });
  } catch (err) {
    console.error('DELETE /deals/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

module.exports = router;
