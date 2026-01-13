
/**
 * 🔒 CORE AUTH CONTEXT - LOCKED
 * -----------------------------
 * Gerencia o estado global de autenticação e dados do usuário.
 * Modificado para garantir que 'loading' só seja false após tentar buscar o perfil.
 * AGORA COM AUTO-REPARO DE PERFIL E SAFETY TIMEOUT.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
    session: null, 
    user: null, 
    profile: null,
    loading: true, 
    signOut: async () => {},
    refreshProfile: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Função isolada e robusta para buscar perfil com Auto-Reparo
  const fetchProfile = async (userId: string, email?: string) => {
      try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          
          if (data && data.organization_id) {
              setProfile(data as UserProfile);
              return data;
          } 
          
          // AUTO-REPARO: Se não encontrou perfil ou falta organização
          if (!data || !data.organization_id) {
              console.log("AuthContext: Perfil incompleto. Tentando reparo automático...");
              
              // 1. Cria Org
              const { data: newOrg } = await supabase.from('organizations').insert([{ name: 'Minha Confecção' }]).select('id').single();
              
              if(newOrg) {
                  // 2. Upsert Profile
                  const { data: newProfile } = await supabase.from('user_profiles').upsert({
                      id: userId,
                      email: email || '',
                      organization_id: newOrg.id,
                      role: 'admin',
                      updated_at: new Date().toISOString()
                  }).select().single();
                  
                  if (newProfile) {
                      setProfile(newProfile as UserProfile);
                      return newProfile;
                  }
              }
          }
          
          // Fallback final
          if (error) console.error("Erro ao buscar perfil:", error.message);
          return null;

      } catch (err) {
          console.error("Erro inesperado no fetchProfile:", err);
          return null;
      }
  };

  useEffect(() => {
    let mounted = true;

    // SAFETY TIMEOUT: Força a liberação da tela de loading se o Supabase demorar mais de 6 segundos
    // Isso evita que o app trave na tela "Conectando ao sistema..."
    const safetyTimer = setTimeout(() => {
        if (mounted && loading) {
            console.warn("⚠️ Auth Init Timed Out - Forcing UI Render");
            setLoading(false);
        }
    }, 6000);

    const initAuth = async () => {
        try {
            // 1. Pega a sessão atual
            const { data: { session: currentSession }, error } = await supabase.auth.getSession();
            
            if (error) throw error;

            if (mounted) {
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
                
                // 2. Se tem usuário, busca o perfil
                if (currentSession?.user) {
                    await fetchProfile(currentSession.user.id, currentSession.user.email);
                }
            }
        } catch (error) {
            console.error("Auth init failed:", error);
        } finally {
            if (mounted) {
                setLoading(false);
                clearTimeout(safetyTimer); // Cancela o timeout de segurança se tudo correu bem
            }
        }
    };

    initAuth();

    // Listener para mudanças em tempo real (Login/Logout/Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (mounted) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
             setSession(newSession);
             setUser(newSession?.user ?? null);
             
             // Busca perfil imediatamente ao logar
             if (newSession?.user) {
                 await fetchProfile(newSession.user.id, newSession.user.email);
             }
          } else if (event === 'SIGNED_OUT') {
             setSession(null);
             setUser(null);
             setProfile(null);
             setLoading(false);
          }
      }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  const refreshProfile = async () => {
      if (user) {
          await fetchProfile(user.id, user.email);
      }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
