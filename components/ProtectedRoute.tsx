
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldCheck, LogOut, AlertTriangle, RefreshCw } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, profile, loading, signOut } = useAuth();
  const location = useLocation();
  
  const [showExit, setShowExit] = useState(false);
  
  // Timeout de segurança estendido para 8 segundos para dar tempo ao Auto-Healing
  useEffect(() => {
      const timer = setTimeout(() => {
          if (loading || (session && !profile)) {
              setShowExit(true);
          }
      }, 8000);
      return () => clearTimeout(timer);
  }, [loading, session, profile]);

  const LoadingScreen = () => (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <ShieldCheck size={64} className="text-blue-500 mb-6 relative z-10 animate-bounce-slow" />
        </div>
        <div className="flex items-center gap-3 text-2xl font-bold tracking-tight">
            B-HUB <span className="text-blue-500">PCP</span>
        </div>
        <div className="mt-8 flex flex-col items-center gap-4 text-slate-400 text-sm">
            <div className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                <span>{profile ? 'Finalizando...' : 'Conectando ao banco de dados...'}</span>
            </div>
            
            {showExit && (
                <div className="flex flex-col gap-3 mt-6 items-center animate-fade-in bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-sm text-center">
                    <p className="text-sm text-orange-300 flex flex-col items-center gap-2 mb-2">
                        <AlertTriangle size={24}/> 
                        <span>Demora na conexão detectada.</span>
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                        O sistema está tentando criar seu perfil automaticamente. Se persistir, tente recarregar.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => window.location.reload()}
                            className="flex-1 flex items-center justify-center gap-2 text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                            <RefreshCw size={12}/> Recarregar
                        </button>
                        <button 
                            onClick={async () => {
                                localStorage.clear();
                                await signOut();
                                window.location.href = '/login';
                            }}
                            className="flex-1 flex items-center justify-center gap-2 text-red-300 hover:text-white bg-slate-700 hover:bg-red-900/50 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                            <LogOut size={12}/> Sair
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
  );

  // 1. Carregando Inicial
  if (loading) return <LoadingScreen />;

  // 2. Sem sessão -> Login
  if (!session) return <Navigate to="/login" replace />;

  // 3. Com sessão mas sem perfil (Erro de Banco de Dados ou Delay no Auto-Healing)
  if (!profile) {
      return <LoadingScreen />;
  }

  // 4. Onboarding (Perfil existe mas incompleto)
  const needsOnboarding = profile && !profile.onboarding_completed;
  if (needsOnboarding && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
  }
  if (profile?.onboarding_completed && location.pathname === '/onboarding') {
      return <Navigate to="/" replace />;
  }

  // 5. Sucesso - Renderiza o App
  return <>{children}</>;
};
