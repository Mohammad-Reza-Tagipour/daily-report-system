"use client";

// app/(auth)/login/page.tsx — Persian login (frontend-only).
// CRITICAL: This page NEVER redirects away. If already logged in, it just
// shows the form (user can navigate manually). This prevents redirect loops.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const forbidden = search.get("forbidden") === "1";
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await login(email, password);
      if (!res.ok) {
        toast.error("ورود ناموفق", { description: res.error });
        return;
      }
      toast.success("خوش آمدید!", { description: res.user.name });
      // Navigate based on role. Use router.push (client-side, no reload).
      router.push(res.user.role === "ADMIN" ? "/dashboard" : "/report");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (kind: "admin" | "employee") => {
    setEmail(kind === "admin" ? "admin@zai.dev" : "ali@zai.dev");
    setPassword(kind === "admin" ? "admin123" : "ali123");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <span className="text-lg">←</span> بازگشت
        </Link>
        <ThemeToggle />
      </div>

      <GlassCard variant="strong" className="p-7 sm:p-9">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ورود به سامانه</h1>
          <p className="mt-1 text-sm text-muted-foreground">سامانه‌ی گزارش روزانه پروژه</p>
        </div>

        {forbidden && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4" /> دسترسی به داشبورد نیاز به نقش مدیر دارد.
          </div>
        )}

        <GlassButton type="button" variant="glass" size="lg" className="w-full mb-5" onClick={() => toast.info("ورود با گوگل نیاز به OAuth backend دارد")}>
          <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          ورود با گوگل
        </GlassButton>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> یا با ایمیل و گذرواژه <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/80">ایمیل</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" dir="ltr"
                className="h-11 w-full rounded-xl border border-border bg-background/50 px-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/80">گذرواژه</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" dir="ltr"
                className="h-11 w-full rounded-xl border border-border bg-background/50 px-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <GlassButton type="button" variant="primary" size="lg" disabled={loading} onClick={submit} className="w-full">
            {loading ? "در حال ورود..." : "ورود"}
          </GlassButton>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> حساب‌های نمونه <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GlassButton type="button" variant="glass" onClick={() => fillDemo("admin")}><ShieldCheck className="h-4 w-4 text-primary" /> مدیر</GlassButton>
          <GlassButton type="button" variant="glass" onClick={() => fillDemo("employee")}><Mail className="h-4 w-4 text-primary" /> کارمند</GlassButton>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          حساب ندارید؟ <Link href="/signup" className="font-medium text-primary hover:underline">ثبت‌نام</Link>
        </p>
      </GlassCard>
    </motion.div>
  );
}
