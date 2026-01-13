
import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, ProductionOrderItem, Product } from '../types';
import { ApiService } from '../services/api';
import { ClipboardCheck, CheckCircle2, AlertTriangle, ArrowRight, Save, X, Search, RotateCw, ArrowDown, Scissors, HelpCircle, AlertOctagon, Loader2, Truck, User, MoreVertical, RotateCcw, RefreshCw, Database } from 'lucide-react';
import { ModernDatePicker } from './ModernDatePicker';
import { useToast } from '../contexts/ToastContext';

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

// Type for the dynamic matrices
type RevisionMatrix = Record<string, Record<string, number>>;

export const RevisionModule: React.FC = () => {
  const { addToast } = useToast();
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [completedOps, setCompletedOps] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOp, setSelectedOp] = useState<ProductionOrder | null>(null);
  const [inspectorName, setInspectorName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Menu State
  const [activeMenuOpId, setActiveMenuOpId] = useState<string | null>(null);
  
  // Revert State
  const [opToRevert, setOpToRevert] = useState<ProductionOrder | null>(null);

  // Matrix States for Detailed Breakdown
  const [approvedMatrix, setApprovedMatrix] = useState<RevisionMatrix>({});
  const [reworkMatrix, setReworkMatrix] = useState<RevisionMatrix>({});
  const [defectMatrix, setDefectMatrix] = useState<RevisionMatrix>({});
  const [missingMatrix, setMissingMatrix] = useState<RevisionMatrix>({}); // "Peças Faltantes" (Didn't arrive)

  // UI State
  const [matrixTab, setMatrixTab] = useState<'approved' | 'rework' | 'defect' | 'missing'>('approved');
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({
      label: 'Últimos 30 dias',
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date()
  });

  // --- NEW: REWORK CONFIRMATION MODAL STATE ---
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkResponsible, setReworkResponsible] = useState('');
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Fechar menu ao clicar fora
  useEffect(() => {
      const handleClickOutside = () => setActiveMenuOpId(null);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
        const [allOps, allProds] = await Promise.all([
            ApiService.getProductionOrders(),
            ApiService.getProducts()
        ]);
        allOps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Pendentes: Status REVISÃO
        setOps(allOps.filter(op => op.status === OrderStatus.QUALITY_CONTROL));
        
        // Histórico: Status EMBALAGEM ou CONCLUÍDO e que tenha detalhes de revisão
        // A verificação op.revisionDetails garante que só pegamos o que passou por aqui
        setCompletedOps(allOps.filter(op => 
            (op.status === OrderStatus.PACKING || op.status === OrderStatus.COMPLETED) && 
            op.revisionDetails && 
            op.revisionDetails.isFinalized
        ));
        
        setProducts(allProds);
    } catch (err: any) {
        addToast({ type: 'error', title: 'Erro', message: 'Falha ao carregar dados.' });
    } finally {
        setIsLoading(false);
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
          const revDate = new Date(op.revisionDetails?.endDate || op.createdAt).getTime();
          const dateMatch = revDate >= start && revDate <= end;
          const searchMatch = !searchTerm || 
              op.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              prodName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (op.revisionDetails?.inspectorName || '').toLowerCase().includes(searchTerm.toLowerCase());
          return dateMatch && searchMatch;
      });
  }, [completedOps, dateRange, searchTerm, products]);

  // --- KPI STATS (TOTAL HISTÓRICO REAL) ---
  const stats = useMemo(() => {
      let totalReviewed = 0;
      let totalApproved = 0;
      let totalRework = 0;
      let totalRejected = 0;

      // Iterar sobre TODO o histórico carregado para garantir precisão
      completedOps.forEach(op => {
          if (op.revisionDetails) {
              // Força a conversão para Number para evitar concatenação de strings ou erros
              const approved = Number(op.revisionDetails.approvedQty) || 0;
              const rework = Number(op.revisionDetails.reworkQty) || 0;
              const rejected = Number(op.revisionDetails.rejectedQty) || 0;
              
              totalApproved += approved;
              totalRework += rework;
              totalRejected += rejected;
              totalReviewed += (approved + rework + rejected);
          }
      });

      return { totalReviewed, totalApproved, totalRework, totalRejected };
  }, [completedOps]);

  // --- ACTIONS ---

  const handleRevertOp = async () => {
      if (!opToRevert) return;
      
      try {
          await ApiService.revertRevisionToSubcontractor(opToRevert.id);
          addToast({ type: 'success', title: 'Estorno Realizado', message: `O lote ${opToRevert.lotNumber} voltou para a fase de Costura/Facção.` });
          setOpToRevert(null);
          loadData();
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro no Estorno', message: error.message });
      }
  };

  // --- MATRIX INITIALIZATION ---
  useEffect(() => {
      if (selectedOp) {
          // Initialize empty matrices based on OP items
          const initMatrix = (sourceItems: ProductionOrderItem[]): RevisionMatrix => {
              const matrix: RevisionMatrix = {};
              const sizes = Array.from(new Set(sourceItems.map(i => i.size))).sort();
              const colors = Array.from(new Set(sourceItems.map(i => i.color)));
              
              colors.forEach((c) => {
                  matrix[c] = {};
                  sizes.forEach((s) => {
                      matrix[c][s] = 0;
                  });
              });
              return matrix;
          };

          const baseMatrix = initMatrix(selectedOp.items);
          setApprovedMatrix(JSON.parse(JSON.stringify(baseMatrix)));
          setReworkMatrix(JSON.parse(JSON.stringify(baseMatrix)));
          setDefectMatrix(JSON.parse(JSON.stringify(baseMatrix)));
          setMissingMatrix(JSON.parse(JSON.stringify(baseMatrix)));
          
          setInspectorName(selectedOp.revisionDetails?.inspectorName || '');
          setMatrixTab('approved');
          setShowReworkModal(false);
          setReworkResponsible('');
      }
  }, [selectedOp]);

  // --- LOGIC HELPERS ---

  const getPlannedQty = (color: string, size: string) => {
      return selectedOp?.items.find(i => i.color === color && i.size === size)?.quantity || 0;
  };

  const getMatrixValue = (matrix: RevisionMatrix, color: string, size: string) => {
      return matrix[color]?.[size] || 0;
  };

  const updateMatrixValue = (
      matrixState: RevisionMatrix, 
      setMatrixState: React.Dispatch<React.SetStateAction<RevisionMatrix>>,
      color: string, 
      size: string, 
      value: number
  ) => {
      setMatrixState(prev => ({
          ...prev,
          [color]: {
              ...prev[color],
              [size]: value
          }
      }));
  };

  const calculateMatrixTotal = (matrix: RevisionMatrix) => {
      let total = 0;
      Object.values(matrix).forEach(sizes => {
          Object.values(sizes).forEach(qty => total += Number(qty) || 0);
      });
      return total;
  };

  const convertMatrixToItems = (matrix: RevisionMatrix): ProductionOrderItem[] => {
      const items: ProductionOrderItem[] = [];
      Object.entries(matrix).forEach(([color, sizes]) => {
          Object.entries(sizes).forEach(([size, qty]) => {
              if (qty > 0) items.push({ color, size, quantity: Number(qty) });
          });
      });
      return items;
  };

  const validateTotals = () => {
      if (!selectedOp) return { valid: false, diff: 0, totalCounted: 0 };
      
      const totalApproved = calculateMatrixTotal(approvedMatrix);
      const totalRework = calculateMatrixTotal(reworkMatrix);
      const totalDefect = calculateMatrixTotal(defectMatrix);
      const totalMissing = calculateMatrixTotal(missingMatrix);
      
      const totalCounted = totalApproved + totalRework + totalDefect + totalMissing;
      const totalPlanned = selectedOp.quantityTotal;
      
      return {
          valid: totalCounted === totalPlanned,
          diff: totalCounted - totalPlanned,
          totalCounted,
          totalPlanned,
          breakdown: { totalApproved, totalRework, totalDefect, totalMissing }
      };
  };

  const handleSave = async () => {
      if (!selectedOp) return;
      if (isSaving) return;

      if (!inspectorName.trim()) {
          addToast({ type: 'error', title: 'Campo Obrigatório', message: 'Informe o responsável pela revisão.' });
          return;
      }

      const validation = validateTotals();
      if (!validation.valid) {
          addToast({ 
              type: 'error', 
              title: 'Divergência de Quantidade', 
              message: `A soma total (${validation.totalCounted}) deve ser EXATAMENTE igual ao planejado (${validation.totalPlanned}). Diferença: ${validation.diff > 0 ? '+' : ''}${validation.diff}` 
          });
          return;
      }

      // Prepare Breakdown Arrays
      const itemsApproved = convertMatrixToItems(approvedMatrix);
      const itemsRework = convertMatrixToItems(reworkMatrix);
      const itemsRejected = convertMatrixToItems(defectMatrix);
      const itemsMissing = convertMatrixToItems(missingMatrix);

      // Store pending data structure
      // NOTE: Ensure quantity properties are Numbers for DB aggregation
      const saveData = {
          validation,
          itemsApproved,
          itemsRework,
          itemsRejected,
          itemsMissing
      };

      setPendingSaveData(saveData);

      // --- CHECK IF REWORK IS NEEDED ---
      if (validation.breakdown.totalRework > 0) {
          setShowReworkModal(true);
          return;
      }

      // If no rework, proceed to finish
      await executeFinalize(saveData);
  };

  const executeFinalize = async (data: any, reworkResp?: string) => {
      setIsSaving(true);
      try {
          // --- AUTOMATIC REWORK LOGIC ---
          if (data.validation.breakdown.totalRework > 0) {
              const description = `Peças reprovadas na revisão (Retrabalho). Envio autorizado por: ${reworkResp || inspectorName}`;
              
              await ApiService.createReworkOrder(
                  selectedOp!.id,
                  selectedOp!.subcontractor || 'Interno',
                  data.validation.breakdown.totalRework,
                  data.itemsRework, // Detailed Snapshot
                  description
              );
              
              addToast({ type: 'info', title: 'Remessa Gerada', message: 'Ordem de Retrabalho criada e enviada para a facção.' });
          }

          const updatedOp = {
              ...selectedOp,
              status: OrderStatus.PACKING, 
              revisionDetails: {
                  inspectorName,
                  
                  // CRITICAL: Saving explicit totals for Dashboards/Cards
                  approvedQty: Number(data.validation.breakdown.totalApproved),
                  itemsApproved: data.itemsApproved,
                  
                  reworkQty: Number(data.validation.breakdown.totalRework),
                  itemsRework: data.itemsRework,
                  
                  rejectedQty: Number(data.validation.breakdown.totalDefect),
                  itemsRejected: data.itemsRejected,
                  
                  missingQty: Number(data.validation.breakdown.totalMissing),
                  itemsMissing: data.itemsMissing,

                  isFinalized: true,
                  endDate: new Date().toISOString()
              }
          };

          await ApiService.updateProductionOrder(selectedOp!.id, updatedOp);
          
          setSelectedOp(null);
          setShowReworkModal(false);
          setPendingSaveData(null);
          await loadData(); // Reload to refresh cards immediately
          addToast({ type: 'success', title: 'Revisão Concluída', message: 'Ordem enviada para Embalagem com sucesso.' });
      } catch (err: any) {
          addToast({ type: 'error', title: 'Erro ao Salvar', message: err.message });
      } finally {
          setIsSaving(false);
      }
  };

  const handleConfirmRework = () => {
      if (!reworkResponsible.trim()) {
          addToast({ type: 'error', title: 'Campo Obrigatório', message: 'Informe o responsável pelo envio do retrabalho.' });
          return;
      }
      executeFinalize(pendingSaveData, reworkResponsible);
  };

  const validationStatus = validateTotals();

  // --- RENDER MATRIX HELPER ---
  const renderInputMatrix = (
      currentMatrix: RevisionMatrix, 
      setMatrixFunc: React.Dispatch<React.SetStateAction<RevisionMatrix>>,
      colorTheme: string // 'purple' | 'yellow' | 'red' | 'gray'
  ) => {
      if (!selectedOp) return null;
      
      const themeColors: any = {
          purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', ring: 'focus:ring-purple-200' },
          yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', ring: 'focus:ring-yellow-200' },
          red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    ring: 'focus:ring-red-200' },
          gray:   { bg: 'bg-gray-100',  border: 'border-gray-300',   text: 'text-gray-700',   ring: 'focus:ring-gray-200' }
      };
      const theme = themeColors[colorTheme];

      return (
          <div className={`border-2 ${theme.border} rounded-xl overflow-hidden shadow-sm bg-white`}>
              <table className="w-full text-center text-sm">
                  <thead className={`${theme.bg} ${theme.text} font-bold`}>
                      <tr>
                          <th className="p-3 text-left">Cor / Tam</th>
                          {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => <th key={s} className="p-2 w-16">{s}</th>)}
                          <th className="p-3 w-20 border-l border-gray-200">Total</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {(Array.from(new Set(selectedOp.items.map(i => i.color))) as string[]).map(color => {
                          const rowTotal = Object.values(currentMatrix[color] || {}).reduce((a,b)=>a+b,0);
                          return (
                              <tr key={color} className="hover:bg-gray-50 transition-colors">
                                  <td className="p-3 text-left font-bold flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(color)}}></div>
                                      {color}
                                  </td>
                                  {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => {
                                      const max = getPlannedQty(color, s);
                                      const current = currentMatrix[color]?.[s] || 0;
                                      const cellTotal = 
                                          getMatrixValue(approvedMatrix, color, s) + 
                                          getMatrixValue(reworkMatrix, color, s) + 
                                          getMatrixValue(defectMatrix, color, s) + 
                                          getMatrixValue(missingMatrix, color, s);
                                      
                                      const isOver = cellTotal > max;

                                      return (
                                          <td key={s} className="p-1">
                                              {max > 0 ? (
                                                  <div className="relative">
                                                      <input 
                                                        type="number"
                                                        className={`w-full text-center font-bold border rounded p-2 outline-none transition-colors text-lg
                                                            ${isOver ? 'bg-red-50 border-red-300 text-red-600' : `bg-white ${theme.border} text-gray-900 focus:ring-2 ${theme.ring}`}
                                                        `}
                                                        value={current === 0 ? '' : current}
                                                        placeholder="0"
                                                        onChange={e => updateMatrixValue(currentMatrix, setMatrixFunc, color, s, Number(e.target.value))}
                                                      />
                                                      {isOver && <div className="absolute -top-2 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                                                  </div>
                                              ) : <span className="text-gray-200 text-xs">-</span>}
                                          </td>
                                      );
                                  })}
                                  <td className={`p-3 font-bold border-l border-gray-200 ${theme.text} ${theme.bg}`}>
                                      {rowTotal}
                                  </td>
                              </tr>
                          )
                      })}
                      {/* GRAND TOTAL */}
                      <tr className={`${theme.bg} font-bold border-t-2 ${theme.border} ${theme.text}`}>
                          <td className="p-3 text-left">TOTAL ABA</td>
                          {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => (
                              <td key={s} className="p-3">
                                  {(Array.from(new Set(selectedOp.items.map(i => i.color))) as string[]).reduce((acc, c) => acc + (currentMatrix[c]?.[s] || 0), 0)}
                              </td>
                          ))}
                          <td className="p-3 text-lg border-l border-gray-300">
                              {calculateMatrixTotal(currentMatrix)}
                          </td>
                      </tr>
                  </tbody>
              </table>
          </div>
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="text-purple-600" /> Revisão & Qualidade
          </h1>
          <p className="text-gray-500 text-sm">Controle de qualidade e segregação de peças defeituosas.</p>
        </div>
        <button 
            onClick={loadData} 
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition-colors"
        >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/> Atualizar Dados
        </button>
      </div>

      {/* TOP METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border-l-4 border-blue-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ClipboardCheck size={20}/></div>
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Database size={16}/></div>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Total Revisado (Histórico)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalReviewed} <span className="text-sm font-normal text-gray-400">pçs</span></div>
          </div>

          <div className="bg-white p-5 rounded-xl border-l-4 border-green-500 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle2 size={20}/></div>
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
                    placeholder="Buscar Lote, Produto..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
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
              <tr key={op.id} className="hover:bg-purple-50/30 transition-colors relative group">
                <td className="p-4 font-mono font-bold text-purple-700">{op.lotNumber}</td>
                <td className="p-4">
                    <div className="font-bold text-gray-800">{getProductDisplayName(op.productId)}</div>
                </td>
                <td className="p-4">
                    {activeTab === 'pending' ? op.subcontractor : new Date(op.revisionDetails?.endDate || '').toLocaleDateString()}
                </td>
                <td className="p-4 text-gray-500">
                    {activeTab === 'pending' ? new Date(op.revisionDetails?.startDate || op.createdAt).toLocaleDateString() : op.revisionDetails?.inspectorName}
                </td>
                <td className="p-4 text-right">
                  {activeTab === 'pending' ? (
                      <div className="flex items-center justify-end gap-2 relative">
                          {/* 3 Dots Menu Button */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveMenuOpId(activeMenuOpId === op.id ? null : op.id); }}
                            className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          >
                              <MoreVertical size={18}/>
                          </button>

                          {/* Context Menu Dropdown */}
                          {activeMenuOpId === op.id && (
                              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-xl z-20 w-48 overflow-hidden animate-fade-in text-left">
                                  <button 
                                    onClick={() => { setOpToRevert(op); setActiveMenuOpId(null); }}
                                    className="w-full px-4 py-3 hover:bg-red-50 flex items-center gap-2 text-red-600 text-sm font-medium transition-colors"
                                  >
                                      <RotateCcw size={16}/> Estornar para Facção
                                  </button>
                              </div>
                          )}

                          <button 
                            onClick={() => setSelectedOp(op)}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2 transition-transform hover:scale-105"
                          >
                            Iniciar Revisão <ArrowRight size={16}/>
                          </button>
                      </div>
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

      {/* REVERT CONFIRMATION MODAL */}
      {opToRevert && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-scale-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                          <RotateCcw size={24}/>
                      </div>
                      <h3 className="font-bold text-xl text-gray-900 mb-2">Estornar Lote {opToRevert.lotNumber}?</h3>
                      <p className="text-gray-500 text-sm mb-6">
                          Esta ação devolverá o lote para o status <b>"Em Costura (Facção)"</b> e removerá da fila de revisão. Confirma?
                      </p>
                      
                      <div className="flex gap-3 w-full">
                          <button 
                              onClick={() => setOpToRevert(null)}
                              className="flex-1 py-2.5 border border-gray-300 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={handleRevertOp}
                              className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md transition-colors"
                          >
                              Confirmar Estorno
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* REVISION MODAL - DETAILED BREAKDOWN */}
      {selectedOp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl animate-scale-in overflow-hidden max-h-[95vh] flex flex-col">
               <div className="bg-purple-600 p-4 text-white flex justify-between items-center shrink-0">
                   <h3 className="font-bold text-lg flex items-center gap-2"><ClipboardCheck/> Conferência de Lote: {selectedOp.lotNumber}</h3>
                   <button onClick={() => setSelectedOp(null)} className="hover:bg-purple-700 p-1 rounded"><X/></button>
               </div>
               
               <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                  
                  {/* HEADER INFO */}
                  <div className="mb-6 bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center">
                      <div>
                          <div className="text-xs text-gray-500 font-bold uppercase">Produto</div>
                          <div className="text-xl font-bold text-gray-800">{getProductDisplayName(selectedOp.productId)}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-xs text-gray-500 font-bold uppercase">Total Esperado (Corte)</div>
                          <div className="text-2xl font-bold text-purple-700">{selectedOp.quantityTotal} <span className="text-sm font-normal text-gray-400">peças</span></div>
                      </div>
                  </div>

                  {/* REFERENCE MATRIX (PLANNED) */}
                  <div className="mb-6 bg-white p-4 rounded-xl border border-dashed border-gray-300">
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><Scissors size={14}/> Grade de Corte (Referência)</h4>
                      <div className="overflow-x-auto">
                          <table className="w-full text-center text-xs opacity-70">
                              <thead>
                                  <tr className="border-b border-gray-200">
                                      <th className="text-left py-1">Cor</th>
                                      {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(s => <th key={s} className="w-12">{s}</th>)}
                                      <th className="w-12 font-bold">Total</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {(Array.from(new Set(selectedOp.items.map(i => i.color))) as string[]).map(color => {
                                      const items = selectedOp.items;
                                      return (
                                          <tr key={color}>
                                              <td className="text-left font-bold py-1 text-gray-700">{color}</td>
                                              {(Array.from(new Set(selectedOp.items.map(i => i.size))) as string[]).sort().map(size => {
                                                  const qty = items.find(i => i.color === color && i.size === size)?.quantity || 0;
                                                  return <td key={size} className={qty > 0 ? "text-purple-700 font-bold" : "text-gray-300"}>{qty || '-'}</td>
                                              })}
                                              <td className="font-bold text-gray-800">{items.filter(i => i.color === color).reduce((a,b)=>a+b.quantity,0)}</td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  <div className="flex justify-center mb-6 text-gray-300"><ArrowDown size={24}/></div>

                  {/* TAB NAVIGATION */}
                  <div className="flex gap-2 mb-0">
                      <button onClick={() => setMatrixTab('approved')} className={`px-6 py-3 rounded-t-xl font-bold text-sm border-t border-x transition-all ${matrixTab === 'approved' ? 'bg-white border-purple-200 text-purple-700 z-10' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'}`}>
                          <CheckCircle2 size={16} className="inline mr-2"/> Aprovadas (1ª)
                      </button>
                      <button onClick={() => setMatrixTab('rework')} className={`px-6 py-3 rounded-t-xl font-bold text-sm border-t border-x transition-all ${matrixTab === 'rework' ? 'bg-white border-yellow-200 text-yellow-700 z-10' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'}`}>
                          <RotateCw size={16} className="inline mr-2"/> Retrabalho (2ª)
                      </button>
                      <button onClick={() => setMatrixTab('defect')} className={`px-6 py-3 rounded-t-xl font-bold text-sm border-t border-x transition-all ${matrixTab === 'defect' ? 'bg-white border-red-200 text-red-700 z-10' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'}`}>
                          <AlertTriangle size={16} className="inline mr-2"/> Defeito (Perda)
                      </button>
                      <button onClick={() => setMatrixTab('missing')} className={`px-6 py-3 rounded-t-xl font-bold text-sm border-t border-x transition-all ${matrixTab === 'missing' ? 'bg-white border-gray-300 text-gray-700 z-10' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'}`}>
                          <HelpCircle size={16} className="inline mr-2"/> Faltantes (Diferença)
                      </button>
                  </div>

                  {/* ACTIVE MATRIX CONTENT */}
                  <div className="bg-white p-6 rounded-b-xl rounded-tr-xl border shadow-sm relative z-0">
                      {matrixTab === 'approved' && renderInputMatrix(approvedMatrix, setApprovedMatrix, 'purple')}
                      {matrixTab === 'rework' && (
                          <div>
                              <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded mb-4 border border-yellow-200">
                                  <b>Atenção:</b> Ao salvar, uma ordem de conserto será gerada automaticamente para estas peças.
                              </div>
                              {renderInputMatrix(reworkMatrix, setReworkMatrix, 'yellow')}
                          </div>
                      )}
                      {matrixTab === 'defect' && renderInputMatrix(defectMatrix, setDefectMatrix, 'red')}
                      {matrixTab === 'missing' && (
                          <div>
                              <div className="bg-gray-100 text-gray-600 text-xs p-3 rounded mb-4 border border-gray-200">
                                  Registre aqui peças que <b>não vieram</b> na sacola do corte (diferença de quantidade).
                              </div>
                              {renderInputMatrix(missingMatrix, setMissingMatrix, 'gray')}
                          </div>
                      )}
                  </div>

                  {/* SUMMARY & VALIDATION FOOTER */}
                  <div className="mt-6 bg-slate-800 text-white p-6 rounded-xl shadow-lg">
                      <div className="grid grid-cols-5 gap-4 text-center items-center">
                          <div className="border-r border-slate-600">
                              <div className="text-xs text-slate-400 uppercase">Aprovadas</div>
                              <div className="text-xl font-bold text-green-400">{validationStatus.breakdown.totalApproved}</div>
                          </div>
                          <div className="border-r border-slate-600">
                              <div className="text-xs text-slate-400 uppercase">Retrabalho</div>
                              <div className="text-xl font-bold text-yellow-400">{validationStatus.breakdown.totalRework}</div>
                          </div>
                          <div className="border-r border-slate-600">
                              <div className="text-xs text-slate-400 uppercase">Defeito</div>
                              <div className="text-xl font-bold text-red-400">{validationStatus.breakdown.totalDefect}</div>
                          </div>
                          <div className="border-r border-slate-600">
                              <div className="text-xs text-slate-400 uppercase">Faltantes</div>
                              <div className="text-xl font-bold text-gray-400">{validationStatus.breakdown.totalMissing}</div>
                          </div>
                          <div>
                              <div className="text-xs text-slate-400 uppercase">Total Contado</div>
                              <div className={`text-2xl font-bold ${validationStatus.valid ? 'text-white' : 'text-red-500 animate-pulse'}`}>
                                  {validationStatus.totalCounted} <span className="text-sm text-slate-500">/ {validationStatus.totalPlanned}</span>
                              </div>
                          </div>
                      </div>
                      
                      {!validationStatus.valid && (
                          <div className="mt-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded text-center text-sm font-bold flex items-center justify-center gap-2">
                              <AlertOctagon size={16}/>
                              Divergência: {validationStatus.diff > 0 ? `+${validationStatus.diff} peças a mais` : `${validationStatus.diff} peças faltando na contagem`}
                          </div>
                      )}
                  </div>

                  <div className="mt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Responsável pela Revisão <span className="text-red-500">*</span></label>
                        <input 
                            className="w-full border rounded p-3"
                            placeholder="Nome do revisor"
                            value={inspectorName} 
                            onChange={e => setInspectorName(e.target.value)}
                        />
                  </div>
               </div>

               <div className="bg-gray-50 p-4 border-t flex justify-end items-center shrink-0">
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all
                            ${validationStatus.valid 
                                ? 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-105' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                        `}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        {isSaving ? 'Salvando...' : 'Concluir Conferência'}
                    </button>
               </div>
           </div>
        </div>
      )}

      {/* REWORK CONFIRMATION MODAL */}
      {showReworkModal && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-scale-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border-t-8 border-yellow-500">
                  <div className="p-6">
                      <div className="flex justify-center mb-4 text-yellow-500">
                          <Truck size={48} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Confirmar Remessa de Conserto</h3>
                      <p className="text-gray-500 text-center text-sm mb-6">
                          Você registrou peças para retrabalho. Uma nova ordem de serviço será gerada automaticamente para a facção.
                      </p>

                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                          <div className="flex justify-between mb-2 pb-2 border-b border-gray-200">
                              <span className="text-xs font-bold text-gray-500 uppercase">Destino / Facção</span>
                              <span className="font-bold text-gray-800">{selectedOp?.subcontractor || 'Interno'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-500 uppercase">Total Peças</span>
                              <span className="text-2xl font-bold text-yellow-600">{pendingSaveData?.validation?.breakdown?.totalRework || 0}</span>
                          </div>
                      </div>

                      <div className="mb-4">
                          <label className="block text-sm font-bold text-gray-700 mb-1">Responsável pelo Envio <span className="text-red-500">*</span></label>
                          <div className="relative">
                              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                              <input 
                                  className="w-full border rounded-lg p-3 pl-10 focus:ring-2 focus:ring-yellow-500 outline-none"
                                  placeholder="Quem autorizou o envio?"
                                  value={reworkResponsible}
                                  onChange={e => setReworkResponsible(e.target.value)}
                                  autoFocus
                              />
                          </div>
                      </div>

                      <div className="flex gap-3">
                          <button 
                              onClick={() => setShowReworkModal(false)}
                              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={handleConfirmRework}
                              className="flex-1 py-3 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 shadow-md transition-colors flex items-center justify-center gap-2"
                          >
                              Confirmar e Salvar
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
