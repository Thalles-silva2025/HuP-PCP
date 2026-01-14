
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldCheck, LogOut, AlertTriangle, RefreshCw } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, profile, loading, signOut } = useAuth();
  const location = useLocation();
  
  const [showExit, setShowExit] = useState(false);
  
  // Timeout visual de segurança (5 segundos)
  useEffect(() => {
      const timer = setTimeout(() => {
          if (loading || (session && !profile)) {
              setShowExit(true);
          }
      }, 5000);
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
                <span>Conectando ao sistema...</span>
            </div>
            
            {showExit && (
                <div className="flex flex-col gap-3 mt-6 items-center animate-fade-in bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <p className="text-xs text-orange-300 flex items-center gap-2">
                        <AlertTriangle size={12}/> O banco de dados está demorando para responder.
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                            <RefreshCw size={12}/> Tentar Novamente
                        </button>
                        <button 
                            onClick={async () => {
                                localStorage.clear();
                                await signOut();
                                window.location.href = '/login';
                            }}
                            className="flex items-center gap-2 text-red-300 hover:text-white bg-slate-700 hover:bg-red-900/50 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                            <LogOut size={12}/> Sair
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
  );

  // 1. Carregando
  if (loading) return <LoadingScreen />;

  // 2. Sem sessão -> Login
  if (!session) return <Navigate to="/login" replace />;

  // 3. Com sessão mas sem perfil (Erro de Banco de Dados)
  if (!profile) {
      // Se já passou o tempo de espera e não carregou, mostra erro fatal
      if (showExit) {
          return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center animate-fade-in">
                <div className="bg-red-500/10 p-4 rounded-full mb-4 ring-1 ring-red-500/50">
                    <AlertTriangle size={48} className="text-red-500"/>
                </div>
                <h2 className="text-xl font-bold mb-2">Erro de Conexão</h2>
                <p className="text-slate-400 max-w-md mb-8 text-sm leading-relaxed">
                    Não conseguimos carregar seu perfil. Isso geralmente acontece na primeira criação de conta se as permissões do banco estiverem bloqueadas.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-bold">
                        Recarregar Página
                    </button>
                    <button onClick={() => signOut()} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-lg font-bold">
                        Sair da Conta
                    </button>
                </div>
            </div>
          );
      }
      return <LoadingScreen />;
  }

  // 4. Onboarding
  const needsOnboarding = profile && !profile.onboarding_completed;
  if (needsOnboarding && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
  }
  if (profile?.onboarding_completed && location.pathname === '/onboarding') {
      return <Navigate to="/" replace />;
  }

  // 5. Sucesso
  return <>{children}</>;
};
