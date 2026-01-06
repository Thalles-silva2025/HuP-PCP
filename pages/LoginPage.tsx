
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, CheckCircle, ArrowLeft, KeyRound } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Estados da UI
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (view === 'signup') {
        // CADASTRO
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Cadastro realizado! Se o e-mail não chegar, verifique a caixa de spam.');
        // Opcional: Voltar para login após sucesso
        // setView('login');
      } 
      else if (view === 'login') {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/'); // Redirecionar para Dashboard
      }
      else if (view === 'forgot') {
        // RECUPERAÇÃO DE SENHA
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/update-password', // Redireciona para o domínio atual
        });
        if (error) throw error;
        setMessage('Link de recuperação enviado para seu e-mail!');
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
          <h1 className="text-3xl font-bold text-blue-600 mb-2">HubTex</h1>
          <p className="text-gray-500">
            {view === 'signup' ? 'Crie sua conta corporativa' : 
             view === 'forgot' ? 'Recupere seu acesso' : 
             'Sistema Integrado de PCP'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="p-8 pt-2 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 animate-fade-in">
              <AlertCircle size={16} className="mt-0.5 shrink-0"/> <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm flex items-start gap-2 animate-fade-in">
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

          {view !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-bold text-gray-700">Senha</label>
                {view === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => { setView('forgot'); setError(null); setMessage(null); }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
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
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            {loading ? <Loader2 className="animate-spin"/> : (
              view === 'signup' ? 'Criar Conta' : 
              view === 'forgot' ? 'Enviar Link de Recuperação' : 
              'Entrar'
            )}
          </button>

          <div className="text-center pt-4 border-t space-y-2">
            {view === 'forgot' ? (
               <button 
                type="button"
                onClick={() => { setView('login'); setError(null); setMessage(null); }}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1 w-full"
              >
                <ArrowLeft size={14}/> Voltar para Login
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError(null); setMessage(null); }}
                className="text-sm text-blue-600 hover:underline"
              >
                {view === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem uma conta? Entrar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
