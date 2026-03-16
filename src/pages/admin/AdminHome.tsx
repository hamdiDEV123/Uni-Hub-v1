import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Store, BookOpen, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const adminSections = [
  {
    title: "إدارة السوق",
    description: "مراجعة المنتجات والإيصالات والترقيات والسحوبات",
    href: "/admin/marketplace",
    icon: Store,
  },
  {
    title: "إدارة بنك المحاضرات",
    description: "تحليلات Study Hub ومتابعة البلاغات والنشاط",
    href: "/admin/study-hub",
    icon: BookOpen,
  },
];

export default function AdminHome() {
  return (
    <motion.div
      dir="rtl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4"
    >
      <div className="rounded-3xl border border-navy/20 bg-card p-6 shadow-hard">
        <h1 className="text-3xl font-black text-primary">لوحة الأدمن الرئيسية</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اختر القسم الإداري الذي تريد إدارته. كل قسم في صفحة مستقلة.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminSections.map((section) => (
          <Card key={section.href} className="border-navy/20 bg-card shadow-hard-sm">
            <CardHeader className="text-right">
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <section.icon className="h-5 w-5" />
              </div>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-right">
              <p className="text-sm text-muted-foreground">{section.description}</p>
              <Button asChild className="w-full gap-2" variant="cta">
                <Link to={section.href}>
                  فتح القسم
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
