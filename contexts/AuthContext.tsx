
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

  // --- LÓGICA DE AUTO-CORREÇÃO DE PERFIL ---
  const ensureProfileExists = async (userId: string, email?: string): Promise<UserProfile | null> => {
      try {
          // A. Cria uma Organização Padrão
          const { data: newOrg, error: orgError } = await supabase
              .from('organizations')
              .insert([{ name: 'Minha Empresa' }])
              .select('id')
              .single();

          if (orgError) throw new Error(`Erro ao criar organização: ${orgError.message}`);

          // B. Cria o Perfil vinculado
          const newProfileData = {
              id: userId,
              email: email || '',
              organization_id: newOrg.id,
              role: 'admin',
              company_name: 'Minha Empresa',
              onboarding_completed: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
          };

          const { data: createdProfile, error: profileError } = await supabase
              .from('user_profiles')
              .upsert(newProfileData)
              .select('*')
              .single();

          if (profileError) throw new Error(`Erro ao criar perfil: ${profileError.message}`);

          return createdProfile as UserProfile;

      } catch (err) {
          console.error("❌ Falha crítica no AuthContext:", err);
          return null;
      }
  };

  /**
   * Busca o perfil OTIMIZADA.
   */
  const fetchProfile = async (userId: string, email?: string, retries = 2, delay = 500) => {
      try {
          // 1. OTIMIZAÇÃO: Seleciona apenas campos necessários primeiro para ser rápido
          const { data: existingProfile, error: fetchError } = await supabase
            .from('user_profiles')
            .select('*') 
            .eq('id', userId)
            .maybeSingle();

          // SUCESSO: Perfil encontrado e válido
          if (existingProfile && existingProfile.organization_id) {
              setProfile(existingProfile as UserProfile);
              return;
          }

          // FALHA: Se não achou, mas ainda temos tentativas (retries > 0)
          if (retries > 0) {
              setTimeout(() => {
                  fetchProfile(userId, email, retries - 1, delay);
              }, delay);
              return; // Sai e espera a próxima tentativa
          }

          // FALHA TOTAL: Esgotaram as tentativas. Tenta criar (Auto-Healing).
          console.log("⚠️ Perfil não encontrado. Iniciando criação...");
          const newProfile = await ensureProfileExists(userId, email);
          if (newProfile) {
              setProfile(newProfile);
          } else {
              setProfile(null);
          }

      } catch (err) {
          console.error("Erro inesperado no fetchProfile:", err);
          setProfile(null);
      }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
        try {
            // 1. Obtém sessão inicial
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            
            if (mounted) {
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
                
                if (currentSession?.user) {
                    // Inicia busca imediatamente
                    await fetchProfile(currentSession.user.id, currentSession.user.email);
                }
            }
        } catch (error) {
            console.error("Auth init failed:", error);
        } finally {
            if (mounted) {
                setLoading(false);
            }
        }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (mounted) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
             setSession(newSession);
             setUser(newSession?.user ?? null);
             
             if (newSession?.user) {
                 fetchProfile(newSession.user.id, newSession.user.email);
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
          await fetchProfile(user.id, user.email, 0, 0);
      }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
