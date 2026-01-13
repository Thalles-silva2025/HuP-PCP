
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth(); // Hook para verificar status atual
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Redireciona automaticamente se já estiver logado
  useEffect(() => {
    if (session) {
      navigate('/');
    }
  }, [session, navigate]);

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
        setMessage('Cadastro realizado! Se o e-mail não chegar, verifique a caixa de spam ou tente fazer login.');
        setIsSignUp(false); // Volta para tela de login
      } else {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Não precisamos navegar manualmente aqui, o useEffect vai detectar a sessão e redirecionar
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
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0"/> <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm flex items-start gap-2">
              <CheckCircle size={16} className="mt-0.5 shrink-0"/> <span>{message}</span>
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
