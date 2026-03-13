// server.js — Entry point ของแอปพลิเคชัน
// ตั้งค่า Express server, middleware, routes, และ static files
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { init }       = require('./db');         // init DB ก่อน start server
const contactsRouter = require('./routes/contacts');
const dealsRouter    = require('./routes/deals');

const app  = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());                      // อนุญาต cross-origin requests
app.use(express.json());              // parse JSON body
app.use(express.urlencoded({ extended: true })); // parse form data

// --- Static Files ---
// serve ทุกไฟล์ใน /public (index.html, app.js, CSS ฯลฯ)
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
app.use('/api/contacts', contactsRouter); // จัดการ contacts CRUD
app.use('/api/deals',    dealsRouter);    // จัดการ deals CRUD

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Fallback: ส่ง index.html สำหรับทุก route ที่ไม่ใช่ API ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server (รอ DB พร้อมก่อน) ---
init().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 CRM Server running at http://localhost:${PORT}`);
  });
});
