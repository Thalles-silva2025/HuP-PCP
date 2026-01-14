
import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, Product, CuttingJob } from '../types';
import { ApiService } from '../services/api';
import { Plus, Printer, FileText, Eye, X, Scissors, Truck, Package, ClipboardCheck, Tag, Grid3X3, CheckCircle, Copy, Edit2, Filter, Search, Calendar, RotateCcw, Layers, ChevronDown, ChevronRight, AlertCircle, LayoutList, Shirt, User, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Helper for Color
const getColorStyle = (colorName: string) => {
    const map: any = {
        'Branco': '#ffffff', 'Preto': '#000000', 'Marinho': '#000080', 'Vermelho': '#ff0000',
        'Verde': '#008000', 'Amarelo': '#ffff00', 'Azul': '#0000ff', 'Cinza': '#808080',
        'Rosa': '#ffc0cb', 'Roxo': '#800080'
    };
    return map[colorName] || '#cccccc';
};

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const colors = {
    [OrderStatus.DRAFT]: 'bg-gray-100 text-gray-600',
    [OrderStatus.PLANNED]: 'bg-blue-100 text-blue-600',
    [OrderStatus.CUTTING]: 'bg-orange-100 text-orange-600',
    [OrderStatus.SEWING]: 'bg-purple-100 text-purple-600',
    [OrderStatus.QUALITY_CONTROL]: 'bg-indigo-100 text-indigo-600',
    [OrderStatus.PACKING]: 'bg-pink-100 text-pink-600',
    [OrderStatus.COMPLETED]: 'bg-green-100 text-green-700',
    [OrderStatus.CANCELLED]: 'bg-red-100 text-red-600',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
};

const SizeColorMatrix = ({ items, sizes }: { items: any[], sizes: string[] }) => {
  const matrix: Record<string, Record<string, number>> = {};
  const colors = Array.from(new Set(items.map(i => i.color)));
  
  items.forEach(item => {
    if (!matrix[item.color]) matrix[item.color] = {};
    matrix[item.color][item.size] = (matrix[item.color][item.size] || 0) + item.quantity;
  });

  const colTotals: Record<string, number> = {};
  sizes.forEach(s => {
    colTotals[s] = items.filter(i => i.size === s).reduce((sum, curr) => sum + curr.quantity, 0);
  });
  const grandTotal = items.reduce((sum, curr) => sum + curr.quantity, 0);

  const copyToClipboard = () => {
      // Build text representation
      let text = `Cor\t${sizes.join('\t')}\tTotal\n`;
      colors.forEach(color => {
          text += `${color}\t`;
          sizes.forEach(s => {
              text += `${matrix[color]?.[s] || 0}\t`;
          });
          text += `${items.filter(i => i.color === color).reduce((a,b)=>a+b.quantity,0)}\n`;
      });
      navigator.clipboard.writeText(text);
      alert('Matriz copiada para a área de transferência!');
  };

  return (
    <div className="border rounded-lg relative bg-white">
      <div className="absolute top-2 right-2">
          <button onClick={copyToClipboard} className="p-1 hover:bg-gray-200 rounded text-gray-500" title="Copiar Grade">
              <Copy size={16}/>
          </button>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm text-center">
        <thead className="bg-gray-50 text-gray-700 font-bold">
          <tr>
            <th className="p-2 text-left bg-gray-100">Cor / Tamanho</th>
            {sizes.map(s => <th key={s} className="p-2 w-16">{s}</th>)}
            <th className="p-2 w-20 bg-gray-100">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {colors.map(color => (
            <tr key={color} className="hover:bg-gray-50">
              <td className="p-2 text-left font-medium text-gray-800 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(color)}}></div>
                  {color}
              </td>
              {sizes.map(s => (
                <td key={s} className="p-2 text-gray-600">
                  {matrix[color]?.[s] || '-'}
                </td>
              ))}
              <td className="p-2 font-bold bg-gray-50">{items.filter(i => i.color === color).reduce((a,b)=>a+b.quantity,0)}</td>
            </tr>
          ))}
          <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
            <td className="p-2 text-left">TOTAL GERAL</td>
            {sizes.map(s => <td key={s} className="p-2">{colTotals[s] || 0}</td>)}
            <td className="p-2 text-blue-600 text-base">{grandTotal}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
};

export const ProductionOrderList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const highlightOpId = (location.state as any)?.highlightOpId;

  // --- REACT QUERY ---
  const { data: rawOps = [], isLoading: loadingOps, refetch: refetchOps } = useQuery({
    queryKey: ['productionOrders'],
    queryFn: ApiService.getProductionOrders,
    staleTime: 1000 * 60 * 2 // 2 mins cache
  });

  const { data: products = [], refetch: refetchProds } = useQuery({
    queryKey: ['products'],
    queryFn: ApiService.getProducts,
    staleTime: 1000 * 60 * 5
  });

  // Derived sorted OPs
  const ops = useMemo(() => {
      return [...rawOps].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawOps]);

  const [selectedOp, setSelectedOp] = useState<ProductionOrder | null>(null);
  
  // NEW: State to hold children OPs when viewing a batch
  const [batchChildren, setBatchChildren] = useState<ProductionOrder[]>([]);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'summary' | 'revision' | 'packing'>('summary');
  
  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
      search: '',
      status: '',
      subcontractor: '',
      dateStart: '',
      dateEnd: ''
  });

  // Group Expansion State
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Label Printing State
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  
  // Forms
  const [revisionForm, setRevisionForm] = useState<any>({});
  const [packingForm, setPackingForm] = useState<any>({});

  // Auto-open logic if coming from Reports
  useEffect(() => {
    if (highlightOpId && ops.length > 0) {
        const targetOp = ops.find(o => o.id === highlightOpId);
        if (targetOp) {
            openDetails(targetOp);
            // Critical: Limpa o state para não reabrir em loop
            navigate(location.pathname, { replace: true, state: {} });
        }
    }
  }, [highlightOpId, ops, navigate, location.pathname]);

  const refreshAll = () => {
      refetchOps();
      refetchProds();
  };

  const toggleGroup = (batchId: string) => {
      setExpandedGroups(prev => ({...prev, [batchId]: !prev[batchId]}));
  };

  const openDetails = (op: ProductionOrder) => {
    setSelectedOp(op);
    setBatchChildren([]); // Clear batch children for single OP view
    setActiveTab('summary');
    setRevisionForm(op.revisionDetails || { approvedQty: 0, reworkQty: 0, rejectedQty: 0, inspectorName: '' });
    setPackingForm(op.packingDetails || { totalBoxes: 0, packingType: 'Caixa Padrão', totalPackedQty: 0 });
  };

  // --- NEW: Handle Consolidated Batch View ---
  const handleViewBatch = (e: React.MouseEvent, groupOps: ProductionOrder[]) => {
      e.stopPropagation();
      if (groupOps.length === 0) return;

      // Store individual OPs for the detailed view
      setBatchChildren(groupOps);

      // Create a "Virtual" OP that aggregates all children just for the Header Summary
      const totalQty = groupOps.reduce((acc, op) => acc + op.quantityTotal, 0);
      const allItems = groupOps.flatMap(op => op.items); // Still flattening for TOTAL summary, but we will use children for details
      const allEvents = groupOps.flatMap(op => op.events).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const batchOp: ProductionOrder = {
          ...groupOps[0], // Copy basic info from first child
          id: `BATCH-${groupOps[0].lotNumber.split('-').slice(0, 2).join('-')}`,
          lotNumber: `${groupOps[0].lotNumber.split('-').slice(0, 2).join('-')} (Lote Completo)`,
          productId: 'Múltiplos Modelos', 
          quantityTotal: totalQty,
          items: allItems,
          events: allEvents,
      };

      setSelectedOp(batchOp);
      setActiveTab('summary');
  };

  const getActiveSizes = (op: ProductionOrder) => {
      const itemSizes = Array.from(new Set(op.items.map(i => i.size)));
      if (itemSizes.length > 0) return itemSizes.sort();
      const prod = products.find(p => p.id === op.productId);
      const tp = prod?.techPacks.find(t => t.version === op.techPackVersion);
      return tp?.activeSizes || prod?.sizes || [];
  };

  // ... (useMemo filters and stats - Keep Existing) ...
  const subcontractors = useMemo(() => {
      return Array.from(new Set(ops.map(o => o.subcontractor).filter(Boolean)));
  }, [ops]);

  const filteredOps = useMemo(() => {
      return ops.filter(op => {
          const prod = products.find(p => p.id === op.productId);
          
          // Search Text (Lot, SKU, Product Name)
          const searchMatch = !filters.search || 
              op.lotNumber.toLowerCase().includes(filters.search.toLowerCase()) ||
              prod?.name.toLowerCase().includes(filters.search.toLowerCase()) ||
              prod?.sku.toLowerCase().includes(filters.search.toLowerCase());

          // Status Filter
          let statusMatch = true;
          if (filters.status === 'LATE') {
              const isLate = new Date(op.dueDate) < new Date() && op.status !== OrderStatus.COMPLETED && op.status !== OrderStatus.CANCELLED;
              statusMatch = isLate;
          } else {
              statusMatch = !filters.status || op.status === filters.status;
          }

          // Subcontractor Filter
          const subMatch = !filters.subcontractor || op.subcontractor === filters.subcontractor;

          // Date Range
          const opDate = new Date(op.startDate).setHours(0,0,0,0);
          const startFilter = filters.dateStart ? new Date(filters.dateStart).setHours(0,0,0,0) : null;
          const endFilter = filters.dateEnd ? new Date(filters.dateEnd).setHours(23,59,59,999) : null;

          const dateMatch = (!startFilter || opDate >= startFilter) &&
                            (!endFilter || opDate <= endFilter);

          return searchMatch && statusMatch && subMatch && dateMatch;
      });
  }, [ops, products, filters]);

  const groupedOps = useMemo<Record<string, ProductionOrder[]>>(() => {
      const groups: Record<string, ProductionOrder[]> = {};
      
      filteredOps.forEach(op => {
          const parts = op.lotNumber.split('-');
          let baseLot = op.lotNumber;
          if (parts.length >= 3) {
              baseLot = `${parts[0]}-${parts[1]}`;
          }
          
          if (!groups[baseLot]) groups[baseLot] = [];
          groups[baseLot].push(op);
      });
      
      return groups;
  }, [filteredOps]);

  const stats = useMemo(() => {
      const counts = {
          TOTAL: ops.length,
          [OrderStatus.PLANNED]: 0,
          [OrderStatus.CUTTING]: 0,
          [OrderStatus.SEWING]: 0,
          [OrderStatus.QUALITY_CONTROL]: 0,
          [OrderStatus.PACKING]: 0,
          [OrderStatus.COMPLETED]: 0
      };
      ops.forEach(op => {
          if (counts[op.status] !== undefined) {
              counts[op.status]++;
          }
      });
      return counts;
  }, [ops]);

  // ... (Actions like EditBatch, SaveRevision, SavePacking, RiskPlanning - Keep Existing) ...
  const handleEditBatch = (e: React.MouseEvent, groupOps: ProductionOrder[]) => {
      e.stopPropagation();
      const canEdit = groupOps.every(o => o.status === OrderStatus.DRAFT || o.status === OrderStatus.PLANNED);
      if (!canEdit) {
          alert("Apenas OPs em 'Rascunho' ou 'Planejado' podem ser editadas em lote. Utilize 'Gerenciar' para OPs em andamento.");
          return;
      }
      navigate('/ops/new', { state: { editBatch: groupOps } });
  };

  const saveRevision = async () => {
      if (!selectedOp) return;
      const updatedOp = {
          ...selectedOp,
          status: OrderStatus.PACKING, 
          revisionDetails: {
              ...revisionForm,
              isFinalized: true,
              endDate: new Date().toISOString()
          }
      };
      await ApiService.updateProductionOrder(selectedOp.id, updatedOp);
      queryClient.invalidateQueries({ queryKey: ['productionOrders'] }); // Force refresh
      setSelectedOp(updatedOp);
      alert('Revisão registrada! OP movida para Embalagem.');
      setActiveTab('packing');
  };

  const savePacking = async () => {
      if (!selectedOp) return;
      const updatedOp = {
          ...selectedOp,
          status: OrderStatus.COMPLETED,
          packingDetails: {
              ...packingForm,
              isFinalized: true,
              packedDate: new Date().toISOString()
          }
      };
      await ApiService.updateProductionOrder(selectedOp.id, updatedOp);
      queryClient.invalidateQueries({ queryKey: ['productionOrders'] }); // Force refresh
      queryClient.invalidateQueries({ queryKey: ['finishedGoods'] }); // Update Inventory too
      
      setSelectedOp(updatedOp);
      alert('Ordem de Produção Finalizada e Estoque Atualizado Automaticamente!');
  };

  const renderRiskPlanning = (op: ProductionOrder) => {
      if (!op.cuttingDetails) return <p className="text-gray-400 text-sm">Sem planejamento de corte.</p>;
      
      const { plannedMatrix, plannedLayers } = op.cuttingDetails;
      return (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <h4 className="font-bold text-orange-800 text-sm mb-3 flex items-center gap-2">
                  <Scissors size={14}/> Planejamento de Risco (Corte)
              </h4>
              <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                      <div className="text-xs font-bold text-orange-600 mb-1">Risco / Matriz (Unidades na Mesa)</div>
                      <div className="flex gap-2 flex-wrap">
                          {plannedMatrix.map(m => (
                              <span key={m.size} className="bg-white border px-2 py-1 rounded shadow-sm">
                                  <b>{m.size}:</b> {m.ratio}
                              </span>
                          ))}
                      </div>
                  </div>
                  <div>
                      <div className="text-xs font-bold text-orange-600 mb-1">Camadas por Cor (Folhas)</div>
                      <div className="flex gap-2 flex-wrap">
                          {plannedLayers.filter(l => l.layers > 0).map(l => (
                              <span key={l.color} className="bg-white border px-2 py-1 rounded shadow-sm flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: getColorStyle(l.color)}}></div>
                                  {l.color}: <b>{l.layers}</b>
                              </span>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6">
      {/* ... (Header, Summary Cards, Filters - No Changes Here) ... */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel de Ordens de Produção</h1>
          <p className="text-gray-500 text-sm">Gerenciamento agrupado por Lote de Produção.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={refreshAll}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50"
          >
            <RefreshCw size={18} className={loadingOps ? 'animate-spin' : ''}/>
          </button>
          <button 
            onClick={() => navigate('/ops/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md"
          >
            <Plus size={18} /> Nova OP (Lote)
          </button>
        </div>
      </div>

      {/* STATUS SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 no-print">
          <div 
            onClick={() => setFilters({...filters, status: ''})}
            className={`bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md border-gray-500 ${filters.status === '' ? 'ring-2 ring-gray-500' : ''}`}
          >
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-gray-100 text-gray-600 rounded-lg"><LayoutList size={20}/></div>
                  <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">{stats.TOTAL}</span>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Todos</div>
          </div>
          {[
              { label: 'Planejamento', count: stats[OrderStatus.PLANNED], color: 'blue', icon: Layers },
              { label: 'Em Corte', count: stats[OrderStatus.CUTTING], color: 'orange', icon: Scissors },
              { label: 'Costura', count: stats[OrderStatus.SEWING], color: 'purple', icon: Truck },
              { label: 'Revisão', count: stats[OrderStatus.QUALITY_CONTROL], color: 'indigo', icon: ClipboardCheck },
              { label: 'Embalagem', count: stats[OrderStatus.PACKING], color: 'pink', icon: Package },
              { label: 'Finalizado', count: stats[OrderStatus.COMPLETED], color: 'green', icon: CheckCircle },
          ].map((s, i) => (
              <div 
                key={i} 
                className={`bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md border-${s.color}-500 ${filters.status === Object.keys(stats)[i + 1] ? `ring-2 ring-${s.color}-500` : ''}`}
                onClick={() => setFilters({...filters, status: Object.keys(stats)[i + 1]})}
              >
                  <div className="flex justify-between items-start mb-2">
                      <div className={`p-2 bg-${s.color}-50 text-${s.color}-600 rounded-lg`}>
                          <s.icon size={20}/>
                      </div>
                      <span className={`text-xs font-bold text-${s.color}-600 bg-${s.color}-50 px-2 py-1 rounded-full`}>{s.count}</span>
                  </div>
                  <div className="text-gray-500 text-xs font-bold uppercase">{s.label}</div>
              </div>
          ))}
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 no-print animate-fade-in">
          <div className="flex items-center gap-4">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                  <input 
                    type="text" 
                    placeholder="Buscar por Lote, Produto ou SKU..." 
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={filters.search}
                    onChange={e => setFilters({...filters, search: e.target.value})}
                  />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                  <Filter size={18}/> Filtros Avançados
              </button>
          </div>
          {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t animate-slide-down">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Status</label>
                      <select className="w-full border rounded p-2 text-sm bg-gray-50" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                          <option value="">Todos</option>
                          {Object.values(OrderStatus).map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Facção</label>
                      <select className="w-full border rounded p-2 text-sm bg-gray-50" value={filters.subcontractor} onChange={e => setFilters({...filters, subcontractor: e.target.value})}>
                          <option value="">Todos</option>
                          {subcontractors.map(sub => <option key={sub as string} value={sub as string}>{sub as string}</option>)}
                      </select>
                  </div>
              </div>
          )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* ... (Header and Row Rendering - No Changes Needed Here) ... */}
        <div className="bg-gray-50 border-b p-4 grid grid-cols-12 gap-4 font-bold text-gray-600 text-sm uppercase tracking-wider">
            <div className="col-span-3 pl-4">Lote / OP Principal</div>
            <div className="col-span-2">Modelos (Qtd)</div>
            <div className="col-span-2">Volume Total</div>
            <div className="col-span-2">Status Geral</div>
            <div className="col-span-3 text-right pr-4">Ações do Lote</div>
        </div>

        <div className="divide-y">
            {Object.entries(groupedOps).map(([batchId, groupOps]: [string, ProductionOrder[]]) => {
                // ... (Row rendering logic - No changes) ...
                const isExpanded = expandedGroups[batchId];
                const totalQtd = groupOps.reduce((acc, op) => acc + op.quantityTotal, 0);
                const uniqueModels = new Set(groupOps.map(o => o.productId)).size;
                const mainDate = groupOps[0]?.createdAt ? new Date(groupOps[0].createdAt).toLocaleDateString() : '-';
                const statuses = Array.from(new Set(groupOps.map(o => o.status)));
                const canEditBatch = groupOps.every(o => o.status === OrderStatus.DRAFT || o.status === OrderStatus.PLANNED);

                return (
                    <div key={batchId} className="bg-white transition-colors">
                        <div 
                            className={`grid grid-cols-12 gap-4 p-4 items-center cursor-pointer hover:bg-blue-50/50 transition-all ${isExpanded ? 'bg-blue-50/30' : ''}`}
                            onClick={() => toggleGroup(batchId)}
                        >
                            {/* ... (Same layout) ... */}
                            <div className="col-span-3 flex items-center gap-3 pl-4">
                                <button className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-transform duration-200">
                                    {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                                </button>
                                <div>
                                    <div className="font-mono font-bold text-lg text-blue-700">{batchId}</div>
                                    <div className="text-xs text-gray-500">Criado em: {mainDate}</div>
                                </div>
                            </div>
                            <div className="col-span-2 text-sm text-gray-700 font-medium">
                                {uniqueModels} Modelos
                            </div>
                            <div className="col-span-2 font-bold text-gray-800">
                                {totalQtd} <span className="text-xs font-normal text-gray-500">peças</span>
                            </div>
                            <div className="col-span-2">
                                {statuses.length === 1 ? (
                                    <StatusBadge status={statuses[0] as OrderStatus}/>
                                ) : (
                                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Misto / Em Andamento</span>
                                )}
                            </div>
                            <div className="col-span-3 flex justify-end gap-2 pr-4" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={(e) => handleViewBatch(e, groupOps)}
                                    className="p-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 hover:text-blue-600 transition-colors bg-white shadow-sm"
                                    title="Visualizar Resumo do Lote Completo"
                                >
                                    <Eye size={16}/>
                                </button>
                                {canEditBatch && (
                                    <button 
                                        onClick={(e) => handleEditBatch(e, groupOps)}
                                        className="flex items-center gap-2 px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 font-medium text-xs transition-colors"
                                        title="Editar Lote Completo"
                                    >
                                        <Edit2 size={14}/> Editar Lote
                                    </button>
                                )}
                                {!canEditBatch && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1 cursor-help" title="Lote já em produção">
                                        <AlertCircle size={14}/> Em Produção
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* EXPANDED ROWS */}
                        {isExpanded && (
                            <div className="border-t border-gray-100 bg-gray-50/50 pl-12 pr-4 py-2">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-gray-400 uppercase text-left">
                                            <th className="py-2 pl-2">OP (Filha)</th>
                                            <th className="py-2">Produto</th>
                                            <th className="py-2">Qtd</th>
                                            <th className="py-2">Parceiro / Destino</th>
                                            <th className="py-2">Status Atual</th>
                                            <th className="py-2 text-right">Ação Indv.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 border-l-2 border-blue-200">
                                        {groupOps.map(op => {
                                            const prod = products.find(p => p.id === op.productId);
                                            return (
                                                <tr key={op.id} className="hover:bg-white transition-colors">
                                                    <td className="py-3 pl-4 font-mono font-bold text-gray-700">{op.lotNumber}</td>
                                                    <td className="py-3">
                                                        <div className="font-bold text-gray-800">{prod?.sku}</div>
                                                        <div className="text-xs text-gray-500">{prod?.name}</div>
                                                    </td>
                                                    <td className="py-3 font-medium">{op.quantityTotal}</td>
                                                    <td className="py-3 text-gray-600 text-xs">{op.subcontractor || '-'}</td>
                                                    <td className="py-3"><StatusBadge status={op.status}/></td>
                                                    <td className="py-3 text-right">
                                                        <button 
                                                            onClick={() => openDetails(op)}
                                                            className="bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-100 text-xs font-bold shadow-sm inline-flex items-center gap-1"
                                                        >
                                                            <Eye size={12}/> Gerenciar
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
            {Object.keys(groupedOps).length === 0 && (
                <div className="p-12 text-center text-gray-400 italic">Nenhum lote encontrado.</div>
            )}
        </div>
      </div>

      {/* MANAGING MODAL - FULL SCREEN REPORT STYLE */}
      {selectedOp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden animate-scale-in">
              {/* MODAL HEADER */}
              <div className="bg-slate-900 p-4 text-white flex justify-between items-center shadow-md shrink-0">
                 <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Lote / OP</span>
                        <span className="font-mono font-bold text-xl text-blue-400">{selectedOp.lotNumber}</span>
                    </div>
                    <div className="h-8 w-px bg-slate-700"></div>
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Produto</span>
                        <span className="font-bold text-lg">{selectedOp.productId}</span>
                    </div>
                     <div className="h-8 w-px bg-slate-700"></div>
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Status</span>
                        {selectedOp.id.startsWith('BATCH-') ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-600">Visualização Lote</span>
                        ) : (
                            <StatusBadge status={selectedOp.status}/>
                        )}
                    </div>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={() => window.print()} className="p-2 hover:bg-slate-700 rounded text-slate-300"><Printer/></button>
                     <button onClick={() => setSelectedOp(null)} className="p-2 hover:bg-red-900/50 rounded text-red-400"><X/></button>
                 </div>
              </div>

              {/* TABS */}
              <div className="bg-white border-b flex px-6 shrink-0">
                 {[
                   { id: 'summary', label: 'Relatório Geral', icon: FileText },
                   { id: 'revision', label: 'Qualidade & Revisão', icon: ClipboardCheck },
                   { id: 'packing', label: 'Embalagem & Finalização', icon: Package },
                 ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)} 
                        className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                            ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-800'}
                        `}
                    >
                        <tab.icon size={16}/> {tab.label}
                    </button>
                 ))}
                 <div className="ml-auto flex items-center gap-2 py-4">
                    <button onClick={() => navigate('/cutting')} className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200 flex gap-1"><Scissors size={12}/> Ir para Corte</button>
                    <button onClick={() => navigate('/subcontractors')} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 flex gap-1"><Truck size={12}/> Ir para Facção</button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                 {/* SUMMARY REPORT */}
                 {activeTab === 'summary' && (
                    <div className="space-y-8 max-w-5xl mx-auto">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg border shadow-sm">
                                <div className="text-gray-500 text-xs uppercase font-bold">Total Programado</div>
                                <div className="text-2xl font-bold text-blue-600">{selectedOp.quantityTotal} <span className="text-sm text-gray-400">pçs</span></div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border shadow-sm">
                                <div className="text-gray-500 text-xs uppercase font-bold">Cortes Realizados</div>
                                {/* Logic adjusted for Batch View compatibility */}
                                <div className="text-2xl font-bold text-orange-600">
                                    {(batchChildren.length > 0 ? batchChildren : [selectedOp]).reduce((acc, op) => acc + (op.cuttingDetails?.jobs?.reduce((jAcc, job) => jAcc + job.totalPieces, 0) || 0), 0)} 
                                    <span className="text-sm text-gray-400"> pçs</span>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border shadow-sm">
                                <div className="text-gray-500 text-xs uppercase font-bold">Peças Aprovadas</div>
                                <div className="text-2xl font-bold text-green-600">
                                    {(batchChildren.length > 0 ? batchChildren : [selectedOp]).reduce((acc, op) => acc + (op.revisionDetails?.approvedQty || 0), 0)}
                                    <span className="text-sm text-gray-400"> pçs</span>
                                </div>
                            </div>
                             <div className="bg-white p-4 rounded-lg border shadow-sm">
                                <div className="text-gray-500 text-xs uppercase font-bold">Defeitos / Perda</div>
                                <div className="text-2xl font-bold text-red-600">
                                    {(batchChildren.length > 0 ? batchChildren : [selectedOp]).reduce((acc, op) => acc + (op.revisionDetails?.rejectedQty || 0), 0)}
                                    <span className="text-sm text-gray-400"> pçs</span>
                                </div>
                            </div>
                        </div>

                        {/* Detail Matrix - NOW HANDLES MULTIPLE PRODUCTS SEPARATELY */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <div className="flex justify-between mb-4 items-center">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Grid3X3 size={18}/> Detalhamento da Produção</h3>
                                <button onClick={() => setIsLabelModalOpen(true)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 flex items-center gap-1">
                                    <Tag size={12}/> Etiquetas Lote
                                </button>
                            </div>
                            
                            {batchChildren.length > 0 ? (
                                // BATCH VIEW: Render a section for EACH child OP
                                <div className="space-y-8">
                                    {batchChildren.map(childOp => {
                                        const prod = products.find(p => p.id === childOp.productId);
                                        return (
                                            <div key={childOp.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                <div className="flex justify-between mb-2 pb-2 border-b border-gray-200">
                                                    <h4 className="font-bold text-blue-800 flex items-center gap-2">
                                                        <Shirt size={16}/> {prod?.name} ({prod?.sku})
                                                    </h4>
                                                    <span className="text-xs font-bold bg-white px-2 py-1 rounded border">
                                                        OP: {childOp.lotNumber} | {childOp.quantityTotal} pçs
                                                    </span>
                                                </div>
                                                {/* Render Risk & Matrix for this child */}
                                                {renderRiskPlanning(childOp)}
                                                <SizeColorMatrix items={childOp.items} sizes={getActiveSizes(childOp)} />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                // SINGLE VIEW: Render once
                                <>
                                    {renderRiskPlanning(selectedOp)}
                                    <SizeColorMatrix items={selectedOp.items} sizes={getActiveSizes(selectedOp)} />
                                </>
                            )}
                        </div>

                        {/* Timeline - Enhanced with User & Precise Time */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="font-bold text-gray-800 mb-4">Histórico de Rastreabilidade</h3>
                            <div className="space-y-6 relative pl-4 border-l-2 border-gray-200 ml-4">
                                {selectedOp.events?.map((ev, i) => (
                                    <div key={i} className="relative pl-6">
                                        <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-white border-4 border-blue-500"></div>
                                        
                                        <div className="flex justify-between items-start">
                                            <div className="font-bold text-gray-800">{ev.action}</div>
                                            <div className="text-xs text-gray-400 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border">
                                                <Calendar size={12}/> {new Date(ev.date).toLocaleString()}
                                            </div>
                                        </div>
                                        
                                        <div className="text-sm text-gray-600 mt-1 mb-2 bg-gray-50 p-2 rounded border border-gray-100">
                                            {ev.description}
                                        </div>
                                        
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-gray-400 font-medium">Responsável:</span>
                                            <span className="flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                                <User size={10}/> {ev.user || 'Sistema'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {selectedOp.events?.length === 0 && (
                                    <p className="text-gray-400 italic text-sm">Nenhum evento registrado.</p>
                                )}
                            </div>
                        </div>
                    </div>
                 )}

                 {/* ... (Revision and Packing tabs remain largely same, viewing total or blocking edit for batch) ... */}
                 {activeTab === 'revision' && (
                     <div className="max-w-4xl mx-auto">
                         {batchChildren.length > 0 ? (
                             <div className="text-center p-12 text-gray-500">
                                 <AlertCircle size={48} className="mx-auto mb-4 opacity-20"/>
                                 <p>Para realizar o apontamento de qualidade, acesse as OPs individualmente.</p>
                             </div>
                         ) : (
                             // EXISTING REVISION FORM
                             <div className="bg-white p-8 rounded-xl shadow-sm border grid grid-cols-2 gap-12">
                                 <div className="space-y-6">
                                     <div>
                                         <label className="block text-sm font-bold text-gray-700 mb-1">Responsável Revisão</label>
                                         <input className="w-full border rounded p-3" placeholder="Nome do revisor"
                                            value={revisionForm.inspectorName} onChange={e => setRevisionForm({...revisionForm, inspectorName: e.target.value})}/>
                                     </div>
                                     <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                         <label className="block text-sm font-bold text-green-800 mb-1">Peças Aprovadas (1ª Qualidade)</label>
                                         <input type="number" className="w-full border rounded p-3 text-2xl font-bold text-green-700" 
                                            value={revisionForm.approvedQty} onChange={e => setRevisionForm({...revisionForm, approvedQty: Number(e.target.value)})}/>
                                     </div>
                                     <div className="grid grid-cols-2 gap-4">
                                         <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                                            <label className="block text-xs font-bold text-yellow-800 mb-1">Retrabalho / 2ª</label>
                                            <input type="number" className="w-full border rounded p-2 font-bold text-yellow-700"
                                                value={revisionForm.reworkQty} onChange={e => setRevisionForm({...revisionForm, reworkQty: Number(e.target.value)})}/>
                                         </div>
                                         <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                                            <label className="block text-xs font-bold text-red-800 mb-1">Perda / Defeito</label>
                                            <input type="number" className="w-full border rounded p-2 font-bold text-red-700"
                                                value={revisionForm.rejectedQty} onChange={e => setRevisionForm({...revisionForm, rejectedQty: Number(e.target.value)})}/>
                                         </div>
                                     </div>
                                 </div>
                                 <div className="flex flex-col justify-between">
                                     <div className="bg-gray-50 p-4 rounded text-sm text-gray-600 mb-4">
                                         <h4 className="font-bold mb-2">Resumo da OP</h4>
                                         <div className="flex justify-between mb-1"><span>Total Cortado:</span> <span className="font-bold">{selectedOp.quantityTotal}</span></div>
                                         <div className="flex justify-between border-t pt-2 mt-2">
                                             <span>Total Apontado:</span> 
                                             <span className="font-bold">{(revisionForm.approvedQty||0) + (revisionForm.reworkQty||0) + (revisionForm.rejectedQty||0)}</span>
                                         </div>
                                     </div>
                                     <button onClick={saveRevision} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">
                                         Salvar e Mover para Embalagem
                                     </button>
                                 </div>
                             </div>
                         )}
                     </div>
                 )}

                 {activeTab === 'packing' && (
                     <div className="max-w-4xl mx-auto">
                        {batchChildren.length > 0 ? (
                             <div className="text-center p-12 text-gray-500">
                                 <AlertCircle size={48} className="mx-auto mb-4 opacity-20"/>
                                 <p>Para realizar a embalagem e baixa, acesse as OPs individualmente.</p>
                             </div>
                        ) : (
                            // EXISTING PACKING FORM
                            <div className="bg-white p-8 rounded-xl shadow-sm border">
                                 <div className="grid grid-cols-2 gap-8 mb-8">
                                     <div>
                                         <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Embalagem</label>
                                         <select className="w-full border rounded p-3 bg-white" 
                                            value={packingForm.packingType} onChange={e => setPackingForm({...packingForm, packingType: e.target.value})}>
                                             <option>Caixa Padrão</option>
                                             <option>Saco Individual</option>
                                             <option>Cabide</option>
                                         </select>
                                     </div>
                                     <div>
                                         <label className="block text-sm font-bold text-gray-700 mb-1">Total de Volumes (Caixas)</label>
                                         <input type="number" className="w-full border rounded p-3" 
                                            value={packingForm.totalBoxes} onChange={e => setPackingForm({...packingForm, totalBoxes: Number(e.target.value)})}/>
                                     </div>
                                 </div>
                                 
                                 <div className="bg-pink-50 border border-pink-100 rounded-xl p-6 mb-8 text-center">
                                     <label className="block text-sm font-bold text-pink-800 mb-2">Quantidade Total Embalada (Produto Acabado)</label>
                                     <input type="number" className="text-4xl font-bold text-pink-700 bg-transparent text-center w-full focus:outline-none" 
                                        value={packingForm.totalPackedQty || selectedOp.revisionDetails?.approvedQty || 0}
                                        onChange={e => setPackingForm({...packingForm, totalPackedQty: Number(e.target.value)})}
                                     />
                                     <p className="text-xs text-pink-500 mt-2">Esta quantidade entrará no estoque de produto acabado.</p>
                                 </div>

                                 <div className="flex justify-between items-center border-t pt-6">
                                     <button className="text-gray-500 hover:text-gray-800 flex items-center gap-2 text-sm">
                                         <Printer size={18}/> Imprimir Etiquetas de Caixa
                                     </button>
                                     <button onClick={savePacking} className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg flex items-center gap-2">
                                         <CheckCircle size={20}/> Finalizar OP & Atualizar Estoque
                                     </button>
                                 </div>
                            </div>
                        )}
                     </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* LABEL PRINTING MODAL */}
      {selectedOp && isLabelModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-2xl h-[80vh] flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50 no-print">
                      <h3 className="font-bold">Etiquetas de Lote</h3>
                      <div className="flex gap-2">
                        <button onClick={() => window.print()} className="bg-blue-600 text-white px-3 py-1 rounded">Imprimir</button>
                        <button onClick={() => setIsLabelModalOpen(false)} className="bg-gray-200 px-3 py-1 rounded">Fechar</button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 printable-sheet">
                      <div className="grid grid-cols-2 gap-4">
                          {[1,2,3,4].map(n => (
                              <div key={n} className="border-2 border-black p-4 flex flex-col justify-between h-48 break-inside-avoid">
                                  <div className="flex justify-between items-start">
                                      <div>
                                        <h2 className="font-bold text-xl">{selectedOp.lotNumber}</h2>
                                        <p className="text-sm font-mono">{selectedOp.productId}</p>
                                      </div>
                                      <div className="w-12 h-12 bg-black"></div> 
                                  </div>
                                  <div className="text-center font-bold text-2xl border-y py-2 my-2">
                                      Tamanho: M
                                  </div>
                                  <div className="flex justify-between text-xs">
                                      <span>Cor: Branco</span>
                                      <span>Pct: {n}/10</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
