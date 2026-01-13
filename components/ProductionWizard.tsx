
/**
 * 🔒 MÓDULO ORDEM DE PRODUÇÃO - WIZARD DE CRIAÇÃO
 * ---------------------------------------------------
 * Status: FROZEN / PRODUCTION READY
 * Data do Bloqueio: 25/05/2025
 * 
 * Lógica de Geração de IDs (-A, -B), Planejamento de Lotes e Integração Supabase validadas.
 * ATENÇÃO: NÃO ALTERAR O ALGORITMO DE SUFIXO DE LOTE NO HANDLEGENERATE.
 */

// ... existing imports ...
import React, { useState, useEffect, useMemo } from 'react';
import { Product, TechPack, CuttingDetails, MatrixRatio, LayerDefinition, OrderStatus, Partner, ProductionOrder, PhaseDates } from '../types';
import { MockService } from '../services/mockDb';
import { ApiService } from '../services/api';
import { ChevronRight, Check, AlertTriangle, ArrowLeft, Grid3X3, Layers, Plus, Calendar, User, Scissors, Info, Trash2, Printer, Save, Copy, FileText, Truck, ClipboardCheck, Package, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

// ... (Helpers and Interface WizardModel unchanged) ...
// Helper for Color
const getColorStyle = (colorName: string) => {
    const map: any = {
        'Branco': '#ffffff', 'Preto': '#000000', 'Marinho': '#000080', 'Vermelho': '#ff0000',
        'Verde': '#008000', 'Amarelo': '#ffff00', 'Azul': '#0000ff', 'Cinza': '#808080',
        'Rosa': '#ffc0cb', 'Roxo': '#800080'
    };
    return map[colorName] || '#cccccc';
};

// Interface for Internal Wizard State
interface WizardModel {
    uid: string; // Unique ID for this item in the wizard
    existingOpId?: string; // If editing, store the DB ID
    product: Product;
    techPack: TechPack;
    matrix: MatrixRatio[];
    layers: LayerDefinition[];
    // Specific Planning
    cutter: string;
    subcontractor: string;
    totalPieces: number;
}

export const ProductionWizard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editBatch = (location.state as any)?.editBatch as ProductionOrder[]; // Receive batch for editing

  // ... (State variables unchanged) ...
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  
  const [selectedModels, setSelectedModels] = useState<WizardModel[]>([]);
  const [activeModelTab, setActiveModelTab] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [phaseDates, setPhaseDates] = useState<PhaseDates>({
      cuttingStart: new Date().toISOString().split('T')[0],
      cuttingEnd: '',
      sewingStart: '',
      sewingEnd: '',
      revisionStart: '',
      revisionEnd: '',
      packingStart: '',
      packingEnd: ''
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [highlightErrors, setHighlightErrors] = useState(false);
  
  // NEW: State to prevent double clicks
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
        const [prods, ptrs] = await Promise.all([
            ApiService.getProducts(),
            ApiService.getPartners()
        ]);
        setProducts(prods);
        setPartners(ptrs);

        // HYDRATION LOGIC (If Editing)
        if (editBatch && editBatch.length > 0) {
            hydrateWizard(editBatch, prods);
        }
    };
    load();
  }, []);

  const hydrateWizard = (batchOps: ProductionOrder[], allProds: Product[]) => {
      const reconstructedModels: WizardModel[] = [];
      let firstDates = null;

      batchOps.forEach(op => {
          const prod = allProds.find(p => p.id === op.productId);
          if (!prod) return;
          const tp = prod.techPacks.find(t => t.version === op.techPackVersion) || prod.techPacks[0];
          
          if (!firstDates && op.phaseDates) firstDates = op.phaseDates;

          let matrix: MatrixRatio[] = [];
          let layers: LayerDefinition[] = [];

          if (op.cuttingDetails) {
              matrix = op.cuttingDetails.plannedMatrix;
              layers = op.cuttingDetails.plannedLayers;
          } else {
              const sizes = Array.from(new Set(op.items.map(i => i.size)));
              const colors = Array.from(new Set(op.items.map(i => i.color)));
              
              matrix = sizes.map(s => ({ size: s, ratio: 1 }));
              layers = colors.map(c => {
                  const totalColor = op.items.filter(i => i.color === c).reduce((a,b) => a+b.quantity, 0);
                  return { color: c, layers: totalColor };
              });
          }

          reconstructedModels.push({
              uid: `edit-${op.id}`,
              existingOpId: op.id,
              product: prod,
              techPack: tp,
              matrix,
              layers,
              cutter: op.cuttingDetails?.cutterName || '',
              subcontractor: op.subcontractor || '',
              totalPieces: op.quantityTotal
          });
      });

      setSelectedModels(reconstructedModels);
      if (firstDates) setPhaseDates(firstDates);
      if (reconstructedModels.length > 0) setActiveModelTab(reconstructedModels[0].uid);
  };

  // ... (Model Manipulation logic unchanged: handleAddProduct, removeModel, updateModelRatio, etc.) ...
  const handleAddProduct = (product: Product) => {
      const latest = product.techPacks.find(tp => tp.status === 'aprovado') || product.techPacks[0];
      
      if (!latest) {
          alert(`O produto ${product.name} não possui Ficha Técnica. Configure primeiro.`);
          return;
      }

      const sizesToUse = (latest.activeSizes && latest.activeSizes.length > 0) ? latest.activeSizes : product.sizes;
      const initialMatrix = sizesToUse.map(s => ({ size: s, ratio: 0 }));
      const colorsToUse = product.colors; 
      const initialLayers = colorsToUse.map(c => ({ color: c, layers: 0 }));

      const newModel: WizardModel = {
          uid: `wm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          product,
          techPack: latest,
          matrix: initialMatrix,
          layers: initialLayers,
          cutter: '',
          subcontractor: '',
          totalPieces: 0
      };

      setSelectedModels([...selectedModels, newModel]);
      setSearchTerm('');
      if (!activeModelTab) setActiveModelTab(newModel.uid);
  };

  const removeModel = (uid: string) => {
      const newModels = selectedModels.filter(m => m.uid !== uid);
      setSelectedModels(newModels);
      if (activeModelTab === uid && newModels.length > 0) {
          setActiveModelTab(newModels[0].uid);
      }
  };

  const updateModelRatio = (uid: string, size: string, val: number) => {
      setSelectedModels(prev => prev.map(m => {
          if (m.uid !== uid) return m;
          const newMatrix = m.matrix.map(rx => rx.size === size ? { ...rx, ratio: val } : rx);
          const totalPcs = calculatePieces(newMatrix, m.layers);
          return { ...m, matrix: newMatrix, totalPieces: totalPcs };
      }));
  };

  const updateModelLayer = (uid: string, color: string, val: number) => {
      setSelectedModels(prev => prev.map(m => {
          if (m.uid !== uid) return m;
          const newLayers = m.layers.map(l => l.color === color ? { ...l, layers: val } : l);
          const totalPcs = calculatePieces(m.matrix, newLayers);
          return { ...m, layers: newLayers, totalPieces: totalPcs };
      }));
  };

  const calculatePieces = (matrix: MatrixRatio[], layers: LayerDefinition[]) => {
      const ratioTotal = matrix.reduce((a,b)=>a+b.ratio,0);
      const layersTotal = layers.reduce((a,b)=>a+b.layers,0);
      return ratioTotal * layersTotal;
  };

  const autoFillDates = () => {
      const start = new Date(phaseDates.cuttingStart);
      const addDays = (d: Date, days: number) => {
          const res = new Date(d);
          res.setDate(res.getDate() + days);
          return res;
      };
      setPhaseDates({
          cuttingStart: start.toISOString().split('T')[0],
          cuttingEnd: addDays(start, 2).toISOString().split('T')[0],
          sewingStart: addDays(start, 3).toISOString().split('T')[0],
          sewingEnd: addDays(start, 18).toISOString().split('T')[0],
          revisionStart: addDays(start, 19).toISOString().split('T')[0],
          revisionEnd: addDays(start, 21).toISOString().split('T')[0],
          packingStart: addDays(start, 21).toISOString().split('T')[0],
          packingEnd: addDays(start, 22).toISOString().split('T')[0],
      });
  };

  const applyPartnerToAll = (type: 'cutter' | 'subcontractor', value: string) => {
      setSelectedModels(prev => prev.map(m => ({ ...m, [type]: value })));
  };

  const updateModelPartner = (uid: string, type: 'cutter' | 'subcontractor', value: string) => {
      setSelectedModels(prev => prev.map(m => m.uid === uid ? { ...m, [type]: value } : m));
  };

  const handleNextStep = () => {
      setValidationError(null);
      setHighlightErrors(false);

      if (step === 1) {
          if (selectedModels.length === 0) {
              setValidationError("Adicione pelo menos um produto para continuar.");
              return;
          }
      } 
      
      if (step === 2) {
          const invalidModel = selectedModels.find(m => m.totalPieces === 0);
          if (invalidModel) {
              setValidationError(`O modelo ${invalidModel.product.sku} não tem grade definida (Total 0).`);
              setActiveModelTab(invalidModel.uid);
              return;
          }
      }

      if (step === 3) {
          if (!phaseDates.cuttingEnd || !phaseDates.sewingEnd) {
              setValidationError("Preencha as datas de término do planejamento.");
              setHighlightErrors(true);
              return;
          }
          const missingPartner = selectedModels.find(m => !m.cutter || !m.subcontractor);
          if (missingPartner) {
              setValidationError("Defina o Cortador e a Facção para todos os modelos.");
              setHighlightErrors(true);
              return;
          }
      }

      setStep(step + 1);
  };

  const handleGenerate = async (status: OrderStatus = OrderStatus.PLANNED) => {
      if (isSubmitting) return; // Prevent double click
      setIsSubmitting(true); // LOCK UI

      try {
          const year = new Date().getFullYear();
          let batchBaseId = '';
          
          // Determine base ID correctly
          if (!editBatch || editBatch.length === 0) {
              // NEW BATCH
              const allOps = await ApiService.getProductionOrders();
              const yearOps = allOps.filter(o => o.lotNumber.startsWith(`${year}-`));
              const maxSeq = yearOps.reduce((max, op) => {
                  const parts = op.lotNumber.split('-');
                  if (parts.length >= 2) {
                      const num = parseInt(parts[1]);
                      return !isNaN(num) && num > max ? num : max;
                  }
                  return max;
              }, 0);
              const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
              batchBaseId = `${year}-${nextSeq}`;
          } else {
              // EDITING BATCH
              const firstExisting = editBatch[0];
              const parts = firstExisting.lotNumber.split('-');
              if (parts.length >= 2) {
                  batchBaseId = `${parts[0]}-${parts[1]}`;
              } else {
                  batchBaseId = firstExisting.lotNumber; 
              }
          }

          const suffixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          
          for (let i = 0; i < selectedModels.length; i++) {
              const model = selectedModels[i];
              // Only append suffix if there is more than 1 item in the batch
              const suffix = selectedModels.length > 1 ? `-${suffixChars[i]}` : '';
              const finalLotNumber = `${batchBaseId}${suffix}`;

              const items = [];
              for (const layer of model.layers) {
                  if (layer.layers > 0) {
                      for (const matrix of model.matrix) {
                          if (matrix.ratio > 0) {
                              items.push({
                                  color: layer.color,
                                  size: matrix.size,
                                  quantity: layer.layers * matrix.ratio
                              });
                          }
                      }
                  }
              }

              const cuttingDetails: CuttingDetails = {
                  plannedMatrix: model.matrix,
                  plannedLayers: model.layers,
                  cutterName: model.cutter,
                  jobs: [], 
                  isFinalized: false
              };

              const opPayload = {
                  id: model.existingOpId, 
                  lotNumber: finalLotNumber,
                  productId: model.product.id,
                  techPackVersion: model.techPack.version,
                  quantityTotal: model.totalPieces,
                  items: items,
                  status: status,
                  startDate: phaseDates.cuttingStart,
                  dueDate: phaseDates.packingEnd, 
                  phaseDates: phaseDates, 
                  subcontractor: model.subcontractor,
                  costSnapshot: model.techPack.totalCost,
                  cuttingDetails: cuttingDetails
              };

              if (model.existingOpId) {
                  await ApiService.updateProductionOrder(model.existingOpId, opPayload);
              } else {
                  await ApiService.createProductionOrder(opPayload);
              }
          }

          alert(status === OrderStatus.DRAFT ? 'Rascunho salvo!' : `Lote ${batchBaseId} processado com sucesso!`);
          navigate('/ops');
      } catch (error) {
          console.error("Erro ao salvar:", error);
          alert("Erro ao salvar ordem de produção.");
          setIsSubmitting(false); // Unlock on error
      }
  };

  const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto pb-20 px-4">
      {/* ... (Render Logic unchanged: Steps 1, 2, 3, 4 and Headers) ... */}
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate('/ops')} className="flex items-center text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <ArrowLeft size={16} className="mr-2"/> Voltar para Lista
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
            {editBatch ? 'Editar Ordem de Produção (Lote)' : 'Nova Ordem de Produção (Lote Misto)'}
        </h1>
        <p className="text-gray-500 mt-1">
            {editBatch ? 'Ajuste quantidades, datas e parceiros do lote existente.' : 'Crie ordens para um ou vários produtos simultaneamente.'}
        </p>
        
        {/* Progress Stepper */}
        <div className="flex items-center mt-8 max-w-2xl">
          {[
             { n: 1, label: 'Seleção de Modelos' }, 
             { n: 2, label: 'Grade & Corte' }, 
             { n: 3, label: 'Planejamento' }, 
             { n: 4, label: 'Confirmação' }
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold border-2 transition-colors relative z-10
                ${step >= s.n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-200'}
              `}>
                {step > s.n ? <Check size={20}/> : s.n}
              </div>
              <span className={`ml-3 text-sm font-medium ${step >= s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
              {i < arr.length - 1 && <div className={`flex-1 h-1 mx-4 rounded -ml-2 ${step > s.n ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-h-[600px] flex flex-col relative">
        
        {validationError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-bounce">
                <AlertCircle size={20}/>
                <span className="font-bold">{validationError}</span>
            </div>
        )}

        {/* Step 1: Select Products */}
        {step === 1 && (
          <div className="p-8 animate-fade-in flex flex-col h-full">
            <h2 className="text-xl font-bold mb-6 text-gray-800">1. Adicione os modelos ao carrinho da OP</h2>
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <input className="w-full border-2 border-gray-200 rounded-xl p-3 pl-10 outline-none focus:border-blue-500" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus />
                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                <div className="border rounded-xl overflow-hidden flex flex-col h-[450px] shadow-sm">
                    <div className="bg-gray-50 p-3 font-bold text-gray-600 border-b">Produtos Disponíveis</div>
                    <div className="overflow-y-auto p-2 space-y-2 flex-1 bg-gray-50/30">
                        {filteredProducts.map(p => (
                            <div key={p.id} className="flex items-center gap-3 p-3 bg-white hover:bg-blue-50 rounded-lg border border-gray-100 hover:border-blue-200 cursor-pointer group transition-all shadow-sm" onClick={() => handleAddProduct(p)}>
                                <img src={p.imageUrl} className="w-12 h-12 rounded bg-gray-200 object-cover"/>
                                <div className="flex-1"><div className="font-bold text-gray-800">{p.sku}</div><div className="text-xs text-gray-500">{p.name}</div></div>
                                <button className="bg-blue-100 text-blue-600 p-2 rounded-full opacity-0 group-hover:opacity-100"><Plus size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="border-2 border-blue-100 bg-blue-50/30 rounded-xl overflow-hidden flex flex-col h-[450px]">
                    <div className="bg-blue-100 p-3 font-bold text-blue-800 border-b border-blue-200 flex justify-between"><span>Carrinho</span> <span className="bg-white px-2 py-0.5 rounded text-xs text-blue-600 font-bold">{selectedModels.length} itens</span></div>
                    <div className="overflow-y-auto p-2 space-y-2 flex-1">
                        {selectedModels.map((m, idx) => (
                            <div key={m.uid} className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm animate-scale-in">
                                <span className="text-gray-400 font-bold w-6">{idx + 1}.</span>
                                <img src={m.product.imageUrl} className="w-10 h-10 rounded bg-gray-200 object-cover"/>
                                <div className="flex-1"><div className="font-bold text-gray-800">{m.product.sku}</div><div className="text-xs text-gray-500">{m.product.name}</div></div>
                                <button onClick={() => removeModel(m.uid)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        {selectedModels.length === 0 && <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><Package size={48} className="opacity-20"/><p>Selecione produtos ao lado.</p></div>}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* Step 2: Grade */}
        {step === 2 && (
          <div className="p-8 animate-fade-in flex flex-col h-full bg-slate-50">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">2. Definição de Grade por Modelo</h2>
                <div className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-full font-bold shadow-lg">Total Geral: {selectedModels.reduce((a,b) => a + b.totalPieces, 0)} peças</div>
             </div>
             <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                 {selectedModels.map(m => (
                     <button key={m.uid} onClick={() => setActiveModelTab(m.uid)} className={`px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap border flex items-center gap-2 ${activeModelTab === m.uid ? 'bg-white text-blue-600 border-blue-200 ring-2 ring-blue-100' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-white'}`}>
                         {m.product.sku} {m.totalPieces > 0 && <span className="bg-green-100 text-green-700 text-[10px] px-1.5 rounded ml-1">{m.totalPieces}</span>}
                     </button>
                 ))}
             </div>
             {selectedModels.map(m => {
                 if (m.uid !== activeModelTab) return null;
                 return (
                     <div key={m.uid} className="animate-fade-in bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-100 p-3 font-bold text-gray-700 border-b flex items-center gap-2"><Grid3X3 size={18}/> Risco (Peças na Mesa)</div>
                                <div className="p-4 space-y-2">
                                    {m.matrix.map(mtx => (
                                        <div key={mtx.size} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 shadow-sm">
                                            <span className="font-bold w-12 text-center text-lg">{mtx.size}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => updateModelRatio(m.uid, mtx.size, Math.max(0, mtx.ratio - 1))} className="w-8 h-8 rounded bg-gray-100 font-bold border">-</button>
                                                <input className="w-16 text-center font-bold border rounded p-1 text-lg" value={mtx.ratio} onChange={e => updateModelRatio(m.uid, mtx.size, parseInt(e.target.value) || 0)}/>
                                                <button onClick={() => updateModelRatio(m.uid, mtx.size, mtx.ratio + 1)} className="w-8 h-8 rounded bg-blue-50 font-bold text-blue-600 border border-blue-200">+</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-100 p-3 font-bold text-gray-700 border-b flex items-center gap-2"><Layers size={18}/> Folhas por Cor</div>
                                <div className="p-4 space-y-2">
                                    {m.layers.map(lyr => (
                                        <div key={lyr.color} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 shadow-sm">
                                            <span className="font-medium flex items-center gap-2"><div className="w-4 h-4 rounded-full border" style={{backgroundColor: getColorStyle(lyr.color)}}></div>{lyr.color}</span>
                                            <div className="flex items-center gap-2"><input className="w-20 text-center font-bold border rounded p-1 text-lg" value={lyr.layers} onChange={e => updateModelLayer(m.uid, lyr.color, parseInt(e.target.value) || 0)}/><span className="text-xs text-gray-400 font-bold">fls</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         </div>
                     </div>
                 )
             })}
          </div>
        )}

        {/* Step 3: Planning */}
        {step === 3 && (
           <div className="p-8 animate-fade-in bg-white min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">3. Planejamento de Produção</h2>
                  <button onClick={autoFillDates} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg border border-indigo-200 hover:bg-indigo-100 font-bold shadow-sm text-sm flex items-center gap-2"><Calendar size={16}/> Sugerir Datas</button>
              </div>
              <div className="space-y-8 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-white p-5 rounded-xl border-l-4 border-orange-500 shadow-lg">
                          <h4 className="text-orange-700 font-bold text-sm uppercase mb-4 flex items-center gap-2"><Scissors size={16}/> Corte</h4>
                          <input type="date" className="w-full border rounded-lg p-2 text-sm mb-2" value={phaseDates.cuttingStart} onChange={e => setPhaseDates({...phaseDates, cuttingStart: e.target.value})}/>
                          <input type="date" className={`w-full border rounded-lg p-2 text-sm ${highlightErrors && !phaseDates.cuttingEnd ? 'border-red-500' : ''}`} value={phaseDates.cuttingEnd} onChange={e => setPhaseDates({...phaseDates, cuttingEnd: e.target.value})}/>
                      </div>
                      <div className="bg-white p-5 rounded-xl border-l-4 border-purple-500 shadow-lg">
                          <h4 className="text-purple-700 font-bold text-sm uppercase mb-4 flex items-center gap-2"><Truck size={16}/> Costura (Facção)</h4>
                          <input type="date" className="w-full border rounded-lg p-2 text-sm mb-2" value={phaseDates.sewingStart} onChange={e => setPhaseDates({...phaseDates, sewingStart: e.target.value})}/>
                          <input type="date" className={`w-full border rounded-lg p-2 text-sm ${highlightErrors && !phaseDates.sewingEnd ? 'border-red-500' : ''}`} value={phaseDates.sewingEnd} onChange={e => setPhaseDates({...phaseDates, sewingEnd: e.target.value})}/>
                      </div>
                      <div className="bg-white p-5 rounded-xl border-l-4 border-indigo-500 shadow-lg">
                          <h4 className="text-indigo-700 font-bold text-sm uppercase mb-4 flex items-center gap-2"><ClipboardCheck size={16}/> Revisão</h4>
                          <input type="date" className="w-full border rounded-lg p-2 text-sm mb-2" value={phaseDates.revisionStart} onChange={e => setPhaseDates({...phaseDates, revisionStart: e.target.value})}/>
                          <input type="date" className="w-full border rounded-lg p-2 text-sm" value={phaseDates.revisionEnd} onChange={e => setPhaseDates({...phaseDates, revisionEnd: e.target.value})}/>
                      </div>
                      <div className="bg-white p-5 rounded-xl border-l-4 border-pink-500 shadow-lg">
                          <h4 className="text-pink-700 font-bold text-sm uppercase mb-4 flex items-center gap-2"><Package size={16}/> Embalagem</h4>
                          <input type="date" className="w-full border rounded-lg p-2 text-sm mb-2" value={phaseDates.packingStart} onChange={e => setPhaseDates({...phaseDates, packingStart: e.target.value})}/>
                          <input type="date" className="w-full border rounded-lg p-2 text-sm" value={phaseDates.packingEnd} onChange={e => setPhaseDates({...phaseDates, packingEnd: e.target.value})}/>
                      </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl shadow-inner">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 pb-4 border-b border-gray-200"><User size={18}/> Atribuição de Responsáveis</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="md:col-span-1 bg-white p-4 rounded-xl border shadow-sm h-fit">
                              <h4 className="font-bold text-sm text-gray-700 mb-4 bg-gray-100 p-2 rounded">Definir Padrão (Todos)</h4>
                              <div className="space-y-4">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-600 mb-1">Cortador Padrão</label>
                                      <select className="w-full border rounded-lg p-2 text-sm" onChange={e => applyPartnerToAll('cutter', e.target.value)}>
                                          <option value="">Selecione...</option>
                                          {partners.filter(p => p.type === 'Cortador').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-600 mb-1">Facção Padrão</label>
                                      <select className="w-full border rounded-lg p-2 text-sm" onChange={e => applyPartnerToAll('subcontractor', e.target.value)}>
                                          <option value="">Selecione...</option>
                                          <option value="Interno">Produção Interna</option>
                                          {partners.filter(p => p.type === 'Facção' || p.type === 'Outro').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                      </select>
                                  </div>
                              </div>
                          </div>
                          <div className="md:col-span-2">
                              <h4 className="font-bold text-sm text-gray-700 mb-3 ml-2">Ajuste Individual por Modelo</h4>
                              <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                                  <table className="w-full text-sm text-left">
                                      <thead className="bg-gray-100 text-gray-700 font-bold">
                                          <tr><th className="p-3">Modelo</th><th className="p-3">Cortador</th><th className="p-3">Facção / Destino</th></tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 bg-white">
                                          {selectedModels.map(m => (
                                              <tr key={m.uid} className={highlightErrors && (!m.cutter || !m.subcontractor) ? 'bg-red-50' : ''}>
                                                  <td className="p-3 font-medium flex items-center gap-2"><img src={m.product.imageUrl} className="w-8 h-8 rounded object-cover border"/>{m.product.sku}</td>
                                                  <td className="p-3">
                                                      <select className="w-full border rounded p-1.5 text-xs" value={m.cutter} onChange={e => updateModelPartner(m.uid, 'cutter', e.target.value)}>
                                                          <option value="">Selecionar...</option>
                                                          {partners.filter(p => p.type === 'Cortador').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                                      </select>
                                                  </td>
                                                  <td className="p-3">
                                                      <select className="w-full border rounded p-1.5 text-xs" value={m.subcontractor} onChange={e => updateModelPartner(m.uid, 'subcontractor', e.target.value)}>
                                                          <option value="">Selecionar...</option>
                                                          <option value="Interno">Produção Interna</option>
                                                          {partners.filter(p => p.type === 'Facção' || p.type === 'Outro').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                                      </select>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
           </div>
        )}

        {/* Step 4: Confirmation (Logic intact, only rendering table) */}
        {step === 4 && (
           <div className="p-8 animate-fade-in bg-gray-50 flex flex-col h-full overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Revisão Final do Lote</h2>
              <div className="space-y-8">
                  {selectedModels.map((m) => {
                      const sizes = m.matrix.map(mtx => mtx.size);
                      const colors = m.layers.filter(l => l.layers > 0).map(l => l.color);
                      const tableData = colors.map(color => {
                          const layerCount = m.layers.find(l => l.color === color)?.layers || 0;
                          const row: any = { color, total: 0 };
                          sizes.forEach(size => {
                              const ratio = m.matrix.find(rx => rx.size === size)?.ratio || 0;
                              row[size] = layerCount * ratio;
                              row.total += row[size];
                          });
                          return row;
                      });
                      return (
                          <div key={m.uid} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                              <div className="bg-gray-100 p-4 flex justify-between items-center border-b border-gray-200">
                                  <div className="flex items-center gap-4">
                                      <img src={m.product.imageUrl} className="w-16 h-16 rounded-lg object-cover shadow-sm border border-white"/>
                                      <div><div className="font-bold text-lg text-gray-800">{m.product.sku} - {m.product.name}</div><div className="text-xs text-gray-500 flex gap-4 mt-1"><span><b>Cortador:</b> {m.cutter}</span><span><b>Facção:</b> {m.subcontractor}</span></div></div>
                                  </div>
                                  <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-lg font-bold shadow">{m.totalPieces} pçs</div>
                              </div>
                              <div className="p-6">
                                  <div className="border rounded-lg overflow-hidden shadow-sm">
                                      <table className="w-full text-center text-sm">
                                          <thead className="bg-gray-50 text-gray-700 font-bold border-b"><tr><th className="p-3 text-left">Cor / Tamanho</th>{sizes.map(s => <th key={s} className="p-3 w-16">{s}</th>)}<th className="p-3 w-20 bg-gray-100">Total</th></tr></thead>
                                          <tbody className="divide-y divide-gray-100">
                                              {tableData.map((row, i) => (
                                                  <tr key={i} className="hover:bg-blue-50/30">
                                                      <td className="p-3 text-left font-medium flex items-center gap-2"><div className="w-3 h-3 rounded-full border shadow-sm" style={{backgroundColor: getColorStyle(row.color)}}></div>{row.color}</td>
                                                      {sizes.map(s => <td key={s} className="p-3">{row[s] || '-'}</td>)}
                                                      <td className="p-3 font-bold bg-gray-50 text-blue-700">{row.total}</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
           </div>
        )}

        {/* Footer Actions */}
        <div className="bg-white p-6 border-t flex justify-between items-center mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 sticky bottom-0">
           {step > 1 ? <button onClick={() => setStep(step - 1)} className="px-6 py-3 rounded-xl border bg-white text-gray-600 font-bold hover:bg-gray-100 transition-colors shadow-sm">Voltar</button> : <div/>}
           {step < 4 ? 
             <button onClick={handleNextStep} className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all hover:scale-105">Próximo <ChevronRight size={18}/></button> 
             : 
             <div className="flex gap-3">
                 <button 
                    onClick={() => handleGenerate(OrderStatus.DRAFT)} 
                    disabled={isSubmitting}
                    className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
                 >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                    Salvar Rascunho
                 </button>
                 <button 
                    onClick={() => handleGenerate(OrderStatus.PLANNED)} 
                    disabled={isSubmitting}
                    className="px-8 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-200 animate-pulse-slow transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>}
                    {isSubmitting ? 'Processando...' : (editBatch ? 'Atualizar Lote' : 'Gerar Ordem de Produção')}
                 </button>
             </div>
           }
        </div>
      </div>
    </div>
  );
};
