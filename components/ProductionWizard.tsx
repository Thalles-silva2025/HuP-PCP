
import React, { useState, useEffect, useMemo } from 'react';
import { Product, TechPack, CuttingDetails, MatrixRatio, LayerDefinition, OrderStatus, Partner, ProductionOrder, PhaseDates } from '../types';
import { MockService } from '../services/mockDb';
import { ChevronRight, Check, AlertTriangle, ArrowLeft, Grid3X3, Layers, Plus, Calendar, User, Scissors, Info, Trash2, Printer, Save, Copy, FileText, Truck, ClipboardCheck, Package } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

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

  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  
  // --- STATE ---
  const [selectedModels, setSelectedModels] = useState<WizardModel[]>([]);
  const [activeModelTab, setActiveModelTab] = useState<string | null>(null); // UID of active model in Step 2/3
  
  // Step 1: Search
  const [searchTerm, setSearchTerm] = useState('');

  // Step 3: Planning (Global or Per Item)
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

  useEffect(() => {
    const load = async () => {
        const [prods, ptrs] = await Promise.all([
            MockService.getProducts(),
            MockService.getPartners()
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

          // Reconstruct Matrix/Layers from CuttingDetails (preferred) or Items
          let matrix: MatrixRatio[] = [];
          let layers: LayerDefinition[] = [];

          if (op.cuttingDetails) {
              matrix = op.cuttingDetails.plannedMatrix;
              layers = op.cuttingDetails.plannedLayers;
          } else {
              // Fallback if no cutting details (Draft) - Rebuild from Items logic
              // Simplification: Assume 1 layer per color found in items, and ratio = item qty
              // This is imperfect for complex matrixes but works for drafts
              const sizes = Array.from(new Set(op.items.map(i => i.size)));
              const colors = Array.from(new Set(op.items.map(i => i.color)));
              
              matrix = sizes.map(s => ({ size: s, ratio: 1 })); // Default ratio
              layers = colors.map(c => {
                  // Find avg qty for this color across sizes
                  const totalColor = op.items.filter(i => i.color === c).reduce((a,b) => a+b.quantity, 0);
                  return { color: c, layers: totalColor }; // Rough approx
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

  // --- STEP 1: ADD PRODUCTS ---

  const handleAddProduct = (product: Product) => {
      // Find latest TechPack
      const latest = product.techPacks.find(tp => tp.status === 'aprovado') || product.techPacks[0];
      
      if (!latest) {
          alert(`O produto ${product.name} não possui Ficha Técnica. Configure primeiro.`);
          return;
      }

      // Initialize Matrix based on TechPack Active Sizes
      const sizesToUse = (latest.activeSizes && latest.activeSizes.length > 0) ? latest.activeSizes : product.sizes;
      const initialMatrix = sizesToUse.map(s => ({ size: s, ratio: 0 }));
      
      // Initialize Layers based on Product Colors
      // Only bring colors available in the TechPack (or Product if TP has no strict color logic)
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
      setSearchTerm(''); // Clear search
      if (!activeModelTab) setActiveModelTab(newModel.uid);
  };

  const removeModel = (uid: string) => {
      const newModels = selectedModels.filter(m => m.uid !== uid);
      setSelectedModels(newModels);
      if (activeModelTab === uid && newModels.length > 0) {
          setActiveModelTab(newModels[0].uid);
      }
  };

  // --- STEP 2: MATRIX LOGIC ---

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

  // --- STEP 3: PLANNING LOGIC ---

  // Auto-calculate dates based on standard lead times
  const autoFillDates = () => {
      const start = new Date(phaseDates.cuttingStart);
      
      const addDays = (d: Date, days: number) => {
          const res = new Date(d);
          res.setDate(res.getDate() + days);
          return res;
      };

      const cutEnd = addDays(start, 2);
      const sewStart = addDays(cutEnd, 1);
      const sewEnd = addDays(sewStart, 15); // Avg sewing time
      const revStart = addDays(sewEnd, 1);
      const revEnd = addDays(revStart, 2);
      const packStart = addDays(revEnd, 0);
      const packEnd = addDays(packStart, 1);

      setPhaseDates({
          cuttingStart: start.toISOString().split('T')[0],
          cuttingEnd: cutEnd.toISOString().split('T')[0],
          sewingStart: sewStart.toISOString().split('T')[0],
          sewingEnd: sewEnd.toISOString().split('T')[0],
          revisionStart: revStart.toISOString().split('T')[0],
          revisionEnd: revEnd.toISOString().split('T')[0],
          packingStart: packStart.toISOString().split('T')[0],
          packingEnd: packEnd.toISOString().split('T')[0],
      });
  };

  const applyPartnerToAll = (type: 'cutter' | 'subcontractor', value: string) => {
      setSelectedModels(prev => prev.map(m => ({ ...m, [type]: value })));
  };

  const updateModelPartner = (uid: string, type: 'cutter' | 'subcontractor', value: string) => {
      setSelectedModels(prev => prev.map(m => m.uid === uid ? { ...m, [type]: value } : m));
  };

  // --- FINAL: GENERATION ---

  const handleGenerate = async (status: OrderStatus = OrderStatus.PLANNED) => {
      if (selectedModels.length === 0) return;

      // 1. Generate Sequence Number (Batch ID) if NEW
      // If Editing, we need to try to keep the existing Lot ID prefix if possible, or warn user.
      // Simplification: If creating new (no existingOpId), gen new batch.
      // If updating, use existingOpId.
      
      const year = new Date().getFullYear();
      let batchBaseId = '';

      // Check if this is a NEW batch
      const isNewBatch = !selectedModels[0].existingOpId;

      if (isNewBatch) {
          const allOps = await MockService.getProductionOrders();
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
          // Extract base from existing
          // We assume all selectedModels belong to same batch if editing
          const firstOp = await MockService.getProductionOrderById(selectedModels[0].existingOpId!);
          if (firstOp) {
              const parts = firstOp.lotNumber.split('-');
              if (parts.length >= 2) batchBaseId = `${parts[0]}-${parts[1]}`;
          }
      }

      // 2. Iterate Models and Create/Update OPs
      const suffixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      
      for (let i = 0; i < selectedModels.length; i++) {
          const model = selectedModels[i];
          const suffix = selectedModels.length > 1 ? `-${suffixChars[i]}` : '';
          
          // If editing, try to preserve the exact lot number if we are just updating the same index
          // But if we added/removed models, we might regenerate suffixes. 
          // Simplification: Always regenerate Lot Number based on Batch ID + Index to ensure consistency.
          const finalLotNumber = `${batchBaseId}${suffix}`;

          // Construct Items Array
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

          // Construct Cutting Details
          const cuttingDetails: CuttingDetails = {
              plannedMatrix: model.matrix,
              plannedLayers: model.layers,
              cutterName: model.cutter,
              jobs: [], // Reset jobs? No, if editing, we might want to keep? 
              // Rule: "Editar somente rascunho ou planejado". In these states, jobs are usually empty.
              isFinalized: false
          };

          const opPayload = {
              id: model.existingOpId, // Pass ID if updating
              lotNumber: finalLotNumber,
              productId: model.product.id,
              techPackVersion: model.techPack.version,
              quantityTotal: model.totalPieces,
              items: items,
              status: status,
              startDate: phaseDates.cuttingStart,
              dueDate: phaseDates.packingEnd, // Final delivery
              phaseDates: phaseDates, // New Granular Dates
              subcontractor: model.subcontractor,
              costSnapshot: model.techPack.totalCost,
              cuttingDetails: cuttingDetails
          };

          if (model.existingOpId) {
              await MockService.updateProductionOrder(model.existingOpId, opPayload);
          } else {
              await MockService.createProductionOrder(opPayload);
          }
      }

      alert(status === OrderStatus.DRAFT ? 'Rascunho salvo!' : `Lote ${batchBaseId} processado com sucesso!`);
      navigate('/ops');
  };

  const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto pb-20 px-4">
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
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold border-2 transition-colors
                ${step >= s.n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-200'}
              `}>
                {step > s.n ? <Check size={20}/> : s.n}
              </div>
              <span className={`ml-3 text-sm font-medium ${step >= s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
              {i < arr.length - 1 && <div className={`flex-1 h-1 mx-4 rounded ${step > s.n ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
        
        {/* STEP 1: SELECT PRODUCTS */}
        {step === 1 && (
          <div className="p-8 animate-fade-in flex flex-col h-full">
            <h2 className="text-xl font-bold mb-6 text-gray-800">1. Adicione os modelos ao carrinho da OP</h2>
            
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <input 
                        className="w-full border-2 border-gray-200 rounded-xl p-3 pl-10 outline-none focus:border-blue-500"
                        placeholder="Buscar por nome ou SKU..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                {/* Available Products */}
                <div className="border rounded-xl overflow-hidden flex flex-col h-[400px]">
                    <div className="bg-gray-50 p-3 font-bold text-gray-600 border-b">Produtos Disponíveis</div>
                    <div className="overflow-y-auto p-2 space-y-2 flex-1">
                        {filteredProducts.map(p => (
                            <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 cursor-pointer group" onClick={() => handleAddProduct(p)}>
                                <img src={p.imageUrl} className="w-12 h-12 rounded bg-gray-200 object-cover"/>
                                <div className="flex-1">
                                    <div className="font-bold text-gray-800">{p.sku}</div>
                                    <div className="text-xs text-gray-500">{p.name}</div>
                                </div>
                                <button className="bg-blue-50 text-blue-600 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Selected Cart */}
                <div className="border-2 border-blue-100 bg-blue-50/30 rounded-xl overflow-hidden flex flex-col h-[400px]">
                    <div className="bg-blue-100 p-3 font-bold text-blue-800 border-b border-blue-200 flex justify-between">
                        <span>Carrinho da OP {editBatch ? '(Edição)' : ''}</span>
                        <span className="bg-white px-2 py-0.5 rounded text-xs">{selectedModels.length} itens</span>
                    </div>
                    <div className="overflow-y-auto p-2 space-y-2 flex-1">
                        {selectedModels.map((m, idx) => (
                            <div key={m.uid} className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm">
                                <span className="text-gray-400 font-bold w-6">{idx + 1}.</span>
                                <img src={m.product.imageUrl} className="w-10 h-10 rounded bg-gray-200 object-cover"/>
                                <div className="flex-1">
                                    <div className="font-bold text-gray-800">{m.product.sku}</div>
                                    <div className="text-xs text-gray-500">{m.product.name}</div>
                                </div>
                                <button onClick={() => removeModel(m.uid)} className="text-red-400 hover:text-red-600 p-2">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                        {selectedModels.length === 0 && (
                            <div className="text-center text-gray-400 mt-20">Nenhum modelo selecionado.</div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* STEP 2: GRADE & CUTTING */}
        {step === 2 && (
          <div className="p-8 animate-fade-in flex flex-col h-full">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">2. Definição de Grade por Modelo</h2>
                <div className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                    Total Geral: {selectedModels.reduce((a,b) => a + b.totalPieces, 0)} peças
                </div>
             </div>

             {/* TABS */}
             <div className="flex gap-2 overflow-x-auto pb-2 border-b mb-6">
                 {selectedModels.map(m => (
                     <button 
                        key={m.uid}
                        onClick={() => setActiveModelTab(m.uid)}
                        className={`px-4 py-2 rounded-t-lg font-bold text-sm whitespace-nowrap transition-colors border-b-2
                            ${activeModelTab === m.uid 
                                ? 'bg-blue-50 text-blue-600 border-blue-600' 
                                : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}
                        `}
                     >
                         {m.product.sku}
                     </button>
                 ))}
             </div>

             {/* ACTIVE MODEL EDITOR */}
             {selectedModels.map(m => {
                 if (m.uid !== activeModelTab) return null;
                 return (
                     <div key={m.uid} className="animate-fade-in">
                         <div className="flex items-center gap-4 mb-4 bg-gray-50 p-3 rounded-lg border">
                             <img src={m.product.imageUrl} className="w-16 h-16 rounded object-cover border"/>
                             <div>
                                 <h3 className="font-bold text-lg">{m.product.name}</h3>
                                 <div className="text-sm text-gray-500">{m.product.collection} • TP v{m.techPack.version}</div>
                             </div>
                             <div className="ml-auto text-right">
                                 <div className="text-xs text-gray-500 uppercase">Total Modelo</div>
                                 <div className="text-2xl font-bold text-gray-900">{m.totalPieces}</div>
                             </div>
                         </div>

                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Matrix */}
                            <div className="bg-white border rounded-xl p-4 shadow-sm">
                                <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Grid3X3 size={18}/> Risco (Peças na Mesa)</h4>
                                <div className="space-y-2">
                                    {m.matrix.map(mtx => (
                                        <div key={mtx.size} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                            <span className="font-bold w-12 text-center">{mtx.size}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => updateModelRatio(m.uid, mtx.size, Math.max(0, mtx.ratio - 1))} className="w-6 h-6 rounded bg-gray-200 font-bold text-gray-600 hover:bg-gray-300">-</button>
                                                <input 
                                                    className="w-12 text-center font-bold border rounded p-1"
                                                    value={mtx.ratio}
                                                    onChange={e => updateModelRatio(m.uid, mtx.size, parseInt(e.target.value) || 0)}
                                                />
                                                <button onClick={() => updateModelRatio(m.uid, mtx.size, mtx.ratio + 1)} className="w-6 h-6 rounded bg-blue-100 font-bold text-blue-600 hover:bg-blue-200">+</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Layers */}
                            <div className="bg-white border rounded-xl p-4 shadow-sm">
                                <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Layers size={18}/> Folhas por Cor</h4>
                                <div className="space-y-2">
                                    {m.layers.map(lyr => (
                                        <div key={lyr.color} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                            <span className="font-medium flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(lyr.color)}}></div>
                                                {lyr.color}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    className="w-16 text-center font-bold border rounded p-1"
                                                    value={lyr.layers}
                                                    onChange={e => updateModelLayer(m.uid, lyr.color, parseInt(e.target.value) || 0)}
                                                />
                                                <span className="text-xs text-gray-400">fls</span>
                                            </div>
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

        {/* STEP 3: PLANNING */}
        {step === 3 && (
           <div className="p-8 animate-fade-in bg-slate-50 min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">3. Planejamento de Produção</h2>
                  <button onClick={autoFillDates} className="bg-white text-blue-600 px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 font-bold shadow-sm text-sm flex items-center gap-2">
                      <Calendar size={16}/> Preencher Datas Automaticamente
                  </button>
              </div>
              
              <div className="space-y-8 flex-1">
                  {/* Phase Dates - Expanded View */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-white p-5 rounded-xl border-l-4 border-orange-500 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-2 right-2 text-orange-100 group-hover:text-orange-200 transition-colors"><Scissors size={40}/></div>
                          <h4 className="text-orange-700 font-bold text-sm uppercase mb-4 relative z-10 flex items-center gap-2"><Scissors size={16}/> Corte</h4>
                          <div className="space-y-3 relative z-10">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 block mb-1">Início</label>
                                  <input type="date" className="w-full border border-orange-200 rounded p-2 text-sm bg-orange-50/30 focus:ring-2 focus:ring-orange-500 outline-none" value={phaseDates.cuttingStart} onChange={e => setPhaseDates({...phaseDates, cuttingStart: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 block mb-1">Fim</label>
                                  <input type="date" className="w-full border border-orange-200 rounded p-2 text-sm bg-orange-50/30 focus:ring-2 focus:ring-orange-500 outline-none" value={phaseDates.cuttingEnd} onChange={e => setPhaseDates({...phaseDates, cuttingEnd: e.target.value})}/>
                              </div>
                          </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border-l-4 border-purple-500 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-2 right-2 text-purple-100 group-hover:text-purple-200 transition-colors"><Truck size={40}/></div>
                          <h4 className="text-purple-700 font-bold text-sm uppercase mb-4 relative z-10 flex items-center gap-2"><Truck size={16}/> Costura (Facção)</h4>
                          <div className="space-y-3 relative z-10">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 block mb-1">Início</label>
                                  <input type="date" className="w-full border border-purple-200 rounded p-2 text-sm bg-purple-50/30 focus:ring-2 focus:ring-purple-500 outline-none" value={phaseDates.sewingStart} onChange={e => setPhaseDates({...phaseDates, sewingStart: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 block mb-1">Fim</label>
                                  <input type="date" className="w-full border border-purple-200 rounded p-2 text-sm bg-purple-50/30 focus:ring-2 focus:ring-purple-500 outline-none" value={phaseDates.sewingEnd} onChange={e => setPhaseDates({...phaseDates, sewingEnd: e.target.value})}/>
                              </div>
                          </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border-l-4 border-indigo-500 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-2 right-2 text-indigo-100 group-hover:text-indigo-200 transition-colors"><ClipboardCheck size={40}/></div>
                          <h4 className="text-indigo-700 font-bold text-sm uppercase mb-4 relative z-10 flex items-center gap-2"><ClipboardCheck size={16}/> Revisão</h4>
                          <div className="space-y-3 relative z-10">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 block mb-1">Início</label>
                                  <input type="date" className="w-full border border-indigo-200 rounded p-2 text-sm bg-indigo-50/30 focus:ring-2 focus:ring-indigo-500 outline-none" value={phaseDates.revisionStart} onChange={e => setPhaseDates({...phaseDates, revisionStart: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 block mb-1">Fim</label>
                                  <input type="date" className="w-full border border-indigo-200 rounded p-2 text-sm bg-indigo-50/30 focus:ring-2 focus:ring-indigo-500 outline-none" value={phaseDates.revisionEnd} onChange={e => setPhaseDates({...phaseDates, revisionEnd: e.target.value})}/>
                              </div>
                          </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border-l-4 border-pink-500 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-2 right-2 text-pink-100 group-hover:text-pink-200 transition-colors"><Package size={40}/></div>
                          <h4 className="text-pink-700 font-bold text-sm uppercase mb-4 relative z-10 flex items-center gap-2"><Package size={16}/> Embalagem</h4>
                          <div className="space-y-3 relative z-10">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 block mb-1">Início</label>
                                  <input type="date" className="w-full border border-pink-200 rounded p-2 text-sm bg-pink-50/30 focus:ring-2 focus:ring-pink-500 outline-none" value={phaseDates.packingStart} onChange={e => setPhaseDates({...phaseDates, packingStart: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 block mb-1">Fim</label>
                                  <input type="date" className="w-full border border-pink-200 rounded p-2 text-sm bg-pink-50/30 focus:ring-2 focus:ring-pink-500 outline-none" value={phaseDates.packingEnd} onChange={e => setPhaseDates({...phaseDates, packingEnd: e.target.value})}/>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Mass Assignment */}
                  <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 pb-4 border-b"><User size={18}/> Atribuição de Responsáveis</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="md:col-span-1 bg-gray-50 p-4 rounded-lg border">
                              <h4 className="font-bold text-sm text-gray-700 mb-3">Definir Padrão (Todos os Modelos)</h4>
                              <div className="space-y-4">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-600 mb-1">Cortador Padrão</label>
                                      <select className="w-full border rounded p-2 text-sm bg-white" onChange={e => applyPartnerToAll('cutter', e.target.value)}>
                                          <option value="">Selecione...</option>
                                          {partners.filter(p => p.type === 'Cortador').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-600 mb-1">Facção Padrão</label>
                                      <select className="w-full border rounded p-2 text-sm bg-white" onChange={e => applyPartnerToAll('subcontractor', e.target.value)}>
                                          <option value="">Selecione...</option>
                                          <option value="Interno">Produção Interna</option>
                                          {partners.filter(p => p.type === 'Facção' || p.type === 'Outro').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                      </select>
                                  </div>
                              </div>
                          </div>

                          <div className="md:col-span-2">
                              <h4 className="font-bold text-sm text-gray-700 mb-3">Ajuste Individual por Modelo</h4>
                              <div className="overflow-x-auto border rounded-lg">
                                  <table className="w-full text-sm text-left">
                                      <thead className="bg-gray-100 text-gray-700 font-bold">
                                          <tr>
                                              <th className="p-3">Modelo</th>
                                              <th className="p-3">Cortador</th>
                                              <th className="p-3">Facção / Destino</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                          {selectedModels.map(m => (
                                              <tr key={m.uid} className="bg-white">
                                                  <td className="p-3 font-medium flex items-center gap-2">
                                                      <img src={m.product.imageUrl} className="w-8 h-8 rounded object-cover border"/>
                                                      {m.product.sku}
                                                  </td>
                                                  <td className="p-3">
                                                      <select 
                                                        className="w-full border rounded p-1.5 text-xs bg-gray-50 focus:ring-1 focus:ring-blue-500 outline-none" 
                                                        value={m.cutter} 
                                                        onChange={e => updateModelPartner(m.uid, 'cutter', e.target.value)}
                                                      >
                                                          <option value="">Selecionar...</option>
                                                          {partners.filter(p => p.type === 'Cortador').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                                      </select>
                                                  </td>
                                                  <td className="p-3">
                                                      <select 
                                                        className="w-full border rounded p-1.5 text-xs bg-gray-50 focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={m.subcontractor}
                                                        onChange={e => updateModelPartner(m.uid, 'subcontractor', e.target.value)}
                                                      >
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

        {/* STEP 4: CONFIRMATION CARDS */}
        {step === 4 && (
           <div className="p-8 animate-fade-in bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Revisão Final do Lote</h2>
              
              <div className="grid grid-cols-1 gap-6">
                  {selectedModels.map((m, idx) => (
                      <div key={m.uid} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row">
                          <div className="w-full md:w-48 bg-gray-100 p-4 flex flex-col items-center justify-center border-r border-gray-200">
                              <img src={m.product.imageUrl} className="w-24 h-24 rounded-lg object-cover mb-2 shadow-sm"/>
                              <div className="font-bold text-lg text-gray-800">{m.product.sku}</div>
                              <div className="text-xs text-gray-500 mb-2">{m.product.name}</div>
                              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                                  {m.totalPieces} pçs
                              </div>
                          </div>
                          <div className="flex-1 p-6">
                              <div className="flex justify-between mb-4 text-sm text-gray-600">
                                  <div><span className="font-bold">Cortador:</span> {m.cutter || <span className="text-red-500">Não definido</span>}</div>
                                  <div><span className="font-bold">Facção:</span> {m.subcontractor || <span className="text-red-500">Não definido</span>}</div>
                                  <div><span className="font-bold">Entrega:</span> {phaseDates.packingEnd ? new Date(phaseDates.packingEnd).toLocaleDateString() : '-'}</div>
                              </div>
                              
                              <div className="bg-gray-50 rounded-lg p-3 border">
                                  <div className="text-xs font-bold text-gray-400 uppercase mb-2">Grade de Corte</div>
                                  <div className="flex gap-4 flex-wrap text-sm">
                                      {m.layers.filter(l => l.layers > 0).map(l => (
                                          <div key={l.color} className="bg-white px-2 py-1 rounded border shadow-sm flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(l.color)}}></div>
                                              <span className="font-bold">{l.color}:</span>
                                              <span className="text-gray-600">
                                                  {m.matrix.filter(x => x.ratio > 0).map(x => `${x.size}(${x.ratio * l.layers})`).join(', ')}
                                              </span>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
           </div>
        )}

        {/* Footer Actions */}
        <div className="bg-white p-6 border-t flex justify-between items-center mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 sticky bottom-0">
           {step > 1 ? (
             <button onClick={() => setStep(step - 1)} className="px-6 py-3 rounded-lg border bg-white text-gray-600 font-bold hover:bg-gray-100 transition-colors">
                Voltar
             </button>
           ) : <div/>}
           
           {step < 4 ? (
             <button 
                onClick={() => {
                    // Validation
                    if (step === 1 && selectedModels.length === 0) return alert('Adicione pelo menos um produto.');
                    if (step === 2 && selectedModels.some(m => m.totalPieces === 0)) return alert('Todos os modelos precisam ter grade definida.');
                    setStep(step + 1);
                }} 
                className="px-8 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
             >
                Próximo <ChevronRight size={18}/>
             </button>
           ) : (
             <div className="flex gap-3">
                 <button onClick={() => handleGenerate(OrderStatus.DRAFT)} className="px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-50 flex items-center gap-2">
                    <Save size={18}/> Salvar Rascunho
                 </button>
                 <button onClick={() => window.print()} className="px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-50 flex items-center gap-2">
                    <Printer size={18}/> Imprimir
                 </button>
                 <button onClick={() => handleGenerate(OrderStatus.PLANNED)} className="px-8 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-200 animate-pulse-slow">
                    <Check size={18}/> {editBatch ? 'Atualizar Lote' : 'Gerar Ordem de Produção'}
                 </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
