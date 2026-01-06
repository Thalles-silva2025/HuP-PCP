
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Building2, DollarSign, Users, Target, AlertTriangle, TrendingDown, CheckCircle, ArrowRight, Activity, Save } from 'lucide-react';

export const OnboardingPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    company_name: '',
    phone: '',
    revenue_range: '',
    employees_count: '',
    market_years: '',
    production_model: '',
    main_pain_point: '',
    is_profitable: '', // 'Sim' | 'Não' | 'Não Sei'
    loss_areas: '',
    current_system: ''
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        alert('Sessão expirada. Faça login novamente.');
        return;
    }

    // Explicit Validation with User Friendly Messages
    const requiredFields: Record<string, string> = {
        'company_name': 'Nome da Empresa',
        'phone': 'Telefone / WhatsApp',
        'revenue_range': 'Faixa de Faturamento',
        'employees_count': 'Nº de Funcionários',
        'market_years': 'Tempo de Mercado',
        'production_model': 'Modelo de Produção',
        'main_pain_point': 'Principal Dor/Problema',
        'is_profitable': 'Status de Lucratividade',
        'loss_areas': 'Áreas de Perda'
    };

    const missing = Object.keys(requiredFields).filter(key => {
        const val = formData[key as keyof typeof formData];
        return !val || val.toString().trim() === '';
    });
    
    if (missing.length > 0) {
        const missingList = missing.map(k => requiredFields[k]).join(', ');
        alert(`Por favor, preencha os seguintes campos obrigatórios: \n\n${missingList}`);
        return;
    }

    setLoading(true);

    try {
        const updates = {
            id: user.id,
            // email: user.email, // REMOVIDO: O e-mail fica na tabela auth.users e não deve ser duplicado se a coluna não existir.
            ...formData,
            is_profitable: formData.is_profitable === 'Sim', // Boolean conversion
            onboarding_completed: true,
            updated_at: new Date().toISOString()
        };

        // Debug log
        console.log('Tentando salvar dados no Supabase:', updates);

        const { data, error } = await supabase.from('user_profiles').upsert(updates).select();

        if (error) {
            console.error('Erro detalhado do Supabase:', error);
            // Lança o erro com a mensagem específica do banco
            throw new Error(error.message || JSON.stringify(error));
        }

        console.log('Dados salvos com sucesso:', data);

        // Force reload profile to update context before redirect
        await refreshProfile(); 
        
        // Success
        navigate('/');
    } catch (err: any) {
        console.error('Erro Capturado no Submit:', err);
        
        let errorMessage = 'Erro desconhecido.';
        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'object') {
            errorMessage = JSON.stringify(err, null, 2);
        } else {
            errorMessage = String(err);
        }

        alert(`Ocorreu um erro ao salvar os dados:\n\n${errorMessage}\n\nIMPORTANTE: Verifique se você rodou o script SQL atualizado (GUIDE_SUPABASE_SETUP.md) no Supabase para criar as colunas de onboarding.`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* Sidebar Info */}
        <div className="bg-blue-600 text-white p-8 md:w-1/3 flex flex-col justify-between">
            <div>
                <div className="font-bold text-2xl mb-2">Bem-vindo ao B-Hub! 🚀</div>
                <p className="text-blue-100 text-sm mb-8">Para configurar sua conta com as melhores práticas de PCP e Custos, precisamos conhecer sua operação no detalhe.</p>
                
                <div className="space-y-4">
                    <div className={`flex items-center gap-3 ${step === 1 ? 'text-white font-bold' : 'text-blue-300'}`}>
                        <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm">{step > 1 ? <CheckCircle size={16}/> : '1'}</div>
                        <span>Sobre a Empresa</span>
                    </div>
                    <div className={`flex items-center gap-3 ${step === 2 ? 'text-white font-bold' : 'text-blue-300'}`}>
                        <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm">{step > 2 ? <CheckCircle size={16}/> : '2'}</div>
                        <span>Operação & Dores</span>
                    </div>
                </div>
            </div>
            <div className="text-xs text-blue-200 mt-8">
                * Todos os dados são confidenciais e usados apenas para calibrar o sistema.
            </div>
        </div>

        {/* Form Content */}
        <div className="p-8 md:w-2/3 flex flex-col">
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
                
                {/* STEP 1: BUSINESS PROFILE */}
                {step === 1 && (
                    <div className="space-y-5 animate-fade-in">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <Building2 className="text-blue-600"/> Perfil do Negócio
                        </h2>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Marca / Confecção <span className="text-red-500">*</span></label>
                            <input 
                                className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 outline-none"
                                placeholder="Ex: Confecções Estrela"
                                value={formData.company_name}
                                onChange={e => handleChange('company_name', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Celular / WhatsApp <span className="text-red-500">*</span></label>
                                <input 
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 outline-none"
                                    placeholder="(XX) 99999-9999"
                                    value={formData.phone}
                                    onChange={e => handleChange('phone', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tempo de Mercado <span className="text-red-500">*</span></label>
                                <select 
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 bg-white focus:border-blue-500 outline-none"
                                    value={formData.market_years}
                                    onChange={e => handleChange('market_years', e.target.value)}
                                >
                                    <option value="">Selecione...</option>
                                    <option>Menos de 1 ano</option>
                                    <option>1 a 3 anos</option>
                                    <option>3 a 10 anos</option>
                                    <option>Mais de 10 anos</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Equipe (Funcionários) <span className="text-red-500">*</span></label>
                                <select 
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 bg-white focus:border-blue-500 outline-none"
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
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Faturamento Mensal <span className="text-red-500">*</span></label>
                                <select 
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 bg-white focus:border-blue-500 outline-none"
                                    value={formData.revenue_range}
                                    onChange={e => handleChange('revenue_range', e.target.value)}
                                >
                                    <option value="">Média Estimada...</option>
                                    <option>Até R$ 20k</option>
                                    <option>R$ 20k a R$ 50k</option>
                                    <option>R$ 50k a R$ 150k</option>
                                    <option>R$ 150k a R$ 500k</option>
                                    <option>Acima de R$ 500k</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Sistema de Gestão Atual</label>
                            <input 
                                className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 outline-none"
                                placeholder="Onde você controla hoje? (Ex: Planilhas, Bling, Millenium, Caderno...)"
                                value={formData.current_system}
                                onChange={e => handleChange('current_system', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* STEP 2: PAIN & OPERATION */}
                {step === 2 && (
                    <div className="space-y-5 animate-slide-in">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <Target className="text-red-500"/> Diagnóstico Rápido
                        </h2>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Modelo de Produção <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Própria', 'Facção (Terceirizada)', 'Híbrida'].map(opt => (
                                    <button
                                        type="button"
                                        key={opt}
                                        onClick={() => handleChange('production_model', opt)}
                                        className={`p-3 rounded-lg border-2 text-sm font-bold transition-all ${formData.production_model === opt ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-blue-300'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Sua empresa dá lucro hoje? <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Sim', 'Não', 'Não Sei'].map(opt => (
                                    <button
                                        type="button"
                                        key={opt}
                                        onClick={() => handleChange('is_profitable', opt)}
                                        className={`p-3 rounded-lg border-2 text-sm font-bold transition-all ${formData.is_profitable === opt ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-green-300'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Maior Dor / Problema Atual <span className="text-red-500">*</span></label>
                            <textarea 
                                className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-red-500 outline-none h-20 resize-none"
                                placeholder="Ex: Perco o controle do que está na facção, não sei meu custo real..."
                                value={formData.main_pain_point}
                                onChange={e => handleChange('main_pain_point', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Onde você acredita que está perdendo dinheiro? <span className="text-red-500">*</span></label>
                            <input 
                                className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-red-500 outline-none"
                                placeholder="Ex: Compra errada de tecido, roubo, retrabalho..."
                                value={formData.loss_areas}
                                onChange={e => handleChange('loss_areas', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* NAVIGATION BUTTONS */}
                <div className="pt-6 mt-4 border-t border-gray-100 flex justify-between">
                    {step === 1 ? (
                        <div/> // Spacer
                    ) : (
                        <button type="button" onClick={() => setStep(step - 1)} className="px-6 py-3 rounded-lg text-gray-600 font-bold hover:bg-gray-100">
                            Voltar
                        </button>
                    )}

                    {step < 2 ? (
                        <button 
                            type="button" 
                            onClick={() => {
                                if(!formData.company_name) return alert('Por favor, preencha o Nome da Empresa para continuar.');
                                setStep(step + 1)
                            }} 
                            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200"
                        >
                            Próximo <ArrowRight size={20}/>
                        </button>
                    ) : (
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Salvando...' : 'Finalizar Cadastro'} <Save size={20}/>
                        </button>
                    )}
                </div>

            </form>
        </div>
      </div>
    </div>
  );
};
