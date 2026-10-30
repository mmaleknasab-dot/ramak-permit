# تست ابری رایگان (چند کامپیوتر + گوشی)

## گزینه پیشنهادی: Render.com (رایگان)

### ۱) آماده‌سازی
- پوشه ramak-server را در یک مخزن GitHub بگذارید
  (یا از دکمه Upload در Render اگر موجود بود)

### ۲) ساخت سرویس
1. بروید به https://render.com و با ایمیل/گوگل ثبت‌نام کنید
2. Dashboard → New + → Web Service
3. مخزن GitHub را وصل کنید (یا پوشه را طبق راهنمای Render آپلود کنید)
4. تنظیمات:
   - Name: ramak-permit
   - Runtime: Node
   - Build Command: (خالی بگذارید)
   - Start Command: node server.js
   - Instance: Free
5. Create Web Service را بزنید و ۲–۳ دقیقه صبر کنید
6. آدرس نهایی شبیه این است:
   https://ramak-permit-xxxx.onrender.com

### ۳) تست
- همان لینک را روی لپ‌تاپ، سیستم دیگر و گوشی باز کنید
- ورود: admin / 123

### ۴) بازوی بله (روی لپ‌تاپ خودتان)
سرور ابری روشن است؛ بازو را محلی اجرا کنید:

```bat
set BALE_TOKEN=توکن-شما
set RAMAK_API=https://ramak-permit-xxxx.onrender.com
node bot.js
```

### نکته رایگان Render
- اگر حدود ۱۵ دقیقه کسی وصل نباشد، سرویس می‌خوابد
- اولین ورود بعد از خواب ممکن است ۳۰–۶۰ ثانیه طول بکشد
- با redeploy ممکن است داده تست پاک شود (برای تست اشکالی ندارد)

## گزینه جایگزین: Railway.app
1. https://railway.app ثبت‌نام
2. New Project → Deploy from GitHub (یا Upload)
3. Start Command: node server.js
4. بعد از Deploy لینک Public را بگیرید

## گزینه ارزان پایدارتر (ماهانه کم)
VPS ایران یا خارج با فقط: node server.js
