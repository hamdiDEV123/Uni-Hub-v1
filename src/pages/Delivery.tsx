import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { 
  Package, Loader2, MapPin, CheckCircle2, Plus, 
  Search, ShoppingBag, MessageSquare, XCircle, ShieldCheck, Lock, Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function DeliveryHub() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'requester' | 'runner'>('runner');
  const [enteredOtp, setEnteredOtp] = useState<string>(""); 

  const universities = ["دمياط الجديدة", "دمياط الأهلية", "الدلتا", "المنصورة", "المنصورة الأهلية", "المنصورة الجديدة", "حورس"];
  const [selectedUni, setSelectedUni] = useState("الدلتا");
  const [newOrder, setNewOrder] = useState({ title: '', pickup: '', dropoff: '', fee: '', type: 'external', phone: '' });

  // 1. جلب بيانات البروفايل للتأكد من التوثيق (الركن الأول: التوثيق)
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('profiles') as any).select('*').eq('id', user?.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // 2. جلب الطلبات
  const { data: orders, isLoading } = useQuery({
    queryKey: ['delivery-orders', selectedUni],
    queryFn: async () => {
      const { data, error } = await (supabase.from('orders') as any).select('*').eq('description', selectedUni).order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 3000,
  });

  // 3. نشر طلب (الركن الثالث: حجز الفلوس Escrow)
  const createOrder = useMutation({
    mutationFn: async () => {
      if (!newOrder.title || !newOrder.pickup || !newOrder.dropoff || !newOrder.fee) throw new Error("أكمل البيانات");
      const { error } = await (supabase.from('orders') as any).insert({
        buyer_id: user?.id,
        title: newOrder.title,
        description: selectedUni,
        location: `[${newOrder.type === 'external' ? 'خارجي' : 'داخلي'}] ${newOrder.pickup} ➔ ${newOrder.dropoff}`,
        fee: parseFloat(newOrder.fee),
        status: 'pending',
        otp_code: Math.floor(1000 + Math.random() * 9000).toString(),
        phone_number: newOrder.phone 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] as any });
      toast.success('تم حجز العمولة ونشر الطلب بأمان! 🔐');
      setIsDialogOpen(false);
      setNewOrder({ title: '', pickup: '', dropoff: '', fee: '', type: 'external', phone: '' });
    }
  });

  // 4. تحديث الحالة مع التحقق من الـ OTP وتحويل العمولة
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, isClaiming, otp }: { id: string, status: string, isClaiming: boolean, otp?: string }) => {
      const targetOrder = orders?.find(o => o.id === id);

      // الركن الثاني: التحقق من الكود الرقمي وتحويل الرصيد
      if (status === 'completed') {
        if (!otp || otp.trim() !== targetOrder.otp_code.toString().trim()) {
          throw new Error("كود الاستلام غير صحيح! اطلبه من زميلك يد بيد");
        }

        // تحويل العمولة لمحفظة الموصل (Runner Wallet)
        const { data: runnerProfile } = await (supabase.from('profiles') as any).select('wallet').eq('id', user?.id).single();
        const newBalance = (runnerProfile?.wallet || 0) + targetOrder.fee;
        
        const { error: walletError } = await (supabase.from('profiles') as any)
          .update({ wallet: newBalance })
          .eq('id', user?.id);
        
        if (walletError) throw walletError;
      }

      const payload: any = { status };
      if (isClaiming) payload.runner_id = user?.id;
      if (status === 'pending') payload.runner_id = null;

      const { error } = await (supabase.from('orders') as any).update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] as any });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] as any });
      toast.success('تمت العملية بنجاح! الرصيد الآن في محفظتك 💰');
      setEnteredOtp("");
    },
    onError: (err: any) => toast.error(err.message)
  });

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#0a0a0c] font-black text-orange-500 italic animate-pulse tracking-tighter text-2xl">RARE SECURITY LOADING...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-4 pb-24 text-right text-white font-sans" dir="rtl">
      
      {/* هيدر الأمان اللوجستي */}
      <div className="mb-6 flex justify-between items-center border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
           {profile?.verified_status ? <ShieldCheck size={20} className="text-green-500"/> : <Lock size={20} className="text-orange-500"/>}
           <span className={`text-[10px] font-black uppercase italic ${profile?.verified_status ? 'text-green-500' : 'text-orange-500'}`}>
             {profile?.verified_status ? "Runner الموثوق" : "التوثيق مطلوب للتوصيل"}
           </span>
        </div>
        <div>
          <h1 className="text-2xl font-black text-orange-500 italic tracking-tighter">DELIVERY HUB</h1>
          <p className="text-[8px] text-gray-600 font-bold text-left">SECURE P2P LOGISTICS</p>
        </div>
      </div>

      {/* اختيار الجامعة */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar flex-row-reverse mb-4">
        {universities.map((uni) => (
          <button key={uni} onClick={() => setSelectedUni(uni)}
            className={`whitespace-nowrap px-5 py-2 rounded-xl font-black text-[10px] border transition-all duration-300 ${
              selectedUni === uni ? 'bg-orange-600 border-orange-500 shadow-lg shadow-orange-600/20' : 'bg-white/5 border-white/5 text-gray-500'
            }`}>
            {uni}
          </button>
        ))}
      </div>

      {/* نظام التبديل */}
      <div className="bg-white/5 p-1 rounded-2xl flex flex-row-reverse mb-8 border border-white/5 shadow-inner">
        <button onClick={() => setViewMode('runner')} className={`flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${viewMode === 'runner' ? 'bg-orange-600 text-white' : 'text-gray-500'}`}><Search size={16} /> استكشف الطلبات</button>
        <button onClick={() => setViewMode('requester')} className={`flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${viewMode === 'requester' ? 'bg-orange-600 text-white' : 'text-gray-500'}`}><ShoppingBag size={16} /> طلباتي الخاصة</button>
      </div>

      {/* واجهة المشتري (نشر الطلبات) */}
      {viewMode === 'requester' && (
        <div className="space-y-6">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-16 rounded-[2rem] border-2 border-dashed border-orange-500/20 bg-orange-500/5 text-orange-500 font-black gap-3 shadow-lg hover:bg-orange-500/10">نشر طلب توصيل جديد <Plus size={20} /></Button>
            </DialogTrigger>
            <DialogContent className="bg-[#121214] border-white/10 text-white text-right font-sans" dir="rtl">
              <DialogHeader><DialogTitle className="text-orange-500 font-black italic text-xl">تفاصيل المهمة اللوجستية</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-1">
                   <label className="text-[10px] text-gray-500 mr-2 font-bold">ماذا تريد أن تشحن؟</label>
                   <Input placeholder="مثال: لاب توب، طرد من أمازون، مذكرات..." value={newOrder.title} onChange={(e) => setNewOrder({...newOrder, title: e.target.value})} className="bg-white/5 border-white/10 h-12 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 mr-2 font-bold">نقطة الاستلام</label>
                      <Input placeholder="منين؟" value={newOrder.pickup} onChange={(e) => setNewOrder({...newOrder, pickup: e.target.value})} className="bg-white/5 border-white/10 h-12 rounded-xl" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 mr-2 font-bold">نقطة التوصيل</label>
                      <Input placeholder="فين؟" value={newOrder.dropoff} onChange={(e) => setNewOrder({...newOrder, dropoff: e.target.value})} className="bg-white/5 border-white/10 h-12 rounded-xl" />
                   </div>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] text-gray-500 mr-2 font-bold">رقم الهاتف للتنسيق</label>
                   <Input placeholder="رقم واتسابك" value={newOrder.phone} onChange={(e) => setNewOrder({...newOrder, phone: e.target.value})} className="bg-white/5 border-white/10 h-12 rounded-xl" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] text-orange-500 mr-2 font-black italic uppercase italic">قيمة العمولة (ج.م)</label>
                   <Input type="number" placeholder="كم ستدفع لزميلك؟" value={newOrder.fee} onChange={(e) => setNewOrder({...newOrder, fee: e.target.value})} className="bg-orange-500/5 border-orange-500/20 h-14 rounded-xl text-center text-lg font-black" />
                </div>
                <Button onClick={() => createOrder.mutate()} className="w-full bg-orange-600 font-black h-14 rounded-2xl shadow-xl shadow-orange-600/20 mt-4">تأكيد وحجز العمولة</Button>
                <p className="text-[9px] text-center text-gray-500 italic">بضغطك هنا، يتم حجز مبلغ العمولة من محفظتك لضمان حق الـ Runner</p>
              </div>
            </DialogContent>
          </Dialog>

          {orders?.filter(o => o.buyer_id === user?.id).map(order => (
            <Card key={order.id} className="p-6 rounded-[2.5rem] bg-[#121214] border border-white/10 relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <Badge className={`${order.status === 'active' ? 'bg-blue-500 text-white' : 'bg-orange-500/10 text-orange-500'} uppercase text-[9px] font-black px-4`}>
                  {order.status === 'pending' ? 'في انتظار Runner ⏳' : order.status === 'active' ? 'جاري التوصيل 🚚' : 'تم بنجاح ✅'}
                </Badge>
                <div className="text-right">
                  <span className="text-xs text-gray-500 block font-bold mb-1 italic">قيمة العمولة</span>
                  <span className="font-black text-orange-500 text-xl">{order.fee} ج.م</span>
                </div>
              </div>
              <p className="font-black text-right mb-6 text-lg">{order.title}</p>
              
              {order.status === 'active' && (
                <div className="bg-blue-600/10 border border-blue-500/30 p-5 rounded-3xl text-center space-y-2">
                  <p className="text-[10px] text-blue-500 font-black italic uppercase">SECURITY CODE - كود الأمان</p>
                  <p className="text-4xl font-black text-blue-500 tracking-[0.5em]">{order.otp_code}</p>
                  <p className="text-[9px] text-gray-500 font-bold italic">لا تملي هذا الكود لزميلك إلا بعد استلام طردك</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* واجهة الموصل (استكشاف المهام) */}
      {viewMode === 'runner' && (
        <div className="space-y-6">
          {orders?.filter(o => (o.status === 'pending' || (o.status === 'active' && o.runner_id === user?.id))).map(order => (
            <Card key={order.id} className={`p-8 rounded-[3rem] bg-[#121214] border transition-all duration-500 ${order.status === 'active' ? 'border-green-500/40 shadow-2xl scale-[1.02]' : 'border-white/5'}`}>
              <div className="flex justify-between items-start mb-6">
                 <Badge className={order.location.includes('[خارجي]') ? 'bg-blue-500/10 text-blue-500 font-black' : 'bg-green-500/10 text-green-500 font-black'}>
                   {order.location.includes('[خارجي]') ? 'مشوار خارجي 🚗' : 'توصيل داخلي 🏫'}
                 </Badge>
                 <div className="text-right">
                    <span className="text-[10px] text-gray-500 font-black block italic">الربح المتوقع</span>
                    <div className="text-orange-500 font-black text-3xl italic tracking-tighter">{order.fee} <span className="text-xs">ج.م</span></div>
                 </div>
              </div>

              <div className="bg-white/[0.02] p-6 rounded-[2.5rem] border border-white/5 mb-6 text-right font-bold text-[11px] relative">
                 <p className="font-black text-xl mb-4 flex items-center gap-2 flex-row-reverse"><Package className="text-orange-500" size={24}/> {order.title}</p>
                 <div className="space-y-2 mr-2">
                    <div className="flex items-center gap-2 flex-row-reverse text-gray-400 font-black tracking-tight"><MapPin size={12}/> {order.location.split('➔')[0].replace(/\[.*?\]/, '')}</div>
                    <div className="h-4 w-0.5 bg-orange-500/20 mr-1.5"></div>
                    <div className="flex items-center gap-2 flex-row-reverse text-green-500 font-black tracking-tight"><CheckCircle2 size={12}/> {order.location.split('➔')[1]}</div>
                 </div>
              </div>

              <div className="space-y-3">
                {order.status === 'pending' && order.buyer_id !== user?.id && (
                  <Button 
                    onClick={() => {
                      if (!profile?.verified_status) {
                        toast.error("عفواً! يجب توثيق الكارنيه أولاً في صفحة البروفايل لتتمكن من القبول.");
                        return;
                      }
                      updateStatus.mutate({ id: order.id, status: 'active', isClaiming: true });
                    }} 
                    className={`w-full h-16 rounded-2xl font-black shadow-xl transition-all ${!profile?.verified_status ? 'bg-gray-800 text-gray-500' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'}`}
                  >
                    {!profile?.verified_status ? "🔒 قفل الأمان: التوثيق مطلوب" : "قبول المهمة (Runner)"}
                  </Button>
                )}

                {order.status === 'active' && order.runner_id === user?.id && (
                  <div className="space-y-4">
                    <Button onClick={() => window.open(`https://wa.me/2${order.phone_number}`, '_blank')} className="w-full bg-green-600 h-14 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-green-600/10">
                      <MessageSquare size={18} /> تواصل مع زميلك (واتساب)
                    </Button>
                    
                    <div className="p-6 bg-white/5 rounded-[2.5rem] border border-white/10 space-y-4">
                      <div className="text-center">
                         <p className="text-[10px] text-gray-500 font-black mb-2 italic">اطلب كود الأمان من زميلك لإتمام المهمة:</p>
                         <Input 
                            placeholder="أدخل الـ 4 أرقام هنا" 
                            value={enteredOtp}
                            onChange={(e) => setEnteredOtp(e.target.value)}
                            className="bg-white/10 border-white/20 text-center font-black h-14 text-2xl tracking-[0.5em] rounded-xl focus:border-orange-500 transition-all"
                            maxLength={4}
                         />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button onClick={() => updateStatus.mutate({ id: order.id, status: 'completed', isClaiming: false, otp: enteredOtp })} className="bg-green-600 h-14 rounded-2xl font-black text-xs shadow-lg shadow-green-600/20">تأكيد واستلام {order.fee} ج.م</Button>
                        <Button onClick={() => updateStatus.mutate({ id: order.id, status: 'pending', isClaiming: false })} className="bg-red-500/10 h-14 rounded-2xl font-black text-xs text-red-500 border border-red-500/20">إلغاء المهمة</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {orders?.filter(o => o.status === 'pending' || (o.status === 'active' && o.runner_id === user?.id)).length === 0 && (
             <div className="text-center py-20">
                <Package size={48} className="mx-auto text-gray-800 mb-4 opacity-20" />
                <p className="text-gray-600 font-black italic">لا يوجد مهام متاحة في {selectedUni} حالياً</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}