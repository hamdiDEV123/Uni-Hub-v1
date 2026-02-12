import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import Auth from './Auth';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold neon-text-blue animate-pulse-glow">UniHub</h1>
          <p className="text-muted-foreground text-sm mt-2 font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;
  return <Auth />;
}
