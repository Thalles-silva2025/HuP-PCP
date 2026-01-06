import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, ProductionOrderItem } from '../types';
import { MockService } from '../services/mockDb';
import { ClipboardCheck, CheckCircle2, AlertTriangle, ArrowRight, Save, X, RotateCcw, Filter, Search, RotateCw, Grid3X3, ArrowDown } from 'lucide-react';
import { ModernDatePicker } from './ModernDatePicker';

interface DateRange {
    label: string;
    start: Date;
    end: Date;
}

// Helper for Color Style
const getColorStyle = (colorName: string) => {
    const map: any = {
        'Branco': '#ffffff', 'Preto': '#000000', 'Marinho': '#000080', 'Vermelho': '#ff0000',
        'Verde': '#008000', 'Amarelo': '#ffff00', 'Azul': '#0000ff', 'Cinza': '#808080',
        'Rosa': '#ffc0cb', 'Roxo': '#800080'
    };
    return map[colorName] || '#cccccc';
};

export const RevisionModule: React.FC = () => {
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [completedOps, setCompletedOps] = useState<ProductionOrder[]>([]);
  const [selectedOp, setSelectedOp] = useState<ProductionOrder | null>(null);
  const [form, setForm] = useState<any>({});
  const [errorField, setErrorField] = useState<string | null>(null);
  
  // Matrix State for Detailed Approved
  const [approvedMatrix, setApprovedMatrix] = useState<Record<string, Record<string, number>>>({});
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Filters State
  const [dateRange, setDateRange] = useState<DateRange>({
      label: 'Últimos 30 dias',
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date()
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allOps = await MockService.getProductionOrders();
    // Sort recent first (createdAt descending)
    allOps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setOps(allOps.filter(op => op.status === OrderStatus.QUALITY_CONTROL));
    setCompletedOps(allOps.filter(op => (op.status === OrderStatus.PACKING || op.status === OrderStatus.COMPLETED) && op.revisionDetails?.isFinalized));
  };

  const filteredHistory = useMemo(() => {
      const start = new Date(dateRange.start).setHours(0,0,0,0);
      const end = new Date(dateRange.end).setHours(23,59,59,999);

      return completedOps.filter(op => {
          // Date Filter (End Date of Revision)
          const revDate = new Date(op.revisionDetails?.endDate || op.createdAt).getTime();
          const dateMatch = revDate >= start && revDate <= end;

          // Search Filter
          const searchMatch = !searchTerm || 
              op.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              op.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (op.revisionDetails?.inspectorName || '').toLowerCase().includes(searchTerm.toLowerCase());

          return dateMatch && searchMatch;
      });
  }, [completedOps, dateRange, searchTerm]);

  // --- MATRIX LOGIC & CACHE ---

  useEffect(() => {
      if (selectedOp) {
          // Initialize or Load Cache
          const cacheKey = `revision_cache_${selectedOp.id}`;
          const cached = localStorage.getItem(cacheKey);
          
          if (cached) {
              setApprovedMatrix(JSON.parse(cached));
          } else {
              // Initialize with Zeros
              const initialMatrix: Record<string, Record<string, number>> = {};
              const sizes = Array.from(new Set(selectedOp.items.map((i: ProductionOrderItem) => i.size))).sort();
              const colors = Array.from(new Set(selectedOp.items.map((i: ProductionOrderItem) => i.color)));
              
              colors.forEach((c) => {
                  const colorKey = c as string;
                  initialMatrix[colorKey] = {};
                  sizes.forEach((s) => {
                      const sizeKey = s as string;
                      initialMatrix[colorKey][sizeKey] = 0;
                  });
              });
              setApprovedMatrix(initialMatrix);
          }
      }
  }, [selectedOp]);

  const updateMatrix = (color: string, size: string, value: number) => {
      if (!selectedOp) return;

      // VALIDATION: Cannot exceed available qty for this specific item
      const targetItem = selectedOp.items.find(i => i.color === color && i.size === size);
      const maxQty = targetItem ? targetItem.quantity : 0;

      if (value > maxQty) {
          alert(`ATENÇÃO: A quantidade (${value}) excede o que foi enviado para facção/corte (${maxQty}) para ${color} - ${size}.`);
          return;
      }

      const newMatrix: Record<string, Record<string, number>> = { ...approvedMatrix, [color]: { ...approvedMatrix[color], [size]: value } };
      setApprovedMatrix(newMatrix);
      
      // Save to Cache
      localStorage.setItem(`revision_cache_${selectedOp.id}`, JSON.stringify(newMatrix));
      
      // Update total Approved in simple form for logic compatibility
      let totalApproved = 0;
      Object.values(newMatrix).forEach((sizes) => {
          Object.values(sizes).forEach((qty) => totalApproved += qty);
      });
      setForm((prev: any) => ({ ...prev, approvedQty: totalApproved }));
  };

  const getPlannedQty = (color: string, size: string) => {
      return selectedOp?.items.find(i => i.color === color && i.size === size)?.quantity || 0;
  };

  const openRevision = (op: ProductionOrder) => {
      setSelectedOp(op);
      setErrorField(null);
      setForm(op.revisionDetails || { 
          inspectorName: '', 
          approvedQty: 0, 
          reworkQty: 0, 
          rejectedQty: 0 
      });
  };

  const handleSave = async () => {
      if (!selectedOp) return;
      if (!form.inspectorName) {
          setErrorField('inspectorName');
          return;
      }

      // Convert Matrix to Items Array
      const itemsApproved: ProductionOrderItem[] = [];
      Object.entries(approvedMatrix).forEach(([color, sizes]) => {
          Object.entries(sizes).forEach(([size, qty]) => {
              if (qty > 0) itemsApproved.push({ color, size, quantity: qty });
          });
      });

      const totalApproved = itemsApproved.reduce((a,b)=>a+b.quantity, 0);
      const totalCheck = totalApproved + (form.reworkQty || 0) + (form.rejectedQty || 0);
      const totalOp = selectedOp.quantityTotal;

      if (totalCheck > totalOp) {
           alert(`ERRO: Total Conferido (${totalCheck}) excede Total da OP (${totalOp}).`);
           return;
      }

      const updatedOp = {
          ...selectedOp,
          status: OrderStatus.PACKING, 
          revisionDetails: {
              ...form,
              approvedQty: totalApproved,
              itemsApproved: itemsApproved, // Save Detailed Breakdown
              isFinalized: true,
              endDate: new Date().toISOString()
          }
      };

      await MockService.updateProductionOrder(selectedOp.id, updatedOp);
      
      // Clear Cache
      localStorage.removeItem(`revision_cache_${selectedOp.id}`);
      
      setSelectedOp(null);
      loadData();
      alert(`Revisão concluída! Enviado para Embalagem.`);
  };

  const handleRevertToFaccao = async () => {
      if (!selectedOp) return;
      if (!confirm(`Estornar OP para Facção?`)) return;
      try {
          await MockService.revertRevisionToSubcontractor(selectedOp.id);
          localStorage.removeItem(`revision_cache_${selectedOp.id}`);
          setSelectedOp(null);
          loadData();
          alert('Estornado com sucesso.');
      } catch (err: any) {
          alert(err.message);
      }
  };

  // KPI Calculations
  const stats = useMemo(() => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      let totalReviewed = 0;
      let totalApproved = 0;
      let totalRework = 0;
      let totalRejected = 0;

      completedOps.forEach(op => {
          const revDate = new Date(op.revisionDetails?.endDate || '');
          if (revDate >= weekAgo) {
              const app = (op.revisionDetails?.approvedQty || 0);
              const rew = (op.revisionDetails?.reworkQty || 0);
              const rej = (op.revisionDetails?.rejectedQty || 0);
              totalReviewed += (app + rew + rej);
              totalApproved += app;
              totalRework += rew;
              totalRejected += rej;
          }
      });

      return { totalReviewed, totalApproved, totalRework, totalRejected };
  }, [completedOps]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="text-purple-600" /> Revisão & Qualidade
          </h1>
          <p className="text-gray-500 text-sm">Controle de qualidade e segregação de peças defeituosas.</p>
        </div>
      </div>

      {/* TOP METRICS GRID (New Design) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border-l-4 border-blue-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ClipboardCheck size={20}/></div>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Total Revisado (7d)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalReviewed} <span className="text-sm font-normal text-gray-400">pçs</span></div>
          </div>

          <div className="bg-white p-5 rounded-xl border-l-4 border-green-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle2 size={20}/></div>
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">{stats.totalReviewed > 0 ? Math.round((stats.totalApproved/stats.totalReviewed)*100) : 0}%</span>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Aprovado (1ª)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalApproved} <span className="text-sm font-normal text-gray-400">pçs</span></div>
          </div>

          <div className="bg-white p-5 rounded-xl border-l-4 border-yellow-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg"><RotateCw size={20}/></div>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Retrabalho (2ª)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRework} <span className="text-sm font-normal text-gray-400">pçs</span></div>
          </div>

          <div className="bg-white p-5 rounded-xl border-l-4 border-red-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle size={20}/></div>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Perda / Defeito</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRejected} <span className="text-sm font-normal text-gray-400">pçs</span></div>
          </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'pending' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}
              >
                  Aguardando ({ops.length})
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'history' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}
              >
                  Histórico
              </button>
          </div>

          <div className="flex gap-4 flex-1 justify-end items-center">
              {/* Only show date filters for History tab */}
              {activeTab === 'history' && (
                  <ModernDatePicker 
                      startDate={dateRange.start}
                      endDate={dateRange.end}
                      label={dateRange.label}
                      onChange={(range) => setDateRange({
                          label: range.label || 'Personalizado',
                          start: range.start,
                          end: range.end
                      })}
                  />
              )}
              
              <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                  <input 
                    className="pl-8 pr-4 py-2 border rounded-lg text-sm w-48 focus:ring-2 focus:ring-purple-500 outline-none" 
                    placeholder="Buscar Lote..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-purple-50 text-purple-900 font-bold border-b border-purple-100">
            <tr>
              <th className="p-4">OP / Lote</th>
              <th className="p-4">Produto</th>
              <th className="p-4">{activeTab === 'pending' ? 'Retorno Facção' : 'Conclusão Revisão'}</th>
              <th className="p-4">{activeTab === 'pending' ? 'Data Chegada' : 'Responsável'}</th>
              <th className="p-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(activeTab === 'pending' ? ops : filteredHistory).map(op => (
              <tr key={op.id} className="hover:bg-purple-50/30 transition-colors">
                <td className="p-4 font-mono font-bold text-purple-700">{op.lotNumber}</td>
                <td className="p-4">
                    <div className="font-bold">{op.productId}</div>
                </td>
                <td className="p-4">
                    {activeTab === 'pending' ? op.subcontractor : new Date(op.revisionDetails?.endDate || '').toLocaleDateString()}
                </td>
                <td className="p-4 text-gray-500">
                    {activeTab === 'pending' ? new Date(op.revisionDetails?.startDate || op.createdAt).toLocaleDateString() : op.revisionDetails?.inspectorName}
                </td>
                <td className="p-4 text-right">
                  {activeTab === 'pending' ? (
                      <button 
                        onClick={() => openRevision(op)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2 ml-auto"
                      >
                        Iniciar Revisão <ArrowRight size={16}/>
                      </button>
                  ) : (
                      <div className="text-xs font-bold text-green-600">
                          Aprovado: {op.revisionDetails?.approvedQty} <br/>
                          <span className="text-red-500 font-normal">Perda: {op.revisionDetails?.rejectedQty}</span>
                      </div>
                  )}
                </td>
              </tr>
            ))}
            {(activeTab === 'pending' ? ops : filteredHistory).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* REVISION MODAL - DETAILED MATRIX */}
      {selectedOp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl animate-scale-in overflow-hidden max-h-[90vh] flex flex-col">
               <div className="bg-purple-600 p-4 text-white flex justify-between items-center shrink-0">
                   <h3 className="font-bold text-lg flex items-center gap-2"><ClipboardCheck/> Conferência de Lote: {selectedOp.lotNumber}</h3>
                   <button onClick={() => setSelectedOp(null)} className="hover:bg-purple-700 p-1 rounded"><X/></button>
               </div>
               
               <div className="p-6 overflow-y-auto">
                  
                  {/* HEADER INFO */}
                  <div className="mb-6 bg-purple-50 p-4 rounded-lg border border-purple-100 flex justify-between items-center">
                      <div>
                          <div className="text-sm text-purple-800 font-bold uppercase">Produto</div>
                          <div className="text-xl font-bold">{selectedOp.productId}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-sm text-purple-800 font-bold uppercase">Total Esperado (Corte)</div>
                          <div className="text-xl font-bold">{selectedOp.quantityTotal} Peças</div>
                      </div>
                  </div>

                  {/* 1. REFERENCE TABLE (READ ONLY) */}
                  <div className="mb-8 opacity-70 hover:opacity-100 transition-opacity">
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Grid3X3 size={14}/> Referência: Grade Cortada / Enviada</h4>
                      <div className="border rounded-lg overflow-hidden bg-gray-50">
                          <table className="w-full text-center text-sm">
                              <thead className="bg-gray-200 text-gray-600 font-bold">
                                  <tr>
                                      <th className="p-2 text-left">Cor / Tam</th>
                                      {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => <th key={s} className="p-2 w-12">{s}</th>)}
                                      <th className="p-2 w-16 bg-gray-300">Total</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                  {(Array.from(new Set(selectedOp.items.map(i => i.color))) as string[]).map(color => (
                                      <tr key={color}>
                                          <td className="p-2 text-left font-bold flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(color)}}></div>
                                              {color}
                                          </td>
                                          {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => (
                                              <td key={s} className="p-2 text-gray-500">
                                                  {getPlannedQty(color, s)}
                                              </td>
                                          ))}
                                          <td className="p-2 font-bold bg-gray-100">
                                              {selectedOp.items.filter(i => i.color === color).reduce((a,b)=>a+b.quantity,0)}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  <div className="flex justify-center mb-6 text-purple-300"><ArrowDown size={32}/></div>

                  {/* 2. INPUT MATRIX (APPROVED) */}
                  <div className="mb-6">
                      <h4 className="text-sm font-bold text-purple-900 uppercase mb-2 flex items-center gap-1"><CheckCircle2 size={16}/> Conferência: Quantidade Aprovada (1ª Qualidade)</h4>
                      <div className="border-2 border-purple-200 rounded-xl overflow-hidden shadow-sm">
                          <table className="w-full text-center text-sm">
                              <thead className="bg-purple-100 text-purple-900 font-bold">
                                  <tr>
                                      <th className="p-3 text-left">Cor / Tam</th>
                                      {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => <th key={s} className="p-2 w-16">{s}</th>)}
                                      <th className="p-3 w-20 bg-purple-200">Total</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-purple-50 bg-white">
                                  {(Array.from(new Set(selectedOp.items.map(i => i.color))) as string[]).map(color => (
                                      <tr key={color}>
                                          <td className="p-3 text-left font-bold flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(color)}}></div>
                                              {color}
                                          </td>
                                          {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => {
                                              const max = getPlannedQty(color, s);
                                              const current = approvedMatrix[color]?.[s] || 0;
                                              const isFull = current === max;
                                              const isOver = current > max;

                                              return (
                                                  <td key={s} className="p-2">
                                                      <input 
                                                        type="number"
                                                        className={`w-full text-center font-bold border-b-2 outline-none p-1 focus:bg-purple-50 transition-colors
                                                            ${isOver ? 'border-red-500 text-red-600 bg-red-50' : isFull ? 'border-green-500 text-green-700 bg-green-50' : 'border-gray-200'}
                                                        `}
                                                        value={current === 0 ? '' : current}
                                                        placeholder="0"
                                                        onChange={e => updateMatrix(color, s, Number(e.target.value))}
                                                      />
                                                  </td>
                                              );
                                          })}
                                          <td className="p-3 font-bold bg-purple-50 text-purple-800">
                                              {Object.values(approvedMatrix[color] || {}).reduce((a: number,b: number)=>a+b,0)}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><Save size={12}/> Os dados são salvos automaticamente enquanto você digita.</p>
                  </div>

                  {/* EXCEPTIONS (Rework/Defect) - Keeping simple for now to avoid clutter, but validation respects total */}
                  <div className="grid grid-cols-2 gap-4 border-t pt-6">
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <label className="block text-xs font-bold text-yellow-800 mb-1 flex items-center gap-2"><RotateCcw size={14}/> Retrabalho / 2ª (Total)</label>
                            <input type="number" className="w-full border rounded p-2 font-bold text-yellow-700 bg-white"
                                value={form.reworkQty || ''} onChange={e => setForm({...form, reworkQty: Number(e.target.value)})} placeholder="0"/>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                            <label className="block text-xs font-bold text-red-800 mb-1 flex items-center gap-2"><AlertTriangle size={14}/> Defeito / Perda (Total)</label>
                            <input type="number" className="w-full border rounded p-2 font-bold text-red-700 bg-white"
                                value={form.rejectedQty || ''} onChange={e => setForm({...form, rejectedQty: Number(e.target.value)})} placeholder="0"/>
                        </div>
                  </div>

                  <div className="mt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Responsável pela Revisão <span className="text-red-500">*</span></label>
                        <input 
                            className={`w-full border rounded p-3 ${errorField === 'inspectorName' ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                            placeholder="Nome do revisor"
                            value={form.inspectorName} 
                            onChange={e => {
                                setForm({...form, inspectorName: e.target.value});
                                if(e.target.value) setErrorField(null);
                            }}
                        />
                  </div>
               </div>

               <div className="bg-gray-50 p-4 border-t flex justify-between items-center shrink-0">
                    <button onClick={handleRevertToFaccao} className="text-red-500 text-sm hover:underline font-bold flex items-center gap-1">
                        <RotateCcw size={14}/> Estornar para Facção
                    </button>
                    <button onClick={handleSave} className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-700 flex items-center gap-2 shadow-lg">
                        <Save size={18}/> Concluir Conferência
                    </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};