
// ... existing imports ...
import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, CuttingJob, LayerDefinition, MatrixRatio, Product, TechPack, StandardObservation, Partner } from '../types';
import { MockService } from '../services/mockDb';
import { Scissors, Ruler, Layers, CheckCircle, Printer, X, Grid3X3, AlertTriangle, Scale, Plus, ArrowRight, PauseCircle, PlayCircle, StopCircle, Lock, FileText, ClipboardList, MoreVertical, RotateCcw, ChevronDown, ChevronRight, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';

// ... existing helper functions ...
// Helper for Color
const getColorStyle = (colorName: string) => {
    const map: any = {
        'Branco': '#ffffff', 'Preto': '#000000', 'Marinho': '#000080', 'Vermelho': '#ff0000',
        'Verde': '#008000', 'Amarelo': '#ffff00', 'Azul': '#0000ff', 'Cinza': '#808080',
        'Rosa': '#ffc0cb', 'Roxo': '#800080'
    };
    return map[colorName] || '#cccccc';
};

export const CuttingModule: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'planning';

  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedOp, setSelectedOp] = useState<ProductionOrder | null>(null);
  
  // Cutting Form State
  const [cutType, setCutType] = useState('Principal');
  const [markerWidth, setMarkerWidth] = useState(1.80);
  const [markerLength, setMarkerLength] = useState(0);
  const [markerWeight, setMarkerWeight] = useState(0);
  const [wasteWeight, setWasteWeight] = useState(0);
  const [bundles, setBundles] = useState(0);
  
  // Layers State (copied from plan initially)
  const [realLayers, setRealLayers] = useState<LayerDefinition[]>([]);
  
  // Print State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Menu State
  const [activeMenuOpId, setActiveMenuOpId] = useState<string | null>(null);

  // Filters State
  const [cutterFilter, setCutterFilter] = useState<string>('');

  // Grouping Expansion State
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Overproduction Modal State
  const [showOverproductionModal, setShowOverproductionModal] = useState(false);
  const [exceedingItems, setExceedingItems] = useState<any[]>([]);
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentTab]);

  const loadData = async () => {
    const allOps = await MockService.getProductionOrders();
    const allProducts = await MockService.getProducts();
    const allPartners = await MockService.getPartners();
    
    setProducts(allProducts);
    setPartners(allPartners);

    // Filter based on tab Logic
    let filtered = [];
    if (currentTab === 'planning') {
        // Show OPs that are PLANNED (0% progress)
        filtered = allOps.filter(op => op.status === OrderStatus.PLANNED);
    } else if (currentTab === 'active') {
        // Show OPs that are CUTTING (started) but NOT yet 100% completed
        filtered = allOps.filter(op => {
            const totalCut = op.cuttingDetails?.jobs?.reduce((a,b)=>a+b.totalPieces,0) || 0;
            const isCutCompleted = totalCut >= op.quantityTotal;
            
            return op.status === OrderStatus.CUTTING && !isCutCompleted;
        });
    } else if (currentTab === 'done') {
        // Show OPs that reached 100% (even if status is still CUTTING) OR OPs that moved to next stages
        filtered = allOps.filter(op => {
            const totalCut = op.cuttingDetails?.jobs?.reduce((a,b)=>a+b.totalPieces,0) || 0;
            const isCutCompleted = totalCut >= op.quantityTotal;
            const isNextStage = op.status === OrderStatus.SEWING || op.status === OrderStatus.COMPLETED || op.status === OrderStatus.QUALITY_CONTROL || op.status === OrderStatus.PACKING;
            
            return isNextStage || (op.status === OrderStatus.CUTTING && isCutCompleted);
        });
    }
    
    setOps(filtered);
  };

  // Group OPs by Base Lot Number (YYYY-SEQ)
  const groupedOps = useMemo<Record<string, ProductionOrder[]>>(() => {
      const groups: Record<string, ProductionOrder[]> = {};
      
      // First apply text filters if any (cutter)
      const visibleOps = ops.filter(op => {
          if (!cutterFilter) return true;
          return op.cuttingDetails?.cutterName === cutterFilter;
      });

      visibleOps.forEach(op => {
          // Extract base lot number (e.g., 2025-050 from 2025-050-A)
          // Assumption: Format is YYYY-NNN or YYYY-NNN-SUFFIX
          const parts = op.lotNumber.split('-');
          let baseLot = op.lotNumber;
          if (parts.length >= 3) {
              baseLot = `${parts[0]}-${parts[1]}`;
          }
          
          if (!groups[baseLot]) groups[baseLot] = [];
          groups[baseLot].push(op);
      });
      
      return groups;
  }, [ops, cutterFilter]);

  const toggleGroup = (groupKey: string) => {
      setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const openCutting = (op: ProductionOrder) => {
    setSelectedOp(op);
    if (op.cuttingDetails) {
        setRealLayers(op.cuttingDetails.plannedLayers.map(l => ({ ...l, layers: 0 }))); // Start with 0 for actual input
    }
    setCutType('Principal');
    setMarkerLength(0);
    setMarkerWeight(0);
    setWasteWeight(0);
    setBundles(0);
    setShowOverproductionModal(false);
    setExceedingItems([]);
    setAuthName('');
    setAuthError(false);
  };

  const handleRestartCut = async (e: React.MouseEvent, op: ProductionOrder) => {
      e.stopPropagation();
      setActiveMenuOpId(null);

      if (!confirm(`Tem certeza que deseja REINICIAR o corte da OP ${op.lotNumber}? Todo o histórico de corte será apagado e voltará a 0% (Planejado).`)) {
          return;
      }

      try {
          await MockService.restartCutting(op.id);
          await loadData();
          if (selectedOp?.id === op.id) setSelectedOp(null);
          alert('Corte reiniciado com sucesso! Retornou para a aba "Parado/Planejado".');
      } catch (err: any) {
          alert(err.message);
      }
  };

  const calculateRealTotal = () => {
      if (!selectedOp?.cuttingDetails) return 0;
      const totalRatio = selectedOp.cuttingDetails.plannedMatrix.reduce((a, b) => a + b.ratio, 0);
      const totalLayers = realLayers.reduce((a, b) => a + b.layers, 0);
      return totalRatio * totalLayers;
  };

  const handleValidation = () => {
      if (!selectedOp || !selectedOp.cuttingDetails) return;
      
      const totalPieces = calculateRealTotal();
      if (totalPieces <= 0) {
          alert("Informe a quantidade de folhas cortadas.");
          return;
      }

      // STRICT VALIDATION PER ITEM (Color/Size)
      const plannedMatrix = selectedOp.cuttingDetails.plannedMatrix;
      const currentExceeding: any[] = [];

      realLayers.forEach(layer => {
          if (layer.layers > 0) {
              plannedMatrix.forEach(matrix => {
                  if (matrix.ratio > 0) {
                      const qtyCutNow = layer.layers * matrix.ratio;
                      
                      // Fix: Explicitly cast jobs to prevent 'reduce on unknown' error
                      const currentJobs = selectedOp.cuttingDetails?.jobs || [];
                      const histQty = currentJobs.reduce((acc: number, job: CuttingJob) => {
                          const layerHist = job.layers.find(l => l.color === layer.color);
                          const matrixHist = job.matrix.find(m => m.size === matrix.size);
                          if (layerHist && matrixHist) {
                              return acc + (layerHist.layers * matrixHist.ratio);
                          }
                          return acc;
                      }, 0);

                      const targetQty = selectedOp.items.find(i => i.color === layer.color && i.size === matrix.size)?.quantity || 0;
                      
                      if ((histQty + qtyCutNow) > targetQty) {
                          currentExceeding.push({
                              color: layer.color,
                              size: matrix.size,
                              planned: targetQty,
                              current: histQty,
                              cutting: qtyCutNow,
                              diff: (histQty + qtyCutNow) - targetQty
                          });
                      }
                  }
              });
          }
      });

      if (currentExceeding.length > 0) {
          setExceedingItems(currentExceeding);
          setShowOverproductionModal(true);
      } else {
          executeCut();
      }
  };

  const executeCut = async (authorizedOverproduction = false) => {
      if (!selectedOp || !selectedOp.cuttingDetails) return;
      
      if (authorizedOverproduction && !authName) {
          setAuthError(true);
          return;
      }

      const totalPieces = calculateRealTotal();
      let updatedOpItems = [...selectedOp.items];
      const events = [...selectedOp.events];

      if (authorizedOverproduction) {
          // Fix: Explicitly cast exceedingItems to prevent 'map on unknown' error
          const changesText = (exceedingItems as any[]).map(i => `${i.color}-${i.size}: Plan(${i.planned}) -> Novo(${i.planned + i.diff})`).join(', ');
          events.push({
              date: new Date().toISOString(),
              user: authName || 'Sistema',
              action: 'Alteração de Quantidade (Corte)',
              description: `Autorizado por ${authName}. Alterações: ${changesText}`,
              type: 'alert'
          });

          exceedingItems.forEach(exc => {
              const idx = updatedOpItems.findIndex(i => i.color === exc.color && i.size === exc.size);
              if (idx !== -1) {
                  updatedOpItems[idx] = { ...updatedOpItems[idx], quantity: updatedOpItems[idx].quantity + exc.diff };
              } else {
                  updatedOpItems.push({ color: exc.color, size: exc.size, quantity: exc.diff });
              }
          });
      }

      // Fix: Handle undefined jobs and length property
      const currentJobs = selectedOp.cuttingDetails.jobs || [];
      const newJob: CuttingJob = {
          id: `cut-${Date.now()}`,
          tacoNumber: `${selectedOp.lotNumber}-${currentJobs.length + 1}`,
          date: new Date().toISOString().split('T')[0],
          cutterName: selectedOp.cuttingDetails.cutterName || 'Desconhecido',
          cutType: cutType,
          markerWidth,
          markerLength,
          markerWeight,
          wasteWeight,
          bundles,
          matrix: selectedOp.cuttingDetails.plannedMatrix, 
          layers: realLayers,
          totalPieces: totalPieces,
          fabricConsumption: markerWeight 
      };

      const updatedJobs = [...currentJobs, newJob];
      const newTotalTarget = updatedOpItems.reduce((a,b) => a + b.quantity, 0);
      const totalCutSoFar = updatedJobs.reduce((a,b) => a + b.totalPieces, 0);

      // Status Logic Update:
      let newStatus = selectedOp.status;
      if (selectedOp.status === OrderStatus.PLANNED) {
          newStatus = OrderStatus.CUTTING;
      }

      const updatedOp = {
          ...selectedOp,
          status: newStatus,
          quantityTotal: newTotalTarget,
          items: updatedOpItems,
          events: events,
          cuttingDetails: {
              ...selectedOp.cuttingDetails,
              jobs: updatedJobs,
              isFinalized: false 
          }
      };

      await MockService.updateProductionOrder(selectedOp.id, updatedOp);
      await loadData(); // Reload list to update filters
      
      setShowOverproductionModal(false);

      // CRITICAL CHANGE: If cut is complete, CLOSE the panel
      if (totalCutSoFar >= newTotalTarget) {
          setSelectedOp(null);
          // Optional: Add success sound or toast
          alert('Corte finalizado com sucesso! OP movida para a aba "Finalizados".');
      } else {
          setSelectedOp(updatedOp);
      }
  };

  const getTabLabel = () => {
      switch(currentTab) {
          case 'planning': return 'Aguardando Execução (Parado)';
          case 'active': return 'Em Andamento';
          case 'done': return 'Finalizados';
          default: return 'Sala de Corte';
      }
  };

  // --- Render Helpers ---

  const renderPlannedSummary = () => {
      if(!selectedOp?.cuttingDetails) return null;
      const { plannedMatrix, plannedLayers } = selectedOp.cuttingDetails;
      const ratioTotal = plannedMatrix.reduce((a,b)=>a+b.ratio,0);

      return (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-blue-800 flex items-center gap-2"><ClipboardList size={18}/> Resumo do Planejamento (OP)</h3>
                  <div className="text-xs text-blue-600 bg-white px-2 py-1 rounded border border-blue-100 font-bold">Total: {selectedOp.quantityTotal} pçs</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <div className="text-xs font-bold text-blue-600 uppercase mb-1">Matriz (Risco)</div>
                      <div className="flex gap-2">
                          {plannedMatrix.map(m => (
                              <div key={m.size} className="bg-white px-2 py-1 rounded text-sm border border-blue-100 shadow-sm">
                                  <span className="font-bold">{m.size}</span>: {m.ratio}
                              </div>
                          ))}
                          <div className="bg-blue-200 px-2 py-1 rounded text-sm font-bold text-blue-900">= {ratioTotal}</div>
                      </div>
                  </div>
                  <div>
                      <div className="text-xs font-bold text-blue-600 uppercase mb-1">Cores / Folhas</div>
                      <div className="flex gap-2 flex-wrap">
                          {plannedLayers.filter(l => l.layers > 0).map(l => (
                              <div key={l.color} className="bg-white px-2 py-1 rounded text-sm border border-blue-100 shadow-sm flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full border" style={{backgroundColor: getColorStyle(l.color)}}></div>
                                  <span>{l.color}: <b>{l.layers} fls</b></span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const renderA4CuttingOrder = () => {
      if (!selectedOp) return null;
      return <div className="p-8">Layout de Impressão...</div>; 
  };

  // Determine if editing is locked
  const isOpLocked = selectedOp?.status === OrderStatus.COMPLETED || selectedOp?.status === OrderStatus.PACKING || selectedOp?.status === OrderStatus.QUALITY_CONTROL || selectedOp?.status === OrderStatus.SEWING;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scissors className="text-orange-600" /> Sala de Corte
          </h1>
          <p className="text-gray-500 text-sm">{getTabLabel()}</p>
        </div>
      </div>

      {/* FILTER BAR - CORTADOR */}
      <div className="bg-white p-3 rounded-xl border shadow-sm flex items-center gap-4 no-print">
          <span className="text-sm font-bold text-gray-600 flex items-center gap-1"><User size={16}/> Filtrar Cortador:</span>
          <select 
            className="border rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
            value={cutterFilter}
            onChange={e => setCutterFilter(e.target.value)}
          >
              <option value="">Todos</option>
              {partners.filter(p => p.type === 'Cortador').map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
              ))}
          </select>
          {cutterFilter && <button onClick={() => setCutterFilter('')} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={16}/></button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OP Selection List (Grouped) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden lg:col-span-1 h-fit no-print">
           <div className="p-4 bg-gray-50 border-b font-bold text-gray-700 flex justify-between items-center">
               <span>Ordens ({Object.keys(groupedOps).length} Lotes)</span>
               {currentTab === 'planning' && <PauseCircle size={16} className="text-gray-400"/>}
               {currentTab === 'active' && <PlayCircle size={16} className="text-blue-500"/>}
               {currentTab === 'done' && <CheckCircle size={16} className="text-green-500"/>}
           </div>
           
           <div className="divide-y max-h-[600px] overflow-y-auto">
              {Object.entries(groupedOps).map(([baseLot, groupOps]: [string, ProductionOrder[]]) => {
                  const isExpanded = expandedGroups[baseLot];
                  const totalQtd = groupOps.reduce((a,b) => a + b.quantityTotal, 0);
                  
                  return (
                      <div key={baseLot} className="border-b border-gray-100 last:border-0">
                          {/* PARENT HEADER */}
                          <div 
                            onClick={() => toggleGroup(baseLot)}
                            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center bg-gray-50/50"
                          >
                              <div>
                                  <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                      {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                      Lote {baseLot}
                                  </div>
                                  <div className="text-xs text-gray-500 ml-6">{groupOps.length} Modelos • {totalQtd} pçs</div>
                              </div>
                          </div>

                          {/* CHILDREN LIST */}
                          {isExpanded && (
                              <div className="bg-white">
                                  {groupOps.map(op => {
                                      const totalCut = op.cuttingDetails?.jobs?.reduce((a,b)=>a+b.totalPieces,0) || 0;
                                      const progress = Math.min(100, Math.round((totalCut / op.quantityTotal) * 100));
                                      const cutterName = op.cuttingDetails?.cutterName || 'Não definido';

                                      return (
                                        <div 
                                            key={op.id} 
                                            onClick={() => openCutting(op)}
                                            className={`p-4 pl-8 cursor-pointer hover:bg-orange-50 transition-colors relative group border-l-4 ${selectedOp?.id === op.id ? 'bg-orange-50 border-orange-500' : 'border-transparent'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-mono font-bold text-gray-800 text-sm">{op.lotNumber}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded text-white ${progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-blue-500' : 'bg-gray-400'}`}>
                                                    {progress}%
                                                </span>
                                            </div>
                                            <div className="text-sm font-medium text-gray-900 mb-1">{op.productId}</div>
                                            <div className="text-xs text-gray-500 flex justify-between items-center">
                                                <span className="flex items-center gap-1"><Scissors size={10}/> {cutterName}</span>
                                                <span>{totalCut} / {op.quantityTotal}</span>
                                            </div>
                                            
                                            {/* 3 DOTS MENU (Keep existing logic) */}
                                            <div className="absolute top-2 right-2">
                                                <button 
                                                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                                                    onClick={(e) => { e.stopPropagation(); setActiveMenuOpId(activeMenuOpId === op.id ? null : op.id); }}
                                                >
                                                    <MoreVertical size={16}/>
                                                </button>
                                                {activeMenuOpId === op.id && (
                                                    <div className="absolute right-0 top-6 bg-white shadow-xl border rounded-lg z-10 w-40 overflow-hidden animate-fade-in">
                                                        <button 
                                                            onClick={(e) => handleRestartCut(e, op)}
                                                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                                                            disabled={op.status === OrderStatus.PACKING || op.status === OrderStatus.COMPLETED || op.status === OrderStatus.SEWING}
                                                        >
                                                            <RotateCcw size={14}/> Reiniciar Corte
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  );
              })}
              {Object.keys(groupedOps).length === 0 && <div className="p-4 text-center text-gray-400 text-sm">Nenhuma OP encontrada.</div>}
           </div>
        </div>

        {/* Cutting Work Area */}
        {selectedOp ? (
          <div className="lg:col-span-2 space-y-6">
             {/* Header */}
             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm no-print">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <h2 className="text-xl font-bold text-gray-900">Registro de Corte</h2>
                      <div className="text-sm text-gray-500">Lote: {selectedOp.lotNumber} | Cortador: {selectedOp.cuttingDetails?.cutterName}</div>
                   </div>
                   <div className="text-right">
                       <button onClick={() => setIsPrintModalOpen(true)} className="mb-2 bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-blue-700 shadow-sm">
                           <Printer size={16}/> Imprimir Ordem
                       </button>
                       <div className="text-xs text-gray-400 uppercase font-bold">Total Já Cortado</div>
                       <div className="text-2xl font-bold text-orange-600">
                          {selectedOp.cuttingDetails?.jobs?.reduce((a,b)=>a+b.totalPieces,0) || 0} 
                          <span className="text-sm text-gray-400 font-normal"> / {selectedOp.quantityTotal}</span>
                       </div>
                   </div>
                </div>

                {renderPlannedSummary()}
                
                {/* Form */}
                <div className={`grid grid-cols-2 gap-6 mb-6 relative ${isOpLocked ? 'opacity-60 pointer-events-none' : ''}`}>
                    {isOpLocked && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                            <div className="bg-white/80 p-4 rounded-lg shadow-lg border border-gray-200 text-gray-600 flex items-center gap-2 font-bold">
                                <Lock size={20}/> Edição Bloqueada (Etapa Finalizada)
                            </div>
                        </div>
                    )}
                    <div className="space-y-4">
                        <div className="p-3 bg-gray-50 rounded border">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Tipo de Corte</label>
                            <select className="w-full bg-white border rounded p-2 text-sm" value={cutType} onChange={e => setCutType(e.target.value)}>
                                <option>Principal</option>
                                <option>Gola / Punho</option>
                                <option>Viés</option>
                                <option>Bolso</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Largura Risco (m)</label>
                                <input type="number" step="0.01" className="w-full border rounded p-2" value={markerWidth} onChange={e => setMarkerWidth(Number(e.target.value))}/>
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Comprimento (m)</label>
                                <input type="number" step="0.01" className="w-full border rounded p-2" value={markerLength} onChange={e => setMarkerLength(Number(e.target.value))}/>
                             </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Peso Risco (kg)</label>
                                <input type="number" step="0.01" className="w-full border rounded p-2" value={markerWeight} onChange={e => setMarkerWeight(Number(e.target.value))}/>
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Peso Pontas (kg)</label>
                                <input type="number" step="0.01" className="w-full border rounded p-2" value={wasteWeight} onChange={e => setWasteWeight(Number(e.target.value))}/>
                             </div>
                        </div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Layers size={18}/> Camadas Reais (Folhas)</h3>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {realLayers.map((l, i) => (
                                <div key={l.color} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(l.color)}}></div>
                                        <span className="text-sm font-medium">{l.color}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input 
                                          type="number" 
                                          className="w-16 border rounded p-1 text-center font-bold" 
                                          value={l.layers || ''} 
                                          onChange={e => {
                                              const newLayers = [...realLayers];
                                              newLayers[i].layers = Number(e.target.value);
                                              setRealLayers(newLayers);
                                          }}
                                          placeholder="0"
                                        />
                                        <span className="text-xs text-gray-400">fls</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-orange-200 flex justify-between items-center">
                            <div>
                                <div className="text-xs text-orange-600">Total Peças (Corte Atual)</div>
                                <div className="text-2xl font-bold text-orange-800">{calculateRealTotal()}</div>
                            </div>
                            <button onClick={handleValidation} className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-700 shadow flex items-center gap-2">
                                <Scissors size={18}/> Confirmar
                            </button>
                        </div>
                    </div>
                </div>
             </div>

             {/* Cut History */}
             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm no-print">
                <h3 className="font-bold text-gray-800 mb-4">Histórico de Cortes Detalhado</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="p-2">Data / Taco</th>
                                <th className="p-2">Detalhamento (Cor / Grade)</th>
                                <th className="p-2 text-right">Total Peças</th>
                                <th className="p-2 text-right">Peso</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {selectedOp.cuttingDetails?.jobs?.map(job => (
                                <tr key={job.id} className="hover:bg-gray-50">
                                    <td className="p-2 align-top">
                                        <div className="text-gray-900 font-bold">{new Date(job.date).toLocaleDateString()}</div>
                                        <div className="font-mono text-xs text-gray-500">#{job.tacoNumber}</div>
                                        <div className="text-xs text-gray-400">{job.cutType}</div>
                                    </td>
                                    <td className="p-2">
                                        <div className="space-y-1">
                                            {job.layers.filter(l => l.layers > 0).map(l => (
                                                <div key={l.color} className="flex text-xs items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full border" style={{backgroundColor: getColorStyle(l.color)}}></div>
                                                    <span className="font-bold w-20">{l.color}:</span>
                                                    <span className="text-gray-600">
                                                        {job.matrix.filter(m => m.ratio > 0).map(m => `${m.size}:${m.ratio * l.layers}`).join(', ')}
                                                    </span>
                                                    <span className="font-bold ml-1">({l.layers * job.matrix.reduce((a,b)=>a+b.ratio,0)})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-2 text-right font-bold align-top">{job.totalPieces}</td>
                                    <td className="p-2 text-right align-top">{job.markerWeight}kg</td>
                                </tr>
                            ))}
                            {(!selectedOp.cuttingDetails?.jobs || selectedOp.cuttingDetails.jobs.length === 0) && (
                                <tr><td colSpan={4} className="p-4 text-center text-gray-400">Nenhum corte registrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-300 h-[400px] text-gray-400 flex-col gap-2 no-print">
             <Scissors size={48} className="opacity-20"/>
             <p>Selecione uma OP na lista ao lado.</p>
          </div>
        )}
      </div>

      {/* OVERPRODUCTION MODAL */}
      {showOverproductionModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border-4 border-red-500">
                  <div className="bg-red-600 p-4 text-white">
                      <h3 className="font-bold text-lg flex items-center gap-2"><AlertTriangle size={24}/> Atenção: Sobreprodução</h3>
                  </div>
                  <div className="p-6">
                      <p className="text-gray-700 mb-4 font-medium">Os seguintes itens excedem a quantidade planejada na Ordem de Produção. Para prosseguir, é necessário autorização.</p>
                      
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
                          <table className="w-full text-sm">
                              <thead>
                                  <tr className="text-left text-red-800">
                                      <th className="pb-2">Item</th>
                                      <th className="pb-2 text-right">Planejado</th>
                                      <th className="pb-2 text-right">Atual + Corte</th>
                                      <th className="pb-2 text-right">Excesso</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {exceedingItems.map((item, idx) => (
                                      <tr key={idx} className="border-t border-red-100">
                                          <td className="py-1 font-bold">{item.color} - {item.size}</td>
                                          <td className="py-1 text-right">{item.planned}</td>
                                          <td className="py-1 text-right">{item.current + item.cutting}</td>
                                          <td className="py-1 text-right font-bold text-red-600">+{item.diff}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>

                      <div className="mb-4">
                          <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Responsável pela Alteração <span className="text-red-500">*</span></label>
                          <input 
                            className={`w-full border rounded p-2 focus:outline-none ${authError ? 'border-red-500 ring-2 ring-red-200' : 'border-red-300 focus:ring-red-500'}`}
                            placeholder="Quem autorizou?"
                            value={authName}
                            onChange={e => { setAuthName(e.target.value); setAuthError(false); }}
                          />
                          {authError && <span className="text-xs text-red-500 font-bold mt-1">Obrigatório informar o responsável.</span>}
                      </div>

                      <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowOverproductionModal(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancelar</button>
                          <button 
                            onClick={() => executeCut(true)} 
                            className="px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700"
                          >
                              Autorizar e Atualizar OP
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Professional A4 Print Modal */}
      {isPrintModalOpen && selectedOp && (
          <div className="fixed inset-0 bg-gray-500/90 z-50 flex justify-center overflow-y-auto">
              <div className="relative my-8">
                  <div className="absolute -top-10 right-0 flex gap-2 no-print">
                      <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-blue-700 flex items-center gap-2"><Printer size={18}/> Imprimir</button>
                      <button onClick={() => setIsPrintModalOpen(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded shadow font-bold hover:bg-gray-300 flex items-center gap-2"><X size={18}/> Fechar</button>
                  </div>
                  {renderA4CuttingOrder()}
              </div>
          </div>
      )}
    </div>
  );
};