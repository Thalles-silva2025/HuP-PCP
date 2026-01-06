
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-blue-600">
        <Loader2 className="animate-spin mb-4" size={48} />
        <span className="font-bold text-lg">Carregando B-Hub...</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If user is logged in but hasn't completed onboarding
  // And is NOT already on the onboarding page
  if (session && (!profile || !profile.onboarding_completed) && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
  }

  // If user HAS completed onboarding but tries to access /onboarding page
  if (session && profile?.onboarding_completed && location.pathname === '/onboarding') {
      return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
