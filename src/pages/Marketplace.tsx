import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  ShoppingBag, Plus, Search, Crown, Camera, X, Images, ShieldCheck, 
  MessageCircle, Phone, ChevronRight, ChevronLeft, BadgeCheck, Check, XCircle 
} from 'lucide-react';
import { toast } from 'sonner';

const categories = ['Medical', 'Engineering', 'Tech', 'Scrap'] as const;
const conditions = ['جديد', 'مستعمل - كسر زيرو', 'مستعمل'] as const;

export default function Marketplace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  
  // الحالة الابتدائية للفورم مع القسم الافتراضي
  const [form, setForm] = useState({ 
    title: '', 
    price: '', 
    category: 'Engineering' as string, // القيمة الافتراضية
    description: '', 
    phone: '', 
    condition: 'جديد' 
  });
  
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', filter, search],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('*, profiles:seller_id(full_name, verified_status, role)')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter !== 'all') q = q.eq('category', filter as any);
      if (search) q = q.ilike('title', `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const addProduct = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
      if (imageFiles.length === 0) throw new Error("يرجى اختيار صورة واحدة على الأقل");
      if (!form.title || !form.price || !form.phone) throw new Error("يرجى ملء البيانات الأساسية ورقم الموبايل");

      setIsUploading(true);
      const imageUrls: string[] = [];

      try {
        for (const file of imageFiles) {
          const fileName = `${crypto.randomUUID()}-${file.name}`;
          const { error: uploadError } = await supabase.storage.from('product_images').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('product_images').getPublicUrl(fileName);
          imageUrls.push(data.publicUrl);
        }

        const { error } = await (supabase.from('products') as any).insert({
          seller_id: user.id,
          title: form.title.trim(),
          price: parseFloat(form.price) || 0,
          category: form.category,
          description: form.description.trim() || '',
          image_url: imageUrls,
          phone: form.phone.trim(),
          condition: form.condition,
          is_featured: false,
          status: 'available'
        });

        if (error) throw error;
      } catch (err: any) { throw new Error(err.message || "فشلت عملية الرفع"); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setOpen(false);
      setImageFiles([]);
      setForm({ title: '', price: '', category: 'Engineering', description: '', phone: '', condition: 'جديد' });
      toast.success('تم رفع المنتج بنجاح! 🚀');
      setIsUploading(false);
    },
    onError: (e: any) => { toast.error(e.message); setIsUploading(false); }
  });

  const markAsSold = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from('products').update({ status: 'sold' } as any).eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('تم تحديث حالة المنتج: تم البيع ✅');
      setSelectedProduct(null);
    }
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 bg-[#0a0a0c] min-h-screen text-white font-sans" dir="rtl">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/5 pb-8">
        <div className="text-right">
          <h1 className="text-4xl font-black text-orange-500 tracking-tighter italic">سوق UniHub</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mt-1 font-bold">Project RARE | Delta University</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white gap-2 font-black px-10 h-12 rounded-2xl shadow-[0_10px_30px_rgba(234,88,12,0.2)]">
              <Plus className="h-6 w-6" /> اعرض منتجك الآن
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0c0c0e] border-white/5 text-white max-w-lg shadow-2xl overflow-y-auto max-h-[90vh] rounded-[2rem]" dir="rtl">
            <DialogHeader><DialogTitle className="text-2xl font-black text-right border-b border-white/5 pb-4">بيانات المنتج</DialogTitle></DialogHeader>
            <div className="space-y-5 mt-6 pb-4">
              <div className="space-y-2">
                <Label className="text-gray-400 px-1">اسم المنتج</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-white/5 border-white/5 h-12 text-right rounded-xl" placeholder="مثال: لابتوب Dell G15" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 px-1">السعر</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-white/5 border-white/5 h-12 text-center rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 px-1">حالة المنتج</Label>
                  <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                    <SelectTrigger className="bg-white/5 border-white/5 h-12 text-right rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/5 text-white">{conditions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* الجزء المضاف حديثاً: خانة القسم - Category ✅ */}
              <div className="space-y-2">
                <Label className="text-gray-400 px-1">تصنيف القسم</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="bg-white/5 border-white/5 h-12 text-right rounded-xl">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/5 text-white">
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 px-1">رقم الموبايل</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-white/5 border-white/5 h-12 text-right rounded-xl" placeholder="01xxxxxxxxx" />
              </div>

              <div className="space-y-2 text-right">
                <Label className="text-gray-400 px-1">وصف المنتج (التفاصيل)</Label>
                <textarea 
                  value={form.description} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                  className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-right text-sm min-h-[100px] focus:border-orange-500/50 outline-none"
                  placeholder="اكتب تفاصيل المنتج بوضوح..."
                />
              </div>

              <div className="space-y-2 text-right">
                <Label className="text-gray-400 flex justify-between px-1"><span>اختر عدة صور</span> صور المنتج</Label>
                <div className="grid grid-cols-4 gap-2 border border-white/5 p-3 rounded-2xl bg-white/[0.02]">
                  {imageFiles.map((file, i) => (
                    <div key={i} className="relative h-16 bg-white/5 rounded-xl overflow-hidden"><img src={URL.createObjectURL(file)} className="w-full h-full object-cover" /><button type="button" onClick={() => setImageFiles(imageFiles.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-600 rounded-full p-0.5"><X size={12}/></button></div>
                  ))}
                  <label className="h-16 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/5"><Camera size={24} className="text-gray-600" /><input type="file" multiple className="hidden" accept="image/*" onChange={(e) => e.target.files && setImageFiles([...imageFiles, ...Array.from(e.target.files)])} /></label>
                </div>
              </div>

              <Button onClick={() => addProduct.mutate()} disabled={isUploading} className="w-full bg-orange-600 hover:bg-orange-700 font-black h-14 text-lg rounded-2xl transition-all">
                {isUploading ? 'جاري الرفع...' : 'عرض المنتج في الماركت'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* البحث والأقسام */}
      <div className="flex flex-col gap-4 max-w-2xl mx-auto">
        <div className="relative group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={20} />
          <Input placeholder="ابحث في UniHub..." className="bg-[#121214] border-white/5 pr-14 h-14 rounded-2xl focus:border-orange-500/50 text-right shadow-2xl" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar justify-center">
          {['all', ...categories].map((cat) => (
            <Button key={cat} variant={filter === cat ? 'default' : 'outline'} onClick={() => setFilter(cat)} className={`rounded-full px-6 h-9 text-[10px] font-black transition-all ${filter === cat ? 'bg-orange-600 border-none' : 'border-white/5 bg-white/5'}`}>{cat === 'all' ? 'الكل' : cat}</Button>
          ))}
        </div>
      </div>

      {/* باقي الكود (عرض المنتجات والمودال) يظل كما هو دون تغيير */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-6">
        {products?.map((p) => {
          const isStore = (p.profiles as any)?.role === 'store';
          const isSold = (p as any).status === 'sold';
          return (
            <motion.div key={p.id} whileHover={{ y: -8 }} className={`relative p-5 rounded-[2.5rem] transition-all shadow-2xl ${isSold ? 'opacity-60 grayscale-[0.3]' : ''} ${isStore ? 'bg-[#0f172a] border border-blue-500/30' : (p as any).is_featured ? 'bg-[#1a1610] border-2 border-orange-500/30' : 'bg-[#121214] border border-white/5'}`}>
              
              <div className="absolute top-2 left-2 flex flex-col gap-2 z-10">
                {isSold ? (
                  <span className="bg-red-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-wider">تم البيع</span>
                ) : (
                  <>
                    {(p as any).is_featured && <Crown className="text-orange-500 bg-black/80 rounded-full p-2 border border-orange-500/20" size={36} />}
                    <span className="bg-black/60 backdrop-blur-md text-[9px] font-black px-3 py-1 rounded-full text-gray-300 border border-white/5">{(p as any).condition || 'مستعمل'}</span>
                  </>
                )}
              </div>

              <div className="h-48 bg-black/40 rounded-[2rem] mb-5 overflow-hidden relative border border-white/5 group cursor-pointer" onClick={() => setSelectedProduct(p)}>
                <img src={p.image_url?.[0] || ''} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                {isStore && <div className="absolute top-3 right-3 bg-blue-600 text-white text-[9px] px-3 py-1.5 rounded-full font-black">متجر معتمد</div>}
              </div>

              <div className="space-y-4 text-right">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-md truncate max-w-[140px] leading-tight">{p.title}</h3>
                  <span className="text-orange-500 font-black text-lg drop-shadow-[0_0_8px_rgba(234,88,12,0.5)]">{p.price} ج.م</span>
                </div>
                
                <div className="flex items-center gap-2 justify-end border-t border-white/5 pt-3 text-[10px] text-gray-500 font-bold">
                   {(p.profiles as any)?.verified_status && <BadgeCheck size={14} className="text-blue-500" />}
                   {(p.profiles as any)?.full_name || 'طالب'}
                </div>
                
                <Button onClick={() => setSelectedProduct(p)} className={`w-full h-12 mt-2 rounded-2xl text-[11px] font-black transition-all ${isSold ? 'bg-zinc-800' : isStore ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white/5 hover:bg-orange-600'}`}>
                  {isSold ? 'تم البيع - التفاصيل' : 'التفاصيل والاتصال'}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* مودال التفاصيل */}
      <Dialog open={!!selectedProduct} onOpenChange={() => { setSelectedProduct(null); setCurrentImgIndex(0); }}>
        <DialogContent className="bg-[#0a0a0c] border-white/10 text-white max-w-2xl overflow-y-auto max-h-[90vh] text-right rounded-[2.5rem]" dir="rtl">
          {selectedProduct && (
            <div className="space-y-8 pt-4">
              <div className="h-[400px] rounded-[2.5rem] overflow-hidden border border-white/5 bg-white/[0.02] relative shadow-inner group">
                <img src={selectedProduct.image_url?.[currentImgIndex]} className="w-full h-full object-contain p-4" />
                {selectedProduct.image_url?.length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-between px-6 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <Button size="icon" variant="ghost" className="bg-black/60 rounded-full text-white" onClick={() => setCurrentImgIndex((prev) => (prev + 1) % selectedProduct.image_url.length)}><ChevronRight size={28} /></Button>
                    <Button size="icon" variant="ghost" className="bg-black/60 rounded-full text-white" onClick={() => setCurrentImgIndex((prev) => (prev - 1 + selectedProduct.image_url.length) % selectedProduct.image_url.length)}><ChevronLeft size={28} /></Button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-start border-b border-white/5 pb-6">
                   <div className="text-right">
                     <h2 className="text-3xl font-black mb-2 leading-tight">{selectedProduct.title}</h2>
                     <span className="bg-orange-500/10 text-orange-500 text-[10px] font-black px-4 py-1.5 rounded-full border border-orange-500/20">{selectedProduct.condition || 'مستعمل'}</span>
                   </div>
                   <div className="text-left text-4xl font-black text-orange-500 drop-shadow-[0_0_10px_rgba(234,88,12,0.4)]">{selectedProduct.price} ج.م</div>
                </div>

                <div className="bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 min-h-[120px]">
                   <p className="text-gray-400 text-md leading-relaxed whitespace-pre-wrap">{selectedProduct.description || "لا يوجد وصف إضافي."}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-8 bg-orange-600/5 rounded-[2.5rem] border border-orange-600/10">
                   {selectedProduct.status === 'sold' ? (
                     <div className="text-red-500 font-black text-xl flex items-center gap-2"><XCircle /> هذا المنتج تم بيعه بالفعل</div>
                   ) : (
                     <div className="flex gap-3 w-full sm:w-auto">
                        <a href={`https://wa.me/${selectedProduct.phone?.startsWith('0') ? '2' + selectedProduct.phone : selectedProduct.phone}?text=مهتم بمنتجك ${selectedProduct.title}`} target="_blank" rel="noreferrer" className="flex-1 sm:flex-none flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-black gap-3 px-8 py-4 rounded-2xl shadow-xl"><MessageCircle size={22} /> واتساب</a>
                        <a href={`tel:${selectedProduct.phone}`} className="flex-1 sm:flex-none flex items-center justify-center border border-white/10 hover:bg-white/5 text-white font-black gap-3 px-8 py-4 rounded-2xl"><Phone size={22} /> اتصال</a>
                        
                        {user?.id === selectedProduct.seller_id && (
                          <Button onClick={() => markAsSold.mutate(selectedProduct.id)} className="bg-zinc-800 hover:bg-red-900 text-white font-black px-6 rounded-2xl transition-colors">تحديد كمباع</Button>
                        )}
                     </div>
                   )}
                   <div className="flex items-center gap-4 text-right">
                      <div><p className="text-[10px] text-orange-500 font-black mb-1 uppercase tracking-widest">المعلن</p><p className="font-black text-xl">{(selectedProduct.profiles as any)?.full_name || "طالب"}</p></div>
                      <div className="h-14 w-14 rounded-3xl bg-orange-500/20 flex items-center justify-center text-orange-500 font-black text-2xl border border-orange-500/10 shadow-inner">{((selectedProduct.profiles as any)?.full_name || "D")?.charAt(0)}</div>
                   </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
