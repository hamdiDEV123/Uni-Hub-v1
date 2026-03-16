import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const colorTokens = [
  { name: "Primary", token: "--primary", preview: "bg-primary" },
  { name: "Foreground", token: "--foreground", preview: "bg-foreground" },
  { name: "Secondary", token: "--secondary", preview: "bg-secondary" },
  { name: "Muted", token: "--muted", preview: "bg-muted" },
  { name: "Destructive", token: "--destructive", preview: "bg-destructive" },
  { name: "Success", token: "--success", preview: "bg-success" },
  { name: "Warning", token: "--warning", preview: "bg-warning" },
];

export default function DesignSystem() {
  return (
    <div dir="rtl" className="space-y-6 text-right">
      <div>
        <h1 className="text-3xl font-black text-foreground">Trust Blue Design System</h1>
        <p className="text-sm text-muted-foreground mt-1">
          مرجع حي للتوكنز والمكونات الأساسية المستخدمة في Uni-Hub.
        </p>
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>ألوان النظام</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {colorTokens.map((item) => (
            <div key={item.token} className="rounded-xl border border-border p-3 space-y-2">
              <div className={`h-12 rounded-lg border border-border ${item.preview}`} />
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">{item.name}</span>
                <code className="text-muted-foreground">{item.token}</code>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>مكونات أساسية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>زر أساسي</Button>
            <Button variant="outline">زر Outline</Button>
            <Button variant="secondary">زر Secondary</Button>
            <Button variant="destructive">زر تحذيري</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>Badge</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>

          <div className="max-w-md">
            <Input placeholder="مثال لحقل إدخال بنمط النظام" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>الحركة والعمق</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-hard pressable interactive-lift interactive-glow">
            بطاقة تفاعلية مع Hard Shadow وPress State.
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            بطاقة بطبقة Soft Shadow للعمق البصري.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
