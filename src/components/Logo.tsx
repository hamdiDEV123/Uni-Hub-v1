import React, { useState, useRef } from "react";
import { Download, LayoutTemplate, Copy, Check, CheckCircle2, BookOpen } from "lucide-react";

// الهوية البصرية الرسمية المعتمدة - أزرق الثقة
const BRAND = {
  primary: "#3B82F6", // الأزرق الأساسي (الخلفية)
  shadow: "#1D4ED8", // الأزرق الداكن (الظل الحاد)
  accent: "#0F172A", // الكحلي الداكن جداً (النظارة، النصوص، التفاصيل)
  white: "#FFFFFF", // الأبيض الناصع (الشخصية)
  bg: "#F8FAFC", // لون خلفية الموقع المقترح (أزرق رمادي فاتح جداً)
};

type LayoutType = "stacked" | "horizontal" | "markOnly";

export const LogoSVG = ({ layout = "stacked", svgRef }: { layout?: LayoutType; svgRef?: React.Ref<SVGSVGElement> }) => {
  let viewBox = "0 0 500 500";
  let textElement: React.ReactNode = null;

  if (layout === "stacked") {
    viewBox = "0 0 500 650";
    textElement = (
      <text
        x="250"
        y="580"
        textAnchor="middle"
        fontSize="85"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        letterSpacing="-2"
        fill={BRAND.accent}
      >
        uni-hup
      </text>
    );
  } else if (layout === "horizontal") {
    viewBox = "0 0 950 500";
    textElement = (
      <text
        x="520"
        y="285"
        textAnchor="start"
        fontSize="110"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        letterSpacing="-3"
        fill={BRAND.accent}
      >
        uni-hup
      </text>
    );
  }

  const mascotPaths = (
    <>
      <rect x="90" y="320" width="85" height="200" rx="15" />
      <rect x="325" y="320" width="85" height="200" rx="15" />
      <rect x="150" y="420" width="200" height="60" rx="10" />
      <path d="M 155 200 V 300 A 95 95 0 0 0 345 300 V 200 Z" />
      <path d="M 155 200 C 155 90, 345 90, 345 200 Z" />
      <circle cx="250" cy="95" r="15" />
      <path d="M 105 210 Q 250 160 395 210 Q 250 250 105 210 Z" />
    </>
  );

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      className="w-full h-full"
      style={{ transition: "all 0.3s ease" }}
    >
      <g>
        <circle cx="250" cy="250" r="230" fill={BRAND.primary} />

        <clipPath id="badge-clip">
          <circle cx="250" cy="250" r="230" />
        </clipPath>

        <g clipPath="url(#badge-clip)">
          <g transform="translate(25, 20)" fill={BRAND.shadow} stroke={BRAND.shadow} strokeWidth="18" strokeLinejoin="round">
            {mascotPaths}
          </g>
          <g fill={BRAND.white} stroke={BRAND.white} strokeWidth="18" strokeLinejoin="round">
            {mascotPaths}
          </g>
        </g>

        <g fill={BRAND.accent} stroke="none">
          <circle cx="210" cy="275" r="26" />
          <circle cx="290" cy="275" r="26" />
          <rect x="210" y="265" width="80" height="20" rx="4" />
          <path d="M 230 330 Q 250 350 270 330" stroke={BRAND.accent} strokeWidth="14" strokeLinecap="round" fill="none" />
        </g>
      </g>
      {textElement}
    </svg>
  );
};

