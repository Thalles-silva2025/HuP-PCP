
import React, { useEffect, useState } from 'react';
import { ApiService } from '../services/api';
import { OrganizationConfig } from '../types';
import { Settings, Save, Bell, Palette, FileText, Building2, Upload, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const SystemConfigModule: React.FC = () => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  
  // --- SMART CACHE ---
  const { data: serverConfig, isLoading } = useQuery({
      queryKey: ['organizationConfig'],
      queryFn: ApiService.getOrganizationConfig,
      staleTime: Infinity // Config muda pouco, manter cache longo
  });

  const [config, setConfig] = useState<Partial<OrganizationConfig>>({
      primaryColor: '#3b82f6',
      enableNotifications: true,
      daysToAlertOverdue: 3,
      defaultPaymentTerms: '30 dias',
      companyLogoUrl: '',
      leadTimeCutting: 2,
      leadTimeSewing: 15,
      leadTimeRevision: 2,
      leadTimePacking: 1
  });

  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'financial'>('general');

  // Sync state when data loads
  useEffect(() => {
      if (serverConfig) {
          setConfig(serverConfig);
      }
  }, [serverConfig]);

  const handleSave = async () => {
      setSaving(true);
      try {
          await ApiService.saveOrganizationConfig(config);
          await queryClient.invalidateQueries({ queryKey: ['organizationConfig'] });
          addToast({ type: 'success', title: 'Salvo', message: 'Configurações atualizadas com sucesso.' });
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao salvar configurações.' });
      } finally {
          setSaving(false);
      }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setConfig(prev => ({ ...prev, companyLogoUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  if (isLoading) {
      return (
          <div className="flex h-96 items-center justify-center text-gray-400">
              <Loader2 className="animate-spin mr-2"/> Carregando preferências...
          </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Settings className="text-slate-600"/> Configurações do Sistema
                </h1>
                <p className="text-gray-500 text-sm">Personalize a experiência e regras da sua empresa.</p>
            </div>
            <button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
            >
                {saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                Salvar Alterações
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Sidebar Navigation */}
            <div className="md:col-span-1">
                <nav className="space-y-1">
                    <button 
                        onClick={() => setActiveTab('general')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <Building2 size={18}/> Geral & Prazos
                    </button>
                    <button 
                        onClick={() => setActiveTab('appearance')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'appearance' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <Palette size={18}/> Aparência & Marca
                    </button>
                    <button 
                        onClick={() => setActiveTab('financial')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'financial' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <FileText size={18}/> Relatórios & Financeiro
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="md:col-span-3 space-y-6">
                
                {/* TAB: GENERAL */}
                {activeTab === 'general' && (
                    <div className="bg-white rounded-xl shadow-sm border p-6 animate-fade-in">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b">Preferências Gerais</h2>
                        
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Bell size={20}/></div>
                                    <div>
                                        <div className="font-bold text-gray-800">Notificações do Sistema</div>
                                        <div className="text-xs text-gray-500">Alertas sobre atrasos e estoque baixo.</div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={config.enableNotifications} onChange={e => setConfig({...config, enableNotifications: e.target.checked})}/>
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Alerta de Atraso (Dias)</label>
                                    <p className="text-xs text-gray-500 mb-2">Dias antes do vencimento para alertar.</p>
                                    <input 
                                        type="number" 
                                        className="w-full border rounded-lg p-3"
                                        value={config.daysToAlertOverdue}
                                        onChange={e => setConfig({...config, daysToAlertOverdue: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t mt-4">
                                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Clock size={16}/> Prazos Padrão de Produção (Dias)</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Corte</label>
                                        <input type="number" className="w-full border rounded p-2" value={config.leadTimeCutting} onChange={e => setConfig({...config, leadTimeCutting: parseInt(e.target.value)||0})}/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Costura</label>
                                        <input type="number" className="w-full border rounded p-2" value={config.leadTimeSewing} onChange={e => setConfig({...config, leadTimeSewing: parseInt(e.target.value)||0})}/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Revisão</label>
                                        <input type="number" className="w-full border rounded p-2" value={config.leadTimeRevision} onChange={e => setConfig({...config, leadTimeRevision: parseInt(e.target.value)||0})}/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Embalagem</label>
                                        <input type="number" className="w-full border rounded p-2" value={config.leadTimePacking} onChange={e => setConfig({...config, leadTimePacking: parseInt(e.target.value)||0})}/>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">Estes valores serão usados ao clicar em "Sugerir Datas" na criação de OPs.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: APPEARANCE */}
                {activeTab === 'appearance' && (
                    <div className="bg-white rounded-xl shadow-sm border p-6 animate-fade-in">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b">Marca & Identidade Visual</h2>
                        
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Logotipo da Empresa</label>
                            <div className="flex items-center gap-6">
                                <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group">
                                    {config.companyLogoUrl ? (
                                        <img src={config.companyLogoUrl} className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-xs text-gray-400 font-bold uppercase">Sem Logo</span>
                                    )}
                                    <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white font-bold text-xs">
                                        Alterar
                                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                    </label>
                                </div>
                                <div className="text-sm text-gray-500">
                                    <p>Recomendado: PNG Transparente</p>
                                    <p>Tamanho Máx: 2MB</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Cor Primária do Sistema</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="color" 
                                    className="h-10 w-20 border rounded cursor-pointer"
                                    value={config.primaryColor}
                                    onChange={e => setConfig({...config, primaryColor: e.target.value})}
                                />
                                <div className="text-sm font-mono text-gray-600 border px-3 py-2 rounded bg-gray-50">
                                    {config.primaryColor}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Esta cor será usada em botões, destaques e gráficos.</p>
                        </div>
                    </div>
                )}

                {/* TAB: FINANCIAL */}
                {activeTab === 'financial' && (
                    <div className="bg-white rounded-xl shadow-sm border p-6 animate-fade-in">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b">Financeiro & Relatórios</h2>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Termos de Pagamento Padrão</label>
                                <input 
                                    className="w-full border rounded-lg p-3"
                                    placeholder="Ex: 30 dias após entrega"
                                    value={config.defaultPaymentTerms || ''}
                                    onChange={e => setConfig({...config, defaultPaymentTerms: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Rodapé dos Relatórios (PDF)</label>
                                <p className="text-xs text-gray-500 mb-2">Texto exibido ao final das ordens de serviço e romaneios.</p>
                                <textarea 
                                    className="w-full border rounded-lg p-3 h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: Mercadoria entregue sujeita a conferência..."
                                    value={config.invoiceFooterText || ''}
                                    onChange={e => setConfig({...config, invoiceFooterText: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};
