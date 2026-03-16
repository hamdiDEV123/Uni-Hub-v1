import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import {
  User,
  School,
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Camera,
  Loader2,
  CheckCircle,
  AlertCircle,
  Star,
  Package,
  TrendingUp,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type ReviewRow = {
  id: string;
  rating: number | null;
  comment: string | null;
  created_at: string;
};

export default function Profile() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      setProfile(data ?? null);
    } catch {
      toast.error('حدث خطأ أثناء تحميل الملف الشخصي');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    void fetchProfile();

    const profileChannel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async () => {
          await fetchProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [fetchProfile, user?.id]);

  const uploadIdCard = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('لم يتم العثور على المستخدم');
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/id-card-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('verification-docs').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ university_card_url: filePath })
        .eq('id', user.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('تم رفع البطاقة.. جاري المراجعة');
    },
    onError: () => {
      toast.error('حدث خطأ.. تأكد من رفع البطاقة');
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // سجل الطلبات (History)
  const { data: history = [] } = useQuery<OrderRow[]>({
    queryKey: ['profile-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`buyer_id.eq.${user?.id},runner_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });
      if (error) {
        toast.error('حدث خطأ أثناء تحميل السجل');
        return [];
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  // التقييمات (Reviews)
  const { data: reviews = [] } = useQuery<ReviewRow[]>({
    queryKey: ['profile-reviews', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('target_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) {
        toast.error('حدث خطأ أثناء تحميل التقييمات');
        return [];
      }
      return (data || []) as ReviewRow[];
    },
    enabled: !!user?.id,
  });

  const totalEarnings =
    history
      ?.filter(o => o.runner_id === user?.id && o.status === 'delivered')
      .reduce((acc, curr) => acc + Number(curr.fee ?? 0), 0) || 0;
  const completedMissions = history?.filter(o => o.runner_id === user?.id && o.status === 'delivered').length || 0;
  const averageRating = reviews?.length ? (reviews.reduce((acc: number, curr: { rating: number | null }) => acc + (curr.rating || 0), 0) / reviews.length).toFixed(1) : '0.0';

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent text-primary font-black uppercase tracking-tighter">
        جاري تحميل بيانات الحساب...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-6 text-right text-foreground font-sans" dir="rtl">
      <div className="mb-8 flex items-center justify-between rounded-3xl border border-border bg-card p-5 shadow-hard">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase">الملف الشخصي</h1>
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase text-right">بيانات المستخدم الأساسية</p>
        </div>
        <div className="bg-primary/10 p-3 rounded-2xl border border-primary/25">
          <User className="text-primary" size={28} />
        </div>
      </div>

      {/* إحصائيات الحساب السريعة */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="bg-card border-border p-4 flex flex-col items-center justify-center gap-2 rounded-[2rem] shadow-hard interactive-lift">
          <div className="bg-primary/10 p-2 rounded-full text-primary"><TrendingUp size={20} /></div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground font-bold">إجمالي الأرباح</p>
            <p className="text-xl font-black text-foreground">{totalEarnings} ج.م</p>
          </div>
        </Card>
        <Card className="bg-card border-border p-4 flex flex-col items-center justify-center gap-2 rounded-[2rem] shadow-hard interactive-lift">
          <div className="bg-success/10 p-2 rounded-full text-success"><Award size={20} /></div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground font-bold">المهام المكتملة</p>
            <p className="text-xl font-black text-foreground">{completedMissions}</p>
          </div>
        </Card>
        <Card className="bg-card border-border p-4 flex flex-col items-center justify-center gap-2 rounded-[2rem] shadow-hard interactive-lift">
          <div className="bg-warning/10 p-2 rounded-full text-warning"><Star size={20} /></div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground font-bold">متوسط التقييم</p>
            <p className="text-xl font-black text-foreground">{averageRating}</p>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full bg-muted p-1 rounded-2xl border border-border h-14 shadow-hard-sm">
          <TabsTrigger value="reviews" className="flex-1 rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-12">التقييمات</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-12">سجل الطلبات</TabsTrigger>
          <TabsTrigger value="overview" className="flex-1 rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-12">نظرة عامة</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6 text-right">
              <Card className="border-border bg-card p-8 rounded-[2.5rem] shadow-hard">
                <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-primary justify-end">
                  البيانات الشخصية <User size={20} />
                </h2>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground block uppercase">الاسم الكامل</label>
                    <Input value={profile?.full_name || ''} disabled className="bg-muted/50 border-border h-12 rounded-xl text-right font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground block uppercase">البريد الإلكتروني</label>
                    <Input value={user?.email || ''} disabled className="bg-muted/50 border-border h-12 rounded-xl text-right font-bold" />
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-black text-muted-foreground block uppercase">الرقم الجامعي</label>
                    <div className="flex items-center gap-2 bg-muted/50 border border-border h-12 rounded-xl px-4 flex-row-reverse">
                      <School size={18} className="text-muted-foreground" />
                      <span className="text-sm font-bold">{profile?.university_id || 'غير متوفر'}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border-border bg-card p-8 rounded-[2.5rem] border-r-4 border-r-primary shadow-hard">
                <div className="flex items-center justify-between">
                  <Button className="font-black h-12 rounded-xl px-6 transition-all active:scale-95 shadow-hard-sm">شحن</Button>
                  <div className="flex items-center gap-4 flex-row-reverse text-right">
                    <div className="rounded-2xl bg-primary/10 p-4 text-primary border border-primary/25">
                      <Wallet size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">رصيد المحفظة</p>
                      <h3 className="text-2xl font-black text-foreground">{profile?.wallet || '0.00'} ج.م</h3>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-6 text-right">
              <Card className={`border-2 p-8 rounded-[3rem] transition-all duration-700 shadow-hard ${profile?.verified_status ? 'border-success/40 bg-success/5' : 'border-primary/25 bg-primary/5'}`}>
                <div className="mb-6 flex items-center justify-between">
                  <Badge className={profile?.verified_status ? 'bg-success/15 text-success border border-success/30 px-4 font-black' : 'bg-warning/15 text-warning border border-warning/30 px-4 font-black'}>
                    {profile?.verified_status ? 'موثق' : 'غير موثق'}
                  </Badge>
                  <h2 className={`flex items-center gap-2 text-lg font-black ${profile?.verified_status ? 'text-success' : 'text-primary'}`}>
                    حالة التوثيق {profile?.verified_status ? <ShieldCheck className="animate-pulse" /> : <ShieldAlert />}
                  </h2>
                </div>

                <p className="mb-8 text-[11px] font-bold leading-relaxed text-muted-foreground">
                  يتم مراجعة مستندات التوثيق يدويًا لضمان سلامة المستخدمين داخل المجتمع.
                </p>

                {!profile?.university_card_url ? (
                  <div className="relative group cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && uploadIdCard.mutate(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="border-2 border-dashed border-border p-12 rounded-[2.5rem] text-center group-hover:border-primary/50 transition-all bg-muted/20">
                      {isUploading ? <Loader2 className="mx-auto animate-spin text-primary" /> : <Camera className="mx-auto text-muted-foreground mb-2" size={40} />}
                      <span className="text-[10px] font-black text-muted-foreground block mt-2 uppercase tracking-widest">ارفع بطاقة الجامعة</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/40 p-6 rounded-3xl border border-border text-center flex flex-col items-center gap-3">
                    {profile?.verified_status ? <CheckCircle className="text-success" size={40} /> : <Loader2 className="animate-spin text-primary" size={40} />}
                    <p className="text-xs font-black italic">
                      {profile?.verified_status ? 'تم التوثيق بنجاح' : 'جاري مراجعة المستندات.. سيتم إشعارك قريبًا'}
                    </p>
                  </div>
                )}
              </Card>

              <div className="bg-primary/5 p-6 rounded-[2.5rem] border border-primary/20 shadow-hard-sm">
                <h4 className="text-[10px] font-black text-primary mb-3 flex items-center gap-2 justify-end uppercase">
                  ملاحظات مهمة <AlertCircle size={14} />
                </h4>
                <ul className="text-[9px] space-y-2 text-muted-foreground font-bold">
                  <li>• يتم التحقق من البطاقة خلال 24 ساعة كحد أقصى.</li>
                  <li>• يرجى التأكد من أن البطاقة واضحة وسارية.</li>
                  <li>• لا يتم قبول بطاقات منتهية أو غير مطابقة للبيانات.</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {history?.map((order) => (
            <Card key={order.id} className="bg-card border-border p-4 rounded-3xl flex items-center justify-between shadow-hard-sm interactive-lift">
              <div className="text-left">
                <Badge className={order.status === 'delivered' ? 'bg-success/10 text-success border border-success/30' : 'bg-primary/10 text-primary border border-primary/30'}>
                  {order.status === 'delivered' ? 'مكتمل' : 'قيد التنفيذ'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1 font-bold">{new Date(order.created_at).toLocaleDateString('ar-EG')}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-foreground">{order.title || order.location || 'طلب توصيل'}</p>
                <p className="text-xs text-muted-foreground font-bold flex items-center justify-end gap-1">
                  {order.runner_id === user?.id ? 'قمت بالتوصيل' : 'تم التوصيل بواسطة'} <Package size={12} />
                </p>
              </div>
            </Card>
          ))}
          {history?.length === 0 && <div className="text-center text-muted-foreground py-10 font-bold">لا توجد طلبات حتى الآن</div>}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {reviews?.map((review) => (
            <Card key={review.id} className="bg-card border-border p-4 rounded-3xl shadow-hard-sm interactive-lift">
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className={i < review.rating ? "fill-warning text-warning" : "text-muted-foreground/50"} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground font-bold">{new Date(review.created_at).toLocaleDateString('ar-EG')}</p>
              </div>
              <p className="text-sm text-foreground/90 font-medium text-right">{review.comment || "لا يوجد تعليق"}</p>
            </Card>
          ))}
          {reviews?.length === 0 && <div className="text-center text-muted-foreground py-10 font-bold">لا توجد تقييمات بعد</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
