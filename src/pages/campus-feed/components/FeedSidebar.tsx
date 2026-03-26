import { Hash } from "lucide-react";
import type { CampusLeaderboardEntry, CampusTrendingHashtag } from "@/backend/campusFeedApi";

type FeedSidebarProps = {
  leaderboard: CampusLeaderboardEntry[];
  trendingHashtags: CampusTrendingHashtag[];
  activeHashtag: string | null;
  onToggleHashtag: (hashtag: string) => void;
};

export function FeedSidebar({ leaderboard, trendingHashtags, activeHashtag, onToggleHashtag }: FeedSidebarProps) {
  return (
    <>
      <div className="rounded-3xl border border-border bg-card p-4 md:p-5 shadow-hard">
        <h3 className="mb-2 text-base font-black md:mb-3">لوحة الشرف 🔥</h3>
        <div className="space-y-2">
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد بيانات ترتيب بعد</p>
          ) : (
            leaderboard.map((entry, index) => (
              <div key={entry.user_id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-bold">{`${index + 1}. ${entry.full_name}`}</p>
                  <p className="text-[11px] text-muted-foreground">{`Karma: ${entry.karma_points}`}</p>
                </div>
                <span className="text-sm font-black text-orange-500">{`🔥 ${entry.current_streak}`}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 md:p-5 shadow-hard">
        <h3 className="mb-2 inline-flex items-center gap-2 text-base font-black md:mb-3">
          <Hash className="h-4 w-4 text-primary" />
          التريند اليوم
        </h3>
        {trendingHashtags.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد هاشتاجات ترند حالياً</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {trendingHashtags.map((item) => (
              <button
                key={item.hashtag}
                type="button"
                onClick={() => onToggleHashtag(item.hashtag)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                  activeHashtag === item.hashtag
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                #{item.hashtag} · {item.posts_count}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}