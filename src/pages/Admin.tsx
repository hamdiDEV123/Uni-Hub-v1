import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  ShieldCheck, Users, TrendingUp, Wallet, Store, Search, Megaphone, ShieldAlert, Camera, Activity, FileCheck 
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type OrderRow = Database['public']['Tables']['orders']['Row'];
type ProfileRowWithAdminNotes = ProfileRow & { admin_notes?: string | null };
type ProfileAdminRow = ProfileRowWithAdminNotes & { status?: string };
type ProfileDbUpdate = Partial<Pick<Database['public']['Tables']['profiles']['Update'], 'verified_status' | 'university_card_url' | 'role'>> & {
  admin_notes?: string | null;
};
type ProfileAdminUpdate = Partial<ProfileDbUpdate> & { status?: 'active' | 'banned' };
type OrderStat = { name: string; value: number };
type AdminStats = {
  totalUsers: number;
  commission: number;
  activeStores: number;
  pendingVerifications: number;
  orderStats: OrderStat[];
};

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [announcement, setAnnouncement] = useState('');

  // 1. جلب الإحصائيات (حقيقية من الداتابيز)
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data: prods } = await supabase.from('products').select('*');
      const { data: users } = await supabase.from('profiles').select('*');
      const { data: orders } = await supabase.from('orders').select('*');
      
      const p = (prods ?? []) as ProductRow[];
      const u = (users ?? []) as ProfileAdminRow[];
      const o = (orders ?? []) as OrderRow[];

      return {
        totalUsers: u.length,
        commission: o.filter(ord => ord.status === 'delivered').reduce((acc, curr) => acc + (Number(curr.fee ?? 0) * 0.1), 0),
        activeStores: u.filter(user => user.role === 'store').length,
        pendingVerifications: u.filter(user => user.university_card_url && !user.verified_status).length,
        orderStats: [
          { name: 'معلق', value: o.filter(ord => ord.status === 'pending').length },
          { name: 'نشط', value: o.filter(ord => ord.status === 'active').length },
          { name: 'مكتمل', value: o.filter(ord => ord.status === 'delivered').length },
        ]
      };
    },
  });

  // 2. جلب قائمة المستخدمين
  const { data: allUsers } = useQuery<ProfileAdminRow[]>({
    queryKey: ['admin-users', searchQuery],
    queryFn: async () => {
      let q = supabase.from('profiles').select('*');
      if (searchQuery) q = q.ilike('full_name', `%${searchQuery}%`);
      const { data } = await q;
      const rows = (data ?? []) as ProfileRowWithAdminNotes[];
      return rows.map((user) => ({
        ...user,
        status: user.admin_notes?.includes('status:banned') ? 'banned' : 'active',
      })) as ProfileAdminRow[];
    },
  });

  // 3. أوامر الإدارة (التوثيق والحظر)
  const updateStatus = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ProfileAdminUpdate }) => {
      const { status, ...dbUpdates } = updates;
      const normalizedUpdates: ProfileDbUpdate = { ...dbUpdates };

      if (status) {
        normalizedUpdates.admin_notes = status === 'banned' ? 'status:banned' : null;
      }

      const { error } = await supabase.from('profiles').update(normalizedUpdates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('تم تحديث حالة المستخدم بنجاح! 🛡️');
    }
  });

  const COLORS = ['hsl(var(--warning))', 'hsl(var(--primary))', 'hsl(var(--success))'];

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen text-foreground text-right font-sans" dir="rtl">
      
      {/* هيدر التحكم والرسائل */}
      <div className="flex justify-between items-center border-b border-border pb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-row-reverse">
          <ShieldAlert className="text-primary animate-pulse" size={35} />
          <div className="text-right">
            <h1 className="text-3xl font-black tracking-tighter text-foreground">RARE COMMAND CENTER</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">إدارة الأمان والتوثيق اللوجستي</p>
          </div>
        </div>
        <div className="flex bg-card p-2 rounded-2xl border border-border gap-3 w-full lg:w-auto shadow-hard-sm">
           <Button
             onClick={() => {
               const trimmed = announcement.trim();
               if (!trimmed) {
                 toast.error('اكتب الرسالة أولاً');
                 return;
               }
               toast.success('تم النشر');
               setAnnouncement('');
             }}
             className="font-bold px-6 rounded-xl shadow-hard-sm interactive-lift"
           >
             نشر
           </Button>
           <Input
             placeholder="أرسل إشعاراً لجميع الطلاب..."
             className="bg-transparent border-border text-right h-11 min-w-[300px]"
             value={announcement}
             onChange={(e) => setAnnouncement(e.target.value)}
           />
           <div className="flex items-center px-4 border-r border-border text-primary"><Megaphone size={20}/></div>
        </div>
      </div>

      {/* كروت الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="عمولات النظام" value={`${stats?.commission || 0} ج.م`} icon={<Wallet className="text-primary" />} />
        <StatCard title="المتاجر المعتمدة" value={stats?.activeStores || 0} icon={<Store className="text-primary" />} />
        <StatCard title="طلبات توثيق" value={stats?.pendingVerifications || 0} icon={<Camera className="text-warning" />} />
        <StatCard title="إجمالي المستخدمين" value={stats?.totalUsers || 0} icon={<Users className="text-muted-foreground" />} />
      </div>

      {/* قسم التوثيق اليدوي (الجزء اللي كنت نسيته يا هندسة) ✅ */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-primary mr-2 flex items-center gap-2 flex-row-reverse">
          <FileCheck size={22} /> مراجعة مستندات التوثيق (ID Verification)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allUsers?.filter(u => u.university_card_url && !u.verified_status).map(u => (
            <Card key={u.id} className="bg-card border-primary/20 p-6 rounded-[2.5rem] relative overflow-hidden group hover:border-primary/50 transition-all shadow-hard interactive-lift">
              <div className="flex justify-between items-start mb-4">
                <Badge className="bg-warning/15 text-warning border border-warning/30 font-black text-[9px]">PENDING APPROVAL</Badge>
                <div className="text-right">
                  <p className="font-black">{u.full_name || 'طالب جديد'}</p>
                  <p className="text-[9px] text-muted-foreground font-bold">{u.university_id || 'غير محدد'}</p>
                </div>
              </div>
              
              {/* عرض صورة الكارنيه من الـ Storage */}
              <div className="h-44 bg-muted/30 rounded-3xl mb-4 overflow-hidden border border-border group relative">
                <img 
                  src={`${supabase.storage.from('verification-docs').getPublicUrl(u.university_card_url).data.publicUrl}`} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                  alt="University Card" 
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => updateStatus.mutate({id: u.id, updates: {verified_status: true}})} className="font-black rounded-xl text-xs h-12 shadow-hard-sm interactive-lift">توثيق ✅</Button>
                <Button onClick={() => updateStatus.mutate({id: u.id, updates: {university_card_url: null}})} className="bg-destructive/10 text-destructive rounded-xl text-xs h-12 font-bold border border-destructive/20 hover:bg-destructive/20">رفض</Button>
              </div>
            </Card>
          ))}
          {stats?.pendingVerifications === 0 && (
            <div className="col-span-full py-12 text-center bg-muted/30 rounded-[2.5rem] border border-dashed border-border opacity-70">
               <ShieldCheck size={32} className="mx-auto mb-2" />
               <p className="text-xs font-black italic">لا توجد طلبات توثيق معلقة</p>
            </div>
          )}
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border p-6 rounded-[2.5rem] lg:col-span-2 shadow-hard">
          <h3 className="font-bold text-sm mb-6 flex items-center gap-2 text-primary"><TrendingUp size={16}/> إحصائيات نمو العمليات اللوجستية</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{n:'1',v:10},{n:'2',v:25},{n:'3',v:45},{n:'4',v:80}]}>
                <defs>
                  <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '15px', color: 'hsl(var(--foreground))'}} />
                  <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorV)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-card border-border p-6 rounded-[2.5rem] shadow-hard">
          <h3 className="font-bold text-sm mb-6 flex items-center gap-2 text-primary"><Activity size={16}/> توزيع حالات الطلبات</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.orderStats} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {stats?.orderStats?.map((entry: OrderStat, index: number) => (
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
      <Card className="bg-card border-border p-8 rounded-[3rem] shadow-hard">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder="ابحث عن طالب..." 
              className="bg-muted/30 border-border pr-12 h-12 rounded-2xl text-right"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <h3 className="font-black text-xl text-primary uppercase">Campus Directory</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allUsers?.map(u => (
            <div key={u.id} className={`p-5 rounded-[2.5rem] border transition-all shadow-hard-sm interactive-lift ${u.status === 'banned' ? 'bg-destructive/5 border-destructive/25' : 'bg-card border-border hover:bg-muted/20'}`}>
               <div className="flex items-center justify-between mb-5 flex-row-reverse">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${u.verified_status ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {u.full_name?.charAt(0) || '?'}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm">{u.full_name || 'طالب جديد'}</p>
                    <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest">{u.role}</p>
                  </div>
               </div>
               <div className="flex gap-2">
                 <Button onClick={() => updateStatus.mutate({id: u.id, updates: {status: u.status === 'banned' ? 'active' : 'banned'}})} className={`flex-1 h-9 rounded-xl text-[9px] font-black ${u.status === 'banned' ? 'bg-primary/10 text-primary border border-primary/25' : 'bg-destructive/10 text-destructive border border-destructive/25'}`}>
                   {u.status === 'banned' ? 'إلغاء الحظر' : 'حظر'}
                 </Button>
                 <Button onClick={() => updateStatus.mutate({id: u.id, updates: {role: u.role === 'store' ? 'student' : 'store'}})} className="flex-1 h-9 rounded-xl text-[9px] font-black bg-muted/30 border border-border">
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

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: ReactNode }) {
  return (
    <Card className="bg-card border-border p-8 rounded-[2.5rem] border-t-4 border-t-primary/35 shadow-hard interactive-lift">
      <div className="flex justify-between items-center flex-row-reverse">
        <div className="p-4 bg-muted/30 rounded-2xl border border-border">{icon}</div>
        <div className="text-right">
          <p className="text-muted-foreground text-[10px] font-black mb-1 uppercase tracking-tighter">{title}</p>
          <h3 className="text-2xl font-black text-foreground">{value}</h3>
        </div>
      </div>
    </Card>
  );
}
