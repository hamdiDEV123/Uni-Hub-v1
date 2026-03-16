import { motion } from "framer-motion";
import { Navigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Home,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  Truck,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "الرئيسية", href: "#الرئيسية" },
  { label: "المشهد", href: "#المشهد" },
  { label: "المزايا", href: "#المزايا" },
  { label: "الأرقام", href: "#الأرقام" },
  { label: "الخدمات", href: "#الخدمات" },
  { label: "الأسئلة", href: "#الأسئلة" },
  { label: "ابدأ", href: "#ابدأ" },
];

const features = [
  {
    title: "سوق جامعي متكامل",
    desc: "بيع وشراء المنتجات الدراسية بسهولة مع إدارة ذكية للطلبات.",
    icon: ShoppingBag,
  },
  {
    title: "توصيل طلابي ذكي",
    desc: "خدمات توصيل داخل الحرم الجامعي مع تتبع واضح وسريع.",
    icon: Truck,
  },
  {
    title: "سكن ورفاق",
    desc: "اعثر على سكن مناسب أو رفيق سكن وفق تفضيلات دقيقة.",
    icon: Home,
  },
  {
    title: "رياضة وملاعب",
    desc: "احجز ملاعب وأنشطة رياضية وشارك مجتمع الجامعة.",
    icon: Trophy,
  },
  {
    title: "إشعارات مركزية",
    desc: "تابع كل أحداث المنصة من مكان واحد دون تفويت أي تحديث.",
    icon: Bell,
  },
  {
    title: "ثقة وتوثيق",
    desc: "نظام صلاحيات ومراجعات يضمن تجربة أكثر أمانًا واحترافية.",
    icon: ShieldCheck,
  },
];

const stats = [
  { value: "6", label: "خدمات رئيسية في منصة واحدة" },
  { value: "100%", label: "واجهة عربية كاملة RTL" },
  { value: "24/7", label: "وصول مستمر من الجوال والويب" },
];

const faqs = [
  {
    q: "هل المنصة مخصصة لطلاب الجامعات فقط؟",
    a: "المنصة مصممة أساسًا للبيئة الجامعية وتدعم أدوارًا مختلفة للطلاب وإدارة النظام.",
  },
  {
    q: "كيف أبدأ؟",
    a: "اضغط دخول المنصة، سجّل حسابك أو ادخل بحسابك الحالي، ثم انتقل مباشرة للوحة التحكم.",
  },
  {
    q: "هل الخدمات مترابطة داخل حساب واحد؟",
    a: "نعم، حساب واحد يمنحك الوصول للسوق والتوصيل والسكن والرياضة والإشعارات.",
  },
];

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">جاري تحميل المنصة...</p>
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div id="الرئيسية" className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_12%_18%,hsl(var(--primary)/.16),transparent_36%),radial-gradient(circle_at_86%_20%,hsl(var(--success)/.12),transparent_34%),radial-gradient(circle_at_70%_78%,hsl(var(--warning)/.10),transparent_33%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_right,rgba(59,130,246,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,.08)_1px,transparent_1px)] bg-[size:120px_120px]" />

      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="grid h-11 w-11 place-content-center rounded-2xl bg-primary/10 text-primary border border-primary/30 shadow-hard-sm">
              <Zap className="h-5 w-5" />
            </span>
            <div className="text-right">
              <p className="text-2xl font-extrabold leading-none">UniHub Connect</p>
              <p className="text-xs text-muted-foreground">منصة جامعية عربية متكاملة</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="القائمة الرئيسية">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-lg font-bold text-muted-foreground transition hover:text-primary">
                {item.label}
              </a>
            ))}
          </nav>

          <Link to="/auth">
            <Button className="h-12 rounded-2xl px-6 text-base font-extrabold shadow-hard-sm interactive-lift">
              دخول المنصة
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 pb-24 md:px-8">
        <section id="المشهد" className="relative pt-14 md:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="mx-auto max-w-5xl text-center"
          >
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-5 py-2 text-sm font-bold text-primary">
              <Sparkles className="h-4 w-4" />
              الجيل الجديد لإدارة الحياة الجامعية
            </div>

            <h1 className="text-5xl font-black leading-[1.2] tracking-tight text-foreground md:text-7xl">
              منصة عربية قوية
              <br />
              تجمع كل خدمات الطالب
              <br />
              في مكان واحد
            </h1>

            <p className="mx-auto mt-8 max-w-4xl text-xl leading-9 text-muted-foreground">
              دفع، سوق، سكن، رياضة، وإشعارات فورية بتجربة سلسة وسريعة تناسب الجامعات العربية
              على الجوال والويب.
            </p>

            <div id="ابدأ" className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link to="/auth">
                <Button className="h-14 min-w-[230px] rounded-2xl text-xl font-extrabold shadow-hard interactive-lift">
                  ابدأ رحلتك الآن
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#الخدمات">
                <Button
                  variant="outline"
                  className="h-14 min-w-[230px] rounded-2xl border-border bg-card text-xl font-bold text-foreground hover:bg-muted shadow-hard-sm interactive-lift"
                >
                  تصفح الخدمات
                </Button>
              </a>
            </div>
          </motion.div>
        </section>

        <section id="الأرقام" className="mt-16 grid gap-4 md:grid-cols-3">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-card p-6 shadow-hard interactive-lift">
              <p className="text-4xl font-black text-primary">{item.value}</p>
              <p className="mt-2 text-base text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </section>

        <section id="المزايا" className="mt-16">
          <div className="mb-7 flex items-center justify-between">
            <h2 className="text-3xl font-black">المزايا</h2>
            <p className="text-sm text-muted-foreground">تصميم حديث وهوية عربية موحدة</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((item, idx) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="rounded-3xl border border-border bg-card p-6 shadow-hard interactive-lift"
              >
                <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary/35 bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-extrabold">{item.title}</h3>
                <p className="mt-2 leading-8 text-muted-foreground">{item.desc}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="الخدمات" className="mt-16 rounded-3xl border border-border bg-card p-8 shadow-hard">
          <h2 className="text-3xl font-black">الخدمات المتاحة</h2>
          <p className="mt-2 text-muted-foreground">كل خدمة مصممة لتعمل منفردة ومترابطة في نفس الوقت.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "السوق", link: "/marketplace" },
              { name: "التوصيل", link: "/delivery" },
              { name: "السكن", link: "/housing" },
              { name: "الرياضة", link: "/sports" },
              { name: "الإشعارات", link: "/notifications" },
              { name: "لوحة الإدارة", link: "/admin" }
            ].map((service) => (
              <Link key={service.name} to={service.link}>
                <div className="rounded-2xl border border-border bg-muted/20 px-5 py-4 text-lg font-bold hover:bg-muted transition-colors cursor-pointer hover:border-primary/30 interactive-lift">
                  {service.name}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="الأسئلة" className="mt-16">
          <h2 className="text-3xl font-black">الأسئلة الشائعة</h2>
          <div className="mt-6 space-y-4">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-2xl border border-border bg-card p-5 shadow-hard-sm">
                <h3 className="text-xl font-extrabold text-primary">{item.q}</h3>
                <p className="mt-2 leading-8 text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
