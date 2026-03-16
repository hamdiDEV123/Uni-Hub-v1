// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// استبدل هذه القيم ببيانات مشروعك من لوحة تحكم Supabase (Settings -> API)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);