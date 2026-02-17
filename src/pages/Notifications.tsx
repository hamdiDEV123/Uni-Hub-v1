import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Bell, CheckCheck, Megaphone, Trophy, ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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
    {
      section: "receipts",
      keywords: [
        "\u0625\u062b\u0628\u0627\u062a \u062f\u0641\u0639",
        "\u0627\u062b\u0628\u0627\u062a \u062f\u0641\u0639",
        "receipt",
        "manual payment",
      ],
    },
    { section: "upgrades", keywords: ["\u062a\u0631\u0642\u064a\u0629", "upgrade", "tier"] },
    { section: "payouts", keywords: ["\u0633\u062d\u0628", "withdraw", "payout"] },
    { section: "disputes", keywords: ["\u0646\u0632\u0627\u0639", "dispute"] },
    {
      section: "products",
      keywords: ["\u0645\u0646\u062a\u062c", "\u0645\u0631\u0627\u062c\u0639\u0629", "product", "review"],
    },
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
    queryKey: ["notifications", user?.id],
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bell className="h-6 w-6 neon-text-orange" />
            Notifications
            {unreadCount > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">Stay updated on campus activity</p>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAllRead.mutate()}
            className="gap-1 border-border/50 text-xs"
          >
            <CheckCheck className="h-3 w-3" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-card h-16 animate-pulse" />
          ))}
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
                className={`glass-card flex cursor-pointer items-start gap-3 p-4 transition-all ${
                  !n.is_read ? "border-l-2 border-l-primary" : "opacity-60"
                }`}
                onClick={() => openNotification.mutate(n as PlatformNotification)}
              >
                <div className={`shrink-0 rounded-lg p-2 ${typeColors[n.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{n.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground/50">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                  {!!(n as PlatformNotification).link && (
                    <p className="mt-1 text-[10px] text-primary">Open details</p>
                  )}
                </div>
              </motion.div>
            );
          })}
          {notifications?.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Bell className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p>No notifications yet</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
