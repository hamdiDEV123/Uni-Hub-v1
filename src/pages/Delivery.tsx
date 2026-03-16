import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { 
  Package, MapPin, CheckCircle2, Plus, 
  Search, ShoppingBag, MessageSquare, ShieldCheck, Lock, Star, Award, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  claimDeliveryOrderSecure,
  completeDeliveryOrderSecure,
  createDeliveryOrderSecure,
  releaseDeliveryOrderSecure,
} from "@/backend/deliveryApi";

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type OrderRow = Database['public']['Tables']['orders']['Row'];

export default function DeliveryHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'requester' | 'runner'>('runner');
  const [enteredOtp, setEnteredOtp] = useState<string>(""); 
  const [rating, setRating] = useState(0); // تقييم الطلب

  const universities = ["جامعة الدلتا", "جامعة المنصورة", "القاهرة", "الاسكندرية", "جامعة عين شمس", "جامعة الأزهر", "أخرى"];
  const [selectedUni, setSelectedUni] = useState("القاهرة");
  const [newOrder, setNewOrder] = useState({ title: '', pickup: '', dropoff: '', fee: '', type: 'external', phone: '' });

  // 1. جلب بيانات المستخدم الحالية من الواجهة الخلفية (ملف شخصي، رصيد)
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user?.id ?? '').single();
      if (error) throw error;
      return data as ProfileRow;
    },
    enabled: !!user,
  });

  // 2. جلب الطلبات
  const { data: orders, isLoading } = useQuery({
    queryKey: ['delivery-orders', selectedUni],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*').eq('description', selectedUni).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
    refetchInterval: 3000,
  });

  // 3. إنشاء طلب (نظام الدفع: حجز المبلغ Escrow)
  const createOrder = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("لم يتم العثور على المستخدم");
      if (!newOrder.title || !newOrder.pickup || !newOrder.dropoff || !newOrder.fee || !newOrder.phone) throw new Error("املأ الفراغات");
      
      const feeAmount = parseFloat(newOrder.fee);
      if (isNaN(feeAmount) || feeAmount <= 0) throw new Error("مبلغ العمولة يجب أن يكون رقمًا موجبًا");
      await createDeliveryOrderSecure({
        title: newOrder.title,
        campus: selectedUni,
        pickup: newOrder.pickup,
        dropoff: newOrder.dropoff,
        fee: feeAmount,
        phone: newOrder.phone,
        type: newOrder.type,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast.success('تم إنشاء الطلب بنجاح! سيتم إعلامك قريبًا');
      setIsDialogOpen(false);
      setNewOrder({ title: '', pickup: '', dropoff: '', fee: '', type: 'external', phone: '' });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء الطلب");
    }
  });

  // 4. تحديث حالة الطلب من قبل الموصل باستخدام OTP لضمان الأمان
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, isClaiming, otp }: { id: string, status: string, isClaiming: boolean, otp?: string }) => {
      const targetOrder = orders?.find(o => o.id === id);
      if (!targetOrder) throw new Error("الطلب غير موجود");

      if (status === 'active' && isClaiming) {
        await claimDeliveryOrderSecure(id);
        return;
      }

      if (status === 'delivered') {
        if (!otp || otp.trim() !== targetOrder.otp_code.toString().trim()) {
          throw new Error("رمز OTP غير صحيح! تأكد من الرمز من العميل");
        }
        await completeDeliveryOrderSecure(id, otp.trim());
        return;
      }

      if (status === 'pending' && !isClaiming) {
        await releaseDeliveryOrderSecure(id);
        return;
      }

      throw new Error("العملية غير صالحة");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast.success('تم تحديث الحالة! شكرًا لتعاونك معنا');
      setEnteredOtp("");
      setRating(0);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث الحالة')
  });

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-background font-black text-primary animate-pulse tracking-tighter text-2xl">{"جاري تحميل خدمة التوصيل..."}</div>;

  // إحصائيات التوصيل
  const completedMissions = orders?.filter(o => o.runner_id === user?.id && o.status === 'delivered').length || 0;
  const totalEarnings = orders?.filter(o => o.runner_id === user?.id && o.status === 'delivered').reduce((acc, curr) => acc + curr.fee, 0) || 0;

  return (
    <div className="min-h-screen bg-background p-4 pb-24 text-right text-foreground font-sans" dir="rtl">
      
      {/* رأس الصفحة العلوي */}
      <div className="mb-6 flex justify-between items-center border-b border-navy/20 pb-4">
        <div className="flex items-center gap-2">
           {profile?.verified_status ? <ShieldCheck size={20} className="text-success"/> : <Lock size={20} className="text-warning"/>}
           <span className={`text-[10px] font-black uppercase ${profile?.verified_status ? 'text-success' : 'text-warning'}`}>
             {profile?.verified_status ? "حساب موثق" : "التوثيق مطلوب للتوصيل"}
           </span>
        </div>
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tighter">{"مركز التوصيل"}</h1>
          <p className="text-[8px] text-muted-foreground font-bold text-left">{"توصيل طلابي آمن"}</p>
        </div>
      </div>

      {/* فلتر الجامعات */}
      <div className="mb-4 flex flex-row-reverse gap-2 overflow-x-auto pb-4 no-scrollbar">
        {universities.map((uni) => (
          <button key={uni} onClick={() => setSelectedUni(uni)}
            className={`whitespace-nowrap rounded-xl border px-5 py-2 text-[10px] font-black transition-all duration-300 ${
              selectedUni === uni ? 'border-primary bg-primary text-primary-foreground shadow-hard-sm' : 'border-navy/20 bg-card text-muted-foreground'
            }`}>
            {uni}
          </button>
        ))}
      </div>

      {/* فلتر العرض */}
      <div className="mb-8 flex flex-row-reverse rounded-2xl border border-navy/20 bg-muted/30 p-1 shadow-hard-sm">
        <button onClick={() => setViewMode('runner')} className={`flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${viewMode === 'runner' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><Search size={16} /> تصفح الطلبات</button>
        <button onClick={() => setViewMode('requester')} className={`flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${viewMode === 'requester' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><ShoppingBag size={16} /> إدارة طلباتي</button>
      </div>

      {/* قسم طلباتي (عندما أكون طالبًا) */}
      {viewMode === 'requester' && (
        <div className="space-y-6">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="cta" className="h-16 w-full gap-3 rounded-[2rem] border-2 border-dashed border-primary/25 font-black">إنشاء طلب توصيل جديد <Plus size={20} /></Button>
            </DialogTrigger>
            <DialogContent className="border-navy/20 bg-card text-right font-sans text-foreground shadow-hard" dir="rtl">
              <DialogHeader><DialogTitle className="text-primary font-black text-xl">تفاصيل طلب التوصيل</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-1">
                 <label className="text-[10px] text-muted-foreground mr-2 font-bold">ماذا تريد توصيله؟</label>
                 <Input placeholder="مثال: أريد توصيل وجبة من مطعم..." value={newOrder.title} onChange={(e) => setNewOrder({...newOrder, title: e.target.value})} className="bg-muted/30 border-border h-12 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                   <label className="text-[10px] text-muted-foreground mr-2 font-bold">مكان الاستلام</label>
                   <Input placeholder="البوابة" value={newOrder.pickup} onChange={(e) => setNewOrder({...newOrder, pickup: e.target.value})} className="bg-muted/30 border-border h-12 rounded-xl" />
                   </div>
                   <div className="space-y-1">
                   <label className="text-[10px] text-muted-foreground mr-2 font-bold">مكان التسليم</label>
                   <Input placeholder="السكن" value={newOrder.dropoff} onChange={(e) => setNewOrder({...newOrder, dropoff: e.target.value})} className="bg-muted/30 border-border h-12 rounded-xl" />
                   </div>
                </div>
                <div className="space-y-1">
                 <label className="text-[10px] text-muted-foreground mr-2 font-bold">رقم هاتف للتواصل</label>
                 <Input placeholder="رقم الهاتف" value={newOrder.phone} onChange={(e) => setNewOrder({...newOrder, phone: e.target.value})} className="bg-muted/30 border-border h-12 rounded-xl" />
                </div>
                <div className="space-y-1">
                 <label className="text-[10px] text-primary mr-2 font-black uppercase">عمولة التوصيل (ج.م)</label>
                 <Input type="number" placeholder="كم ستدفع للموصل؟" value={newOrder.fee} onChange={(e) => setNewOrder({...newOrder, fee: e.target.value})} className="bg-primary/5 border-primary/20 h-14 rounded-xl text-center text-lg font-black" />
                </div>
               <Button onClick={() => createOrder.mutate()} className="w-full font-black h-14 rounded-2xl shadow-hard-sm mt-4 interactive-lift">تأكيد ونشر الطلب</Button>
               <p className="text-[9px] text-center text-muted-foreground">{"بالضغط هنا يتم حجز مبلغ العمولة من محفظتك لضمان حق الموصل"}</p>
              </div>
            </DialogContent>
          </Dialog>

          {orders?.filter(o => o.buyer_id === user?.id).map(order => (
            <Card key={order.id} className="relative overflow-hidden rounded-[2.5rem] border border-navy/20 bg-card p-6 shadow-hard interactive-lift">
              <div className="flex justify-between items-center mb-4">
                <Badge className={`${order.status === 'active' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary border border-primary/30'} uppercase text-[9px] font-black px-4`}>
                  {order.status === 'pending' ? "في انتظار موصل ⏳" : order.status === 'active' ? "جاري التوصيل 🚚" : "تم بنجاح ✅"}
                </Badge>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block font-bold mb-1">عمولة التوصيل</span>
                  <span className="font-black text-primary text-xl">{order.fee} ج.م</span>
                </div>
              </div>
              <p className="font-black text-right mb-6 text-lg">{order.title}</p>
              
              {order.status === 'active' && (
                <div className="bg-primary/10 border border-primary/30 p-5 rounded-3xl text-center space-y-2">
                  <p className="text-[10px] text-primary font-black uppercase">{"كود الأمان"}</p>
                  <p className="text-4xl font-black text-primary tracking-[0.5em]">{order.otp_code}</p>
                  <p className="text-[9px] text-muted-foreground font-bold">شارك هذا الكود مع الموصل عند استلام طلبك فقط</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* قسم التوصيل (عندما أكون موصلًا) */}
      {viewMode === 'runner' && (
        <div className="space-y-6">
          {/* إحصائيات الموصل - Gamification */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="group relative flex items-center gap-3 overflow-hidden border border-navy/20 bg-card/20 p-4">
              <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors"></div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary z-10">
                <Award size={20} />
              </div>
              <div className="z-10">
                <p className="text-[9px] text-muted-foreground font-bold">المهام المكتملة</p>
                <p className="text-xl font-black text-foreground">{completedMissions}</p>
              </div>
            </Card>
            <Card className="group relative flex items-center gap-3 overflow-hidden border border-navy/20 bg-card p-4 shadow-hard-sm">
              <div className="absolute inset-0 bg-success/5 group-hover:bg-success/10 transition-colors"></div>
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success z-10">
                <TrendingUp size={20} />
              </div>
              <div className="z-10">
                <p className="text-[9px] text-muted-foreground font-bold">إجمالي الأرباح</p>
                <p className="text-xl font-black text-foreground">{totalEarnings} <span className="text-[10px] text-muted-foreground">ج.م</span></p>
              </div>
            </Card>
          </div>

          {orders?.filter(o => (o.status === 'pending' || (o.status === 'active' && o.runner_id === user?.id))).map(order => (
            <Card key={order.id} className={`rounded-[3rem] border bg-card p-8 shadow-hard transition-all duration-500 ${order.status === 'active' ? 'scale-[1.02] border-primary/40' : 'border-navy/20'}`}>
              <div className="flex justify-between items-start mb-6">
                <Badge className={order.location.includes('[خارجي]') ? 'bg-primary/10 text-primary border border-primary/30 font-black' : 'bg-primary/10 text-primary border border-primary/30 font-black'}>
                   {order.location.includes('[خارجي]') ? 'خارج الحرم الجامعي' : 'داخل الحرم الجامعي'}
                 </Badge>
                 <div className="text-right">
                  <span className="text-[10px] text-muted-foreground font-black block">عمولة التوصيل</span>
                  <div className="text-primary font-black text-3xl tracking-tighter">{order.fee} <span className="text-xs">ج.م</span></div>
                 </div>
              </div>

              <div className="relative mb-6 rounded-[2.5rem] border border-navy/20 bg-muted/20 p-6 text-right text-[11px] font-bold">
                <p className="font-black text-xl mb-4 flex items-center gap-2 flex-row-reverse"><Package className="text-primary" size={24}/> {order.title}</p>
                 <div className="space-y-2 mr-2">
                  <div className="flex items-center gap-2 flex-row-reverse text-muted-foreground font-black tracking-tight"><MapPin size={12}/> {order.location.split(' -> ')[0].replace(/\[.*?\]/, '')}</div>
                  <div className="h-4 w-0.5 bg-primary/20 mr-1.5"></div>
                  <div className="flex items-center gap-2 flex-row-reverse text-primary font-black tracking-tight"><CheckCircle2 size={12}/> {order.location.split(' -> ')[1]}</div>
                 </div>
              </div>

              <div className="space-y-3">
                {order.status === 'pending' && order.buyer_id !== user?.id && (
                  <Button 
                    onClick={() => {
                      if (!profile?.verified_status) {
                        toast.error("مهم! يجب عليك توثيق حسابك أولاً قبل قبول أي طلبات توصيل.");
                        return;
                      }
                      updateStatus.mutate({ id: order.id, status: 'active', isClaiming: true });
                    }} 
                    className={`w-full h-16 rounded-2xl font-black shadow-hard-sm transition-all ${!profile?.verified_status ? 'bg-muted text-muted-foreground' : 'interactive-lift'}`}
                  >
                    {!profile?.verified_status ? "🔒 التوثيق مطلوب قبل القبول" : "قبول المهمة (موصل)"}
                  </Button>
                )}

                {order.status === 'active' && order.runner_id === user?.id && (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <Button aria-label={`التواصل عبر واتساب بشأن ${order.title}`} onClick={() => window.open(`https://wa.me/2${order.phone_number}`, '_blank')} className="flex-1 h-14 rounded-2xl font-black flex items-center justify-center gap-2 shadow-hard-sm interactive-lift">
                        <MessageSquare size={18} /> واتساب
                      </Button>
                      <Button onClick={() => navigate(`/chat?uid=${order.buyer_id}`)} className="flex-1 h-14 rounded-2xl font-black flex items-center justify-center gap-2 shadow-hard-sm interactive-lift">
                        <MessageSquare size={18} /> شات التطبيق
                      </Button>
                    </div>
                    
                    <div className="space-y-4 rounded-[2.5rem] border border-navy/20 bg-muted/30 p-6">
                      <div className="text-center">
                         <p className="text-[10px] text-muted-foreground font-black mb-2">عند استلام المبلغ من العميل، أدخل كود الأمان:</p>
                         <Input 
                            placeholder="أدخل الـ 4 أرقام هنا" 
                            value={enteredOtp}
                            onChange={(e) => setEnteredOtp(e.target.value)}
                            className="bg-card border-border text-center font-black h-14 text-2xl tracking-[0.5em] rounded-xl focus-halo transition-all"
                            maxLength={4}
                         />
                      </div>
                      
                      {/* تقييم تجربة التوصيل */}
                      <div className="flex justify-center gap-2 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} size={24} className={`cursor-pointer transition-all ${star <= rating ? "fill-warning text-warning scale-110" : "text-muted-foreground"}`} onClick={() => setRating(star)} />
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button onClick={() => updateStatus.mutate({ id: order.id, status: 'delivered', isClaiming: false, otp: enteredOtp })} className="h-14 rounded-2xl font-black text-xs shadow-hard-sm interactive-lift">تأكيد الاستلام وإنهاء المهمة {order.fee} ج.م</Button>
                        <Button onClick={() => updateStatus.mutate({ id: order.id, status: 'pending', isClaiming: false })} className="bg-destructive/10 h-14 rounded-2xl font-black text-xs text-destructive border border-destructive/20 hover:bg-destructive/20">إلغاء المهمة</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {orders?.filter(o => o.status === 'pending' || (o.status === 'active' && o.runner_id === user?.id)).length === 0 && (
             <div className="text-center py-20">
                <Package size={48} className="mx-auto text-muted-foreground mb-4 opacity-30" />
                <p className="text-muted-foreground font-black">لا توجد طلبات توصيل في {selectedUni} حالياً</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