const ColorSwatch = ({ name, hex, usage }: { name: string; hex: string; usage: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = hex;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("فشل النسخ: ", err);
    }
  };

  const isLight = hex === BRAND.white || hex === BRAND.bg;
  const textColor = isLight ? BRAND.accent : BRAND.white;
  const borderColor = isLight ? "border-border" : "border-transparent";

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative group h-20 rounded-2xl flex items-center justify-center cursor-pointer transition-transform hover:scale-105 border ${borderColor} shadow-sm`}
        style={{ backgroundColor: hex }}
        onClick={handleCopy}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-2xl backdrop-blur-[2px]">
          {copied ? <Check className="h-6 w-6 text-primary-foreground drop-shadow-md" /> : <Copy className="h-6 w-6 text-primary-foreground drop-shadow-md" />}
        </div>
        <span className="font-mono font-bold tracking-wider opacity-90" style={{ color: textColor }}>
          {hex}
        </span>
      </div>
      <div className="text-right">
        <h4 className="text-sm font-bold text-foreground">{name}</h4>
        <p className="text-xs text-muted-foreground">{usage}</p>
      </div>
    </div>
  );
};

export default function LogoShowcase() {
  const [layout, setLayout] = useState<LayoutType>("horizontal");
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `UniHup-Logo-${layout}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    try {
      const textArea = document.createElement("textarea");
      textArea.value = svgData;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("فشل النسخ: ", err);
    }
  };

  return (
    <div className="min-h-screen p-6 font-sans text-foreground" dir="rtl" style={{ backgroundColor: BRAND.bg }}>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-4 border-b border-border/50 py-8 text-center">
          <div className="mb-2 inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            الهوية البصرية <span style={{ color: BRAND.primary }}>Uni-Hup</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg font-medium text-muted-foreground">
            النسخة الرسمية المعتمدة (أزرق الثقة). تعكس الاحترافية، الأمان، والتكنولوجيا الحديثة في خدمة الطلاب.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="relative flex min-h-[500px] flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-card p-12 shadow-soft lg:col-span-8">
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: `radial-gradient(${BRAND.primary} 2px, transparent 2px)`, backgroundSize: "30px 30px" }}
            ></div>
            <div className={`relative w-full transition-all duration-500 ease-in-out ${layout === "horizontal" ? "max-w-4xl" : "max-w-md"} drop-shadow-2xl`}>
              <LogoSVG layout={layout} svgRef={svgRef} />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="space-y-8 rounded-[2rem] border border-border bg-card p-6 shadow-soft">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2 font-bold text-foreground">
                  <LayoutTemplate className="h-5 w-5 text-primary" />
                  <h3>النسق (Layout)</h3>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { id: "horizontal", label: "عرضي (للموقع من فوق)" },
                    { id: "stacked", label: "طولي (للملفات الرسمية)" },
                    { id: "markOnly", label: "الأيقونة فقط (Favicon)" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLayout(l.id as LayoutType)}
                      className={`py-3 px-4 rounded-xl font-bold text-right transition-all border-2 ${
                        layout === l.id
                          ? "border-primary/50 bg-primary/10 text-primary shadow-soft"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:bg-muted/40"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2 font-bold text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <h3>ألوان المنصة (اضغط للنسخ)</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <ColorSwatch name="الأزرق الأساسي" hex={BRAND.primary} usage="الأزرار، الهيدر، الروابط" />
                  <ColorSwatch name="الداكن (النصوص)" hex={BRAND.accent} usage="العناوين الكبيرة، التباين" />
                  <ColorSwatch name="الظل/التفاعل" hex={BRAND.shadow} usage="عند تمرير الماوس (Hover)" />
                  <ColorSwatch name="الخلفيات" hex={BRAND.white} usage="خلفية الأقسام والبطاقات" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCopyCode}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg transition-all border-2 ${
                  copied ? "border-success/40 bg-success/10 text-success" : "border-border bg-card text-foreground hover:bg-muted/40"
                }`}
              >
                {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                {copied ? "تم نسخ كود الـ SVG!" : "نسخ كود الـ SVG"}
              </button>

              <button
                onClick={handleDownloadSVG}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-foreground px-6 py-4 text-lg font-bold text-background transition-all shadow-hard hover:-translate-y-1 hover:bg-foreground/90"
              >
                <Download className="w-6 h-6" />
                تنزيل الشعار (.SVG)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
