import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { 
  MapPin, Plus, Filter, MessageCircle, Camera, X, 
  ChevronRight, ChevronLeft, Loader2, Trash2,
  Wifi, Wind, Shirt, Utensils
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const housingTypes = [
  { id: 'apartment', label: 'شقة كاملة' },
  { id: 'room', label: 'غرفة مستقلة' },
  { id: 'shared', label: 'مطلوب شريك سكن' }
];

const amenitiesList = [
  { id: 'wifi', label: 'واي فاي', icon: Wifi },
  { id: 'ac', label: 'تكييف', icon: Wind },
  { id: 'laundry', label: 'غسالة', icon: Shirt },
  { id: 'kitchen', label: 'مطبخ مجهز', icon: Utensils },
];

export default function Housing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [genderFilter, setGenderFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [selectedHousing, setSelectedHousing] = useState<any | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  
  const [form, setForm] = useState({ 
    title: '', price: '', location: '', type: 'room', 
    gender_preference: 'male', description: '', contact_phone: '',
    amenities: [] as string[]
  });

  const { data: listings, isLoading } = useQuery({
    queryKey: ['housing', genderFilter, typeFilter],
    queryFn: async () => {
      let q = supabase.from('housing').select('*');
      if (genderFilter !== 'all') q = q.eq('gender_preference', genderFilter);
      if (typeFilter !== 'all') q = q.eq('type', typeFilter);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addListing = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("سجل دخولك أولاً");
      if (imageFiles.length === 0) throw new Error("ارفع صورة واحدة على الأقل");
      setIsUploading(true);
      
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const fileName = `${crypto.randomUUID()}-${file.name}`;
        await supabase.storage.from('product_images').upload(fileName, file);
        const { data } = supabase.storage.from('product_images').getPublicUrl(fileName);
        imageUrls.push(data.publicUrl);
      }

      // الحل النهائي للـ 2 بروبليم باستخدام (as any) ✅
      const { error } = await (supabase.from('housing') as any).insert([{
        poster_id: user.id,
        title: form.title.trim(),
        price: parseFloat(form.price) || 0,
        location: form.location.trim(),
        type: form.type as any, // حل بروبليم النوع
        gender_preference: form.gender_preference as any, // حل بروبليم الجنس
        description: form.description,
        images: imageUrls,
        contact_phone: form.contact_phone.trim(),
        amenities: form.amenities
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housing'] });
      setOpen(false);
      setImageFiles([]);
      setForm({ title: '', price: '', location: '', type: 'room', gender_preference: 'male', description: '', contact_phone: '', amenities: [] });
      toast.success('تم النشر بنجاح! 🚀');
      setIsUploading(false);
    }
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 bg-[#08080a] min-h-screen text-white font-sans" dir="rtl">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-8 font-sans">
        <div className="text-right leading-tight">
          <h1 className="text-5xl font-black text-orange-500 italic tracking-tighter">HOUSING HUB</h1>
          <p className="text-[9px] text-gray-500 font-bold tracking-[0.3em] uppercase">Delta University</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700 font-black px-10 h-14 rounded-2xl shadow-xl">
              <Plus className="ml-2 h-6 w-6" /> أضف سكن
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0c0c0e] border-white/10 text-white max-w-lg rounded-[2.5rem] overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-right text-orange-500">تفاصيل السكن</DialogTitle>
              <DialogDescription className="sr-only">Form</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 mt-6 pb-4">
              <div className="grid grid-cols-4 gap-2 border border-white/5 p-4 rounded-3xl bg-white/[0.02]">
                {imageFiles.map((f, i) => (
                  <div key={i} className="relative h-20 rounded-2xl overflow-hidden group border border-white/5">
                    <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                    <button onClick={() => setImageFiles(imageFiles.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><X size={16}/></button>
                  </div>
                ))}
                <label className="h-20 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                  <Camera size={24} className="text-gray-500 mb-1" />
                  <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => e.target.files && setImageFiles([...imageFiles, ...Array.from(e.target.files)])} />
                </label>
              </div>

              <Input placeholder="عنوان الإعلان" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="bg-white/5 border-none h-12 rounded-xl text-right font-bold" />
              
              <div className="grid grid-cols-2 gap-4">
                <Select value={form.gender_preference} onValueChange={(v) => setForm({...form, gender_preference: v})}>
                  <SelectTrigger className="bg-white/5 border-none h-12 rounded-xl text-right font-black"><SelectValue placeholder="النوع" /></SelectTrigger>
                  <SelectContent className="bg-[#0c0c0e] border-white/10 text-white"><SelectItem value="male">بنين 👨‍🎓</SelectItem><SelectItem value="female">بنات 👩‍🎓</SelectItem></SelectContent>
                </Select>
                <Input placeholder="السعر" type="number" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} className="bg-white/5 border-none h-12 text-center rounded-xl font-black" />
              </div>

              <div className="space-y-2 text-right font-sans">
                <Label className="text-gray-500 text-[10px] uppercase font-bold tracking-widest px-1">المميزات</Label>
                <div className="grid grid-cols-2 gap-2 font-sans">
                  {amenitiesList.map(am => (
                    <div key={am.id} onClick={() => setForm(p => ({...p, amenities: p.amenities.includes(am.id) ? p.amenities.filter(a => a !== am.id) : [...p.amenities, am.id]}))} 
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${form.amenities.includes(am.id) ? 'bg-orange-600/10 border-orange-600 text-orange-500' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                      <am.icon size={18} />
                      <span className="text-xs font-black">{am.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <textarea placeholder="وصف السكن..." value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="w-full bg-white/5 border-none rounded-[1.5rem] p-4 text-right h-24 outline-none font-bold" />
              
              <Button onClick={() => addListing.mutate()} disabled={isUploading} className="w-full bg-orange-600 h-16 font-black rounded-3xl text-xl shadow-2xl">
                {isUploading ? <Loader2 className="animate-spin text-white" /> : 'نشر الإعلان'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pt-6 font-sans">
        {listings?.map((h: any) => (
          <motion.div key={h.id} layout onClick={() => setSelectedHousing(h)} className="bg-[#121214] border border-white/5 p-4 rounded-[3rem] cursor-pointer group transition-all shadow-2xl hover:border-orange-500/40">
            <div className="h-56 rounded-[2.5rem] overflow-hidden mb-5 bg-zinc-900 relative">
              <img src={h.images?.[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <Badge className={`absolute top-4 right-4 border-none font-black text-[9px] px-4 py-2 rounded-full backdrop-blur-md ${h.gender_preference === 'male' ? 'bg-blue-600/80' : 'bg-pink-600/80'}`}>
                {h.gender_preference === 'male' ? 'بنين' : 'بنات'}
              </Badge>
            </div>
            <div className="text-right px-3">
              <h3 className="font-black text-white text-xl truncate">{h.title}</h3>
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-1 text-[11px] text-gray-500 font-bold italic"><MapPin size={14} className="text-orange-500"/> {h.location}</div>
                <p className="text-orange-500 font-black text-2xl">{h.price} <span className="text-[10px] text-gray-600">ج.م</span></p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal التفاصيل */}
      <Dialog open={!!selectedHousing} onOpenChange={() => { setSelectedHousing(null); setCurrentImgIndex(0); }}>
        <DialogContent className="bg-[#0a0a0c] border-white/10 text-white max-w-2xl rounded-[3rem] overflow-y-auto max-h-[90vh]" dir="rtl">
          {selectedHousing && (
            <div className="space-y-8 pt-4">
              <div className="h-[400px] rounded-[3rem] overflow-hidden relative border border-white/5 bg-white/[0.02] shadow-inner group">
                <img src={selectedHousing.images?.[currentImgIndex]} className="w-full h-full object-contain p-6" />
                {selectedHousing.images?.length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-between px-6 opacity-0 group-hover:opacity-100 transition-all">
                    <Button size="icon" variant="ghost" className="bg-black/60 rounded-full" onClick={() => setCurrentImgIndex(p => (p + 1) % selectedHousing.images.length)}><ChevronRight size={32} /></Button>
                    <Button size="icon" variant="ghost" className="bg-black/60 rounded-full" onClick={() => setCurrentImgIndex(p => (p - 1 + selectedHousing.images.length) % selectedHousing.images.length)}><ChevronLeft size={32} /></Button>
                  </div>
                )}
              </div>
              <div className="text-right space-y-8 px-4 font-sans">
                <div className="flex justify-between items-start border-b border-white/5 pb-8">
                   <div>
                     <h2 className="text-4xl font-black">{selectedHousing.title}</h2>
                     <div className="flex items-center gap-2 text-gray-500 font-black"><MapPin size={18} className="text-orange-500" /> {selectedHousing.location}</div>
                   </div>
                   <p className="text-5xl font-black text-orange-500">{selectedHousing.price} <span className="text-xs text-gray-600">ج.م/شهر</span></p>
                </div>

                <div className="flex flex-wrap justify-end gap-3 font-sans">
                  {amenitiesList.filter(a => selectedHousing.amenities?.includes(a.id)).map(a => (
                    <div key={a.id} className="flex items-center gap-2 bg-orange-500/10 text-orange-500 px-4 py-2 rounded-2xl text-xs font-black border border-orange-500/20 shadow-inner leading-none uppercase tracking-tighter">
                      <a.icon size={14} /> {a.label}
                    </div>
                  ))}
                </div>

                <div className="bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5 min-h-[140px] shadow-inner">
                  <p className="text-gray-400 leading-relaxed font-bold italic text-lg">{selectedHousing.description || "لا يوجد وصف."}</p>
                </div>
                
                <Button onClick={() => window.open(`https://wa.me/20${selectedHousing.contact_phone}`, '_blank')} className="w-full bg-green-600 hover:bg-green-700 h-20 font-black rounded-[2rem] text-2xl shadow-2xl transition-transform active:scale-95 group">
                  <MessageCircle size={32} className="ml-3 group-hover:animate-bounce" /> تواصل عبر واتساب الآن
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}