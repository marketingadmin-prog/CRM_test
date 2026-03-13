// db.js — PostgreSQL connection สำหรับ Railway
// อ่าน DATABASE_URL จาก environment variable (Railway inject ให้อัตโนมัติ)
require('dotenv').config();
const { Pool } = require('pg');

// ===== Connection Pool =====
// ใช้ DATABASE_URL เดียว (Railway format: postgresql://user:pass@host:port/db)
// ssl.rejectUnauthorized: false — จำเป็นสำหรับ Railway (ใช้ self-signed cert)
// เปิด SSL เฉพาะเมื่อเชื่อมต่อ remote (Railway) — ถ้าเป็น localhost ไม่ใช้ SSL
const isRemote = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

// ===== initDB — สร้างตารางทั้งหมด (IF NOT EXISTS) =====
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100)  NOT NULL,
      company    VARCHAR(100),
      email      VARCHAR(100),
      phone      VARCHAR(20),
      status     VARCHAR(20)   NOT NULL DEFAULT 'lead'
                 CHECK (status IN ('lead','prospect','customer','inactive')),
      tags       TEXT,
      notes      TEXT,
      created_at TIMESTAMP     NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP     NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deals (
      id         SERIAL PRIMARY KEY,
      contact_id INTEGER       REFERENCES contacts(id) ON DELETE SET NULL,
      title      VARCHAR(200)  NOT NULL,
      value      DECIMAL(10,2) NOT NULL DEFAULT 0,
      stage      VARCHAR(30)   NOT NULL DEFAULT 'new'
                 CHECK (stage IN ('new','contacted','proposal','negotiation','won','lost')),
      close_date DATE,
      notes      TEXT,
      created_at TIMESTAMP     NOT NULL DEFAULT NOW()
    );
  `);

  console.log('✅ Tables ready (contacts, deals)');
}

// ===== seedData — ข้อมูลตัวอย่าง 10 contacts + 5 deals =====
// ใส่เฉพาะตอนที่ตารางว่างเปล่า เพื่อไม่ duplicate เมื่อ restart
async function seedData() {
  // นับ rows ใน contacts ก่อน
  const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM contacts');
  if (parseInt(rows[0].cnt) > 0) {
    console.log('ℹ️  Seed skipped — data already exists');
    return;
  }

  // ---- 10 Contacts ----
  const contacts = await pool.query(`
    INSERT INTO contacts (name, company, email, phone, status, tags, notes)
    VALUES
      ('สมชาย ใจดี',      'ABC Corporation',  'somchai@abc.co.th',    '081-111-1111', 'customer',  'enterprise,vip',    'ลูกค้าหลักมา 3 ปี'),
      ('สมหญิง รักงาน',   'XYZ Solutions',    'somying@xyz.co.th',    '082-222-2222', 'prospect',  'smb',               'สนใจแพ็กเกจ Pro'),
      ('วิชัย ทำงานดี',   'Tech Startup Co.', 'wichai@techstart.io',  '083-333-3333', 'lead',      'startup,tech',      'เจอใน TechMeet 2024'),
      ('มาลี สวยงาม',     'Retail Plus',      'malee@retailplus.com', '084-444-4444', 'customer',  'retail',            'ซื้อแพ็กเกจ Basic'),
      ('ประสิทธิ์ เก่งมาก','Global Trade Ltd', 'prasit@global.co.th', '085-555-5555', 'prospect',  'enterprise',        'รอ proposal'),
      ('นภา แสงดาว',      'Creative Agency',  'napa@creative.co.th',  '086-666-6666', 'lead',      'agency,design',     'referral จากสมชาย'),
      ('อนุชา มั่นคง',    'Finance Group',    'anucha@fingrp.co.th',  '087-777-7777', 'inactive',  'finance',           'หยุด subscription'),
      ('รัตนา ดีเด่น',    'EduTech Thailand', 'ratana@edutech.co.th', '088-888-8888', 'customer',  'education,tech',    'ต่อสัญญาแล้ว'),
      ('ธนกร ใหม่มาก',    'Logistics Pro',    'thanakorn@logpro.com', '089-999-9999', 'prospect',  'logistics',         'นัด demo สัปดาห์หน้า'),
      ('ชลิตา สดใส',      'Health & Beauty',  'chalita@hnb.co.th',    '090-000-0000', 'lead',      'beauty,retail',     'ดาวน์โหลด brochure')
    RETURNING id
  `);

  // map index → contact id จริงในฐานข้อมูล
  const ids = contacts.rows.map(r => r.id);

  // ---- 5 Deals ----
  await pool.query(`
    INSERT INTO deals (contact_id, title, value, stage, close_date, notes)
    VALUES
      ($1, 'Enterprise License — ABC Corp',      850000, 'negotiation', '2024-03-31', 'รอ approve จาก CFO'),
      ($2, 'Pro Package Upgrade — XYZ',          120000, 'proposal',    '2024-02-28', 'ส่ง proposal ไปแล้ว'),
      ($3, 'Startup Plan — Tech Startup Co.',     35000, 'contacted',   '2024-02-15', 'นัด demo'),
      ($4, 'Basic Renewal — Retail Plus',         24000, 'won',         '2024-01-31', 'ปิดดีล ชำระแล้ว'),
      ($5, 'Global Trade Integration Package',   540000, 'new',         '2024-04-30', 'ยังไม่ได้ติดต่อกลับ')
  `, [ids[0], ids[1], ids[2], ids[3], ids[4]]);

  console.log('🌱 Seed data inserted (10 contacts, 5 deals)');
}

// ===== init — เรียกจาก server.js ตอน startup =====
async function init() {
  try {
    // ทดสอบ connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    client.release();

    await initDB();
    await seedData();
  } catch (err) {
    console.error('❌ Database init failed:', err.message);
    process.exit(1); // หยุด server ถ้า DB ไม่พร้อม
  }
}

// export pool (ให้ routes ใช้) และ init function
module.exports = { pool, init };
