/**
 * بازوی بله — پورتال پیمانکار رامک (بدون وابستگی)
 *
 * ویندوز:
 *   set BALE_TOKEN=توکن
 *   set RAMAK_API=http://127.0.0.1:3780
 *   node bot.js
 */
const BALE_TOKEN = process.env.BALE_TOKEN || '';
const API_BASE = process.env.RAMAK_API || 'http://127.0.0.1:3780';
const BALE_API = 'https://tapi.bale.ai/bot' + BALE_TOKEN;

if (!BALE_TOKEN) {
  console.error('');
  console.error('خطا: توکن بازو تنظیم نشده است.');
  console.error('ویندوز:  set BALE_TOKEN=xxxx');
  console.error('لینوکس:  export BALE_TOKEN=xxxx');
  console.error('سپس:     node bot.js');
  console.error('');
  process.exit(1);
}

const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { mobile: '', step: 'ask_mobile', temp: {} });
  }
  return sessions.get(chatId);
}

async function bale(method, body) {
  const res = await fetch(BALE_API + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return res.json();
}

async function sendMessage(chatId, text, replyMarkup) {
  const payload = { chat_id: chatId, text: text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  try {
    await bale('sendMessage', payload);
  } catch (e) {
    console.error('sendMessage error', e.message);
  }
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

function normalizeMobile(text) {
  let m = String(text || '').replace(/[^\d]/g, '');
  if (m.startsWith('98') && m.length === 12) m = '0' + m.slice(2);
  if (m.startsWith('9') && m.length === 10) m = '0' + m;
  return m;
}

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: 'قراردادهای من' }, { text: 'پرمیت‌های من' }],
      [{ text: 'ثبت نفر' }, { text: 'گزارش کار' }],
      [{ text: 'تغییر موبایل' }]
    ],
    resize_keyboard: true
  };
}

async function handleStart(chatId) {
  const s = getSession(chatId);
  s.step = 'ask_mobile';
  s.mobile = '';
  s.temp = {};
  await sendMessage(
    chatId,
    'سلام\nبه بازوی پیمانکاران صنایع لبنی رامک خوش آمدید.\n\nلطفاً شماره موبایلی که در قرارداد ثبت شده را ارسال کنید.\nمثال: 09121234567',
    { remove_keyboard: true }
  );
}

async function bindMobile(chatId, text) {
  const mobile = normalizeMobile(text);
  if (!/^09\d{9}$/.test(mobile)) {
    await sendMessage(chatId, 'شماره معتبر نیست. مثال صحیح: 09121234567');
    return;
  }
  try {
    const contracts = await apiGet('/api/contractor/' + mobile + '/contracts');
    if (!contracts.length) {
      await sendMessage(chatId, 'هیچ قرارداد فعالی با این شماره یافت نشد.\nبا واحد کنترل پروژه هماهنگ کنید.');
      return;
    }
    const s = getSession(chatId);
    s.mobile = mobile;
    s.step = 'menu';
    const names = contracts.map((c) => '- ' + (c.cName || c.pName || c.id)).join('\n');
    await sendMessage(
      chatId,
      'ورود موفق\nموبایل: ' + mobile + '\n\nقراردادهای فعال:\n' + names + '\n\nاز منو انتخاب کنید:',
      mainKeyboard()
    );
  } catch (e) {
    await sendMessage(chatId, 'خطا در اتصال به سرور رامک.\nمطمئن شوید سرور روشن است.\n' + e.message);
  }
}

async function showContracts(chatId, s) {
  const contracts = await apiGet('/api/contractor/' + s.mobile + '/contracts');
  if (!contracts.length) {
    await sendMessage(chatId, 'قرارداد فعالی نیست.', mainKeyboard());
    return;
  }
  let msg = 'قراردادهای شما:\n\n';
  contracts.forEach((c, i) => {
    msg += (i + 1) + ') ' + (c.cName || '-') + '\n';
    msg += '   پروژه: ' + (c.pName || '-') + '\n';
    msg += '   سایت: ' + (c.site || '-') + '\n';
    msg += '   بازه: ' + (c.startDate || '-') + ' تا ' + (c.endDate || '-') + '\n';
    msg += '   ناظر: ' + (c.nazor || '-') + '\n\n';
  });
  await sendMessage(chatId, msg, mainKeyboard());
}

async function showPermits(chatId, s) {
  const permits = await apiGet('/api/contractor/' + s.mobile + '/permits');
  if (!permits.length) {
    await sendMessage(chatId, 'پرمیتی ثبت نشده است.', mainKeyboard());
    return;
  }
  let msg = 'پرمیت‌ها:\n\n';
  permits.slice(-15).reverse().forEach((p) => {
    msg += '- ' + (p.permitNo || p.id) + ' — وضعیت: ' + (p.status || '-') + '\n';
    msg += '  از ' + (p.startDate || '-') + ' تا ' + (p.endDate || '-') + '\n\n';
  });
  await sendMessage(chatId, msg, mainKeyboard());
}

async function startAddPerson(chatId, s) {
  const permits = await apiGet('/api/contractor/' + s.mobile + '/permits');
  const issued = permits.filter((p) => p.status === 'issued');
  if (!issued.length) {
    await sendMessage(chatId, 'پرمیت صادرشده‌ای ندارید. ابتدا پرمیت باید توسط HSE صادر شود.', mainKeyboard());
    return;
  }
  s.step = 'person_permit';
  s.temp = { permits: issued };
  let msg = 'شماره ردیف پرمیت را بفرستید:\n\n';
  issued.forEach((p, i) => {
    msg += (i + 1) + ') ' + (p.permitNo || p.id) + ' (' + (p.startDate || '') + ' تا ' + (p.endDate || '') + ')\n';
  });
  await sendMessage(chatId, msg);
}

