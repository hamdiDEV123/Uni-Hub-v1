import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  User, Mail, School, Wallet, ShieldCheck, 
  ShieldAlert, Camera, Loader2, CheckCircle, AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. دالة جلب بيانات البروفايل
  const fetchProfile = async () => {
    if (!user?.id) return;
    const { data, error } = await (supabase.from('profiles') as any)
      .select('*')
      .eq('id', user?.id)
      .single();
    if (data) setProfile(data);
    setLoading(false);
  };

  // 2. تفعيل نظام الـ Realtime للحس اللحظي بالتغييرات ✅
  useEffect(() => {
    if (!user?.id) return;

    fetchProfile(); // جلب البيانات أول مرة

    // فتح قناة اتصال مباشرة مع سوبابيز لمراقبة التغييرات في البروفايل
    const profileChannel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // بنراقب لما الأدمن يعمل Update
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`, // راقب بروفايلي أنا بس
        },
        (payload) => {
          console.log('تحديث جديد وصل من الداتابيز! 🚀', payload.new);
          setProfile(payload.new); // تحديث الواجهة فوراً بالبيانات الجديدة
          
          // تنبيه للمستخدم لو التوثيق نجح
          if (payload.new.verified_status) {
            toast.success("مبروك! تم توثيق حسابك بنجاح ✅");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id]);

  // 3. ميوتيشن رفع صورة الكارنيه
  const uploadIdCard = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}/id-card-${Math.random()}.${fileExt}`;

      // رفع الصورة لمخزن سوبابيز (Storage)
      const { error: uploadError } = await supabase.storage
        .from('verification-docs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // تحديث رابط الصورة في البروفايل
      const { error: updateError } = await (supabase.from('profiles') as any)
        .update({ university_card_url: filePath })
        .eq('id', user?.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      // هنا مش محتاجين نعمل Refresh لأن الـ Realtime هيحدث الداتا لما الداتابيز تسمع
      toast.success('تم رفع الكارنيه.. بانتظار مراجعة الأدمن ⏳');
      setIsUploading(false);
    },
    onError: () => {
      toast.error('فشل الرفع.. تأكد من حجم الصورة');
      setIsUploading(false);
    }
  });

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0a0a0c] text-orange-500 italic font-black uppercase tracking-tighter">RARE PROFILE LOADING...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 text-right text-white font-sans" dir="rtl">
      
      {/* هيدر الصفحة */}
      <div className="mb-10 flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-orange-500 italic uppercase">الملف الشخصي</h1>
          <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase text-right">مركز الأمان والبيانات</p>
        </div>
        <div className="bg-orange-500/10 p-3 rounded-2xl">
          <User className="text-orange-500" size={28} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* القسم الأول: البيانات الشخصية */}
        <div className="space-y-6 text-right">
          <Card className="border-white/5 bg-[#121214] p-8 rounded-[2.5rem] shadow-2xl">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-orange-500 justify-end italic">
              المعلومات العامة <User size={20} />
            </h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 block uppercase">الاسم بالكامل</label>
                <Input value={profile?.full_name || ''} disabled className="bg-white/5 border-white/10 h-12 rounded-xl text-right font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 block uppercase">البريد الإلكتروني</label>
                <Input value={profile?.email || user?.email || ''} disabled className="bg-white/5 border-white/10 h-12 rounded-xl text-right font-bold" />
              </div>
              <div className="space-y-1 text-right">
                <label className="text-[10px] font-black text-gray-500 block uppercase">الجامعة الحالية</label>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 h-12 rounded-xl px-4 flex-row-reverse">
                   <School size={18} className="text-gray-500" />
                   <span className="text-sm font-bold">{profile?.university_id || 'لم يتم التحديد'}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* محفظة الرصيد - مربوطة بـ wallet_balance للتسميع اللحظي ✅ */}
          <Card className="border-white/5 bg-[#121214] p-8 rounded-[2.5rem] border-r-4 border-r-orange-500">
            <div className="flex items-center justify-between">
              <Button className="bg-orange-600 hover:bg-orange-700 font-black h-12 rounded-xl px-6 transition-all active:scale-95 shadow-lg shadow-orange-900/20">شحن</Button>
              <div className="flex items-center gap-4 flex-row-reverse text-right">
                <div className="rounded-2xl bg-orange-500/10 p-4 text-orange-500">
                  <Wallet size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">رصيدك في المحفظة</p>
                  <h3 className="text-2xl font-black text-white">{profile?.wallet_balance || '0.00'} ج.م</h3>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* القسم الثاني: نظام التوثيق الجامعي - مربوط بالـ Realtime ✅ */}
        <div className="space-y-6 text-right">
          <Card className={`border-2 p-8 rounded-[3rem] transition-all duration-700 ${profile?.verified_status ? 'border-green-500/40 bg-green-500/5' : 'border-orange-500/20 bg-orange-500/5'}`}>
            <div className="mb-6 flex items-center justify-between">
              <Badge className={profile?.verified_status ? 'bg-green-500/20 text-green-500 border-none px-4 font-black' : 'bg-orange-500/20 text-orange-500 border-none px-4 font-black'}>
                {profile?.verified_status ? 'موثق ✅' : 'قيد المراجعة ⏳'}
              </Badge>
              <h2 className={`flex items-center gap-2 text-lg font-black italic ${profile?.verified_status ? 'text-green-500' : 'text-orange-500'}`}>
                توثيق الهوية الجامعية {profile?.verified_status ? <ShieldCheck className="animate-pulse" /> : <ShieldAlert />}
              </h2>
            </div>

            <p className="mb-8 text-[11px] font-bold leading-relaxed text-gray-400 italic">
              ارفع صورة واضحة للكارنيه الجامعي ليتم مراجعتها وتفعيل وضع الـ <span className="text-orange-500">Runner</span> والوصول لكافة الميزات.
            </p>

            {!profile?.university_card_url ? (
              <div className="relative group cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => e.target.files?.[0] && uploadIdCard.mutate(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-white/10 p-12 rounded-[2.5rem] text-center group-hover:border-orange-500/50 transition-all bg-white/[0.02]">
                  {isUploading ? <Loader2 className="mx-auto animate-spin text-orange-500" /> : <Camera className="mx-auto text-gray-600 mb-2" size={40} />}
                  <span className="text-[10px] font-black text-gray-500 block mt-2 uppercase tracking-widest">ارفع صورة الكارنيه</span>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 text-center flex flex-col items-center gap-3">
                {profile?.verified_status ? <CheckCircle className="text-green-500" size={40} /> : <Loader2 className="animate-spin text-orange-500" size={40} />}
                <p className="text-xs font-black italic">
                  {profile?.verified_status ? "أنت الآن موصل موثق في الشبكة" : "تم استلام الكارنيه.. الأدمن يراجعه الآن"}
                </p>
              </div>
            )}
          </Card>

          <div className="bg-orange-500/5 p-6 rounded-[2.5rem] border border-orange-500/10">
            <h4 className="text-[10px] font-black text-orange-500 mb-3 flex items-center gap-2 justify-end uppercase">
              تنبيه الأمان اللوجستي <AlertCircle size={14} />
            </h4>
            <ul className="text-[9px] space-y-2 text-gray-400 font-bold">
              <li>• بيانات الكارنيه مشفرة تماماً ولا تظهر لأي مستخدم آخر.</li>
              <li>• التوثيق يمنحك حق الوصول لطلبات العمولة المرتفعة.</li>
              <li>• أي تلاعب في الهوية يؤدي لحظر الحساب نهائياً من الشبكة.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}