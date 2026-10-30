/**
 * ذخیره داده به صورت فایل JSON (دیتابیس سبک برای شبکه داخلی)
 * مسیر: ./data/store.json
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const DEFAULT_STORE = {
  users: [
    {
      id: 'u1',
      fname: 'مدیر',
      lname: 'ارشد',
      title: 'مدیر کل',
      username: 'admin',
      password: '123',
      mobile: '',
      role: 'admin',
      signatureImage: '',
      access: {
        contracts: true, permits: true, nazor: true, fanni: true,
        quality: true, foodSafety: true, section: true,
        hse: true, security: true, personnelApproval: true, food: true, reports: true, users: true
      }
    }
  ],
  contracts: [],
  permits: [],
  personnel: [],
  food_menu: [],
  food_history: [],
  food_daily: [],
  hse_reports: [],
  contractor_reports: [],
  permit_counter: 0,
  cfg_org_units: null,
  cfg_roles: null,
  manual_date: null,
  login_bg: null,
  main_bg: null,
  hero_bg: null
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(DEFAULT_STORE, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Object.assign({}, DEFAULT_STORE, data);
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
  }
}

function writeStore(store) {
  ensureStore();
  const tmp = STORE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_FILE);
}

function getAll() {
  return readStore();
}

function getKey(key) {
  const store = readStore();
  if (Object.prototype.hasOwnProperty.call(store, key)) return store[key];
  return null;
}

function setKey(key, value) {
  const store = readStore();
  store[key] = value;
  writeStore(store);
  return store[key];
}

function setMany(obj) {
  const store = readStore();
  Object.keys(obj || {}).forEach((k) => {
    store[k] = obj[k];
  });
  writeStore(store);
  return store;
}

/** برای بازوی بله: قراردادهای فعال با موبایل پیمانکار */
function getContractsByMobile(mobile) {
  const store = readStore();
  const m = String(mobile || '').trim();
  return (store.contracts || []).filter(
    (c) => c.isActive !== false && String(c.contractorMobile || '').trim() === m
  );
}

function getPermitsForContractIds(ids) {
  const store = readStore();
  const set = new Set(ids);
  return (store.permits || []).filter((p) => set.has(p.contractId));
}

function addPersonnel(record) {
  const store = readStore();
  if (!store.personnel) store.personnel = [];
  store.personnel.push(record);
  writeStore(store);
  return record;
}

function addContractorReport(record) {
  const store = readStore();
  if (!store.contractor_reports) store.contractor_reports = [];
  store.contractor_reports.push(record);
  writeStore(store);
  return record;
}

function addPermit(permit) {
  const store = readStore();
  if (!store.permits) store.permits = [];
  let counter = store.permit_counter || 0;
  counter += 1;
  store.permit_counter = counter;
  if (!permit.permitNo) {
    permit.permitNo = 'HP' + String(counter).padStart(4, '0');
  }
  store.permits.push(permit);
  writeStore(store);
  return permit;
}

module.exports = {
  getAll,
  getKey,
  setKey,
  setMany,
  getContractsByMobile,
  getPermitsForContractIds,
  addPersonnel,
  addContractorReport,
  addPermit,
  readStore,
  writeStore
};
