// This file is updated to fix WebSocket Realtime issues
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  // إضافة إعدادات الـ Realtime لضمان استقرار الاتصال بكرة في العرض
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    timeout: 30000, // زيادة وقت الانتظار لـ 30 ثانية عشان شبكة الجامعة لو ضعيفة
  }
});