import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Mail, Lock, User, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    const newErrors: Record<string, string> = {};
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = "يرجى إدخال بريد إلكتروني صحيح";
    }
    if (password.length < 6) {
      newErrors.password = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    }
    if (!isLogin && fullName.trim().length < 3) {
      newErrors.fullName = "الاسم يجب أن يكون ثلاثي على الأقل";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب، افحص البريد للتأكيد");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_12%_18%,hsl(var(--primary)/.12),transparent_36%),radial-gradient(circle_at_86%_20%,hsl(var(--navy)/.10),transparent_34%)]" />

      <header className="sticky top-0 z-40 border-b border-navy/20 bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="grid h-11 w-11 place-content-center overflow-hidden rounded-2xl border border-navy/20 bg-card shadow-hard-sm">
              <img src="/UniHup-StudentLogo-markOnly-creativePurple.svg" alt="UniHub Logo" className="h-full w-full object-cover" />
            </span>
            <div className="text-right">
              <p className="text-2xl font-extrabold leading-none">UniHub Connect</p>
              <p className="text-xs text-muted-foreground">منصة جامعية عربية متكاملة</p>
            </div>
          </Link>

          <Link to="/" className="text-sm font-bold text-muted-foreground transition hover:text-primary">
            العودة للرئيسية
          </Link>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-6xl items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid w-full overflow-hidden rounded-3xl border border-navy/20 bg-card shadow-hard lg:grid-cols-2"
        >
          <div className="space-y-6 border-b border-navy/20 p-8 lg:border-b-0 lg:border-l lg:border-navy/20">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 py-1 text-xs font-bold text-primary">
              <ShieldCheck className="h-4 w-4" />
              منصة جامعية عربية متكاملة
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground">
              {isLogin ? "مرحبًا بعودتك" : "أنشئ حسابك الآن"}
            </h1>
            <p className="leading-8 text-muted-foreground">
              {isLogin
                ? "ادخل إلى لوحة التحكم واستفد من السوق، التوصيل، السكن والرياضة في تجربة واحدة."
                : "ابدأ رحلتك داخل UniHub Connect وأنشئ حسابًا موحدًا لإدارة كل خدماتك."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground font-black">الاسم الكامل</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="fullName" 
                      value={fullName} 
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) setErrors({...errors, fullName: ""});
                      }} 
                      className={`pr-10 ${errors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}`} 
                      disabled={loading}
                    />
                  </div>
                  {errors.fullName && <p className="text-xs text-red-400">{errors.fullName}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-black">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({...errors, email: ""});
                    }} 
                    className={`pr-10 ${errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`} 
                    disabled={loading}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-black">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    value={password} 
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({...errors, password: ""});
                    }} 
                    className={`pr-10 ${errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`} 
                    disabled={loading}
                  />
                </div>
                {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
              </div>

              <Button type="submit" variant="cta" disabled={loading} className="h-12 w-full font-black shadow-hard-sm">
                {loading ? "جاري التنفيذ..." : isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
                <ArrowRight className="mr-2 h-4 w-4" />
              </Button>
            </form>

            <p className="text-sm text-muted-foreground">
              {isLogin ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
              <button 
                onClick={() => { setIsLogin(!isLogin); setErrors({}); }} 
                className="font-bold text-primary hover:underline" 
                type="button"
                disabled={loading}
              >
                {isLogin ? "إنشاء حساب" : "تسجيل الدخول"}
              </button>
            </p>
          </div>

          <div className="relative hidden flex-col justify-between overflow-hidden border-r border-navy/20 p-8 lg:flex cosmic-gradient">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,.35),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(251,191,36,.18),transparent_30%)]" />
            <div>
              <p className="relative text-xs tracking-[0.2em] text-white/70">منصة UniHub Connect</p>
              <h2 className="relative mt-4 text-3xl font-black leading-tight text-white">
                كل خدمات الجامعة
                <br />
                في منصة واحدة
              </h2>
            </div>

            <div className="relative space-y-4">
              <div className="rounded-2xl border border-white/35 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm font-bold text-white">سوق جامعي + إدارة طلبات + مراجعات أدمن</p>
              </div>
              <div className="rounded-2xl border border-white/35 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm font-bold text-white">واجهة عربية حديثة وتجربة موحدة</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/20 px-4 py-1 text-xs font-black text-gold">
                <Sparkles className="h-4 w-4" />
                نسخة الهوية الجديدة
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="pb-8 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">العودة للصفحة الرئيسية</Link>
      </div>
    </div>
  );
}
