# گزارش روزانه پروژه | Daily Project Report System

سامانه‌ی گزارش روزانه پروژه — ثبت ورود/خروج و وظایف روزانه کارکنان با تقویم شمسی، طراحی گلسمورفیسم و حالت تاریک/روشن.

## امکانات

- **احراز هویت نقشی** — مدیر اصلی (admin@zai.dev)، مدیران، و کارمندان
- **تقویم شمسی** — روزهای جمعه قرمز، امروز برجسته، روزهای آینده قفل
- **داشبورد مدیر** — ۳ تب: تقویم (همه‌ی کارکنان)، کاربران (مدیریت نقش)، ارجاع وظیفه
- **گزارش کارمند** — فقط ستون خودش + اعلان‌های مدیر
- **Backend واقعی** — Prisma + SQLite (قابل تغییر به PostgreSQL)
- **خروج خودکار** — بعد از ۱۵ دقیقه بی‌فعالیتی

## حساب‌های نمونه (بعد از seed)

| ایمیل | گذرواژه | نقش |
|-------|---------|------|
| admin@zai.dev | admin123 | مدیر اصلی |
| ali@zai.dev | ali123 | کارمند |
| sara@zai.dev | sara123 | کارمند |
| reza@zai.dev | reza123 | کارمند |

## تکنولوژی‌ها

- Next.js 16 (App Router + API Routes)
- TypeScript
- Prisma 6 + SQLite
- bcryptjs (هش گذرواژه)
- Cookie-based session (بدون NextAuth)
- Tailwind CSS 4
- jalaali-js (تقویم شمسی)
- framer-motion + next-themes

---

## 🚀 نصب و اجرای محلی (مهم — دقیقاً به همین ترتیب)

```bash
# ۱. پکیج‌ها را نصب کنید (prisma generate خودکار اجرا می‌شود)
npm install

# ۲. فایل .env را از روی .env.example بسازید
# روی ویندوز:
copy .env.example .env
# روی مک/لینوکس:
cp .env.example .env

# ۳. دیتابیس را بسازید
npm run db:push

# ۴. کاربران نمونه را ایجاد کنید
npm run db:seed

# ۵. اجرای پروژه
npm run dev
```

سپس به `http://localhost:3000` بروید.

⚠️ **اگر خطای `@prisma/client did not initialize` گرفتید:**
```bash
npx prisma generate
```
را اجرا کنید، سپس `npm run dev` را دوباره بزنید.

---

## 📦 استقرار (Deployment)

### گزینه ۱: Vercel + Vercel Postgres (پیشنهادی)

۱. کد را به GitHub پوش کنید:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/daily-report-system.git
git push -u origin main
```

۲. به [vercel.com](https://vercel.com) بروید و با GitHub وارد شوید.

۳. "Add New Project" → ریپو را انتخاب کنید.

۴. در تنظیمات، Environment Variables را اضافه کنید:
   - `DATABASE_URL` =Postgres connection string)
   - `AUTH_SECRET` = (یک رشته‌ی تصادفی ۳۲ کاراکتری)

۵. در فایل `prisma/schema.prisma`، `sqlite` را به `postgresql` تغییر دهید:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

۶. Deploy را بزنید.

۷. بعد از deploy، در Vercel terminal اجرا کنید:
```bash
npx prisma db push
npx tsx scripts/seed.ts
```

### گزینه ۲: VPS (سرور اختصاصی)

```bash
# روی سرور:
git clone https://github.com/YOUR_USERNAME/daily-report-system.git
cd daily-report-system
npm install

# دیتابیس را بسازید و seed کنید
npm run db:push
npm run db:seed

# Build و اجرا
npm run build
npm start    # پورت 3000
```

با PM2 برای اجرای دائمی:
```bash
npm install -g pm2
pm2 start npm --name "daily-report" -- start
pm2 startup
pm2 save
```

### گزینه ۳: Supabase (PostgreSQL رایگان)

۱. به [supabase.com](https://supabase.com) بروید و پروژه بسازید.

۲. Connection string را از Settings > Database بگیرید.

۳. در `.env`:
```
DATABASE_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
```

۴. در `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

۵. سپس:
```bash
npx prisma db push
npx tsx scripts/seed.ts
npm run build
npm start
```

---

## 📁 ساختار پروژه

```
daily-report-system/
├── prisma/
│   └── schema.prisma          ← مدل‌های دیتابیس
├── scripts/
│   └── seed.ts                ← ایجاد کاربران نمونه
├── src/
│   ├── app/
│   │   ├── api/               ← API Routes (backend)
│   │   │   ├── auth/login/
│   │   │   ├── auth/logout/
│   │   │   ├── auth/me/
│   │   │   ├── signup/
│   │   │   ├── users/
│   │   │   ├── entries/
│   │   │   └── notifications/
│   │   ├── (auth)/            ← صفحات ورود/ثبت‌نام
│   │   ├── dashboard/         ← داشبورد مدیر
│   │   ├── report/            ← گزارش کارمند
│   │   ├── layout.tsx
│   │   └── page.tsx           ← لندینگ
│   ├── components/            ← کامپوننت‌های UI
│   ├── context/
│   │   ├── AuthContext.tsx    ← احراز هویت (fetch API)
│   │   └── ThemeContext.tsx   ← تم تاریک/روشن
│   └── lib/
│       ├── db.ts              ← Prisma client
│       ├── session.ts         ← مدیریت session (cookie)
│       ├── constants.ts       ← ثابت‌های مشترک
│       ├── jalali.ts          ← تقویم شمسی
│       └── useStore.ts        ← هوک‌های fetch
├── package.json
└── next.config.ts
```

## قوانین نقش‌ها

| چه کسی | روی چه کسی | امکان‌پذیر؟ |
|--------|-------|-------|
| مدیر اصلی | خودش | ❌ غیرقابل تغییر |
| مدیر اصلی | مدیران دیگر | ✅ تنزل یا ارتقا |
| مدیر اصلی | کارمندان | ✅ ارتقا |
| مدیر عادی | مدیر اصلی | ❌ |
| مدیر عادی | مدیران دیگر | ❌ فقط مدیر اصلی |
| مدیر عادی | کارمندان | ✅ ارتقا |
