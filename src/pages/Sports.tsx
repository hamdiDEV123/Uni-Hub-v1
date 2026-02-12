import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { MapPin, Clock, Users, MessageCircle, Star, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type GenderType = "male" | "female" | "any";

export default function SportsHub() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sportFilter, setSportFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // حساب تاريخ النهاردة لمنع الحجز القديم
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const [form, setForm] = useState({
    title: '',
    sport_type: 'football',
    skill_level: 'intermediate',
    location: '',
    price_per_person: '',
    event_date: today, // القيمة الافتراضية هي النهاردة
    event_time: '',
    max_players: '10',
    contact_phone: '',
    description: '',
    gender_preference: 'any' as GenderType
  });

  // 1. جلب البيانات
  const { data: events, isLoading } = useQuery({
    queryKey: ['sports_data', sportFilter],
    queryFn: async () => {
      let query = (supabase.from('sports_hub') as any).select('*');
      if (sportFilter !== 'all') query = query.eq('sport_type', sportFilter);
      const { data, error } = await query.order('event_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
  });

  // 2. إنشاء حجز جديد مع حماية البيانات
  const createEvent = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      if (!form.title || !form.location || !form.event_time) throw new Error("برجاء ملء جميع البيانات الأساسية");
      if (parseInt(form.max_players) < 2) throw new Error("العدد يجب أن يكون 2 على الأقل");

      const timeParts = form.event_time.split(':');
      const formattedTime = timeParts.length === 2 ? `${form.event_time}:00` : form.event_time;

      const { error } = await (supabase.from('sports_hub') as any).insert([{
        user_id: user.id,
        title: form.title.trim(),
        sport_type: form.sport_type,
        skill_level: form.skill_level,
        location: form.location.trim(),
        price_per_person: Math.abs(parseFloat(form.price_per_person)) || 0,
        event_date: form.event_date,
        event_time: formattedTime,
        max_players: Math.abs(parseInt(form.max_players)) || 10,
        contact_phone: form.contact_phone.trim(),
        gender_preference: form.gender_preference,
        current_players: 1,
        // تخزين ID المنظم في قائمة اللاعبين لمنعه من الانضمام لنفسه
        joined_users: [user.id] 
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports_data'] });
      setIsDialogOpen(false);
      setForm({
        title: '', sport_type: 'football', skill_level: 'intermediate',
        location: '', price_per_person: '', event_date: today,
        event_time: '', max_players: '10', contact_phone: '', description: '',
        gender_preference: 'any'
      });
      toast.success('تم النشر بنجاح! نتقابل في الملعب ⚽');
    },
    onError: (err: any) => toast.error(err.message)
  });

  // 3. الانضمام (مع منع تكرار نفس الشخص)
  const joinEvent = useMutation({
    mutationFn: async (event: any) => {
      if (!user) throw new Error("سجل دخولك أولاً");
      
      // التأكد إن المستخدم منضمش قبل كدة
      const joinedUsers = event.joined_users || [];
      if (joinedUsers.includes(user.id)) throw new Error("أنت منضم بالفعل لهذه الحجزة");
      
      if (event.current_players >= event.max_players) throw new Error("الحجزة اكتملت");

      const { error } = await (supabase.from('sports_hub') as any)
        .update({ 
          current_players: event.current_players + 1,
          joined_users: [...joinedUsers, user.id] // إضافة ID المستخدم للقائمة
        })
        .eq('id', event.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports_data'] });
      toast.success('تم حجز مكانك! 🔥');
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-4 md:p-8 font-sans" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 border-b border-white/5 pb-8">
        <div className="text-right">
          <h1 className="text-6xl font-black text-green-500 italic tracking-tighter leading-none">SPORTS HUB</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-2">Team up, don't play alone.</p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-4">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 text-[10px] font-black">
            {['all', 'football', 'padel'].map(s => (
              <button key={s} onClick={() => setSportFilter(s)} className={`px-6 py-2 rounded-xl transition-all ${sportFilter === s ? 'bg-green-600 shadow-xl text-white' : 'text-gray-500'}`}>
                {s === 'all' ? 'الكل' : s === 'football' ? 'قدم' : 'بادل'}
              </button>
            ))}
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 h-12 rounded-2xl font-black px-8 shadow-xl">نظم نشاط +</Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0c0c0e] border-white/10 text-white rounded-[2.5rem] max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-right text-green-500 font-black text-2xl">إنشاء حجز جديد</DialogTitle>
                <DialogDescription className="text-right text-gray-500 text-xs font-sans italic">ممنوع إدخال تواريخ قديمة أو بيانات وهمية</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-6">
                <Input placeholder="اسم الحجزة (خماسي، بادل..)" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-white/5 border-none h-12 text-right rounded-xl" />
                
                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.sport_type} onValueChange={(v) => setForm({...form, sport_type: v})}>
                    <SelectTrigger className="bg-white/5 border-none h-12 rounded-xl text-right font-bold font-sans"><SelectValue placeholder="الرياضة" /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white text-right"><SelectItem value="football">كرة قدم ⚽</SelectItem><SelectItem value="padel">بادل 🎾</SelectItem></SelectContent>
                  </Select>
                  <Select value={form.gender_preference} onValueChange={(v: GenderType) => setForm({...form, gender_preference: v})}>
                    <SelectTrigger className="bg-white/5 border-none h-12 rounded-xl text-right font-bold font-sans"><SelectValue placeholder="النوع" /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white text-right"><SelectItem value="male">بنين</SelectItem><SelectItem value="female">بنات</SelectItem><SelectItem value="any">الكل</SelectItem></SelectContent>
                  </Select>
                </div>

                <Input placeholder="اسم الملعب أو اللوكيشن" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="bg-white/5 border-none h-12 text-right rounded-xl" />

                <div className="grid grid-cols-2 gap-3 font-sans">
                  <div className="space-y-1 text-right">
                    <Label className="text-[10px] text-gray-500 mr-2">وقت الماتش</Label>
                    <Input type="time" value={form.event_time} onChange={e => setForm({...form, event_time: e.target.value})} className="bg-white/5 border-none h-12 rounded-xl text-center" />
                  </div>
                  <div className="space-y-1 text-right">
                    <Label className="text-[10px] text-gray-500 mr-2">تاريخ الماتش</Label>
                    <Input type="date" min={today} value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} className="bg-white/5 border-none h-12 rounded-xl text-center" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 font-sans text-right">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-500 mr-2">العدد الكلي</Label>
                    <Input type="number" min="2" value={form.max_players} onChange={e => setForm({...form, max_players: e.target.value})} className="bg-white/5 border-none h-12 text-center rounded-xl font-bold" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-500 mr-2 text-green-500">سعر الفرد</Label>
                    <Input type="number" min="0" value={form.price_per_person} onChange={e => setForm({...form, price_per_person: e.target.value})} className="bg-white/5 border-none h-12 text-center rounded-xl font-bold text-green-500" />
                  </div>
                </div>

                <Input placeholder="رقم واتساب للتنسيق" value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} className="bg-white/5 border-none h-12 text-right rounded-xl" />
                
                <Button onClick={() => createEvent.mutate()} className="w-full bg-green-600 h-14 font-black rounded-3xl text-xl mt-4 shadow-2xl active:scale-95 transition-transform">نشر الآن 🔥</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grid Results */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 animate-pulse">
           <Loader2 className="animate-spin text-green-500 h-12 w-12" />
           <p className="text-gray-500 font-black uppercase tracking-[0.2em]">Searching for matches...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {events?.map((act: any) => {
            const isFull = act.current_players >= act.max_players;
            const alreadyJoined = act.joined_users?.includes(user?.id);

            return (
              <motion.div key={act.id} layout initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#121214] border-2 border-white/5 p-6 rounded-[3rem] group hover:border-green-500/40 transition-all flex flex-col shadow-2xl overflow-hidden relative">
                <div className="flex justify-between items-start mb-6">
                  <Badge className={`font-black rounded-full px-4 py-1 border-none shadow-lg ${isFull ? 'bg-red-600' : 'bg-green-600'}`}>
                    {isFull ? 'مكتمل العدد' : `متبقي ${act.max_players - act.current_players} أماكن`}
                  </Badge>
                  <div className="text-4xl opacity-10 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700">
                    {act.sport_type === 'football' ? '⚽' : '🎾'}
                  </div>
                </div>

                <div className="text-right space-y-4 flex-1">
                  <h3 className="text-2xl font-black text-white group-hover:text-green-500 transition-colors leading-tight truncate">{act.title}</h3>
                  <div className="flex items-center justify-end gap-2 text-[10px] font-black text-orange-500 uppercase">
                    <Star size={12} fill="currentColor" /> {act.skill_level} • {act.gender_preference === 'male' ? 'بنين' : act.gender_preference === 'female' ? 'بنات' : 'الكل'}
                  </div>
                  
                  <div className="space-y-2 text-gray-500 text-[11px] font-bold italic border-t border-white/5 pt-4">
                    <div className="flex items-center justify-end gap-2"><MapPin size={14} className="text-green-500"/> {act.location}</div>
                    <div className="flex items-center justify-end gap-2 font-sans"><Clock size={14} className="text-green-500"/> {act.event_date} | {act.event_time}</div>
                  </div>

                  <div className="pt-6 mt-auto flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button onClick={() => window.open(`https://wa.me/20${act.contact_phone}`, '_blank')} className="bg-white/5 hover:bg-green-600/20 text-white hover:text-green-500 rounded-2xl h-11 w-11 p-0 transition-all border border-white/5"><MessageCircle size={20}/></Button>
                      
                      <Button 
                        disabled={isFull || alreadyJoined} 
                        onClick={() => joinEvent.mutate(act)} 
                        className={`font-black rounded-2xl h-11 px-6 shadow-xl transition-all active:scale-95 flex gap-2 ${alreadyJoined ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50' : isFull ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                      >
                         {alreadyJoined ? <><CheckCircle2 size={16}/> منضم</> : 'انضم'}
                      </Button>
                    </div>
                    <div className="text-left font-sans">
                      <p className="text-2xl font-black text-white leading-none">{act.price_per_person}</p>
                      <p className="text-[8px] text-gray-500 font-black uppercase tracking-tighter">EGP/P</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}