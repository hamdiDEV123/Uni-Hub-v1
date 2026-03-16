import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Send, MessageSquare, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default function Chat() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('uid');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(targetUserId);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Sync selected user with URL param changes
  useEffect(() => {
    if (targetUserId) {
      setSelectedUserId(targetUserId);
    }
  }, [targetUserId]);

  // 1. جلب جهات الاتصال (الأشخاص الذين تواصلت معهم)
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ['chat-contacts', user?.id, targetUserId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // جلب الرسائل المرسلة والمستقبلة لمعرفة الأطراف الأخرى
      const { data: sent } = await supabase.from('messages').select('receiver_id').eq('sender_id', user.id);
      const { data: received } = await supabase.from('messages').select('sender_id').eq('receiver_id', user.id);

      type SentRow = { receiver_id: string };
      type ReceivedRow = { sender_id: string };
      const sentIds = ((sent ?? []) as unknown as SentRow[]).map((m) => m.receiver_id);
      const receivedIds = ((received ?? []) as unknown as ReceivedRow[]).map((m) => m.sender_id);
      
      const ids = new Set([
        ...sentIds,
        ...receivedIds,
        ...(targetUserId ? [targetUserId] : [])
      ]);
      
      ids.delete(user.id); // حذف نفسي من القائمة
      
      if (ids.size === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(ids));
      return (profiles as Profile[]) || [];
    },
    enabled: !!user?.id
  });

  // 2. جلب الرسائل للمحادثة المحددة
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', user?.id, selectedUserId],
    queryFn: async () => {
      if (!user?.id || !selectedUserId) return [];
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      return (data as Message[]) || [];
    },
    enabled: !!user?.id && !!selectedUserId,
  });

  // 3. الاشتراك في التحديثات اللحظية (Realtime)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          // إذا كانت الرسالة تابعة للمحادثة المفتوحة حالياً
          if (
            (newMsg.sender_id === user.id && newMsg.receiver_id === selectedUserId) ||
            (newMsg.sender_id === selectedUserId && newMsg.receiver_id === user.id)
          ) {
            queryClient.setQueryData(['chat-messages', user.id, selectedUserId], (old: Message[] = []) => {
              if (old.some((m) => m.id === newMsg.id)) return old;
              return [...old, newMsg];
            });
            // Keep contacts fresh when new conversations start
            queryClient.invalidateQueries({ queryKey: ['chat-contacts', user.id, targetUserId] });
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedUserId, queryClient, targetUserId]);

  // Scroll to bottom on load
  useEffect(() => {
    if (messages) {
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages]);

  // 4. إرسال رسالة
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedUserId || !newMessage.trim()) {
        throw new Error('INVALID_MESSAGE_STATE');
      }
      
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: selectedUserId,
        content: newMessage.trim()
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
    },
    onError: () => {
      toast.error("فشل إرسال الرسالة");
    }
  });

  const handleSend = () => {
    if (!newMessage.trim()) return;
    if (!user?.id || !selectedUserId) {
      toast.error('اختر محادثة أولاً');
      return;
    }
    sendMessage.mutate();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] grid grid-cols-1 md:grid-cols-3 gap-6 p-4 font-sans text-foreground" dir="rtl">
      {/* قائمة المحادثات */}
      <Card className="md:col-span-1 flex flex-col overflow-hidden rounded-[2rem] border-navy/20 bg-card shadow-hard">
        <div className="p-6 border-b border-border bg-muted/30">
          <h2 className="text-foreground font-black flex items-center gap-2 text-xl"><MessageSquare className="text-primary" /> المحادثات</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {contactsLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : contacts?.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 flex flex-col items-center">
                <User size={40} className="opacity-20 mb-2" />
                <p className="text-sm font-bold">لا توجد محادثات سابقة</p>
              </div>
            ) : (
              contacts?.map(contact => (
                <div
                  key={contact.id}
                  onClick={() => setSelectedUserId(contact.id)}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-all interactive-lift ${selectedUserId === contact.id ? 'border-primary/30 bg-primary/10 shadow-hard-sm' : 'border-transparent hover:bg-muted/40'}`}
                >
                  <Avatar className="h-12 w-12 border border-border">
                    <AvatarImage src={contact.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-muted-foreground font-black">{contact.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-foreground font-black text-sm">{contact.full_name}</p>
                    <p className="text-muted-foreground text-[10px] font-bold mt-1">اضغط للمراسلة</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* منطقة الشات */}
      <Card className="relative md:col-span-2 flex flex-col overflow-hidden rounded-[2rem] border-navy/20 bg-card shadow-hard">
        {!selectedUserId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-70">
            <MessageSquare size={80} className="mb-6 text-primary/50" />
            <p className="font-black text-2xl">اختر محادثة للبدء</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-4">
              <Avatar className="h-10 w-10 border border-border">
                <AvatarFallback className="bg-primary text-primary-foreground font-black">{contacts?.find(c => c.id === selectedUserId)?.full_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <span className="text-foreground font-black block text-lg">{contacts?.find(c => c.id === selectedUserId)?.full_name || 'مستخدم'}</span>
                <span className="text-[10px] text-success font-bold flex items-center gap-1">● متصل الآن (تجريبي)</span>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6 bg-muted/20">
              <div className="space-y-6">
                {messagesLoading ? (
                  <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                ) : (
                  messages?.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-4 rounded-[1.5rem] text-sm font-bold shadow-hard-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tl-none' : 'bg-card text-foreground rounded-tr-none border border-border'}`}>
                          {msg.content}
                          <span className={`text-[9px] block mt-2 text-left font-medium ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-muted/30 border-t border-border flex gap-3 items-center">
              <Input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب رسالتك هنا..."
                className="bg-card border-border text-right h-12 rounded-xl focus-halo"
              />
              <Button onClick={handleSend} size="icon" variant="cta" className="h-12 w-12 rounded-xl">
                {sendMessage.isPending ? <Loader2 className="animate-spin" /> : <Send size={20} />}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
