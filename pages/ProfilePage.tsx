
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Building2, Mail, Save, User, Phone, MapPin, Target, DollarSign, Activity } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    phone: '',
    employees_count: '',
    revenue_range: '',
    main_pain_point: '',
    production_model: '',
    current_system: ''
  });

  useEffect(() => {
      if (profile) {
          setFormData({
              full_name: profile.full_name || '',
              company_name: profile.company_name || '',
              phone: profile.phone || '',
              employees_count: profile.employees_count || '',
              revenue_range: profile.revenue_range || '',
              main_pain_point: profile.main_pain_point || '',
              production_model: profile.production_model || '',
              current_system: profile.current_system || ''
          });
      }
  }, [profile]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!user) return;
      setLoading(true);
      setMessage(null);

      try {
          const { error } = await supabase
            .from('user_profiles')
            .update(formData)
            .eq('id', user.id);

          if (error) throw error;
          
          await refreshProfile();
          setMessage('Perfil atualizado com sucesso!');
      } catch (err: any) {
          alert('Erro ao atualizar: ' + err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <User className="text-blue-600"/> Meu Perfil
        </h1>

        {message && (
            <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2 animate-fade-in">
                <Activity size={18}/> {message}
            </div>
        )}

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Account Info Card */}
            <div className="md:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 mx-auto flex items-center justify-center text-3xl font-bold text-white mb-4">
                        {profile?.company_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-bold text-gray-900 mb-1">{profile?.email || user?.email}</div>
                    <div className="text-xs text-gray-500 uppercase bg-gray-100 px-2 py-1 rounded-full inline-block">
                        {profile?.role || 'Admin'}
                    </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><Target size={18}/> Status da Conta</h3>
                    <p className="text-sm text-blue-700 mb-4">Seu plano atual é o <b>Gratuito (Beta)</b>.</p>
                    <button type="button" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors">
                        Ver Planos Disponíveis
                    </button>
                </div>
            </div>

            {/* Edit Form */}
            <div className="md:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 text-lg mb-6 border-b pb-2">Dados da Empresa</h3>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Empresa / Marca</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                <input 
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.company_name}
                                    onChange={e => handleChange('company_name', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Telefone / WhatsApp</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                <input 
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.phone}
                                    onChange={e => handleChange('phone', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Seu Nome Completo</label>
                        <input 
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.full_name}
                            onChange={e => handleChange('full_name', e.target.value)}
                            placeholder="Como você gostaria de ser chamado?"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Faturamento Estimado</label>
                            <select 
                                className="w-full px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.revenue_range}
                                onChange={e => handleChange('revenue_range', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                <option>Até R$ 20k</option>
                                <option>R$ 20k a R$ 50k</option>
                                <option>R$ 50k a R$ 150k</option>
                                <option>R$ 150k a R$ 500k</option>
                                <option>Acima de R$ 500k</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Tamanho da Equipe</label>
                            <select 
                                className="w-full px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.employees_count}
                                onChange={e => handleChange('employees_count', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                <option>1 (Eu mesmo)</option>
                                <option>2 a 5</option>
                                <option>6 a 20</option>
                                <option>21 a 50</option>
                                <option>50+</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Modelo de Produção</label>
                        <select 
                            className="w-full px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.production_model}
                            onChange={e => handleChange('production_model', e.target.value)}
                        >
                            <option value="">Selecione...</option>
                            <option>Própria</option>
                            <option>Facção (Terceirizada)</option>
                            <option>Híbrida</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Principal Dor / Desafio</label>
                        <textarea 
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                            value={formData.main_pain_point}
                            onChange={e => handleChange('main_pain_point', e.target.value)}
                        />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200"
                        >
                            {loading ? 'Salvando...' : 'Salvar Alterações'} <Save size={18}/>
                        </button>
                    </div>
                </div>
            </div>
        </form>
    </div>
  );
};
