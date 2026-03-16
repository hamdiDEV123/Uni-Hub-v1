import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { MapPin, Clock, MessageCircle, Star, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type GenderType = 'male' | 'female' | 'any';
type SportsEvent = {
  id: string;
  title: string;
  sport_type: string;
  skill_level: string;
  gender_preference: GenderType;
  location: string;
  price_per_person: number;
  event_date: string;
  event_time: string;
  max_players: number;
  current_players: number;
  contact_phone: string | null;
  joined_users: string[] | null;
};

export default function SportsHub() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sportFilter, setSportFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [form, setForm] = useState({
    title: '',
    sport_type: 'football',
    skill_level: 'intermediate',
    location: '',
    price_per_person: '',
    event_date: today,
    event_time: '',
    max_players: '10',
    contact_phone: '',
    description: '',
    gender_preference: 'any' as GenderType,
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ['sports_data', sportFilter],
    queryFn: async () => {
      let query = supabase.from('sports_hub').select('*');
      if (sportFilter !== 'all') query = query.eq('sport_type', sportFilter);
      const { data, error } = await query.order('event_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SportsEvent[];
    },
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      if (!form.title || !form.location || !form.event_time) throw new Error('الرجاء ملء الحقول المطلوبة');
      if (parseInt(form.max_players) < 2) throw new Error('يجب أن يكون عدد اللاعبين 2 على الأقل');

      const timeParts = form.event_time.split(':');
      const formattedTime = timeParts.length === 2 ? `${form.event_time}:00` : form.event_time;

      const { error } = await supabase.from('sports_hub').insert([
        {
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
          joined_users: [user.id],
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports_data'] });
      setIsDialogOpen(false);
      setForm({
        title: '', sport_type: 'football', skill_level: 'intermediate',
        location: '', price_per_person: '', event_date: today,
        event_time: '', max_players: '10', contact_phone: '', description: '',
        gender_preference: 'any',
      });
      toast.success('تم إنشاء الحدث بنجاح');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'خطأ في إنشاء الحدث'),
  });

  const joinEvent = useMutation({
    mutationFn: async (event: SportsEvent) => {
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');
      const joinedUsers = event.joined_users || [];
      if (joinedUsers.includes(user.id)) throw new Error('أنت منضم بالفعل لهذا الحدث');
      if (event.current_players >= event.max_players) throw new Error('الحدث مكتمل');

      const { error } = await supabase.from('sports_hub')
        .update({ current_players: event.current_players + 1, joined_users: [...joinedUsers, user.id] })
        .eq('id', event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports_data'] });
      toast.success('تم الانضمام بنجاح');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'خطأ في الانضمام للحدث'),
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 rounded-2xl border border-border bg-card p-6 shadow-hard">
        <div className="text-right">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-none">ملتقى الرياضة</h1>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">نظم واحجز الأنشطة الرياضية</p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-4">
          <div className="flex bg-card p-1 rounded-xl border border-border text-[10px] font-black shadow-hard-sm">
            {['all', 'football', 'padel'].map((s) => (
              <button key={s} onClick={() => setSportFilter(s)} className={`px-6 py-2 rounded-lg transition-all active:translate-y-1 active:shadow-none ${sportFilter === s ? 'bg-primary text-primary-foreground shadow-hard-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {s === 'all' ? 'الكل' : s === 'football' ? 'كرة' : 'بادل'}
              </button>
            ))}
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 h-12 rounded-xl font-black px-8 shadow-hard active:translate-y-1 active:shadow-hard-sm">أنشئ حدث +</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground rounded-2xl max-h-[95vh] overflow-y-auto shadow-hard">
              <DialogHeader>
                <DialogTitle className="text-right text-2xl font-extrabold tracking-tight text-foreground">إنشاء حدث رياضي</DialogTitle>
                <DialogDescription className="text-right text-xs font-sans italic text-muted-foreground">املأ التفاصيل التالية لنشر الحدث</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-6">
                <Input placeholder="عنوان الحدث (مباراة ودية..)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-card border border-border h-12 text-right rounded-xl focus-visible:ring-0 focus-visible:border-primary" />

                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.sport_type} onValueChange={(v) => setForm({ ...form, sport_type: v })}>
                    <SelectTrigger className="bg-card border border-border h-12 rounded-xl text-right font-bold font-sans focus:ring-0 focus:border-primary"><SelectValue placeholder="الرياضة" /></SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-right"><SelectItem value="football">كرة قدم</SelectItem><SelectItem value="padel">بادل</SelectItem></SelectContent>
                  </Select>
                  <Select value={form.gender_preference} onValueChange={(v: GenderType) => setForm({ ...form, gender_preference: v })}>
                    <SelectTrigger className="bg-card border border-border h-12 rounded-xl text-right font-bold font-sans focus:ring-0 focus:border-primary"><SelectValue placeholder="الجنس" /></SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-right"><SelectItem value="male">شباب</SelectItem><SelectItem value="female">بنات</SelectItem><SelectItem value="any">الكل</SelectItem></SelectContent>
                  </Select>
                </div>

                <Input placeholder="اسم الملعب أو الموقع" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="bg-card border border-border h-12 text-right rounded-xl focus-visible:ring-0 focus-visible:border-primary" />

                <div className="grid grid-cols-2 gap-3 font-sans">
                  <div className="space-y-1 text-right">
                    <Label className="mr-2 text-[10px] text-muted-foreground">وقت البدء</Label>
                    <Input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} className="bg-card border border-border h-12 rounded-xl text-center focus-visible:ring-0 focus-visible:border-primary" />
                  </div>
                  <div className="space-y-1 text-right">
                    <Label className="mr-2 text-[10px] text-muted-foreground">تاريخ البدء</Label>
                    <Input type="date" min={today} value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="bg-card border border-border h-12 rounded-xl text-center focus-visible:ring-0 focus-visible:border-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 font-sans text-right">
                  <div className="space-y-1">
                    <Label className="mr-2 text-[10px] text-muted-foreground">أقصى عدد</Label>
                    <Input type="number" min="2" value={form.max_players} onChange={(e) => setForm({ ...form, max_players: e.target.value })} className="bg-card border border-border h-12 text-center rounded-xl font-bold focus-visible:ring-0 focus-visible:border-primary" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-primary mr-2">سعر الفرد</Label>
                    <Input type="number" min="0" value={form.price_per_person} onChange={(e) => setForm({ ...form, price_per_person: e.target.value })} className="bg-card border border-border h-12 text-center rounded-xl font-bold text-primary focus-visible:ring-0 focus-visible:border-primary" />
                  </div>
                </div>

                <Input placeholder="رقم هاتف للتواصل" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="bg-card border border-border h-12 text-right rounded-xl focus-visible:ring-0 focus-visible:border-primary" />

                <Button onClick={() => createEvent.mutate()} className="w-full bg-primary hover:bg-primary/90 h-14 font-black rounded-2xl text-xl mt-4 shadow-hard active:translate-y-1 active:shadow-hard-sm transition-transform">انشر الحدث</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 animate-pulse">
          <Loader2 className="animate-spin text-primary h-12 w-12" />
          <p className="font-black uppercase tracking-[0.2em] text-muted-foreground">جاري جلب الفعاليات...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {events?.map((act: SportsEvent) => {
            const isFull = act.current_players >= act.max_players;
            const alreadyJoined = act.joined_users?.includes(user?.id);

            return (
              <motion.div key={act.id} layout initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-border p-6 rounded-2xl group hover:border-primary/60 transition-all flex flex-col shadow-hard overflow-hidden relative">
                <div className="flex justify-between items-start mb-6">
                  <Badge className={`font-black rounded-full px-4 py-1 border border-border ${isFull ? 'bg-foreground text-background' : 'bg-primary text-primary-foreground'}`}>
                    {isFull ? 'مكتمل العدد' : `متاح ${act.max_players - act.current_players} أماكن`}
                  </Badge>
                  <div className="text-4xl opacity-10 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700">
                    {act.sport_type === 'football' ? '⚽' : '🎾'}
                  </div>
                </div>

                <div className="text-right space-y-4 flex-1">
                  <h3 className="text-2xl font-extrabold text-foreground group-hover:text-primary transition-colors leading-tight truncate">{act.title}</h3>
                  <div className="flex items-center justify-end gap-2 text-[10px] font-black uppercase text-muted-foreground">
                    <Star size={12} fill="currentColor" /> {act.skill_level} • {act.gender_preference === 'male' ? 'شباب' : act.gender_preference === 'female' ? 'بنات' : 'الكل'}
                  </div>

                  <div className="space-y-2 text-muted-foreground text-[11px] font-bold border-t border-border pt-4">
                    <div className="flex items-center justify-end gap-2"><MapPin size={14} className="text-primary" /> {act.location}</div>
                    <div className="flex items-center justify-end gap-2 font-sans"><Clock size={14} className="text-primary" /> {act.event_date} | {act.event_time}</div>
                  </div>

                  <div className="pt-6 mt-auto flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button onClick={() => window.open(`https://wa.me/20${act.contact_phone}`, '_blank')} className="bg-card text-foreground hover:text-primary rounded-xl h-11 w-11 p-0 transition-all border border-border shadow-hard-sm active:translate-y-1 active:shadow-hard-sm"><MessageCircle size={20} /></Button>

                      <Button
                        disabled={isFull || alreadyJoined}
                        onClick={() => joinEvent.mutate(act)}
                        className={`font-black rounded-xl h-11 px-6 transition-all active:translate-y-1 active:shadow-none flex gap-2 shadow-hard-sm ${alreadyJoined ? 'bg-card text-primary border border-primary' : isFull ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-none border border-border' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
                      >
                        {alreadyJoined ? <><CheckCircle2 size={16} /> مُنضم</> : 'انضم'}
                      </Button>
                    </div>
                    <div className="text-left font-sans">
                      <p className="text-2xl font-extrabold leading-none text-foreground">{act.price_per_person}</p>
                      <p className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground">ج.م/فرد</p>
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
