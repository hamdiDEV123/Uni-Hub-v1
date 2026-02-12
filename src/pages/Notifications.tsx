import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Bell, CheckCheck, Megaphone, Trophy, ShoppingBag } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

const typeIcons: Record<string, typeof Bell> = {
  System: Megaphone,
  Sports: Trophy,
  Market: ShoppingBag,
};
const typeColors: Record<string, string> = {
  System: 'bg-primary/20 text-primary',
  Sports: 'bg-accent/20 text-accent',
  Market: 'bg-secondary/20 text-secondary',
};

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 neon-text-orange" />
            Notifications
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground font-mono">{unreadCount}</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">Stay updated on campus activity</p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()} className="gap-1 border-border/50 text-xs">
            <CheckCheck className="h-3 w-3" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="glass-card h-16 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {notifications?.map((n) => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`glass-card p-4 flex items-start gap-3 transition-all ${!n.is_read ? 'border-l-2 border-l-primary' : 'opacity-60'}`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${typeColors[n.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm">{n.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/50 font-mono mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </motion.div>
            );
          })}
          {notifications?.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No notifications yet</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
