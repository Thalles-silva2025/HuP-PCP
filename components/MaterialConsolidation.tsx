
import React, { useEffect, useState } from 'react';
import { ConsolidatedRequirement, ProductionOrder, OrderStatus } from '../types';
import { MockService } from '../services/mockDb';
import { CheckSquare, Calculator, Printer, Download, AlertTriangle, CheckCircle } from 'lucide-react';

export const MaterialConsolidation: React.FC = () => {
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [selectedOpIds, setSelectedOpIds] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<ConsolidatedRequirement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    MockService.getProductionOrders().then(allOps => {
        // Filter OPs: "somente apareca se ela estiver ate a facção"
        // Hide: Review, Packing, Completed, Cancelled
        const visibleOps = allOps.filter(op => 
            op.status === OrderStatus.PLANNED || 
            op.status === OrderStatus.CUTTING || 
            op.status === OrderStatus.SEWING ||
            op.status === OrderStatus.DRAFT
        );
        setOps(visibleOps);
    });
  }, []);

  const toggleOp = (id: string) => {
    setSelectedOpIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCalculate = async () => {
    setLoading(true);
    const result = await MockService.calculateConsolidatedRequirements(selectedOpIds);
    setRequirements(result);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-gray-900">Soma de Aviamentos & Insumos</h1>
        <p className="text-gray-500 text-sm">Consolide o consumo de múltiplas OPs para compras ou separação (Apenas OPs até fase de Facção).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selection Panel */}
        <div className="bg-white p-4 rounded-xl border shadow-sm h-fit no-print">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">Selecione as Ordens</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {selectedOpIds.length} selecionadas
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
            {ops.map(op => (
              <div 
                key={op.id}
                onClick={() => toggleOp(op.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3
                  ${selectedOpIds.includes(op.id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50 border-gray-200'}
                `}
              >
                <div className={`mt-1 w-4 h-4 rounded border flex items-center justify-center
                  ${selectedOpIds.includes(op.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}
                `}>
                  {selectedOpIds.includes(op.id) && <CheckSquare size={12} className="text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                      <div className="font-mono font-bold text-sm text-gray-800">{op.lotNumber}</div>
                      <span className={`text-[10px] px-1.5 rounded border ${
                          op.status === OrderStatus.PLANNED ? 'bg-blue-50 border-blue-200 text-blue-600' :
                          op.status === OrderStatus.CUTTING ? 'bg-orange-50 border-orange-200 text-orange-600' :
                          'bg-purple-50 border-purple-200 text-purple-600'
                      }`}>
                          {op.status}
                      </span>
                  </div>
                  <div className="text-xs text-gray-500">Qtd: {op.quantityTotal} | Entrega: {new Date(op.dueDate).toLocaleDateString()}</div>
                  <div className="text-xs text-gray-400 mt-1">{op.subcontractor}</div>
                </div>
              </div>
            ))}
            {ops.length === 0 && <div className="text-sm text-gray-400 text-center py-4">Nenhuma OP disponível nesta fase.</div>}
          </div>
          <button 
            onClick={handleCalculate}
            disabled={selectedOpIds.length === 0 || loading}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            <Calculator size={18} /> Calcular Necessidade
          </button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Mapa de Consumo Consolidado</h3>
            <div className="flex gap-2 no-print">
              <button onClick={() => window.print()} className="p-2 hover:bg-gray-200 rounded text-gray-600" title="Imprimir">
                <Printer size={18} />
              </button>
              <button className="p-2 hover:bg-gray-200 rounded text-gray-600" title="Exportar Excel">
                <Download size={18} />
              </button>
            </div>
          </div>

          {requirements.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Calculator size={48} className="mx-auto mb-4 opacity-20" />
              <p>Selecione as OPs e clique em calcular para ver os resultados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 font-medium">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Material / Insumo</th>
                    <th className="p-3 text-right">Necessidade Total</th>
                    <th className="p-3 text-right">Estoque Atual</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requirements.map((req, idx) => (
                    <tr key={idx} className={req.status === 'critical' ? 'bg-red-50' : ''}>
                      <td className="p-3 font-mono text-gray-500">{req.material.code}</td>
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{req.material.name}</div>
                        <div className="text-xs text-gray-500">{req.material.supplier}</div>
                      </td>
                      <td className="p-3 text-right font-bold">
                        {req.requiredQty.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 3})} <span className="text-xs font-normal text-gray-500">{req.material.unit}</span>
                      </td>
                      <td className="p-3 text-right">
                         {req.stockQty.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 3})} <span className="text-xs text-gray-500">{req.material.unit}</span>
                      </td>
                      <td className="p-3 flex justify-center">
                        {req.status === 'critical' ? (
                          <div className="flex items-center gap-1 text-red-600 font-bold text-xs bg-white px-2 py-1 rounded border border-red-200">
                             <AlertTriangle size={12} /> COMPRAR ({(req.requiredQty - req.stockQty).toFixed(2)})
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-green-600 font-bold text-xs bg-white px-2 py-1 rounded border border-green-200">
                             <CheckCircle size={12} /> OK
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Footer Summary for Print */}
              <div className="p-4 border-t mt-4 text-xs text-gray-500 print-only">
                 Relatório gerado em {new Date().toLocaleString()} | Usuário: John Doe
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
