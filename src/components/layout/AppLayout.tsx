import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Bell, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// التعديل هنا: خلينها export function عشان App.tsx يشوفها صح ✅
export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0a0a0c]">
        {/* استدعاء المنيو الجانبية */}
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* الهيدر العلوي (Navbar) */}
          <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-xl sticky top-0 z-10">
            <SidebarTrigger className="text-gray-400 hover:text-orange-500 transition-colors" />
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/profile')}
                className="p-2.5 rounded-xl text-gray-400 hover:text-orange-500 hover:bg-white/5 transition-all"
              >
                <User className="h-5 w-5" />
              </button>

              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2.5 rounded-xl text-gray-400 hover:text-orange-500 hover:bg-white/5 transition-all"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
              </button>
            </div>
          </header>

          {/* محتوى الصفحات */}
          <main className="flex-1 p-6 overflow-x-hidden bg-[#0a0a0c]">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}