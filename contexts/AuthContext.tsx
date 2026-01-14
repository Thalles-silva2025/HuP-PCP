
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

  // Busca perfil simplificada e robusta
  const fetchProfile = async (userId: string, email?: string) => {
      try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle(); // maybeSingle evita erro se não existir
          
          if (data && data.organization_id) {
              setProfile(data as UserProfile);
              return data;
          } 
          
          // Se chegou aqui, não tem perfil ou deu erro. 
          // O Auto-Reparo deve ser feito no api.ts para não poluir o contexto
          // Aqui apenas limpamos o perfil para o ProtectedRoute saber.
          setProfile(null);
          return null;

      } catch (err) {
          console.error("Erro inesperado no fetchProfile:", err);
          setProfile(null);
          return null;
      }
  };

  useEffect(() => {
    let mounted = true;

    // Inicialização
    const initAuth = async () => {
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            
            if (mounted) {
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
                
                if (currentSession?.user) {
                    await fetchProfile(currentSession.user.id, currentSession.user.email);
                }
            }
        } catch (error) {
            console.error("Auth init failed:", error);
        } finally {
            if (mounted) {
                // GARANTE QUE O LOADING SEMPRE TERMINA
                setLoading(false);
            }
        }
    };

    initAuth();

    // Listener de Mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (mounted) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
             setSession(newSession);
             setUser(newSession?.user ?? null);
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
