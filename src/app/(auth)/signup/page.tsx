"use client";

// app/(auth)/signup/page.tsx — frontend-only signup. Auto-logs-in after signup.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, UserPlus, Mail, User } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 6) { toast.error("گذرواژه حداقل ۶ کاراکتر"); return; }
    setLoading(true);
    try {
      const res = await signup({ name, email, password });
      if (!res.ok) { toast.error("خطا", { description: res.error }); return; }
      toast.success("حساب ساخته شد");
      router.push(res.user.role === "ADMIN" ? "/dashboard" : "/report");
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><span className="text-lg">←</span> بازگشت</Link>
        <ThemeToggle />
      </div>
      <GlassCard variant="strong" className="p-7 sm:p-9">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><UserPlus className="h-7 w-7" /></div>
          <h1 className="text-2xl font-bold tracking-tight">ساخت حساب جدید</h1>
          <p className="mt-1 text-sm text-muted-foreground">کاربران جدید «کارمند» هستند</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/80">نام</label>
            <div className="relative">
              <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="علی رضایی"
                className="h-11 w-full rounded-xl border border-border bg-background/50 px-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
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
              <EyeOff className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="حداقل ۶ کاراکتر" dir="ltr"
                className="h-11 w-full rounded-xl border border-border bg-background/50 px-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40" />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <GlassButton type="button" variant="primary" size="lg" disabled={loading} onClick={submit} className="w-full">
            {loading ? "در حال ساخت..." : "ثبت‌نام"}
          </GlassButton>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">حساب دارید؟ <Link href="/login" className="font-medium text-primary hover:underline">ورود</Link></p>
      </GlassCard>
    </motion.div>
  );
}
