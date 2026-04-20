import React, { useEffect, useState, useMemo } from 'react';
import { ConsolidatedRequirement, ProductionOrder, OrderStatus, Product, TechPack, Material } from '../types';
import { ApiService } from '../services/api';
import { CheckSquare, Calculator, Printer, Download, AlertTriangle, CheckCircle2, RefreshCcw, Layers, FileText, Calendar, Factory, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export const MaterialConsolidation: React.FC = () => {
  const [selectedOpIds, setSelectedOpIds] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<ConsolidatedRequirement[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // --- SMART CACHE (DATA FETCHING) ---
  const { data: allOps = [], isLoading: loadingOps } = useQuery<ProductionOrder[]>({
      queryKey: ['productionOrders'],
      queryFn: ApiService.getProductionOrders,
      staleTime: 1000 * 60 * 5 // 5 minutos
  });

  const { data: products = [] } = useQuery<Product[]>({
      queryKey: ['products'],
      queryFn: ApiService.getProducts,
      staleTime: 1000 * 60 * 10
  });

  const { data: materials = [] } = useQuery<Material[]>({
      queryKey: ['materials'],
      queryFn: ApiService.getMaterials,
      staleTime: 1000 * 60 * 10
  });

  // Filter: Active OPs not yet shipped (or just for planning)
  const ops = useMemo(() => {
      return allOps.filter(op => 
          op.status === OrderStatus.PLANNED || 
          op.status === OrderStatus.CUTTING || 
          op.status === OrderStatus.SEWING ||
          op.status === OrderStatus.DRAFT
      );
  }, [allOps]);

  const toggleOp = (id: string) => {
    setSelectedOpIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    
    // Simulate async delay for UI feedback (calculation is fast but user expects feedback)
    await new Promise(resolve => setTimeout(resolve, 500));

    const tempReqs: Record<string, { material: any, needed: number, color?: string }> = {};

    selectedOpIds.forEach(opId => {
        const op = ops.find(o => o.id === opId);
        if(!op) return;
        
        const prod = products.find(p => p.id === op.productId);
        const tp = prod?.techPacks.find(t => t.version === op.techPackVersion) || prod?.techPacks[0];
        
        if(!tp || !tp.materials) return;

        // Calculate quantities per color for this OP
        const opQtyByColor: Record<string, number> = {};
        op.items.forEach(i => {
            opQtyByColor[i.color] = (opQtyByColor[i.color] || 0) + i.quantity;
        });
        const opTotalQty = op.quantityTotal;

        tp.materials.forEach(bom => {
            const mat = materials.find(m => m.id === bom.materialId);
            if(!mat) return;

            // Logic: Color Variant or General
            if (bom.variesWithColor) {
                // Break down by active colors in this OP
                Object.entries(opQtyByColor).forEach(([color, qty]) => {
                    if(qty > 0) {
                        const needed = qty * bom.usagePerPiece * (1 + bom.wasteMargin);
                        const key = `${mat.id}-${color}`;
                        if(!tempReqs[key]) {
                            // Create "Virtual" material entry for the specific color
                            tempReqs[key] = { 
                                material: { ...mat, name: `${mat.name} (${color})` }, 
                                needed: 0,
                                color: color 
                            };
                        }
                        tempReqs[key].needed += needed;
                    }
                });
            } else if (bom.colorVariant && bom.colorVariant !== '' && bom.colorVariant !== 'Geral') {
                // Specific mapping
                const qty = opQtyByColor[bom.colorVariant] || 0;
                if(qty > 0) {
                    const needed = qty * bom.usagePerPiece * (1 + bom.wasteMargin);
                    const key = `${mat.id}-${bom.colorVariant}`;
                    if(!tempReqs[key]) {
                        tempReqs[key] = { 
                            material: { ...mat, name: `${mat.name} (${bom.colorVariant})` }, 
                            needed: 0,
                            color: bom.colorVariant
                        };
                    }
                    tempReqs[key].needed += needed;
                }
            } else {
                // General
                const needed = opTotalQty * bom.usagePerPiece * (1 + bom.wasteMargin);
                const key = mat.id;
                if(!tempReqs[key]) {
                    tempReqs[key] = { material: mat, needed: 0 };
                }
                tempReqs[key].needed += needed;
            }
        });
    });

    const result: ConsolidatedRequirement[] = Object.values(tempReqs).map(item => {
        // Find if we have stock for this specific variant? 
        // For now, we compare against Total Stock of the material, unless the material has variants.
        let stockQty = item.material.currentStock;
        
        // If material has variants in DB, try to match
        if (item.material.hasColors && item.material.variants && item.color) {
            const variant = item.material.variants.find((v: any) => v.name === item.color);
            if (variant) stockQty = variant.stock;
        }

        return {
            material: item.material,
            requiredQty: item.needed,
            stockQty: stockQty,
            status: stockQty >= item.needed ? 'ok' : 'critical'
        };
    });

    setRequirements(result.sort((a,b) => a.material.name.localeCompare(b.material.name)));
    setIsCalculating(false);
  };

  // Grouping for Print View
  const groupedRequirements = useMemo(() => {
      const groups: Record<string, ConsolidatedRequirement[]> = {};
      requirements.forEach(req => {
          const type = req.material.type || 'Outros';
          if (!groups[type]) groups[type] = [];
          groups[type].push(req);
      });
      return groups;
  }, [requirements]);

  const selectedOpDetails = ops.filter(op => selectedOpIds.includes(op.id));

  const safeFormatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return 'N/D';
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'N/D' : d.toLocaleDateString();
  };

  if (loadingOps) {
      return (
          <div className="flex h-96 items-center justify-center text-gray-400 gap-2">
              <Loader2 className="animate-spin" size={24}/>
              <span className="font-medium">Carregando ordens...</span>
          </div>
      );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* SCREEN HEADER */}
      <div className="no-print mb-4 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Soma de Aviamentos & Insumos</h1>
        <p className="text-gray-500 text-sm">Consolide o consumo de múltiplas OPs para compras ou separação. <span className="text-blue-600 font-bold">Agora considera variações de cor da Ficha Técnica.</span></p>
      </div>

      {/* SCREEN CONTENT - FULL HEIGHT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 no-print">
        
        {/* Selection Panel - Full Height */}
        <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="font-bold text-gray-800">Selecione as Ordens</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {selectedOpIds.length} selecionadas
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {ops.map(op => (
              <div 
                key={op.id}
                onClick={() => toggleOp(op.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3
                  ${selectedOpIds.includes(op.id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50 border-gray-200'}
                `}
              >
                <div className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0
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
                  <div className="text-xs text-gray-500">Qtd: {op.quantityTotal} | Entrega: {safeFormatDate(op.dueDate)}</div>
                  <div className="text-xs text-gray-400 mt-1">{op.subcontractor}</div>
                </div>
              </div>
            ))}
            {ops.length === 0 && <div className="text-sm text-gray-400 text-center py-4">Nenhuma OP disponível nesta fase.</div>}
          </div>
          
          <div className="mt-4 pt-4 border-t shrink-0">
              <button 
                onClick={handleCalculate}
                disabled={selectedOpIds.length === 0 || isCalculating}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg"
              >
                {isCalculating ? <RefreshCcw size={18} className="animate-spin"/> : <Calculator size={18} />} Calcular Necessidade
              </button>
          </div>
        </div>

        {/* Results Panel - Full Height */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18}/> Mapa de Consumo Consolidado</h3>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="p-2 hover:bg-gray-200 rounded text-gray-600 flex items-center gap-2 text-sm font-medium" title="Imprimir">
                <Printer size={16} /> Imprimir Relatório
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
              {requirements.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Calculator size={48} className="mb-4 opacity-20" />
                  <p>Selecione as OPs e clique em calcular para ver os resultados.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                    <thead className="bg-white text-gray-600 font-medium sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="p-3 bg-gray-50">Código</th>
                        <th className="p-3 bg-gray-50">Material / Variante</th>
                        <th className="p-3 text-right bg-gray-50">Necessidade Total</th>
                        <th className="p-3 text-right bg-gray-50">Estoque (Cor)</th>
                        <th className="p-3 text-center bg-gray-50">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {requirements.map((req, idx) => (
                        <tr key={idx} className={req.status === 'critical' ? 'bg-red-50' : 'hover:bg-gray-50'}>
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
                              <div className="flex items-center gap-1 text-red-600 font-bold text-xs bg-white px-2 py-1 rounded border border-red-200 shadow-sm">
                                 <AlertTriangle size={12} /> COMPRAR ({(req.requiredQty - req.stockQty).toFixed(2)})
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-green-600 font-bold text-xs bg-white px-2 py-1 rounded border border-green-200">
                                 <CheckCircle2 size={12} /> OK
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                </table>
              )}
          </div>
        </div>
      </div>

      {/* PRINT VIEW - HIDDEN ON SCREEN, VISIBLE ON PRINT */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] overflow-y-auto">
          <div className="max-w-[210mm] mx-auto p-8">
              
              {/* Print Header */}
              <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                  <div>
                      <h1 className="text-3xl font-extrabold text-gray-900 uppercase tracking-tight">Relatório de Compras</h1>
                      <div className="text-gray-500 font-medium mt-1 flex items-center gap-2">
                          <Calendar size={14}/> {new Date().toLocaleDateString()} 
                          <span className="mx-2">|</span> 
                          <Factory size={14}/> Consolidação de Insumos
                      </div>
                  </div>
                  <div className="text-right">
                      <div className="text-sm text-gray-500">Ref. Documento</div>
                      <div className="font-mono font-bold text-lg">REQ-{new Date().getTime().toString().substr(-6)}</div>
                  </div>
              </div>

              {/* OPs Included Section */}
              <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Ordens de Produção Contempladas</h3>
                  <div className="flex flex-wrap gap-2">
                      {selectedOpDetails.map(op => {
                          const prod = products.find(p => p.id === op.productId);
                          return (
                              <span key={op.id} className="text-xs bg-white border border-gray-300 px-2 py-1 rounded font-mono">
                                  <b>{op.lotNumber}</b> ({prod?.sku})
                              </span>
                          )
                      })}
                  </div>
              </div>

              {/* Grouped Tables */}
              {Object.entries(groupedRequirements).map(([type, reqs]) => (
                  <div key={type} className="mb-8 break-inside-avoid">
                      <div className="flex items-center gap-2 mb-2 border-b border-gray-300 pb-1">
                          <Layers size={16} className="text-gray-600"/>
                          <h2 className="text-lg font-bold text-gray-800 uppercase">{type}</h2>
                      </div>
                      
                      <table className="w-full text-xs text-left border border-gray-300 rounded overflow-hidden">
                          <thead className="bg-gray-100 text-gray-700 uppercase font-bold">
                              <tr>
                                  <th className="p-2 w-24 border-r border-gray-300">Código</th>
                                  <th className="p-2 border-r border-gray-300">Material / Detalhe</th>
                                  <th className="p-2 w-32 border-r border-gray-300">Fornecedor</th>
                                  <th className="p-2 w-24 text-right border-r border-gray-300">Necessidade</th>
                                  <th className="p-2 w-24 text-right border-r border-gray-300">Estoque</th>
                                  <th className="p-2 w-24 text-center">Ação</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                              {(reqs as ConsolidatedRequirement[]).map((req, i) => {
                                  const buyQty = req.requiredQty - req.stockQty;
                                  return (
                                      <tr key={i} className={req.status === 'critical' ? 'bg-gray-50' : ''}>
                                          <td className="p-2 font-mono text-gray-600 border-r border-gray-200">{req.material.code}</td>
                                          <td className="p-2 font-bold text-gray-800 border-r border-gray-200">{req.material.name}</td>
                                          <td className="p-2 text-gray-500 border-r border-gray-200 truncate max-w-[150px]">{req.material.supplier}</td>
                                          <td className="p-2 text-right font-bold border-r border-gray-200">{req.requiredQty.toFixed(2)} {req.material.unit}</td>
                                          <td className="p-2 text-right text-gray-500 border-r border-gray-200">{req.stockQty.toFixed(2)}</td>
                                          <td className="p-2 text-center">
                                              {req.status === 'critical' ? (
                                                  <span className="font-bold text-black border border-black px-1 rounded">COMPRAR {buyQty.toFixed(2)}</span>
                                              ) : (
                                                  <span className="text-gray-400">OK</span>
                                              )}
                                          </td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              ))}

              {/* Print Footer */}
              <div className="mt-12 pt-8 border-t-2 border-gray-800 flex justify-between text-xs text-gray-500">
                  <div>
                      <p className="font-bold text-gray-900">Aprovação / Compras</p>
                      <div className="h-10 border-b border-gray-300 w-48 mt-4"></div>
                  </div>
                  <div>
                      <p className="font-bold text-gray-900">Recebimento / Almoxarifado</p>
                      <div className="h-10 border-b border-gray-300 w-48 mt-4"></div>
                  </div>
                  <div className="text-right">
                      <p>Impresso em {new Date().toLocaleString()}</p>
                      <p>B-Hub PCP System</p>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};