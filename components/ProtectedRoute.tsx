
/**
 * 🔒 CORE SECURITY COMPONENT
 * -----------------------------------------------------------------
 * Este componente é o "Porteiro" do sistema.
 * Ele garante que NENHUMA tela interna seja carregada antes que:
 * 1. A sessão do usuário esteja confirmada.
 * 2. O perfil do usuário (Organization ID) esteja carregado na memória.
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldCheck, LogOut, AlertTriangle, RefreshCw } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, profile, loading, signOut } = useAuth();
  const location = useLocation();
  
  // Estados para controle de tempo e erro
  const [showExit, setShowExit] = useState(false);
  const [profileTimeout, setProfileTimeout] = useState(false);

  // Timer de segurança GLOBAL: Se ficar carregando por mais de 5s (antes era 8), mostra opções de recuperação
  useEffect(() => {
      const timer = setTimeout(() => setShowExit(true), 5000);
      return () => clearTimeout(timer);
  }, []);

  // Timer específico para o PERFIL:
  useEffect(() => {
      let timer: ReturnType<typeof setTimeout>;
      if (!loading && session && !profile) {
          timer = setTimeout(() => setProfileTimeout(true), 2000);
      }
      return () => {
          if (timer) clearTimeout(timer);
      };
  }, [loading, session, profile]);

  // Componente Visual de Loading (Reutilizável)
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
                <div className="flex flex-col gap-3 mt-6 items-center animate-fade-in">
                    <p className="text-xs text-red-300">Demorando muito? Tente as opções abaixo:</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 bg-blue-900/30 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                        <RefreshCw size={12}/> Recarregar Página
                    </button>
                    <button 
                        onClick={async () => {
                            // Limpeza forçada de cache e sessão
                            localStorage.clear();
                            await signOut();
                            window.location.href = '/login';
                        }}
                        className="flex items-center gap-2 text-red-400 hover:text-red-300 bg-red-900/30 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                        <LogOut size={12}/> Sair / Limpar Cache
                    </button>
                </div>
            )}
        </div>
      </div>
  );

  // 1. LOADING STATE (Inicialização)
  if (loading) {
    return <LoadingScreen />;
  }

  // 2. VERIFICAÇÃO DE SESSÃO
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // 3. VERIFICAÇÃO DE PERFIL (CRÍTICO)
  if (!profile) {
      if (!profileTimeout) {
          return <LoadingScreen />;
      }

      // Se passou o tempo e realmente não tem perfil, mostra erro fatal.
      return (
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center animate-fade-in">
              <div className="bg-red-500/10 p-4 rounded-full mb-4 ring-1 ring-red-500/50">
                  <AlertTriangle size={48} className="text-red-500"/>
              </div>
              <h2 className="text-xl font-bold mb-2">Erro de Perfil</h2>
              <p className="text-slate-400 max-w-md mb-8 text-sm leading-relaxed">
                  Não foi possível carregar seus dados de usuário. Isso pode ocorrer se sua conta não foi configurada corretamente ou se houver um problema de conexão.
              </p>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button 
                      onClick={() => window.location.reload()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                  >
                      <RefreshCw size={18}/> Tentar Novamente
                  </button>
                  <button 
                      onClick={() => signOut()}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-lg font-bold transition-colors border border-slate-700 flex items-center justify-center gap-2"
                  >
                      <LogOut size={18}/> Sair da Conta
                  </button>
              </div>
          </div>
      );
  }

  // 4. VERIFICAÇÃO DE ONBOARDING
  const needsOnboarding = profile && !profile.onboarding_completed;

  if (needsOnboarding && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
  }

  if (profile?.onboarding_completed && location.pathname === '/onboarding') {
      return <Navigate to="/" replace />;
  }

  // 5. LIBERAÇÃO DE ACESSO
  return <>{children}</>;
};
