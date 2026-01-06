
# 🔐 Guia de Implementação: Autenticação no Frontend (React + Supabase)

Este documento descreve exatamente como adicionar a camada de segurança ao seu aplicativo B-Hub. Siga os passos na ordem.

---

## 1. Instalação das Dependências

No terminal do seu projeto, execute o seguinte comando para instalar a biblioteca oficial do Supabase:

```bash
npm install @supabase/supabase-js
```

---

## 2. Configuração de Variáveis de Ambiente

Crie um arquivo chamado `.env` na raiz do projeto (onde fica o `package.json`).
Cole as chaves que você pegou no Painel do Supabase (Project Settings > API).

```env
VITE_SUPABASE_URL=Sua_Project_URL_Aqui
VITE_SUPABASE_ANON_KEY=Sua_Anon_Public_Key_Aqui
```

> **Importante:** Nunca suba este arquivo para o GitHub se o repositório for público.

---

## 3. Criar o Cliente Supabase

Crie um novo arquivo: `services/supabase.ts`.
Este arquivo será a ponte entre seu código e o banco de dados.

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam variáveis de ambiente do Supabase (.env)');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 4. Criar o Contexto de Autenticação

Para que toda a aplicação saiba quem é o usuário logado, vamos criar um "Provedor".
Crie o arquivo: `contexts/AuthContext.tsx`.

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ session: null, user: null, loading: true, signOut: async () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Verificar sessão ativa ao iniciar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Escutar mudanças (Login, Logout, Auto-refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

---

## 5. Criar a Tela de Login

Crie o arquivo: `pages/LoginPage.tsx`.
Esta tela permite login com E-mail/Senha e Cadastro simples.

```typescript
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // Alternar entre Login/Cadastro
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        // CADASTRO
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Cadastro realizado! Verifique seu e-mail para confirmar.');
      } else {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/'); // Redirecionar para Dashboard
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-8 pb-4 text-center">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">B-Hub PCP</h1>
          <p className="text-gray-500">{isSignUp ? 'Crie sua conta corporativa' : 'Faça login para acessar'}</p>
        </div>

        <form onSubmit={handleAuth} className="p-8 pt-2 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16}/> {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle size={16}/> {message}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
              <input 
                type="email" required
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
              <input 
                type="password" required
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="********"
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin"/> : (isSignUp ? 'Criar Conta' : 'Entrar')}
          </button>

          <div className="text-center pt-4 border-t">
            <button 
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
              className="text-sm text-blue-600 hover:underline"
            >
              {isSignUp ? 'Já tem uma conta? Entrar' : 'Não tem conta? Cadastre-se'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

---

## 6. Criar Componente de Rota Protegida

Para impedir que usuários não logados acessem as páginas internas.
Crie o arquivo: `components/ProtectedRoute.tsx`.

```typescript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    // Tela de carregamento simples enquanto verifica sessão
    return <div className="h-screen flex items-center justify-center text-blue-600 font-bold">Carregando B-Hub...</div>;
  }

  if (!session) {
    // Se não tiver sessão, manda pro Login
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
```

---

## 7. Atualizar o App.tsx (O passo final)

Você precisará modificar o `App.tsx` para envolver tudo com o `AuthProvider` e usar o `ProtectedRoute`.

Exemplo de como ficará o `App.tsx`:

```tsx
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
// ... outros imports

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rota Pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rotas Protegidas (Layout Principal) */}
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/ops" element={<ProductionOrderList />} />
                  {/* ... todas as outras rotas do sistema */}
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

---

## 8. Verificação

1.  Rode o app (`npm run dev`).
2.  Você deve ser redirecionado automaticamente para `/login`.
3.  Crie uma conta.
4.  Se o login funcionar e você ver o Dashboard, a implementação foi um sucesso! 🎉
