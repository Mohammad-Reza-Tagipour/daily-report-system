"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ShieldCheck, UserPlus, Moon, Sun, Lock, Users, Save, Chrome, LogOut, UserCircle } from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent, GlassCardDescription } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { formatJalali, formatJalaliShort, toPersianDigits, persianMonths, persianWeekdayOfJalaliDay, isFriday, parseMonthKey, currentMonthKey, daysOfMonth } from "@/lib/jalali";

const features = [
  { icon: ShieldCheck, title: "احراز هویت نقشی", desc: "ورود با ایمیل/گذرواژه یا گوگل؛ مدیر و کارمند با سطح دسترسی متفاوت." },
  { icon: Calendar, title: "تقویم شمسی", desc: "نمایش روزهای ماه (فروردین تا اسفند)، جمعه‌ها قرمز." },
  { icon: Save, title: "ثبت ورود/خروج و وظیفه", desc: "هر سلول: ساعت ورود، خروج و شرح وظیفه — ذخیره خودکار." },
  { icon: Users, title: "داشبورد مدیر", desc: "جدول کشیدنی افقی (Drag-to-Scroll) با ستون برای هر کارمند." },
  { icon: Lock, title: "دسترسی محدود کارمند", desc: "کارمند فقط ستون خودش را می‌بیند و ویرایش می‌کند." },
  { icon: Chrome, title: "بدون دیتابیس", desc: "داده‌ها در مرورگر شما ذخیره می‌شوند — نیازی به سرور نیست." },
];