async function startReport(chatId, s) {
  const permits = await apiGet('/api/contractor/' + s.mobile + '/permits');
  const issued = permits.filter((p) => p.status === 'issued');
  if (!issued.length) {
    await sendMessage(chatId, 'پرمیت صادرشده‌ای برای گزارش نیست.', mainKeyboard());
    return;
  }
  s.step = 'report_permit';
  s.temp = { permits: issued };
  let msg = 'برای کدام پرمیت گزارش می‌دهید؟ شماره ردیف:\n\n';
  issued.forEach((p, i) => {
    msg += (i + 1) + ') ' + (p.permitNo || p.id) + '\n';
  });
  await sendMessage(chatId, msg);
}

async function onText(chatId, text) {
  const s = getSession(chatId);
  const t = (text || '').trim();

  if (t === '/start' || t === 'شروع') {
    await handleStart(chatId);
    return;
  }
  if (t === 'تغییر موبایل') {
    await handleStart(chatId);
    return;
  }

  if (s.step === 'ask_mobile' || !s.mobile) {
    await bindMobile(chatId, t);
    return;
  }

  if (t === 'قراردادهای من') {
    try { await showContracts(chatId, s); } catch (e) { await sendMessage(chatId, 'خطا: ' + e.message, mainKeyboard()); }
    return;
  }
  if (t === 'پرمیت‌های من') {
    try { await showPermits(chatId, s); } catch (e) { await sendMessage(chatId, 'خطا: ' + e.message, mainKeyboard()); }
    return;
  }
  if (t === 'ثبت نفر') {
    try { await startAddPerson(chatId, s); } catch (e) { await sendMessage(chatId, 'خطا: ' + e.message, mainKeyboard()); }
    return;
  }
  if (t === 'گزارش کار') {
    try { await startReport(chatId, s); } catch (e) { await sendMessage(chatId, 'خطا: ' + e.message, mainKeyboard()); }
    return;
  }

  if (s.step === 'person_permit') {
    const idx = parseInt(t, 10) - 1;
    const list = s.temp.permits || [];
    if (isNaN(idx) || idx < 0 || idx >= list.length) {
      await sendMessage(chatId, 'شماره ردیف معتبر نیست.');
      return;
    }
    s.temp.permitId = list[idx].id;
    s.step = 'person_name';
    await sendMessage(chatId, 'نام و نام خانوادگی نفر را بفرستید:');
    return;
  }
  if (s.step === 'person_name') {
    s.temp.name = t;
    s.step = 'person_code';
    await sendMessage(chatId, 'کد ملی / شناسه نفر را بفرستید:');
    return;
  }
  if (s.step === 'person_code') {
    try {
      await apiPost('/api/contractor/' + s.mobile + '/personnel', {
        permitId: s.temp.permitId,
        name: s.temp.name,
        code: t,
        outOfRange: false,
        createdAt: new Date().toLocaleDateString('fa-IR')
      });
      s.step = 'menu';
      s.temp = {};
      await sendMessage(chatId, 'نفر ثبت شد و منتظر تأیید حراست است.', mainKeyboard());
    } catch (e) {
      s.step = 'menu';
      await sendMessage(chatId, 'خطا در ثبت: ' + e.message, mainKeyboard());
    }
    return;
  }

  if (s.step === 'report_permit') {
    const idx = parseInt(t, 10) - 1;
    const list = s.temp.permits || [];
    if (isNaN(idx) || idx < 0 || idx >= list.length) {
      await sendMessage(chatId, 'شماره ردیف معتبر نیست.');
      return;
    }
    s.temp.permitId = list[idx].id;
    s.temp.contractId = list[idx].contractId;
    s.step = 'report_desc';
    await sendMessage(chatId, 'شرح کارهای انجام‌شده را بفرستید:');
    return;
  }
  if (s.step === 'report_desc') {
    try {
      await apiPost('/api/contractor/' + s.mobile + '/report', {
        permitId: s.temp.permitId,
        contractId: s.temp.contractId,
        desc: t,
        date: new Date().toLocaleDateString('fa-IR')
      });
      s.step = 'menu';
      s.temp = {};
      await sendMessage(chatId, 'گزارش ثبت شد.', mainKeyboard());
    } catch (e) {
      s.step = 'menu';
      await sendMessage(chatId, 'خطا: ' + e.message, mainKeyboard());
    }
    return;
  }

  await sendMessage(chatId, 'از منوی پایین یک گزینه انتخاب کنید.', mainKeyboard());
}

async function processUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.chat) return;
  const chatId = msg.chat.id;
  const text = msg.text || '';
  console.log('msg from', chatId, text);
  await onText(chatId, text);
}

let offset = 0;

async function poll() {
  try {
    const url = BALE_API + '/getUpdates?timeout=25&offset=' + offset;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const u of data.result) {
        offset = u.update_id + 1;
        await processUpdate(u);
      }
    } else if (data.description) {
      console.error('Bale API:', data.description);
    }
  } catch (e) {
    console.error('poll error', e.message);
  }
  setTimeout(poll, 500);
}

console.log('');
console.log('بازوی بله رامک در حال اجرا...');
console.log('API سرور:', API_BASE);
console.log('در بله به بازو /start بفرستید.');
console.log('');
poll();
