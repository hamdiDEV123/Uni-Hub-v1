import { motion } from 'framer-motion';
import { ShoppingBag, Truck, Home, Trophy, TrendingUp, Package, DollarSign, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: orderCount } = useQuery({
    queryKey: ['order-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('buyer_id', user!.id);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: productCount } = useQuery({
    queryKey: ['product-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', user!.id);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const stats = [
    { label: 'Wallet Balance', value: `$${profile?.wallet ?? '0.00'}`, icon: DollarSign, glow: 'neon-glow-blue' },
    { label: 'My Listings', value: productCount ?? 0, icon: Package, glow: 'neon-glow-orange' },
    { label: 'My Orders', value: orderCount ?? 0, icon: Truck, glow: 'neon-glow-green' },
    { label: 'Activity', value: 'Active', icon: TrendingUp, glow: 'neon-glow-blue' },
  ];

  const modules = [
    { title: 'Marketplace', desc: 'Buy & sell university supplies', icon: ShoppingBag, color: 'neon-text-blue', url: '/marketplace' },
    { title: 'Delivery', desc: 'Student-to-student logistics', icon: Truck, color: 'neon-text-orange', url: '/delivery' },
    { title: 'Housing', desc: 'Find your perfect roommate', icon: Home, color: 'neon-text-green', url: '/housing' },
    { title: 'Sports Hub', desc: 'Book pitches & join tournaments', icon: Trophy, color: 'neon-text-blue', url: '/sports' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold">
          Welcome back, <span className="neon-text-blue">{profile?.full_name || 'Student'}</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your campus overview</p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`stat-card ${s.glow}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
              <s.icon className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </div>
        ))}
      </motion.div>

      {/* Quick access modules */}
      <motion.div variants={item}>
        <h2 className="text-lg font-semibold mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((m) => (
            <a key={m.title} href={m.url} className="glass-card-hover p-5 block group">
              <m.icon className={`h-8 w-8 mb-3 ${m.color}`} />
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{m.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
            </a>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
