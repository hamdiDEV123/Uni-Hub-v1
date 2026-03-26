import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';
import { MapPin, Plus, MessageCircle, Camera, X, Loader2, Wifi, Wind, Shirt, Utensils, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { HOUSING_AMENITIES, ROOMMATE_SLEEP_OPTIONS, ROOMMATE_SMOKING_OPTIONS } from './housing/housing.constants';
import { cleanDescription, extractAmenities, extractImageUrls, extractPhoneNumber, normalizeAmenityLabel } from './housing/housing.utils';
import { DEFAULT_ROOMMATE_FORM, type RoommateRequest } from './housing/roommate.types';

type HousingRow = Database['public']['Tables']['housing']['Row'];
type HousingInsert = Database['public']['Tables']['housing']['Insert'];
type HousingType = Database['public']['Enums']['housing_type'];
type GenderType = Database['public']['Enums']['gender_type'];
type HousingRowCompat = HousingRow & {
  images?: string[] | null;
  amenities?: string[] | null;
  contact_phone?: string | null;
};

const amenityIconMap = {
  wifi: Wifi,
  ac: Wind,
  laundry: Shirt,
  kitchen: Utensils,
} as const;

export default function Housing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<'housing' | 'roommate'>('housing');
  const [genderFilter, setGenderFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [roommateOpen, setRoommateOpen] = useState(false);
  const [roommateForm, setRoommateForm] = useState(DEFAULT_ROOMMATE_FORM);
  const [selectedHousing, setSelectedHousing] = useState<HousingRowCompat | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const getHousingImages = (housing: HousingRowCompat | null): string[] => {
    if (!housing) return [];
    const fromArray = Array.isArray(housing.images) ? housing.images : [];
    const fromSingle = housing.image_url ? [housing.image_url] : [];
    const fromDescription = extractImageUrls(housing.description);
    return Array.from(new Set([...fromArray, ...fromSingle, ...fromDescription].filter(Boolean)));
  };

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    return 'حدث خطأ غير متوقع';
  };

  const [form, setForm] = useState({
    title: '', price: '', location: '', type: 'room',
    gender_preference: 'male', description: '', contact_phone: '',
    amenities: [] as string[]
  });

  const { data: listings } = useQuery({
    queryKey: ['housing', genderFilter, typeFilter],
    queryFn: async () => {
      let q = supabase.from('housing').select('*');
      if (genderFilter !== 'all') q = q.eq('gender_preference', genderFilter as GenderType);
      if (typeFilter !== 'all') q = q.eq('type', typeFilter as HousingType);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HousingRow[];
    },
  });

  const { data: roommateRequests } = useQuery({
    queryKey: ['roommate-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roommate_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RoommateRequest[];
    },
  });

  const addListing = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('المستخدم غير موجود');
      if (imageFiles.length === 0) throw new Error('الرجاء رفع صورة واحدة على الأقل');
      if (!form.title.trim() || !form.location.trim()) throw new Error('العنوان والموقع مطلوبان');
      setIsUploading(true);

      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const uuid = crypto.randomUUID();
        const candidatePaths = [`${user.id}/${uuid}-${file.name}`, `${uuid}-${file.name}`];
        let uploadedPath: string | null = null;
        let lastUploadError: unknown = null;

        for (const filePath of candidatePaths) {
          const { error: uploadError } = await supabase.storage.from('product_images').upload(filePath, file, {
            upsert: false,
            contentType: file.type || undefined,
          });
          if (!uploadError) {
            uploadedPath = filePath;
            break;
          }
          lastUploadError = uploadError;
        }

        if (!uploadedPath) throw lastUploadError ?? new Error('فشل رفع الصورة');
        const { data } = supabase.storage.from('product_images').getPublicUrl(uploadedPath);
        imageUrls.push(data.publicUrl);
      }

      const contactPhone = form.contact_phone.trim();
      const enrichedDescription = [
        form.description.trim(),
        contactPhone ? `الهاتف: ${contactPhone}` : '',
        form.amenities.length ? `المرافق: ${form.amenities.join('، ')}` : '',
        imageUrls.length ? `الصور: ${imageUrls.join(' | ')}` : '',
      ].filter(Boolean).join('\n\n');

      const payload: HousingInsert = {
        poster_id: user.id,
        title: form.title.trim(),
        price: parseFloat(form.price) || 0,
        location: form.location.trim(),
        type: form.type as HousingType,
        gender_preference: form.gender_preference as GenderType,
        description: enrichedDescription || null,
        image_url: imageUrls[0] ?? null,
      };
      const { error } = await supabase.from('housing').insert([payload]);
      if (!error) return;

      const message = getErrorMessage(error);
      if (!/image_url|column .*image_url.*does not exist/i.test(message)) {
        throw error;
      }

      const legacyPayload = {
        poster_id: user.id,
        title: form.title.trim(),
        price: parseFloat(form.price) || 0,
        location: form.location.trim(),
        type: form.type as HousingType,
        gender_preference: form.gender_preference as GenderType,
        description: enrichedDescription || null,
        images: imageUrls,
        contact_phone: contactPhone || null,
        amenities: form.amenities,
      };

      const { error: legacyError } = await supabase.from('housing').insert([legacyPayload] as never);
      if (legacyError) throw legacyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housing'] });
      setOpen(false);
      setImageFiles([]);
      setForm({ title: '', price: '', location: '', type: 'room', gender_preference: 'male', description: '', contact_phone: '', amenities: [] });
      setIsUploading(false);
      toast.success('تم إضافة الإعلان');
    },
    onError: (err: unknown) => {
      setIsUploading(false);
      toast.error(getErrorMessage(err));
    },
  });

  const addRoommateRequest = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('المستخدم غير موجود');
      if (!roommateForm.title.trim()) throw new Error('عنوان الطلب مطلوب');

      const payload = {
        user_id: user.id,
        title: roommateForm.title.trim(),
        description: roommateForm.description.trim() || null,
        preferred_gender: roommateForm.preferred_gender,
        preferred_faculty: roommateForm.preferred_faculty.trim() || null,
        sleep_schedule: roommateForm.sleep_schedule,
        smoking_preference: roommateForm.smoking_preference,
        budget_min: roommateForm.budget_min ? Number(roommateForm.budget_min) : null,
        budget_max: roommateForm.budget_max ? Number(roommateForm.budget_max) : null,
        area: roommateForm.area.trim() || null,
        phone: roommateForm.phone.trim() || null,
      };

      const { error } = await supabase.from('roommate_requests').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roommate-requests'] });
      setRoommateOpen(false);
      setRoommateForm(DEFAULT_ROOMMATE_FORM);
      toast.success('تم نشر طلب شريك السكن');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 bg-transparent min-h-screen text-foreground font-sans" dir="rtl">
      <div className="flex items-center justify-between rounded-3xl border border-navy/20 bg-card p-5 shadow-hard font-sans">
        <div className="text-right leading-tight">
          <h1 className="text-5xl font-black text-primary tracking-tighter">سكن الطلاب</h1>
          <p className="text-[9px] text-muted-foreground font-bold tracking-[0.3em] uppercase">اعثر على سكنك المثالي</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="cta" className="h-14 rounded-2xl px-10 font-black">
              <Plus className="ml-2 h-6 w-6" /> أضف سكن
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-[2.5rem] border-navy/20 bg-card text-foreground shadow-hard">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-right text-primary">تفاصيل السكن</DialogTitle>
              <DialogDescription className="sr-only">Housing Form</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 mt-6 pb-4">
              <div className="grid grid-cols-4 gap-2 rounded-3xl border border-navy/20 bg-muted/20 p-4">
                {imageFiles.map((f, i) => (
                  <div key={i} className="relative h-20 rounded-2xl overflow-hidden group border border-border">
                    <img src={URL.createObjectURL(f)} alt={`صورة مرفوعة ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      aria-label={`حذف الصورة ${i + 1}`}
                      onClick={() => setImageFiles(imageFiles.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 flex items-center justify-center bg-red-600/80 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <label className="h-20 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-muted/60 transition-all">
                  <Camera size={24} className="text-muted-foreground mb-1" />
                  <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => e.target.files && setImageFiles([...imageFiles, ...Array.from(e.target.files)])} />
                </label>
              </div>

              <Input placeholder="عنوان الإعلان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-muted/40 border-border h-12 rounded-xl text-right font-bold" />

              <div className="grid grid-cols-2 gap-4">
                <Select value={form.gender_preference} onValueChange={(v) => setForm({ ...form, gender_preference: v })}>
                  <SelectTrigger className="bg-muted/40 border-border h-12 rounded-xl text-right font-black"><SelectValue placeholder="الجنس" /></SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground"><SelectItem value="male">شباب</SelectItem><SelectItem value="female">بنات</SelectItem></SelectContent>
                </Select>
                <Input placeholder="السعر" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-muted/40 border-border h-12 text-center rounded-xl font-black" />
              </div>

              <Input placeholder="الموقع" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="bg-muted/40 border-border h-12 rounded-xl text-right font-bold" />

              <div className="space-y-2 text-right font-sans">
                <Label className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">المرافق</Label>
                <div className="grid grid-cols-2 gap-2 font-sans">
                  {HOUSING_AMENITIES.map((am) => {
                    const AmenityIcon = amenityIconMap[am.id];
                    return (
                    <div key={am.id} onClick={() => setForm((p) => ({ ...p, amenities: p.amenities.includes(am.id) ? p.amenities.filter((a) => a !== am.id) : [...p.amenities, am.id] }))}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 transition-all ${form.amenities.includes(am.id) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-navy/20 bg-muted/30 text-muted-foreground'}`}>
                      <AmenityIcon size={18} />
                      <span className="text-xs font-black">{am.label}</span>
                    </div>
                    );
                  })}
                </div>
              </div>

              <textarea placeholder="أضف وصفًا..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-muted/40 border border-border rounded-[1.5rem] p-4 text-right h-24 outline-none font-bold" />

              <Input placeholder="رقم التواصل" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="bg-muted/40 border-border h-12 rounded-xl text-right font-bold" />

              <Button onClick={() => addListing.mutate()} disabled={isUploading} className="w-full h-16 font-black rounded-3xl text-xl shadow-hard interactive-lift">
                {isUploading ? <Loader2 className="animate-spin text-primary-foreground" /> : 'أضف الإعلان'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={activeSection === 'housing' ? 'default' : 'outline'}
          className="h-11 rounded-2xl font-black"
          onClick={() => setActiveSection('housing')}
        >
          إعلانات السكن
        </Button>
        <Button
          variant={activeSection === 'roommate' ? 'default' : 'outline'}
          className="h-11 rounded-2xl font-black"
          onClick={() => setActiveSection('roommate')}
        >
          Roommate Matcher
        </Button>
        {activeSection === 'roommate' ? (
          <Dialog open={roommateOpen} onOpenChange={setRoommateOpen}>
            <DialogTrigger asChild>
              <Button variant="cta" className="mr-auto h-11 rounded-2xl font-black">
                <Plus className="ml-2 h-4 w-4" />
                أضف طلب روم ميت
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] border-navy/20 bg-card" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right text-primary">طلب شريك سكن</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="عنوان الطلب" value={roommateForm.title} onChange={(e) => setRoommateForm((p) => ({ ...p, title: e.target.value }))} />
                <Input placeholder="الكلية المفضلة" value={roommateForm.preferred_faculty} onChange={(e) => setRoommateForm((p) => ({ ...p, preferred_faculty: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" placeholder="أقل ميزانية" value={roommateForm.budget_min} onChange={(e) => setRoommateForm((p) => ({ ...p, budget_min: e.target.value }))} />
                  <Input type="number" placeholder="أعلى ميزانية" value={roommateForm.budget_max} onChange={(e) => setRoommateForm((p) => ({ ...p, budget_max: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={roommateForm.sleep_schedule} onValueChange={(value) => setRoommateForm((p) => ({ ...p, sleep_schedule: value as 'early' | 'late' | 'flexible' }))}>
                    <SelectTrigger><SelectValue placeholder="مواعيد النوم" /></SelectTrigger>
                    <SelectContent>
                      {ROOMMATE_SLEEP_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={roommateForm.smoking_preference} onValueChange={(value) => setRoommateForm((p) => ({ ...p, smoking_preference: value as 'no' | 'yes' | 'either' }))}>
                    <SelectTrigger><SelectValue placeholder="التدخين" /></SelectTrigger>
                    <SelectContent>
                      {ROOMMATE_SMOKING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="المنطقة" value={roommateForm.area} onChange={(e) => setRoommateForm((p) => ({ ...p, area: e.target.value }))} />
                <Input placeholder="رقم التواصل" value={roommateForm.phone} onChange={(e) => setRoommateForm((p) => ({ ...p, phone: e.target.value }))} />
                <textarea
                  placeholder="وصف تفضيلاتك"
                  value={roommateForm.description}
                  onChange={(e) => setRoommateForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full min-h-24 rounded-xl border border-border p-3"
                />
                <Button className="w-full" onClick={() => addRoommateRequest.mutate()} disabled={addRoommateRequest.isPending}>
                  نشر الطلب
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {activeSection === 'housing' ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pt-6 font-sans">
        {listings?.map((h: HousingRowCompat) => (
          <motion.div key={h.id} layout onClick={() => { setSelectedHousing(h); setCurrentImgIndex(0); }} className="group cursor-pointer rounded-[3rem] border border-navy/20 bg-card p-4 shadow-hard transition-all interactive-lift">
            <div className="h-56 rounded-[2.5rem] overflow-hidden mb-5 bg-zinc-900 relative">
              <img src={getHousingImages(h)[0] || ''} alt={`صورة ${h.title}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <Badge className={`absolute top-4 right-4 border font-black text-[9px] px-4 py-2 rounded-full ${h.gender_preference === 'male' ? 'bg-primary/20 text-primary border-primary/35' : 'bg-warning/20 text-warning border-warning/35'}`}>
                {h.gender_preference === 'male' ? 'شباب' : 'بنات'}
              </Badge>
            </div>
            <div className="text-right px-3">
              <h3 className="font-black text-foreground text-xl truncate">{h.title}</h3>
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-bold"><MapPin size={14} className="text-primary" /> {h.location}</div>
                <p className="text-primary font-black text-2xl">{h.price} <span className="text-[10px] text-muted-foreground">ج.م</span></p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
        {(roommateRequests ?? []).map((request) => (
          <Card key={request.id} className="rounded-3xl border border-navy/20 bg-card p-5 shadow-hard-sm text-right">
            <h3 className="text-lg font-black text-foreground">{request.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{request.preferred_faculty || 'كل الكليات'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{ROOMMATE_SLEEP_OPTIONS.find((item) => item.value === request.sleep_schedule)?.label ?? request.sleep_schedule}</Badge>
              <Badge variant="outline">{ROOMMATE_SMOKING_OPTIONS.find((item) => item.value === request.smoking_preference)?.label ?? request.smoking_preference}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{request.description || 'بدون وصف إضافي'}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-bold text-primary">{request.budget_min ?? 0} - {request.budget_max ?? 0} ج.م</span>
              <Button
                size="sm"
                onClick={() => {
                  if (!request.phone) {
                    toast.error('رقم التواصل غير متاح');
                    return;
                  }
                  window.open(`https://wa.me/20${request.phone}`, '_blank');
                }}
              >
                تواصل
              </Button>
            </div>
          </Card>
        ))}
      </div>
      )}

      <Dialog open={!!selectedHousing} onOpenChange={() => { setSelectedHousing(null); setCurrentImgIndex(0); }}>
        <DialogContent className="w-[95vw] max-w-3xl overflow-hidden rounded-[2rem] border-navy/20 bg-card p-0 text-foreground shadow-hard sm:rounded-[3rem]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {selectedHousing ? `تفاصيل السكن: ${selectedHousing.title}` : 'تفاصيل السكن'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              نافذة عرض تفاصيل إعلان السكن والتواصل مع صاحب الإعلان.
            </DialogDescription>
          </DialogHeader>
          {selectedHousing && (
            <div className="space-y-6 sm:space-y-8 pt-4">
              <div className="h-[280px] sm:h-[420px] overflow-hidden relative border-y border-border bg-muted/20 shadow-inner group">
                <img src={getHousingImages(selectedHousing)[currentImgIndex] || ''} alt={`صورة ${selectedHousing.title} رقم ${currentImgIndex + 1}`} className="w-full h-full object-contain p-4 sm:p-6" />
                {getHousingImages(selectedHousing).length > 1 && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-between px-3 sm:px-6 transition-all">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="الصورة التالية"
                      className="bg-black/60 hover:bg-black/70 text-white rounded-full h-10 w-10 sm:h-12 sm:w-12"
                      onClick={() => setCurrentImgIndex((p) => (p + 1) % getHousingImages(selectedHousing).length)}
                    >
                      <ChevronRight size={24} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="الصورة السابقة"
                      className="bg-black/60 hover:bg-black/70 text-white rounded-full h-10 w-10 sm:h-12 sm:w-12"
                      onClick={() => setCurrentImgIndex((p) => (p - 1 + getHousingImages(selectedHousing).length) % getHousingImages(selectedHousing).length)}
                    >
                      <ChevronLeft size={24} />
                    </Button>
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                      {currentImgIndex + 1} / {getHousingImages(selectedHousing).length}
                    </div>
                  </>
                )}
              </div>
              <div className="text-right space-y-6 px-4 pb-6 sm:px-6 font-sans">
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start border-b border-border pb-6">
                  <div className="min-w-0">
                    <h2 className="text-2xl sm:text-4xl font-black break-words leading-tight">{selectedHousing.title}</h2>
                    <div className="flex items-center gap-2 text-muted-foreground font-black mt-2"><MapPin size={18} className="text-primary" /> {selectedHousing.location}</div>
                  </div>
                  <p className="text-3xl sm:text-5xl font-black text-primary shrink-0">{selectedHousing.price} <span className="text-xs text-muted-foreground">ج.م/شهري</span></p>
                </div>

                {extractAmenities(selectedHousing.description).length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {extractAmenities(selectedHousing.description).map((item) => (
                      <span key={item} className="bg-primary/10 text-primary px-3 py-1 rounded-xl text-[11px] font-black border border-primary/25">
                        {normalizeAmenityLabel(item)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="bg-muted/20 p-8 rounded-[2.5rem] border border-border min-h-[140px] shadow-inner">
                  <p className="text-muted-foreground leading-relaxed font-bold text-lg whitespace-pre-line">{cleanDescription(selectedHousing.description) || 'لا يوجد وصف.'}</p>
                </div>

                <Button onClick={() => {
                  const phone = extractPhoneNumber(selectedHousing.description);
                  if (!phone) {
                    toast.error('رقم التواصل غير متاح لهذا الإعلان');
                    return;
                  }
                  window.open(`https://wa.me/20${phone}`, '_blank');
                }} className="w-full h-20 font-black rounded-[2rem] text-2xl shadow-hard transition-transform active:scale-95 group interactive-lift">
                  <MessageCircle size={32} className="ml-3 group-hover:animate-bounce" /> تواصل مع المالك الآن
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
