
import React from 'react';
import { Check, Star, Zap, Building } from 'lucide-react';

export const PlansPage: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto pb-20">
        <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Planos que crescem com sua confecção</h1>
            <p className="text-gray-500 max-w-2xl mx-auto">Escolha a melhor opção para controlar sua produção, reduzir custos e escalar suas vendas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* PLANO STARTER */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:shadow-xl transition-all relative">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Starter</h3>
                <p className="text-gray-500 text-sm mb-6">Para pequenas marcas organizarem a casa.</p>
                <div className="text-4xl font-bold text-gray-900 mb-6">R$ 297 <span className="text-sm font-normal text-gray-400">/mês</span></div>
                
                <button className="w-full py-3 border-2 border-blue-600 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors mb-8">
                    Começar Agora
                </button>

                <ul className="space-y-4 text-sm text-gray-600">
                    <li className="flex items-center gap-2"><Check className="text-green-500" size={16}/> Até 2 usuários</li>
                    <li className="flex items-center gap-2"><Check className="text-green-500" size={16}/> Até 50 OPs ativas/mês</li>
                    <li className="flex items-center gap-2"><Check className="text-green-500" size={16}/> Fichas Técnicas Ilimitadas</li>
                    <li className="flex items-center gap-2"><Check className="text-green-500" size={16}/> Controle Básico de Facção</li>
                </ul>
            </div>

            {/* PLANO GROWTH - DESTAQUE */}
            <div className="bg-white rounded-2xl p-8 border-2 border-blue-600 shadow-2xl relative transform md:-translate-y-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    Mais Popular
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2"><Zap className="text-yellow-500" size={20}/> Growth</h3>
                <p className="text-gray-500 text-sm mb-6">Para confecções em expansão.</p>
                <div className="text-4xl font-bold text-gray-900 mb-6">R$ 697 <span className="text-sm font-normal text-gray-400">/mês</span></div>
                
                <button className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors mb-8 shadow-lg shadow-blue-200">
                    Assinar Growth
                </button>

                <ul className="space-y-4 text-sm text-gray-600">
                    <li className="flex items-center gap-2"><Check className="text-green-500" size={16}/> <b>Até 10 usuários</b></li>
                    <li className="flex items-center gap-2"><Check className="text-green-500" size={16}/> <b>OPs Ilimitadas</b></li>
                    <li className="flex items-center gap-2"><Check className="text-green-500" size={16}/> Controle de Estoque Avançado</li>
                    <li className="flex items-center gap-2"><Check className="text-green-500" size={16}/> Gestão Financeira (Contas a Pagar)</li>
                    <li className="flex items-center gap-2"><Check className="text-green-500" size={16}/> App do Cortador/Facção</li>
                </ul>
            </div>

            {/* PLANO INDUSTRIAL */}
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-700 text-white hover:shadow-xl transition-all relative">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><Building className="text-purple-400" size={20}/> Industrial</h3>
                <p className="text-slate-400 text-sm mb-6">Para grandes operações e indústrias.</p>
                <div className="text-4xl font-bold mb-6">R$ 1.490 <span className="text-sm font-normal text-slate-500">/mês</span></div>
                
                <button className="w-full py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors mb-8">
                    Falar com Consultor
                </button>

                <ul className="space-y-4 text-sm text-slate-300">
                    <li className="flex items-center gap-2"><Check className="text-purple-400" size={16}/> Usuários Ilimitados</li>
                    <li className="flex items-center gap-2"><Check className="text-purple-400" size={16}/> API de Integração (ERPs)</li>
                    <li className="flex items-center gap-2"><Check className="text-purple-400" size={16}/> BI Avançado (Dashboard de Metas)</li>
                    <li className="flex items-center gap-2"><Check className="text-purple-400" size={16}/> Módulo de Cronometragem</li>
                    <li className="flex items-center gap-2"><Check className="text-purple-400" size={16}/> Gerente de Conta Dedicado</li>
                </ul>
            </div>

        </div>

        <div className="mt-16 text-center bg-gray-50 p-8 rounded-2xl">
            <h2 className="font-bold text-gray-800 text-lg mb-2">Precisa de uma solução customizada?</h2>
            <p className="text-gray-500 mb-6">Desenvolvemos integrações específicas para o seu ERP ou E-commerce.</p>
            <button className="text-blue-600 font-bold hover:underline">Entrar em contato</button>
        </div>
    </div>
  );
};
