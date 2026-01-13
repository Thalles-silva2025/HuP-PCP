/**
 * 🔒 MÓDULO SALA DE CORTE - APONTAMENTO & ENFESTO
 * ---------------------------------------------------
 * Status: FROZEN / PRODUCTION READY
 * Data do Bloqueio: 25/05/2025
 * 
 * Funcionalidades:
 * - Painel Kanban (Planejado / Em Andamento / Finalizado).
 * - Cálculo de Enfestos (Camadas x Risco).
 * - Geração Automática de Pagamentos (Se houver taxa cadastrada).
 * - Integração com Estoque e OPs via JSONB (cutting_details).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, CuttingJob, Partner, Product, MatrixRatio } from '../types';
import { ApiService } from '../services/api'; // USANDO API REAL
import { supabase } from '../services/supabase'; // Acesso direto para Pagamentos
import { 
  Scissors, Layers, CheckCircle2, AlertTriangle, PlayCircle, 
  PauseCircle, Ruler, Scale, Box, User, Save, X, 
  MoreVertical, Clock, DollarSign, ArrowRight, FileText, Grid3X3
} from 'lucide-react';

// --- HELPERS ---
const getColorStyle = (colorName: string) => {
    const map: any = {
        'Branco': '#ffffff', 'Preto': '#000000', 'Marinho': '#000080', 'Vermelho': '#ff0000',
        'Verde': '#008000', 'Amarelo': '#ffff00', 'Azul': '#0000ff', 'Cinza': '#808080',
        'Rosa': '#ffc0cb', 'Roxo': '#800080'
    };
    return map[colorName] || '#cccccc';
};

// --- TYPES ---
type TabType = 'planned' | 'active' | 'completed';

export const CuttingModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('planned');
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal & Processing State
  const [selectedOp, setSelectedOp] = useState<ProductionOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Cutting Form State
  const [markerData, setMarkerData] = useState({
      width: 1.80,
      length: 0,
      weight: 0,
      waste: 0,
      type: 'Principal'
  });

  // State for Layers Input (Key: Color Name, Value: Number of Layers)
  const [layersInput, setLayersInput] = useState<Record<string, number>>({});

  // Overproduction Logic
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authName, setAuthName] = useState('');
  const [overproductionDetails, setOverproductionDetails] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const [allOps, allProds, allPartners] = await Promise.all([
            ApiService.getProductionOrders(),
            ApiService.getProducts(),
            ApiService.getPartners()
        ]);
        
        // Filter only valid OPs for cutting logic (Remove Drafts/Cancelled)
        const validOps = allOps.filter(o => o.status !== OrderStatus.DRAFT && o.status !== OrderStatus.CANCELLED);
        
        setOps(validOps);
        setProducts(allProds);
        setPartners(allPartners);
    } catch (error) {
        console.error("Erro ao carregar dados da Sala de Corte:", error);
    } finally {
        setLoading(false);
    }
  };

  // --- LOGIC: STATUS FILTERING ---
  const filteredOps = useMemo(() => {
      return ops.filter(op => {
          // Calculate total cut so far
          const totalCut = op.cuttingDetails?.jobs?.reduce((a,b) => a + b.totalPieces, 0) || 0;
          const isFullyCut = totalCut >= op.quantityTotal;
          const hasStarted = totalCut > 0;

          // TAB 1: A PLANEJAR / PARADO
          // Include PLANNED status
          // OR CUTTING status but NOTHING has been cut yet (0 progress)
          if (activeTab === 'planned') {
              return op.status === OrderStatus.PLANNED || (op.status === OrderStatus.CUTTING && !hasStarted);
          }

          // TAB 2: EM ANDAMENTO
          // Must be CUTTING status AND started (>0) AND NOT finished
          if (activeTab === 'active') {
              return op.status === OrderStatus.CUTTING && hasStarted && !isFullyCut;
          }

          // TAB 3: FINALIZADOS
          // Fully Cut OR Moved to next stages (Sewing, etc)
          if (activeTab === 'completed') {
              const nextStages = [OrderStatus.SEWING, OrderStatus.QUALITY_CONTROL, OrderStatus.PACKING, OrderStatus.COMPLETED];
              return isFullyCut || nextStages.includes(op.status);
          }
          return false;
      });
  }, [ops, activeTab]);

  // --- CALCULATIONS FOR PREVIEW ---
  const calculatedPreview = useMemo(() => {
      if (!selectedOp || !selectedOp.cuttingDetails) return { total: 0, rows: [] };

      const matrix = selectedOp.cuttingDetails.plannedMatrix;
      const ratioSum = matrix.reduce((a,b) => a + b.ratio, 0);
      
      let grandTotal = 0;
      const rows: any[] = [];

      // Iterate over the input layers per color
      Object.entries(layersInput).forEach(([color, value]) => {
          const layers = value as number;
          if (layers > 0) {
              const totalForColor = layers * ratioSum;
              grandTotal += totalForColor;
              
              // Calculate breakdown per size
              const sizes = matrix.map(m => ({
                  size: m.size,
                  qty: m.ratio * layers
              }));

              rows.push({ color, layers, totalForColor, sizes });
          }
      });

      return { total: grandTotal, rows };
  }, [selectedOp, layersInput]);

  // --- ACTIONS ---

  const handleOpenCut = (op: ProductionOrder) => {
      setSelectedOp(op);
      setMarkerData({
          width: 1.80,
          length: 0,
          weight: 0,
          waste: 0,
          type: 'Principal'
      });
      // Initialize inputs with 0 for planned colors
      const initialLayers: Record<string, number> = {};
      op.cuttingDetails?.plannedLayers.forEach(l => {
          initialLayers[l.color] = 0; // Start empty so user fills in
      });
      setLayersInput(initialLayers);
      
      setShowAuthModal(false);
      setAuthName('');
  };

  const validateAndCut = async (authorized = false) => {
      if (!selectedOp || !selectedOp.cuttingDetails) return;
      
      const { total, rows } = calculatedPreview;
      
      if (total <= 0) {
          alert('Informe a quantidade de folhas em pelo menos uma cor.');
          return;
      }

      const currentTotal = selectedOp.cuttingDetails.jobs?.reduce((a,b) => a + b.totalPieces, 0) || 0;
      const newTotal = currentTotal + total;

      // CHECK OVERPRODUCTION
      if (!authorized && newTotal > selectedOp.quantityTotal) {
          setOverproductionDetails({
              planned: selectedOp.quantityTotal,
              current: currentTotal,
              new: total,
              diff: newTotal - selectedOp.quantityTotal
          });
          setShowAuthModal(true);
          return;
      }

      if (authorized && !authName.trim()) {
          alert('Informe o nome do responsável pela autorização.');
          return;
      }

      setIsProcessing(true);

      try {
          // 1. Prepare Active Layers Data
          const activeLayers = rows.map(r => ({
              color: r.color,
              layers: r.layers
          }));

          const newJob: CuttingJob = {
              id: `job-${Date.now()}`,
              tacoNumber: `${selectedOp.lotNumber}-${(selectedOp.cuttingDetails.jobs?.length || 0) + 1}`,
              date: new Date().toISOString(),
              cutterName: selectedOp.cuttingDetails.cutterName || 'Não Definido',
              cutType: markerData.type,
              markerWidth: markerData.width,
              markerLength: markerData.length,
              markerWeight: markerData.weight,
              wasteWeight: markerData.waste,
              bundles: 0, 
              matrix: selectedOp.cuttingDetails.plannedMatrix,
              layers: activeLayers,
              totalPieces: total,
              fabricConsumption: markerData.weight
          };

          const updatedJobs = [...(selectedOp.cuttingDetails.jobs || []), newJob];
          
          // 2. Prepare Updates
          const updates: Partial<ProductionOrder> = {
              status: OrderStatus.CUTTING, // Ensure it's active
              cuttingDetails: {
                  ...selectedOp.cuttingDetails,
                  jobs: updatedJobs
              }
          };

          // 3. Handle Overproduction (Update OP Header if needed)
          if (newTotal > selectedOp.quantityTotal) {
              updates.quantityTotal = newTotal;
              
              // Add Log
              updates.events = [
                  ...selectedOp.events,
                  {
                      date: new Date().toISOString(),
                      user: authName || 'Sistema',
                      action: 'Autorização Corte',
                      description: `Quantidade ampliada em ${newTotal - selectedOp.quantityTotal} peças.`,
                      type: 'alert'
                  }
              ];
          }

          // 4. GENERATE PAYMENT (If Cutter has rate) - REAL DB INSERT
          const cutter = partners.find(p => p.name === selectedOp.cuttingDetails?.cutterName);
          if (cutter && cutter.defaultRate && cutter.defaultRate > 0) {
              const paymentAmount = total * cutter.defaultRate;
              
              // Getting User Org ID via helper in ApiService is internal, so we assume auth context here or fetch profile.
              // For simplicity in this specific file context, we fetch the session user.
              const { data: { user } } = await supabase.auth.getUser();
              const { data: profile } = await supabase.from('user_profiles').select('organization_id').eq('id', user?.id).single();
              
              if (profile) {
                  const { error: payError } = await supabase.from('payments').insert([{
                      op_id: selectedOp.id,
                      partner_name: cutter.name,
                      partner_type: 'Cortador',
                      stage: 'Corte',
                      total_amount: paymentAmount,
                      amount_paid: 0,
                      quantity_delivered: total,
                      rate_per_piece: cutter.defaultRate,
                      status: 'Pendente',
                      due_date: new Date(Date.now() + 86400000).toISOString(), // +1 Day
                      organization_id: profile.organization_id
                  }]);
                  if (payError) console.error("Erro ao gerar pagamento:", payError.message);
              }
          }

          // 5. Save to DB using ApiService
          await ApiService.updateProductionOrder(selectedOp.id, updates);
          
          await loadData();
          setShowAuthModal(false);
          setSelectedOp(null);
          alert('Corte registrado com sucesso! Dados atualizados no banco.');

      } catch (err: any) {
          alert('Erro ao salvar: ' + err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- RENDERERS ---

  const renderCard = (op: ProductionOrder) => {
      const prod = products.find(p => p.id === op.productId);
      const totalCut = op.cuttingDetails?.jobs?.reduce((a,b) => a + b.totalPieces, 0) || 0;
      const progress = Math.min(100, Math.round((totalCut / op.quantityTotal) * 100));
      const cutterName = op.cuttingDetails?.cutterName || 'Não Atribuído';

      return (
          <div key={op.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-all flex flex-col justify-between h-full group">
              <div>
                  <div className="flex justify-between items-start mb-3">
                      <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded text-sm">{op.lotNumber}</span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                          op.status === OrderStatus.PLANNED ? 'bg-blue-100 text-blue-700' :
                          op.status === OrderStatus.CUTTING ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>
                          {op.status === OrderStatus.PLANNED ? 'Aguardando' : op.status === OrderStatus.CUTTING ? 'Em Corte' : 'Finalizado'}
                      </span>
                  </div>
                  
                  <div className="mb-4">
                      <h3 className="font-bold text-gray-900 line-clamp-1" title={prod?.name}>{prod?.name}</h3>
                      <p className="text-xs text-gray-500">{prod?.sku}</p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <User size={14}/> {cutterName}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1 font-medium text-gray-500">
                          <span>Progresso</span>
                          <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} 
                            style={{width: `${progress}%`}}
                          ></div>
                      </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                      <span>{totalCut} cortados</span>
                      <span className="text-gray-400">/ {op.quantityTotal} total</span>
                  </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100">
                  <button 
                    onClick={() => handleOpenCut(op)}
                    className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                        activeTab === 'completed' 
                        ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                    }`}
                  >
                      {activeTab === 'planned' ? <PlayCircle size={16}/> : <Scissors size={16}/>}
                      {activeTab === 'planned' ? 'Iniciar Corte' : activeTab === 'completed' ? 'Ver Histórico' : 'Registrar Corte'}
                  </button>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-8 pb-20">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Scissors size={28}/></div>
                    Sala de Corte
                </h1>
                <p className="text-gray-500 mt-1">Gestão de enfestos, controle de consumo e pagamento de cortadores.</p>
            </div>
            
            {/* TABS */}
            <div className="bg-gray-100 p-1.5 rounded-xl flex gap-1 shadow-inner">
                {[
                    { id: 'planned', label: 'A Planejar', icon: PauseCircle },
                    { id: 'active', label: 'Em Andamento', icon: PlayCircle },
                    { id: 'completed', label: 'Finalizados', icon: CheckCircle2 }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`
                            px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all
                            ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}
                        `}
                    >
                        <tab.icon size={16} className={activeTab === tab.id ? 'text-orange-500' : ''}/>
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>

        {/* CONTENT GRID */}
        {loading ? (
            <div className="text-center py-20 text-gray-400">Carregando ordens do banco de dados...</div>
        ) : filteredOps.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <Scissors size={48} className="mx-auto text-gray-300 mb-4"/>
                <p className="text-gray-500 font-medium">Nenhuma Ordem de Produção nesta etapa.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
                {filteredOps.map(op => renderCard(op))}
            </div>
        )}

        {/* CUTTING MODAL (The Cockpit) */}
        {selectedOp && (
            <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-scale-in">
                    
                    {/* Header */}
                    <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-6">
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lote / OP</div>
                                <div className="text-2xl font-bold font-mono text-orange-400">{selectedOp.lotNumber}</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700"></div>
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Produto</div>
                                <div className="font-bold">{products.find(p => p.id === selectedOp.productId)?.name}</div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedOp(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                            <X size={24}/>
                        </button>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        
                        {/* LEFT: TECH DATA & HISTORY */}
                        <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
                            <div className="p-6 overflow-y-auto">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText size={18}/> Grade Planejada</h3>
                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-6">
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {selectedOp.cuttingDetails?.plannedMatrix.map(m => (
                                            <div key={m.size} className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm border font-medium">
                                                <span className="font-bold text-gray-800">{m.size}</span>: {m.ratio}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-xs text-gray-500 font-bold uppercase mb-2">Total Programado</div>
                                    <div className="text-3xl font-bold text-indigo-600">{selectedOp.quantityTotal} <span className="text-sm font-normal text-gray-400">peças</span></div>
                                </div>

                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Clock size={18}/> Histórico de Cortes</h3>
                                <div className="space-y-3">
                                    {selectedOp.cuttingDetails?.jobs?.slice().reverse().map((job, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 text-sm shadow-sm relative pl-4 overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                                            <div className="flex justify-between font-bold text-gray-800 mb-1">
                                                <span>{new Date(job.date).toLocaleDateString()}</span>
                                                <span>{job.totalPieces} pçs</span>
                                            </div>
                                            <div className="text-xs text-gray-500 flex justify-between">
                                                <span>Taco: {job.tacoNumber}</span>
                                                <span>{job.cutType}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedOp.cuttingDetails?.jobs?.length) && (
                                        <div className="text-sm text-gray-400 italic text-center py-4">Nenhum corte registrado.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* CENTER: ACTION AREA */}
                        <div className="flex-1 p-8 overflow-y-auto relative bg-white">
                            {activeTab === 'completed' && (
                                <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center">
                                    <div className="bg-green-100 text-green-800 px-6 py-3 rounded-xl font-bold border border-green-200 flex items-center gap-2 shadow-sm">
                                        <CheckCircle2/> Ordem Finalizada. Modo Visualização.
                                    </div>
                                </div>
                            )}

                            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Scissors className="text-orange-600"/> Registrar Novo Enfesto
                            </h2>

                            {/* CORE INPUT: LAYERS PER COLOR */}
                            <div className="bg-orange-50 rounded-xl border border-orange-200 p-6 mb-6">
                                <h3 className="text-orange-900 font-bold uppercase mb-4 flex items-center gap-2 text-sm"><Layers size={16}/> Quantidade de Folhas (Camadas)</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.keys(layersInput).map(color => (
                                        <div key={color} className="bg-white p-3 rounded-lg border shadow-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(color)}}></div>
                                                <span className="font-bold text-gray-700 text-sm truncate">{color}</span>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                className="w-full border-2 border-orange-100 rounded p-2 text-center font-bold text-xl text-orange-600 focus:border-orange-500 outline-none"
                                                value={layersInput[color] || ''}
                                                onChange={e => setLayersInput({...layersInput, [color]: parseInt(e.target.value) || 0})}
                                                placeholder="0"
                                            />
                                            <div className="text-xs text-center text-gray-400 mt-1">folhas</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* PREVIEW TABLE (Color x Size x Quantity) */}
                            {calculatedPreview.total > 0 && (
                                <div className="mb-6 animate-fade-in">
                                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm"><Grid3X3 size={16}/> Preview do Corte</h3>
                                    <div className="border rounded-lg overflow-hidden bg-gray-50">
                                        <table className="w-full text-center text-sm">
                                            <thead className="bg-gray-100 text-gray-600 font-bold">
                                                <tr>
                                                    <th className="p-2 text-left">Cor</th>
                                                    {selectedOp.cuttingDetails?.plannedMatrix.map(m => (
                                                        <th key={m.size} className="p-2">{m.size}</th>
                                                    ))}
                                                    <th className="p-2 bg-gray-200">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                {calculatedPreview.rows.map((row: any) => (
                                                    <tr key={row.color}>
                                                        <td className="p-2 text-left font-medium flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(row.color)}}></div>
                                                            {row.color}
                                                        </td>
                                                        {row.sizes.map((s: any) => (
                                                            <td key={s.size} className="p-2 text-gray-600">{s.qty}</td>
                                                        ))}
                                                        <td className="p-2 font-bold bg-gray-50">{row.totalForColor}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-orange-100 font-bold text-orange-900">
                                                    <td className="p-2 text-left">TOTAL GERAL</td>
                                                    <td colSpan={(selectedOp.cuttingDetails?.plannedMatrix.length || 0)} className="p-2"></td>
                                                    <td className="p-2 text-lg">{calculatedPreview.total}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Technical Details Input */}
                            <div className="grid grid-cols-2 gap-6 mb-6 pt-4 border-t border-gray-100">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Tipo de Corte</label>
                                        <select 
                                            className="w-full border-2 border-gray-200 rounded-lg p-2.5 font-medium focus:border-orange-500 outline-none"
                                            value={markerData.type}
                                            onChange={e => setMarkerData({...markerData, type: e.target.value})}
                                        >
                                            <option>Principal</option>
                                            <option>Gola / Punho</option>
                                            <option>Viés</option>
                                            <option>Detalhe</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Largura (m)</label>
                                            <div className="relative">
                                                <Ruler size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                                <input 
                                                    type="number" step="0.01" className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-lg font-mono focus:border-orange-500 outline-none"
                                                    value={markerData.width} onChange={e => setMarkerData({...markerData, width: Number(e.target.value)})}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Comp. (m)</label>
                                            <input 
                                                type="number" step="0.01" className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg font-mono focus:border-orange-500 outline-none"
                                                value={markerData.length} onChange={e => setMarkerData({...markerData, length: Number(e.target.value)})}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Peso Risco (kg)</label>
                                        <div className="relative">
                                            <Scale size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                            <input 
                                                type="number" step="0.01" className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-lg font-mono focus:border-orange-500 outline-none"
                                                value={markerData.weight} onChange={e => setMarkerData({...markerData, weight: Number(e.target.value)})}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Peso Retalho (kg)</label>
                                        <input 
                                            type="number" step="0.01" className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg font-mono focus:border-orange-500 outline-none"
                                            value={markerData.waste} onChange={e => setMarkerData({...markerData, waste: Number(e.target.value)})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button 
                                    onClick={() => validateAndCut()}
                                    disabled={isProcessing}
                                    className="bg-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-orange-700 shadow-lg shadow-orange-200 flex items-center gap-2 disabled:opacity-50 transition-all hover:scale-105"
                                >
                                    {isProcessing ? 'Salvando...' : 'Confirmar Corte'} <Save size={20}/>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* AUTH MODAL (Overproduction) */}
        {showAuthModal && (
            <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-scale-in border-t-8 border-red-600">
                    <div className="flex justify-center mb-4 text-red-600">
                        <AlertTriangle size={48}/>
                    </div>
                    <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">Atenção: Corte Excedente</h3>
                    <p className="text-gray-500 text-center mb-6 text-sm">
                        A quantidade cortada excede o planejado na OP.
                    </p>

                    <div className="bg-red-50 p-4 rounded-lg border border-red-100 mb-6 text-sm">
                        <div className="flex justify-between mb-1">
                            <span>Planejado:</span>
                            <span className="font-bold">{overproductionDetails?.planned}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span>Atual + Novo:</span>
                            <span className="font-bold">{overproductionDetails?.current + overproductionDetails?.new}</span>
                        </div>
                        <div className="flex justify-between border-t border-red-200 pt-2 mt-2 text-red-700 font-bold">
                            <span>Diferença:</span>
                            <span>+{overproductionDetails?.diff} peças</span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Autorizado por:</label>
                        <input 
                            className="w-full border-2 border-gray-300 rounded-lg p-3 outline-none focus:border-red-500"
                            placeholder="Nome do Responsável"
                            value={authName}
                            onChange={e => setAuthName(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setShowAuthModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Cancelar</button>
                        <button onClick={() => validateAndCut(true)} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg">Autorizar</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};