export default function Home() {
  const { resolvedTheme, mounted } = useAppTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const now = new Date();
  const monthKey = currentMonthKey(now);
  const { jy, jm } = parseMonthKey(monthKey);
  const days = daysOfMonth(monthKey).slice(0, 14);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-primary/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -left-40 h-[26rem] w-[26rem] rounded-full bg-accent/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

      {/* Topbar — shows different buttons based on auth state */}
      <header className="relative z-10 px-4 pt-5">
        <div className="glass glass-border mx-auto flex h-16 max-w-6xl items-center justify-between rounded-2xl px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 overflow-hidden"><img src="/logo.svg" alt="لوگو" className="h-7 w-7" /></div>
            <div className="leading-tight"><p className="text-sm font-bold tracking-tight">گزارش روزانه پروژه</p><p className="text-[10px] text-muted-foreground">Daily Project Report System</p></div>
          </Link>

          {user ? (
            /* Logged in: show profile + logout */
            <div className="flex items-center gap-2">
              <Link href={user.role === "ADMIN" ? "/dashboard" : "/report"}>
                <GlassButton variant="ghost" size="sm" className="gap-1.5">
                  <UserCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.name}</span>
                </GlassButton>
              </Link>
              <GlassButton variant="ghost" size="icon" aria-label="خروج" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </GlassButton>
              <ThemeToggle />
            </div>
          ) : (
            /* Not logged in: show login + signup */
            <div className="flex items-center gap-2">
              <Link href="/login"><GlassButton variant="ghost" size="sm">ورود</GlassButton></Link>
              <Link href="/signup"><GlassButton variant="primary" size="sm"><UserPlus className="h-4 w-4" />ثبت‌نام</GlassButton></Link>
              <ThemeToggle />
            </div>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-12 pb-8 text-center sm:pt-16">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full glass glass-border px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Next.js · تقویم شمسی · Tailwind ۴
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">سامانه‌ی <span className="text-gradient">گزارش روزانه پروژه</span></motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">ثبت ساعت ورود/خروج و شرح وظایف روزانه کارکنان با تقویم شمسی، طراحی گلسمورفیسم و حالت تاریک/روشن.</motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            /* Logged in: show dashboard/report buttons */
            <>
              {user.role === "ADMIN" && (
                <Link href="/dashboard"><GlassButton variant="primary" size="lg"><Calendar className="h-4 w-4" /> داشبورد مدیر</GlassButton></Link>
              )}
              <Link href="/report"><GlassButton variant="glass" size="lg"><Save className="h-4 w-4" /> گزارش من</GlassButton></Link>
            </>
          ) : (
            /* Not logged in: show login/signup */
            <>
              <Link href="/login"><GlassButton variant="primary" size="lg">ورود به سامانه</GlassButton></Link>
              <Link href="/signup"><GlassButton variant="glass" size="lg"><UserPlus className="h-4 w-4" /> ثبت‌نام</GlassButton></Link>
            </>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mx-auto mt-8 inline-flex items-center gap-3 rounded-xl glass glass-border px-4 py-2 text-xs">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">امروز:</span>
          <span className="font-semibold" suppressHydrationWarning>{formatJalali(now, { withWeekday: true })}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground" dir="ltr" suppressHydrationWarning>{formatJalaliShort(now)}</span>
        </motion.div>
      </section>

      {/* Live calendar preview */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8">
        <GlassCard variant="strong" className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-border/50 px-5 py-3">
            <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-400/80" /><span className="h-3 w-3 rounded-full bg-amber-400/80" /><span className="h-3 w-3 rounded-full bg-emerald-400/80" /></div>
            <p className="mr-2 text-xs text-muted-foreground">/dashboard — پیش‌نمایش</p>
            <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground" suppressHydrationWarning>
              {mounted && resolvedTheme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {mounted && resolvedTheme === "dark" ? "تاریک" : "روشن"}
            </div>
          </div>
          <div className="p-5">
            <div className="mb-4 flex items-center justify-center gap-3"><span className="text-lg font-bold">{persianMonths()[jm - 1]} {toPersianDigits(jy)}</span></div>
            <div className="scroll-area overflow-x-auto rounded-xl glass glass-border p-3">
              <table className="w-full border-collapse text-xs">
                <thead><tr>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">روز</th>
                  <th className="px-3 py-2 text-center font-semibold text-foreground">علی رضایی</th>
                  <th className="px-3 py-2 text-center font-semibold text-foreground">سارا محمدی</th>
                  <th className="px-3 py-2 text-center font-semibold text-foreground">رضا کریمی</th>
                </tr></thead>
                <tbody>
                  {days.map((day, i) => {
                    const friday = isFriday(jy, jm, day);
                    return (
                      <tr key={day} className={friday ? "bg-rose-500/5" : ""}>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${friday ? "bg-rose-500/20 text-rose-500" : "bg-foreground/5"}`}>{toPersianDigits(day)}</span>
                            <span className={`text-[10px] ${friday ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>{persianWeekdayOfJalaliDay(jy, jm, day)}</span>
                          </div>
                        </td>
                        {[0, 1, 2].map(k => (
                          <td key={k} className="px-3 py-2 text-center">
                            <div className="mx-auto inline-flex flex-col gap-0.5 rounded-md border border-border/60 bg-background/50 px-2 py-1">
                              <span className="text-[10px] tabular-nums text-foreground/80">{toPersianDigits(`09:0${(i % 9) + 1}`)} - {toPersianDigits(`17:${30 + (i % 30)}`)}</span>
                              <span className="text-[9px] text-muted-foreground line-clamp-1">وظیفه‌ی نمونه</span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8">
        <h2 className="mb-5 text-center text-2xl font-bold tracking-tight sm:text-3xl">امکانات</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
              <GlassCard className="h-full p-5 transition-all hover:-translate-y-1">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><f.icon className="h-5 w-5" /></div>
                <h3 className="mb-1 font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10">
        <GlassCard variant="strong" className="overflow-hidden p-8 text-center sm:p-12">
          {user ? (
            <>
              <UserCircle className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">سلام {user.name}!</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">شما وارد شده‌اید. به سامانه بروید.</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {user.role === "ADMIN" && <Link href="/dashboard"><GlassButton variant="primary" size="lg"><Calendar className="h-4 w-4" /> داشبورد <ArrowLeft className="h-4 w-4" /></GlassButton></Link>}
                <Link href="/report"><GlassButton variant="glass" size="lg"><Save className="h-4 w-4" /> گزارش من</GlassButton></Link>
                <GlassButton variant="ghost" size="lg" onClick={handleLogout}><LogOut className="h-4 w-4" /> خروج</GlassButton>
              </div>
            </>
          ) : (
            <>
              <Lock className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">آماده‌ی کاوش؟</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">با حساب‌های نمونه وارد شوید.</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link href="/login"><GlassButton variant="primary" size="lg"><Chrome className="h-4 w-4" /> ورود <ArrowLeft className="h-4 w-4" /></GlassButton></Link>
                <Link href="/signup"><GlassButton variant="glass" size="lg">ثبت‌نام</GlassButton></Link>
              </div>
              <div className="mx-auto mt-5 max-w-md rounded-xl bg-foreground/5 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground/80">حساب‌های نمونه:</p>
                <p dir="ltr" className="text-left">admin@zai.dev / admin123 (ADMIN)</p>
                <p dir="ltr" className="text-left">ali@zai.dev / ali123 (EMPLOYEE)</p>
                <p dir="ltr" className="text-left">sara@zai.dev / sara123 (EMPLOYEE)</p>
              </div>
            </>
          )}
        </GlassCard>
      </section>

      <footer className="relative z-10 px-4 pb-8 pt-4 text-center text-xs text-muted-foreground">
        سامانه‌ی گزارش روزانه پروژه · {toPersianDigits(now.getFullYear())}
        <br />
        <span className="mt-1 inline-block">ساخته‌شده توسط <span className="font-semibold text-foreground/80">Mohammad Reza Tagipour</span></span>
      </footer>
    </main>
  );
}
