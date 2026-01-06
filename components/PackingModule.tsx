import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, ProductionOrderItem } from '../types';
import { MockService } from '../services/mockDb';
import { PackageCheck, CheckCircle, Printer, Box, ArrowRight, X, MapPin, User, AlertTriangle, MoreVertical, RotateCcw, Package, Search, Filter, Grid3X3, ArrowDown, Save } from 'lucide-react';
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

export const PackingModule: React.FC = () => {
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [completedOps, setCompletedOps] = useState<ProductionOrder[]>([]);
  const [selectedOp, setSelectedOp] = useState<ProductionOrder | null>(null);
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [activeMenuOpId, setActiveMenuOpId] = useState<string | null>(null);
  
  // Matrix State for Detailed Packing
  const [packedMatrix, setPackedMatrix] = useState<Record<string, Record<string, number>>>({});

  // Tab State
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Filters State
  const [dateRange, setDateRange] = useState<DateRange>({
      label: 'Últimos 30 dias',
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date()
  });
  const [searchTerm, setSearchTerm] = useState('');

  const warehouses = ['Depósito Central', 'Loja 01', 'Loja 02', 'Expedição'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allOps = await MockService.getProductionOrders();
    // Sort recent first (createdAt descending)
    allOps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setOps(allOps.filter(op => op.status === OrderStatus.PACKING));
    setCompletedOps(allOps.filter(op => op.status === OrderStatus.COMPLETED && op.packingDetails?.isFinalized));
  };

  const filteredHistory = useMemo(() => {
      const start = new Date(dateRange.start).setHours(0,0,0,0);
      const end = new Date(dateRange.end).setHours(23,59,59,999);

      return completedOps.filter(op => {
          // Date Filter (Packed Date)
          const packDate = new Date(op.packingDetails?.packedDate || op.createdAt).getTime();
          const dateMatch = packDate >= start && packDate <= end;

          // Search Filter
          const searchMatch = !searchTerm || 
              op.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              op.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (op.packingDetails?.packerName || '').toLowerCase().includes(searchTerm.toLowerCase());

          return dateMatch && searchMatch;
      });
  }, [completedOps, dateRange, searchTerm]);

  // --- MATRIX LOGIC & CACHE ---

  useEffect(() => {
      if (selectedOp) {
          // Initialize or Load Cache
          const cacheKey = `packing_cache_${selectedOp.id}`;
          const cached = localStorage.getItem(cacheKey);
          
          if (cached) {
              setPackedMatrix(JSON.parse(cached));
          } else {
              // Initialize with Zeros based on Revision Data or Items
              const initialMatrix: Record<string, Record<string, number>> = {};
              
              // Determine source items: Detailed Revision > Revision Total (Plan) > Cut Plan
              const sourceItems: ProductionOrderItem[] = (selectedOp.revisionDetails?.itemsApproved && selectedOp.revisionDetails.itemsApproved.length > 0)
                ? selectedOp.revisionDetails.itemsApproved 
                : selectedOp.items;

              const sizes = Array.from(new Set(sourceItems.map((i: ProductionOrderItem) => i.size))).sort();
              const colors = Array.from(new Set(sourceItems.map((i: ProductionOrderItem) => i.color)));
              
              colors.forEach((c) => {
                  const colorKey = c as string;
                  initialMatrix[colorKey] = {};
                  sizes.forEach((s) => {
                      const sizeKey = s as string;
                      initialMatrix[colorKey][sizeKey] = 0;
                  });
              });
              setPackedMatrix(initialMatrix);
          }
      }
  }, [selectedOp]);

  const updateMatrix = (color: string, size: string, value: number) => {
      if (!selectedOp) return;

      // VALIDATION: Cannot exceed Approved qty
      const sourceItems = selectedOp.revisionDetails?.itemsApproved?.length 
        ? selectedOp.revisionDetails.itemsApproved 
        : selectedOp.items;

      const targetItem = sourceItems.find(i => i.color === color && i.size === size);
      const maxQty = targetItem ? targetItem.quantity : 0;

      if (value > maxQty) {
          alert(`ATENÇÃO: A quantidade (${value}) excede o aprovado na revisão (${maxQty}) para ${color} - ${size}.`);
          return;
      }

      const newMatrix: Record<string, Record<string, number>> = { ...packedMatrix, [color]: { ...packedMatrix[color], [size]: value } };
      setPackedMatrix(newMatrix);
      
      // Save to Cache
      localStorage.setItem(`packing_cache_${selectedOp.id}`, JSON.stringify(newMatrix));
      
      // Update total Packed in simple form
      let totalPacked = 0;
      Object.values(newMatrix).forEach((sizes) => {
          Object.values(sizes).forEach((qty) => totalPacked += qty);
      });
      setForm((prev: any) => ({ ...prev, totalPackedQty: totalPacked }));
  };

  const getApprovedQty = (color: string, size: string) => {
      // Logic to find specific qty
      const sourceItems = selectedOp?.revisionDetails?.itemsApproved?.length 
        ? selectedOp.revisionDetails.itemsApproved 
        : selectedOp?.items;
      
      return sourceItems?.find(i => i.color === color && i.size === size)?.quantity || 0;
  };

  const openPacking = (op: ProductionOrder) => {
      setSelectedOp(op);
      setErrors({});

      setForm({
          packingType: 'Caixa Padrão',
          totalBoxes: 1,
          totalPackedQty: 0,
          warehouse: '', 
          packerName: ''
      });
  };

  const handleFinalize = async () => {
      if (!selectedOp) return;
      
      const newErrors: Record<string, boolean> = {};
      let hasError = false;

      if (!form.warehouse) { newErrors.warehouse = true; hasError = true; }
      if (!form.packerName || !form.packerName.trim()) { newErrors.packerName = true; hasError = true; }

      setErrors(newErrors);
      if (hasError) return;

      // Convert Matrix to Items Array
      const itemsPacked: ProductionOrderItem[] = [];
      Object.entries(packedMatrix).forEach(([color, sizes]) => {
          Object.entries(sizes).forEach(([size, qty]) => {
              if (qty > 0) itemsPacked.push({ color, size, quantity: qty });
          });
      });

      const totalPacked = itemsPacked.reduce((a,b)=>a+b.quantity, 0);
      
      // Allow saving with 0? Probably warn.
      if (totalPacked === 0) {
          if (!confirm("Confirmar finalização com 0 peças embaladas?")) return;
      }

      const updatedOp = {
          ...selectedOp,
          status: OrderStatus.COMPLETED,
          packingDetails: {
              ...form,
              totalPackedQty: totalPacked,
              itemsPacked: itemsPacked, // Detail Saved
              isFinalized: true,
              packedDate: new Date().toISOString()
          }
      };

      await MockService.updateProductionOrder(selectedOp.id, updatedOp);
      
      // Clear Cache
      localStorage.removeItem(`packing_cache_${selectedOp.id}`);

      setSelectedOp(null);
      loadData();
      alert(`Produção Finalizada!`);
  };

  const handleRevertToRevision = async (opId: string) => {
      setActiveMenuOpId(null);
      if(!confirm("Estornar para Revisão?")) return;
      try {
          await MockService.revertPackingToRevision(opId);
          loadData();
          alert('Estornado com sucesso.');
      } catch (err: any) {
          alert(err.message);
      }
  };

  // KPI Stats
  const stats = useMemo(() => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      let totalPacked = 0;
      let totalBoxes = 0;
      let opsFinished = 0;

      completedOps.forEach(op => {
          const packDate = new Date(op.packingDetails?.packedDate || '');
          if (packDate >= weekAgo) {
              totalPacked += (op.packingDetails?.totalPackedQty || 0);
              totalBoxes += (op.packingDetails?.totalBoxes || 0);
              opsFinished++;
          }
      });

      return { totalPacked, totalBoxes, opsFinished };
  }, [completedOps]);

  return (
    <div className="space-y-6" onClick={() => setActiveMenuOpId(null)}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PackageCheck className="text-pink-600" /> Embalagem & Expedição
          </h1>
          <p className="text-gray-500 text-sm">Finalização de ordens e entrada em estoque.</p>
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border-l-4 border-pink-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-pink-50 text-pink-600 rounded-lg"><Package size={20}/></div>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Peças Embaladas (7d)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalPacked} <span className="text-sm font-normal text-gray-400">pçs</span></div>
          </div>

          <div className="bg-white p-5 rounded-xl border-l-4 border-blue-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Box size={20}/></div>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Volumes (Caixas)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalBoxes}</div>
          </div>

          <div className="bg-white p-5 rounded-xl border-l-4 border-green-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle size={20}/></div>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">OPs Finalizadas (7d)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.opsFinished}</div>
          </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'pending' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'}`}
              >
                  Aguardando ({ops.length})
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'history' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'}`}
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
                    className="pl-8 pr-4 py-2 border rounded-lg text-sm w-48 focus:ring-2 focus:ring-pink-500 outline-none" 
                    placeholder="Buscar Lote..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-pink-50 text-pink-900 font-bold border-b border-pink-100">
            <tr>
              <th className="p-4">Lote</th>
              <th className="p-4">Produto</th>
              <th className="p-4 text-right">Qtd {activeTab === 'pending' ? 'Aprovada' : 'Embalada'}</th>
              <th className="p-4 text-right">{activeTab === 'pending' ? 'Ação' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(activeTab === 'pending' ? ops : filteredHistory).map(op => (
              <tr key={op.id} className="hover:bg-pink-50/30 transition-colors group relative">
                <td className="p-4 font-mono font-bold text-pink-700">{op.lotNumber}</td>
                <td className="p-4 font-bold">{op.productId}</td>
                <td className="p-4 text-right font-bold text-gray-800">
                    {activeTab === 'pending' ? op.revisionDetails?.approvedQty : op.packingDetails?.totalPackedQty}
                </td>
                <td className="p-4 text-right relative">
                  {activeTab === 'pending' ? (
                      <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openPacking(op)}
                            className="bg-pink-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-pink-700 flex items-center gap-2"
                          >
                            Embalar <Box size={16}/>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveMenuOpId(activeMenuOpId === op.id ? null : op.id); }}
                            className="p-2 hover:bg-gray-200 rounded-full text-gray-500"
                          >
                              <MoreVertical size={16}/>
                          </button>
                      </div>
                  ) : (
                      <div className="text-xs text-gray-500">
                          {new Date(op.packingDetails?.packedDate || '').toLocaleDateString()} <br/>
                          Resp: {op.packingDetails?.packerName}
                      </div>
                  )}
                  {/* Context Menu */}
                  {activeMenuOpId === op.id && (
                      <div className="absolute right-8 top-10 bg-white shadow-xl border rounded-lg z-20 w-48 overflow-hidden animate-fade-in text-left">
                          <button onClick={() => handleRevertToRevision(op.id)} className="w-full px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 text-sm">
                              <RotateCcw size={14}/> Estornar para Revisão
                          </button>
                      </div>
                  )}
                </td>
              </tr>
            ))}
            {(activeTab === 'pending' ? ops : filteredHistory).length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PACKING MODAL */}
      {selectedOp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl animate-scale-in overflow-hidden max-h-[90vh] flex flex-col">
               <div className="bg-pink-600 p-4 text-white flex justify-between items-center shrink-0">
                   <h3 className="font-bold text-lg flex items-center gap-2"><PackageCheck/> Embalagem Final: {selectedOp.lotNumber}</h3>
                   <button onClick={() => setSelectedOp(null)} className="hover:bg-pink-700 p-1 rounded"><X/></button>
               </div>
               
               <div className="p-6 overflow-y-auto">
                    {/* Header Info */}
                    <div className="mb-6 bg-pink-50 p-4 rounded-lg border border-pink-100 flex justify-between items-center">
                      <div>
                          <div className="text-sm text-pink-800 font-bold uppercase">Produto</div>
                          <div className="text-xl font-bold">{selectedOp.productId}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-sm text-pink-800 font-bold uppercase">Total Aprovado (Revisão)</div>
                          <div className="text-xl font-bold">{selectedOp.revisionDetails?.approvedQty || selectedOp.quantityTotal} Peças</div>
                      </div>
                    </div>

                    {/* 1. REFERENCE TABLE (READ ONLY - FROM REVISION) */}
                    <div className="mb-8 opacity-70 hover:opacity-100 transition-opacity">
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Grid3X3 size={14}/> Referência: Grade Aprovada na Revisão</h4>
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
                                                  {getApprovedQty(color, s)}
                                              </td>
                                          ))}
                                          <td className="p-2 font-bold bg-gray-100">
                                              {/* Calculate row total from approved logic */}
                                              {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).reduce((acc, s) => acc + getApprovedQty(color, s), 0)}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                    </div>

                    <div className="flex justify-center mb-6 text-pink-300"><ArrowDown size={32}/></div>

                    {/* 2. INPUT MATRIX (PACKING) */}
                    <div className="mb-6">
                      <h4 className="text-sm font-bold text-pink-900 uppercase mb-2 flex items-center gap-1"><Package size={16}/> Conferência Final (Entrada de Estoque)</h4>
                      <div className="border-2 border-pink-200 rounded-xl overflow-hidden shadow-sm">
                          <table className="w-full text-center text-sm">
                              <thead className="bg-pink-100 text-pink-900 font-bold">
                                  <tr>
                                      <th className="p-3 text-left">Cor / Tam</th>
                                      {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => <th key={s} className="p-2 w-16">{s}</th>)}
                                      <th className="p-3 w-20 bg-pink-200">Total</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-pink-50 bg-white">
                                  {(Array.from(new Set(selectedOp.items.map(i => i.color))) as string[]).map(color => (
                                      <tr key={color}>
                                          <td className="p-3 text-left font-bold flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(color)}}></div>
                                              {color}
                                          </td>
                                          {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => {
                                              const max = getApprovedQty(color, s);
                                              const current = packedMatrix[color]?.[s] || 0;
                                              const isFull = current === max;
                                              const isOver = current > max;

                                              return (
                                                  <td key={s} className="p-2">
                                                      <input 
                                                        type="number"
                                                        className={`w-full text-center font-bold border-b-2 outline-none p-1 focus:bg-pink-50 transition-colors
                                                            ${isOver ? 'border-red-500 text-red-600 bg-red-50' : isFull ? 'border-green-500 text-green-700 bg-green-50' : 'border-gray-200'}
                                                        `}
                                                        value={current === 0 ? '' : current}
                                                        placeholder="0"
                                                        onChange={e => updateMatrix(color, s, Number(e.target.value))}
                                                      />
                                                  </td>
                                              );
                                          })}
                                          <td className="p-3 font-bold bg-pink-50 text-pink-800">
                                              {Object.values(packedMatrix[color] || {}).reduce((a: number,b: number)=>a+b,0)}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><Save size={12}/> Dados salvos automaticamente.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Embalagem</label>
                            <select className="w-full border rounded p-3 bg-white" 
                            value={form.packingType} onChange={e => setForm({...form, packingType: e.target.value})}>
                                <option>Caixa Padrão</option>
                                <option>Saco Individual</option>
                                <option>Cabide</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Qtd Volumes (Caixas/Fardos)</label>
                            <input type="number" className="w-full border rounded p-3" 
                            value={form.totalBoxes || ''} onChange={e => setForm({...form, totalBoxes: Number(e.target.value)})} placeholder="0"/>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><MapPin size={14}/> Depósito de Destino <span className="text-red-500">*</span></label>
                            <select 
                                className={`w-full border rounded p-3 bg-white ${errors.warehouse ? 'border-red-500 ring-2 ring-red-200' : 'border-pink-300 focus:ring-pink-500'}`}
                                value={form.warehouse || ''}
                                onChange={e => {
                                    setForm({...form, warehouse: e.target.value});
                                    setErrors({...errors, warehouse: false});
                                }}
                            >
                                <option value="">Selecione o local...</option>
                                {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><User size={14}/> Responsável <span className="text-red-500">*</span></label>
                            <input 
                                className={`w-full border rounded p-3 ${errors.packerName ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                                placeholder="Quem conferiu e embalou?"
                                value={form.packerName || ''}
                                onChange={e => {
                                    setForm({...form, packerName: e.target.value});
                                    setErrors({...errors, packerName: false});
                                }}
                            />
                        </div>
                    </div>
               </div>

               <div className="bg-gray-50 p-4 border-t flex justify-between items-center shrink-0">
                    <div className="flex gap-2">
                        <button className="text-gray-500 hover:text-gray-800 flex items-center gap-2 text-sm border px-3 py-2 rounded bg-white">
                            <Printer size={16}/> Etiquetas
                        </button>
                    </div>
                    <button onClick={handleFinalize} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg">
                        <CheckCircle size={18}/> Finalizar OP & Estoque
                    </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};