
import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, ProductionOrderItem, Product } from '../types';
import { ApiService } from '../services/api';
import { PackageCheck, CheckCircle, Printer, Box, ArrowRight, X, MapPin, User, AlertTriangle, MoreVertical, RotateCcw, Package, Search, Filter, Grid3X3, ArrowDown, Save, CheckCircle2 } from 'lucide-react';
import { ModernDatePicker } from './ModernDatePicker';
import { useToast } from '../contexts/ToastContext'; // Import Toast

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

// HELPER: Size Sorting
const sortSizes = (a: string, b: string) => {
    const order = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'U', 'UN'];
    const aUpper = a.toUpperCase().trim();
    const bUpper = b.toUpperCase().trim();
    
    const idxA = order.indexOf(aUpper);
    const idxB = order.indexOf(bUpper);
    
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    
    // Fallback to numeric
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    
    return a.localeCompare(b);
};

export const PackingModule: React.FC = () => {
  const { addToast } = useToast();
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [completedOps, setCompletedOps] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]); // Added products state
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
    try {
        const [allOps, allProds] = await Promise.all([
            ApiService.getProductionOrders(),
            ApiService.getProducts()
        ]);
        // Sort recent first (createdAt descending)
        allOps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setOps(allOps.filter(op => op.status === OrderStatus.PACKING));
        setCompletedOps(allOps.filter(op => op.status === OrderStatus.COMPLETED && op.packingDetails?.isFinalized));
        setProducts(allProds);
    } catch (err: any) {
        addToast({ type: 'error', title: 'Erro', message: 'Falha ao carregar dados.' });
    }
  };

  const getProductDisplayName = (productId: string) => {
      const prod = products.find(p => p.id === productId);
      if (prod) return `${prod.sku} - ${prod.name}`;
      return productId;
  };

  const filteredHistory = useMemo(() => {
      const start = new Date(dateRange.start).setHours(0,0,0,0);
      const end = new Date(dateRange.end).setHours(23,59,59,999);

      return completedOps.filter(op => {
          const prodName = getProductDisplayName(op.productId);

          // Date Filter (Packed Date)
          const packDate = new Date(op.packingDetails?.packedDate || op.createdAt).getTime();
          const dateMatch = packDate >= start && packDate <= end;

          // Search Filter
          const searchMatch = !searchTerm || 
              op.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              prodName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (op.packingDetails?.packerName || '').toLowerCase().includes(searchTerm.toLowerCase());

          return dateMatch && searchMatch;
      });
  }, [completedOps, dateRange, searchTerm, products]);

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

              // SORT SIZES HERE
              const sizes = Array.from(new Set(sourceItems.map((i: ProductionOrderItem) => i.size))).sort(sortSizes);
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
          addToast({ type: 'warning', title: 'Excedente', message: `Quantidade (${value}) maior que aprovado (${maxQty}).` });
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

      if (!form.warehouse) { 
          newErrors.warehouse = true; hasError = true; 
          addToast({ type: 'error', title: 'Campo Obrigatório', message: 'Selecione o depósito de destino.' });
      }
      if (!form.packerName || !form.packerName.trim()) { 
          newErrors.packerName = true; hasError = true; 
          addToast({ type: 'error', title: 'Campo Obrigatório', message: 'Informe o responsável pela embalagem.' });
      }

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

      try {
          await ApiService.updateProductionOrder(selectedOp.id, updatedOp);
          
          // Clear Cache
          localStorage.removeItem(`packing_cache_${selectedOp.id}`);

          setSelectedOp(null);
          loadData();
          addToast({ type: 'success', title: 'Produção Finalizada', message: 'Lote entrou em estoque com sucesso!' });
      } catch (err: any) {
          addToast({ type: 'error', title: 'Erro', message: err.message });
      }
  };

  const handleRevertToRevision = async (opId: string) => {
      setActiveMenuOpId(null);
      if(!confirm("Estornar para Revisão?")) return;
      try {
          await ApiService.revertPackingToRevision(opId);
          loadData();
          addToast({ type: 'info', title: 'Estorno Realizado', message: 'OP devolvida para Revisão.' });
      } catch (err: any) {
          addToast({ type: 'error', title: 'Erro', message: err.message });
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
                    placeholder="Buscar Lote, Produto..."
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
                <td className="p-4 font-bold">{getProductDisplayName(op.productId)}</td>
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

      {/* PACKING MODAL - INTELLIGENT MATRIX */}
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
                          <div className="text-xl font-bold">{getProductDisplayName(selectedOp.productId)}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-sm text-pink-800 font-bold uppercase">Total Aprovado (Revisão)</div>
                          <div className="text-xl font-bold">{selectedOp.revisionDetails?.approvedQty || selectedOp.quantityTotal} Peças</div>
                      </div>
                    </div>

                    {/* REFERENCE MATRIX (APPROVED) */}
                    <div className="mb-6 bg-pink-50/50 p-4 rounded-xl border border-pink-100">
                        <h4 className="text-xs font-bold text-pink-800 uppercase mb-2 flex items-center gap-2"><CheckCircle2 size={14}/> Grade Aprovada (Referência)</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-center text-xs opacity-80">
                                <thead>
                                    <tr className="text-gray-500 border-b border-pink-200">
                                        <th className="text-left py-1">Cor</th>
                                        {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => <th key={s} className="w-12">{s}</th>)}
                                        <th className="w-12 font-bold">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Array.from(new Set(selectedOp.items.map(i => i.color))) as string[]).map(color => {
                                        return (
                                            <tr key={color}>
                                                <td className="text-left font-bold py-1 text-gray-700">{color}</td>
                                                {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(size => {
                                                    const qty = getApprovedQty(color, size);
                                                    return <td key={size} className={qty > 0 ? "text-pink-700 font-bold" : "text-gray-300"}>{qty || '-'}</td>
                                                })}
                                                <td className="font-bold text-gray-800">
                                                    {(selectedOp.revisionDetails?.itemsApproved || selectedOp.items).filter(i => i.color === color).reduce((a,b)=>a+b.quantity,0)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-center mb-6 text-gray-300"><ArrowDown size={24}/></div>

                    {/* 2. INPUT MATRIX (PACKING) */}
                    <div className="mb-6">
                      <h4 className="text-sm font-bold text-pink-900 uppercase mb-2 flex items-center gap-1"><Package size={16}/> Conferência Final (Entrada de Estoque)</h4>
                      <div className="border-2 border-pink-200 rounded-xl overflow-hidden shadow-sm bg-white">
                          <table className="w-full text-center text-sm">
                              <thead className="bg-pink-100 text-pink-900 font-bold">
                                  <tr>
                                      <th className="p-3 text-left">Cor / Tam</th>
                                      {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort(sortSizes).map(s => <th key={s} className="p-2 w-16">{s}</th>)}
                                      <th className="p-3 w-20 bg-pink-200 border-l border-pink-300">Total</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-pink-50">
                                  {(Array.from(new Set(selectedOp.items.map(i => i.color))) as string[]).map(color => {
                                      const rowTotal = Object.values(packedMatrix[color] || {}).reduce((a:number,b:number)=>a+b,0);
                                      return (
                                          <tr key={color} className="hover:bg-pink-50">
                                              <td className="p-3 text-left font-bold flex items-center gap-2">
                                                  <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(color)}}></div>
                                                  {color}
                                              </td>
                                              {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort(sortSizes).map(s => {
                                                  const max = getApprovedQty(color, s);
                                                  const current = packedMatrix[color]?.[s] || 0;
                                                  const isFull = current === max;
                                                  const isOver = current > max;

                                                  return (
                                                      <td key={s} className="p-1">
                                                          {max > 0 ? (
                                                              <div className="relative">
                                                                  <input 
                                                                    type="number"
                                                                    className={`w-full text-center font-bold border rounded p-1.5 outline-none transition-colors
                                                                        ${isOver ? 'bg-red-50 border-red-300 text-red-600' : isFull ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-pink-200 focus:border-pink-400'}
                                                                    `}
                                                                    value={current === 0 ? '' : current}
                                                                    placeholder="0"
                                                                    onChange={e => updateMatrix(color, s, Number(e.target.value))}
                                                                  />
                                                                  <div className="text-[9px] text-gray-400 mt-0.5 text-center">Max: {max}</div>
                                                              </div>
                                                          ) : <span className="text-gray-200 text-xs">-</span>}
                                                      </td>
                                                  );
                                              })}
                                              <td className="p-3 font-bold bg-pink-50 text-pink-800 border-l border-pink-100">
                                                  {rowTotal}
                                              </td>
                                          </tr>
                                      )
                                  })}
                                  {/* Grand Total */}
                                  <tr className="bg-pink-50 font-bold border-t-2 border-pink-200 text-pink-900">
                                      <td className="p-3 text-left">TOTAL GERAL</td>
                                      {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort(sortSizes).map(s => (
                                          <td key={s} className="p-3">
                                              {(Array.from(new Set(selectedOp.items.map(i => i.color))) as string[]).reduce((acc, c) => acc + (packedMatrix[c]?.[s] || 0), 0)}
                                          </td>
                                      ))}
                                      <td className="p-3 text-lg border-l border-pink-300">
                                          {Object.values(packedMatrix).reduce((acc, sizes) => acc + Object.values(sizes).reduce((a,b)=>a+b,0), 0)}
                                      </td>
                                  </tr>
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
                                className={`w-full border rounded p-3 bg-white ${errors.warehouse ? 'border-red-500 ring-2 ring-red-100 bg-red-50' : 'border-pink-300 focus:ring-pink-500'}`}
                                value={form.warehouse || ''}
                                onChange={e => {
                                    setForm({...form, warehouse: e.target.value});
                                    setErrors({...errors, warehouse: false});
                                }}
                            >
                                <option value="">Selecione o local...</option>
                                {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                            {errors.warehouse && <p className="text-xs text-red-500 mt-1">Selecione um local.</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><User size={14}/> Responsável <span className="text-red-500">*</span></label>
                            <input 
                                className={`w-full border rounded p-3 ${errors.packerName ? 'border-red-500 ring-2 ring-red-100 bg-red-50' : ''}`}
                                placeholder="Quem conferiu e embalou?"
                                value={form.packerName || ''}
                                onChange={e => {
                                    setForm({...form, packerName: e.target.value});
                                    setErrors({...errors, packerName: false});
                                }}
                            />
                            {errors.packerName && <p className="text-xs text-red-500 mt-1">Campo obrigatório.</p>}
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
