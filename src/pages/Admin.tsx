import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  ShieldCheck, Users, TrendingUp, AlertCircle, Wallet, 
  Store, Search, User, Megaphone, ShieldAlert, Ban, 
  CheckCircle2, Camera, Activity, FileCheck 
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [announcement, setAnnouncement] = useState('');

  // 1. جلب الإحصائيات (حقيقية من الداتابيز)
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data: prods } = await (supabase.from('products') as any).select('*');
      const { data: users } = await (supabase.from('profiles') as any).select('*');
      const { data: orders } = await (supabase.from('orders') as any).select('*');
      
      const p = (prods as any[]) || [];
      const u = (users as any[]) || [];
      const o = (orders as any[]) || [];

      return {
        totalUsers: u.length,
        commission: o.filter(ord => ord.status === 'completed').reduce((acc, curr) => acc + (Number(curr.fee) * 0.1), 0),
        activeStores: u.filter(user => user.role === 'store').length,
        pendingVerifications: u.filter(user => user.university_card_url && !user.verified_status).length,
        orderStats: [
          { name: 'معلق', value: o.filter(ord => ord.status === 'pending').length },
          { name: 'نشط', value: o.filter(ord => ord.status === 'active').length },
          { name: 'مكتمل', value: o.filter(ord => ord.status === 'completed').length },
        ]
      };
    },
  });

  // 2. جلب قائمة المستخدمين
  const { data: allUsers } = useQuery({
    queryKey: ['admin-users', searchQuery],
    queryFn: async () => {
      let q = (supabase.from('profiles') as any).select('*');
      if (searchQuery) q = q.ilike('full_name', `%${searchQuery}%`);
      const { data } = await q;
      return (data as any[]) || [];
    },
  });

  // 3. أوامر الإدارة (التوثيق والحظر)
  const updateStatus = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await (supabase.from('profiles') as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('تم تحديث حالة المستخدم بنجاح! 🛡️');
    }
  });

  const COLORS = ['#f97316', '#3b82f6', '#22c55e'];

  return (
    <div className="p-6 space-y-8 bg-[#0a0a0c] min-h-screen text-white text-right font-sans" dir="rtl">
      
      {/* هيدر التحكم والرسائل */}
      <div className="flex justify-between items-center border-b border-white/5 pb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-row-reverse">
          <ShieldAlert className="text-orange-500 animate-pulse" size={35} />
          <div className="text-right">
            <h1 className="text-3xl font-black italic tracking-tighter">RARE COMMAND CENTER</h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">إدارة الأمان والتوثيق اللوجستي</p>
          </div>
        </div>
        <div className="flex bg-white/[0.03] p-2 rounded-2xl border border-white/5 gap-3 w-full lg:w-auto">
           <Button onClick={() => toast.success("تم النشر")} className="bg-orange-600 font-bold px-6 rounded-xl">نشر</Button>
           <Input placeholder="أرسل إشعاراً لجميع الطلاب..." className="bg-transparent border-none text-right h-11 min-w-[300px]" />
           <div className="flex items-center px-4 border-r border-white/10 text-orange-500"><Megaphone size={20}/></div>
        </div>
      </div>

      {/* كروت الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="عمولات النظام" value={`${stats?.commission || 0} ج.م`} icon={<Wallet className="text-green-500" />} color="green" />
        <StatCard title="المتاجر المعتمدة" value={stats?.activeStores || 0} icon={<Store className="text-blue-500" />} color="blue" />
        <StatCard title="طلبات توثيق" value={stats?.pendingVerifications || 0} icon={<Camera className="text-orange-500" />} color="orange" />
        <StatCard title="إجمالي المستخدمين" value={stats?.totalUsers || 0} icon={<Users className="text-gray-400" />} color="gray" />
      </div>

      {/* قسم التوثيق اليدوي (الجزء اللي كنت نسيته يا هندسة) ✅ */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-orange-500 italic mr-2 flex items-center gap-2 flex-row-reverse">
          <FileCheck size={22} /> مراجعة مستندات التوثيق (ID Verification)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allUsers?.filter(u => u.university_card_url && !u.verified_status).map(u => (
            <Card key={u.id} className="bg-[#121214] border-orange-500/20 p-6 rounded-[2.5rem] relative overflow-hidden group hover:border-orange-500/50 transition-all">
              <div className="flex justify-between items-start mb-4">
                <Badge className="bg-orange-500/10 text-orange-500 font-black text-[9px]">PENDING APPROVAL</Badge>
                <div className="text-right">
                  <p className="font-black">{u.full_name || 'طالب جديد'}</p>
                  <p className="text-[9px] text-gray-500 font-bold">{u.university_id || 'غير محدد'}</p>
                </div>
              </div>
              
              {/* عرض صورة الكارنيه من الـ Storage */}
              <div className="h-44 bg-black/40 rounded-3xl mb-4 overflow-hidden border border-white/5 group relative">
                <img 
                  src={`${supabase.storage.from('verification-docs').getPublicUrl(u.university_card_url).data.publicUrl}`} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                  alt="University Card" 
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => updateStatus.mutate({id: u.id, updates: {verified_status: true}})} className="bg-green-600 font-black rounded-xl text-xs h-12 shadow-lg shadow-green-600/10">توثيق ✅</Button>
                <Button onClick={() => updateStatus.mutate({id: u.id, updates: {university_card_url: null}})} className="bg-red-500/10 text-red-500 rounded-xl text-xs h-12 font-bold border border-red-500/10">رفض</Button>
              </div>
            </Card>
          ))}
          {stats?.pendingVerifications === 0 && (
            <div className="col-span-full py-12 text-center bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 opacity-40">
               <ShieldCheck size={32} className="mx-auto mb-2" />
               <p className="text-xs font-black italic">لا توجد طلبات توثيق معلقة</p>
            </div>
          )}
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-[#121214] border-white/5 p-6 rounded-[2.5rem] lg:col-span-2 shadow-2xl">
          <h3 className="font-bold text-sm mb-6 flex items-center gap-2 text-orange-500"><TrendingUp size={16}/> إحصائيات نمو العمليات اللوجستية</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{n:'1',v:10},{n:'2',v:25},{n:'3',v:45},{n:'4',v:80}]}>
                <defs>
                  <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{backgroundColor: '#1a1a1a', border: 'none', borderRadius: '15px'}} />
                <Area type="monotone" dataKey="v" stroke="#f97316" strokeWidth={4} fillOpacity={1} fill="url(#colorV)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-[#121214] border-white/5 p-6 rounded-[2.5rem] shadow-2xl">
          <h3 className="font-bold text-sm mb-6 flex items-center gap-2 text-blue-500"><Activity size={16}/> توزيع حالات الطلبات</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.orderStats} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {stats?.orderStats?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* قائمة المستخدمين العامة */}
      <Card className="bg-[#121214] border-white/5 p-8 rounded-[3rem] shadow-2xl">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <Input 
              placeholder="ابحث عن طالب..." 
              className="bg-white/5 border-white/5 pr-12 h-12 rounded-2xl text-right"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <h3 className="font-black text-xl italic text-orange-500 uppercase">Campus Directory</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allUsers?.map(u => (
            <div key={u.id} className={`p-5 rounded-[2.5rem] border transition-all ${u.status === 'banned' ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}>
               <div className="flex items-center justify-between mb-5 flex-row-reverse">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${u.verified_status ? 'bg-green-600' : 'bg-zinc-800'}`}>
                    {u.full_name?.charAt(0) || '?'}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm">{u.full_name || 'طالب جديد'}</p>
                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">{u.role}</p>
                  </div>
               </div>
               <div className="flex gap-2">
                 <Button onClick={() => updateStatus.mutate({id: u.id, updates: {status: u.status === 'banned' ? 'active' : 'banned'}})} className={`flex-1 h-9 rounded-xl text-[9px] font-black ${u.status === 'banned' ? 'bg-green-600/20 text-green-500' : 'bg-red-600/10 text-red-500'}`}>
                   {u.status === 'banned' ? 'إلغاء الحظر' : 'حظر'}
                 </Button>
                 <Button onClick={() => updateStatus.mutate({id: u.id, updates: {role: u.role === 'store' ? 'student' : 'store'}})} className="flex-1 h-9 rounded-xl text-[9px] font-black bg-white/5 border border-white/10">
                   {u.role === 'store' ? 'سحب المتجر' : 'ترقية لمتجر'}
                 </Button>
               </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <Card className="bg-[#121214] border-white/5 p-8 rounded-[2.5rem] border-t-4 border-t-orange-500/30 shadow-2xl">
      <div className="flex justify-between items-center flex-row-reverse">
        <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">{icon}</div>
        <div className="text-right">
          <p className="text-gray-500 text-[10px] font-black mb-1 uppercase tracking-tighter italic">{title}</p>
          <h3 className="text-2xl font-black text-white italic">{value}</h3>
        </div>
      </div>
    </Card>
  );
}