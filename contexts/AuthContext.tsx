
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

  const fetchProfile = async (userId: string) => {
      try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (data && !error) {
              setProfile(data as UserProfile);
          } else if (error?.code === 'PGRST116') {
              console.log("Profile not found, waiting for creation...");
          }
      } catch (err) {
          console.error("Error fetching profile:", err);
      }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
        try {
            // Timeout de segurança: Se o Supabase demorar mais de 5s, assumimos falha/offline e liberamos o app
            const timeOutPromise = new Promise((resolve) => setTimeout(() => resolve({ error: { message: 'Timeout' }, data: { session: null } }), 5000));
            const sessionPromise = supabase.auth.getSession();

            const response: any = await Promise.race([sessionPromise, timeOutPromise]);
            const { data: { session } } = response;
            
            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                
                if (session?.user) {
                    // Tenta buscar o perfil, mas não bloqueia se falhar
                    await fetchProfile(session.user.id).catch(e => console.error("Profile fetch failed on init", e));
                }
            }
        } catch (error) {
            console.error("Auth init error:", error);
        } finally {
            if (mounted) setLoading(false);
        }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
          // Atualiza sessão em eventos explícitos para evitar re-renderizações desnecessárias
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
             setSession(session);
             setUser(session?.user ?? null);
             
             if (session?.user) {
                 try {
                    await fetchProfile(session.user.id);
                 } catch(e) {
                    console.error("Profile refresh error", e);
                 }
             }
          } else if (event === 'SIGNED_OUT') {
             setSession(null);
             setUser(null);
             setProfile(null);
          }
          // Nota: Não forçamos setLoading(true) aqui para evitar que a tela pisque ou trave
          // A inicialização principal (initAuth) cuida do estado inicial de carregamento.
      }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const refreshProfile = async () => {
      if (user) {
          setLoading(true); 
          await fetchProfile(user.id);
          setLoading(false);
      }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
