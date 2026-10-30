/**
 * سرور سامانه پرمیت رامک (بدون وابستگی خارجی — فقط Node.js)
 * اجرا: node server.js
 * دسترسی شبکه: http://IP:3780
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');
const db = require('./db');

const PORT = process.env.PORT || 3780;
const PUBLIC = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
  ? path.join(__dirname, 'public')
  : __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(null);
      try { resolve(JSON.parse(raw)); } catch (e) { resolve(raw); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, time: new Date().toISOString(), version: '2.1.0' });
  }

  if (pathname === '/api/data' && req.method === 'GET') {
    return sendJson(res, 200, db.getAll());
  }

  const dataKey = pathname.match(/^\/api\/data\/([^/]+)$/);
  if (dataKey) {
    const key = decodeURIComponent(dataKey[1]);
    if (req.method === 'GET') {
      return sendJson(res, 200, { key, value: db.getKey(key) });
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readBody(req);
      const value = body && Object.prototype.hasOwnProperty.call(body, 'value') ? body.value : body;
      db.setKey(key, value);
      return sendJson(res, 200, { ok: true, key });
    }
  }

  if (pathname === '/api/data/bulk' && req.method === 'POST') {
    const body = await readBody(req);
    db.setMany(body || {});
    return sendJson(res, 200, { ok: true });
  }

  const cContracts = pathname.match(/^\/api\/contractor\/([^/]+)\/contracts$/);
  if (cContracts && req.method === 'GET') {
    return sendJson(res, 200, db.getContractsByMobile(decodeURIComponent(cContracts[1])));
  }

  const cPermits = pathname.match(/^\/api\/contractor\/([^/]+)\/permits$/);
  if (cPermits && req.method === 'GET') {
    const mobile = decodeURIComponent(cPermits[1]);
    const contracts = db.getContractsByMobile(mobile);
    const ids = contracts.map((c) => c.id);
    return sendJson(res, 200, db.getPermitsForContractIds(ids));
  }

  const cPersonnel = pathname.match(/^\/api\/contractor\/([^/]+)\/personnel$/);
  if (cPersonnel && req.method === 'POST') {
    const mobile = decodeURIComponent(cPersonnel[1]);
    const contracts = db.getContractsByMobile(mobile);
    if (!contracts.length) return sendJson(res, 403, { ok: false, error: 'هیچ قرارداد فعالی برای این موبایل نیست' });
    const body = (await readBody(req)) || {};
    const record = {
      id: body.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
      permitId: body.permitId,
      name: body.name,
      code: body.code,
      approved: false,
      entryTime: '',
      exitTime: '',
      mealTaken: false,
      mealEligible: false,
      workDate: body.workDate || '',
      createdAt: body.createdAt || '',
      outOfRange: !!body.outOfRange,
      outOfRangeReason: body.outOfRangeReason || '',
      requestDate: body.requestDate || '',
      byMobile: mobile
    };
    if (!record.permitId || !record.name || !record.code) {
      return sendJson(res, 400, { ok: false, error: 'permitId و name و code الزامی است' });
    }
    db.addPersonnel(record);
    return sendJson(res, 200, { ok: true, record });
  }

  const cReport = pathname.match(/^\/api\/contractor\/([^/]+)\/report$/);
  if (cReport && req.method === 'POST') {
    const mobile = decodeURIComponent(cReport[1]);
    const body = (await readBody(req)) || {};
    if (!body.permitId || !body.desc) {
      return sendJson(res, 400, { ok: false, error: 'permitId و desc الزامی است' });
    }
    const record = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      permitId: body.permitId,
      contractId: body.contractId || '',
      desc: body.desc,
      date: body.date || '',
      author: mobile
    };
    db.addContractorReport(record);
    return sendJson(res, 200, { ok: true, record });
  }

  const cPermitReq = pathname.match(/^\/api\/contractor\/([^/]+)\/permit-request$/);
  if (cPermitReq && req.method === 'POST') {
    const mobile = decodeURIComponent(cPermitReq[1]);
    const contracts = db.getContractsByMobile(mobile);
    if (!contracts.length) return sendJson(res, 403, { ok: false, error: 'قرارداد فعالی یافت نشد' });
    const body = (await readBody(req)) || {};
    const contract = contracts.find((c) => c.id === body.contractId) || contracts[0];
    const permit = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      contractId: contract.id,
      status: 'submitted',
      site: body.site || contract.site || '',
      locationDetail: body.locationDetail || contract.location || '',
      startDate: body.startDate || '',
      endDate: body.endDate || '',
      peopleCount: body.peopleCount || 1,
      activities: body.activities || [],
      hseEquipments: body.hseEquipments || [],
      isProductionLine: !!body.isProductionLine,
      description: body.description || '',
      createdAt: body.createdAt || '',
      signatures: {},
      stageNotes: {},
      unitNotes: [],
      contractorSignature: {
        name: contract.contractor || 'پیمانکار',
        date: body.createdAt || '',
        via: 'bale'
      }
    };
    const saved = db.addPermit(permit);
    return sendJson(res, 200, { ok: true, permit: saved });
  }

  sendJson(res, 404, { ok: false, error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    let pathname = u.pathname;

    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname);
    }

    // صفحه اصلی و فایل‌های静态
    let fileName = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    fileName = path.normalize(fileName).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(PUBLIC, fileName);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return sendFile(res, filePath);
    }

    // اگر پیدا نشد، همیشه index.html
    const indexPath = path.join(PUBLIC, 'index.html');
    if (fs.existsSync(indexPath)) {
      return sendFile(res, indexPath);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('index.html not found on server. PUBLIC=' + PUBLIC);
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { ok: false, error: String(e.message || e) });
  }
});

function localIPs() {
  const nets = os.networkInterfaces();
  const list = [];
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((n) => {
      if (n.family === 'IPv4' && !n.internal) list.push(n.address);
    });
  });
  return list;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('========================================');
  console.log('  سامانه پرمیت رامک — سرور آماده است');
  console.log('========================================');
  console.log('  PORT:', PORT);
  console.log('  PUBLIC:', PUBLIC);
  console.log('  index?:', fs.existsSync(path.join(PUBLIC, 'index.html')));
  console.log('========================================');
  console.log('');
});
