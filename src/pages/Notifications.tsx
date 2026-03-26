import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Bell, CheckCheck, Megaphone, Trophy, ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { fadeUpItem, pageVariants, staggerContainer } from "@/lib/motion";
import {
  fetchMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToMyNotifications,
  type PlatformNotification,
} from "@/backend/notificationsApi";

const typeIcons: Record<string, typeof Bell> = {
  System: Megaphone,
  Sports: Trophy,
  Market: ShoppingBag,
};

const typeColors: Record<string, string> = {
  System: "bg-primary/20 text-primary",
  Sports: "bg-accent/20 text-accent",
  Market: "bg-secondary/20 text-secondary",
};

function resolveNotificationLink(notification: PlatformNotification): string | null {
  const rawLink = notification.link?.trim();
  if (!rawLink) return null;

  const normalizedLink = rawLink.toLowerCase();
  const isAdminMarketplaceRoot =
    normalizedLink === "/admin" ||
    normalizedLink === "/admin/" ||
    normalizedLink === "/admin/marketplace";

  if (!isAdminMarketplaceRoot || normalizedLink.includes("section=")) {
    return rawLink;
  }

  const text = `${notification.title} ${notification.message}`.toLowerCase();
  const rules: Array<{ section: string; keywords: string[] }> = [
    { section: "receipts", keywords: ["receipt", "manual payment", "إثبات دفع"] },
    { section: "upgrades", keywords: ["upgrade", "tier", "ترقية"] },
    { section: "payouts", keywords: ["payout", "withdraw", "سحب"] },
    { section: "disputes", keywords: ["dispute", "نزاع"] },
    { section: "products", keywords: ["product", "review", "منتج", "مراجعة"] },
  ];

  const matchedRule = rules.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
  );

  if (!matchedRule) return rawLink;
  return `/admin/marketplace?section=${matchedRule.section}`;
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id ?? ""],
    queryFn: async () => fetchMyNotifications(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    return subscribeToMyNotifications(user.id, () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [user, queryClient]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      await markAllNotificationsAsRead(user!.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const openNotification = useMutation({
    mutationFn: async (notification: PlatformNotification) => {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id);
      }
      return resolveNotificationLink(notification);
    },
    onSuccess: (link) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (link) navigate(link);
    },
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  return (
    <motion.div dir="rtl" variants={pageVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUpItem} className="flex items-center justify-between rounded-3xl border border-navy/20 bg-card p-5 shadow-hard">
        <div>
          <span className="mb-2 inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            مركز الإشعارات
          </span>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-foreground">
            <Bell className="h-6 w-6 text-primary" />
            {"الإشعارات"}
            {unreadCount > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{"تابع آخر أحداث المنصة بشكل فوري"}</p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()} className="gap-1 border-navy/30 text-primary text-xs shadow-hard-sm hover:bg-primary/10">
            <CheckCheck className="h-3 w-3" /> {"تعليم الكل كمقروء"}
          </Button>
        )}
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-card shadow-hard-sm" />
          ))}
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
          {notifications?.map((n) => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <motion.div
                key={n.id}
                variants={fadeUpItem}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-hard-sm transition-all interactive-lift ${
                  !n.is_read ? "border-primary/35 bg-primary/5" : "border-navy/20 bg-card opacity-80"
                }`}
                onClick={() => openNotification.mutate(n as PlatformNotification)}
              >
                <div className={`shrink-0 rounded-lg p-2 ${typeColors[n.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{n.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/50">{new Date(n.created_at).toLocaleString("ar-EG")}</p>
                  {!!(n as PlatformNotification).link && <p className="mt-1 text-[10px] text-primary">{"افتح التفاصيل"}</p>}
                </div>
              </motion.div>
            );
          })}

          {notifications?.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Bell className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p>{"لا توجد إشعارات حتى الآن"}</p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
