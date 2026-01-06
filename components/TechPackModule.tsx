
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Product, TechPack, Material, BOMItem, Operation, MaterialType, UnitOfMeasure, ProductStatus, MeasurementPoint, StandardOperation, Color, StandardObservation, Partner, ExtraCost, SalesType } from '../types';
import { MockService } from '../services/mockDb';
import { Shirt, Layers, Settings2, Plus, Save, DollarSign, Trash2, ArrowLeft, PackagePlus, Search, Edit2, ChevronRight, ChevronLeft, Ruler, X, Eye, Printer, History, CheckCircle2, Upload, Camera, Scissors, Lock, Palette, StickyNote, BarChart3, AlertTriangle, Clock, CheckCircle, Image as ImageIcon, Flame, FileWarning } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// --- CUSTOM INPUT COMPONENT FOR PRECISION ---
const DecimalInput = ({ value, onChange, placeholder, className, step = "0.001" }: any) => {
    const [localValue, setLocalValue] = useState(value?.toString() || '');

    useEffect(() => {
        if (value !== undefined && value !== null && !isNaN(value)) {
             if (document.activeElement?.getAttribute('value') !== localValue) {
                 setLocalValue(value.toString().replace('.', ','));
             }
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
            setLocalValue(val);
            const numVal = parseFloat(val.replace(',', '.'));
            if (!isNaN(numVal)) {
                onChange(numVal);
            } else if (val === '') {
                onChange(0);
            }
        }
    };

    const handleBlur = () => {
        const numVal = parseFloat(localValue.replace(',', '.'));
        if (!isNaN(numVal)) {
            setLocalValue(numVal.toString().replace('.', ','));
        }
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            className={className}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
        />
    );
};

// --- SUB-COMPONENTS ---

interface BOMRowProps {
  item: BOMItem;
  idx: number;
  materials: Material[];
  viewingProduct: Product | null;
  onUpdate: (idx: number, field: keyof BOMItem | 'colorCosts', value: any) => void;
  onRemove: (idx: number) => void;
  colorsMap: Record<string, string>;
}

const BOMRow: React.FC<BOMRowProps> = ({ item, idx, materials, viewingProduct, onUpdate, onRemove, colorsMap }) => {
  const [showColorCost, setShowColorCost] = useState(false);
  const mat = materials.find(m => m.id === item.materialId);
  const baseCost = mat ? (mat.costUnit * item.usagePerPiece * (1 + item.wasteMargin)) : 0;
  const hasColorCosts = item.colorCosts && Object.keys(item.colorCosts).length > 0;

  return (
    <React.Fragment>
      <tr className="hover:bg-gray-50 border-b border-gray-100">
        <td className="p-3">
            <select 
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              value={item.materialId} 
              onChange={e => onUpdate(idx, 'materialId', e.target.value)}
            >
              <option value="">Selecione Material...</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
            </select>
            
            {/* Logic: If material has colors, force user to pick one */}
            {mat?.hasColors && mat.variants && mat.variants.length > 0 && (
                <div className="mt-2">
                    <label className="text-[10px] uppercase font-bold text-gray-500">Cor do Material</label>
                    <select
                        className="w-full border border-orange-300 bg-orange-50 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none font-medium"
                        value={item.materialVariantId || ''}
                        onChange={e => {
                            const selectedVariant = mat.variants?.find(v => v.id === e.target.value);
                            onUpdate(idx, 'materialVariantId', e.target.value);
                            onUpdate(idx, 'materialVariantName', selectedVariant?.name);
                        }}
                    >
                        <option value="">Selecione a variante...</option>
                        {mat.variants.map(v => <option key={v.id} value={v.id}>{v.name} (Est: {v.stock})</option>)}
                    </select>
                </div>
            )}
        </td>
        <td className="p-3 align-top">
            <select 
                className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-700 bg-white"
                value={item.colorVariant || ''}
                onChange={e => onUpdate(idx, 'colorVariant', e.target.value)}
            >
                <option value="">Todas as Cores (Padrão)</option>
                {viewingProduct?.colors.map(c => <option key={c} value={c}>Usar na cor: {c}</option>)}
            </select>
            <div className="text-[10px] text-gray-400 mt-1">Quando usar este insumo?</div>
        </td>
        <td className="p-3 text-center align-top pt-4">
            {/* Varies With Color Toggle */}
            <label className="flex items-center justify-center cursor-pointer" title="Se marcado, permite custo diferenciado">
                <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    checked={item.variesWithColor || false}
                    onChange={e => onUpdate(idx, 'variesWithColor', e.target.checked)}
                />
            </label>
        </td>
        <td className="p-3 align-top">
            <DecimalInput
              className="w-full border border-gray-300 rounded-lg p-2 text-center text-sm font-mono" 
              value={item.usagePerPiece} 
              onChange={(val: number) => onUpdate(idx, 'usagePerPiece', val)}
              placeholder="0,000"
            />
        </td>
        <td className="p-3 text-center text-gray-500 font-medium text-xs align-top pt-4">{mat?.unit || '-'}</td>
        <td className="p-3 align-top">
            <div className="relative">
              <DecimalInput
                className="w-full border border-gray-300 rounded-lg p-2 text-center text-sm pr-6" 
                value={item.wasteMargin ? (item.wasteMargin * 100) : 0} 
                onChange={(val: number) => onUpdate(idx, 'wasteMargin', val / 100)}
                placeholder="0"
              />
              <span className="absolute right-2 top-2 text-gray-400 text-xs">%</span>
            </div>
        </td>
        <td className="p-3 text-right font-bold text-gray-800 text-sm align-top pt-4">
            {hasColorCosts ? <span className="text-orange-600 text-xs">(Varia)</span> : `R$ ${baseCost.toFixed(3)}`}
        </td>
        <td className="p-3 text-center flex justify-center gap-2 align-top pt-3">
            <button 
                onClick={() => setShowColorCost(!showColorCost)}
                className={`p-2 rounded-lg transition-colors ${hasColorCosts || showColorCost ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100'}`}
                title="Custo Diferenciado por Cor"
            >
                <DollarSign size={16}/>
            </button>
            <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
        </td>
      </tr>
      {showColorCost && (
          <tr className="bg-orange-50/50">
              <td colSpan={8} className="p-4 border-b">
                  <div className="text-xs font-bold text-orange-800 mb-2">Custos Específicos por Cor (Substitui o custo padrão do material)</div>
                  <div className="grid grid-cols-4 gap-3">
                      {viewingProduct?.colors.map(color => (
                          <div key={color} className="flex items-center gap-2 bg-white p-2 rounded border border-orange-100">
                              <div className="w-3 h-3 rounded-full border" style={{backgroundColor: colorsMap[color] || '#ccc'}}></div>
                              <span className="text-xs font-bold w-16 truncate" title={color}>{color}:</span>
                              <input 
                                type="number" step="0.01" 
                                placeholder={mat?.costUnit?.toFixed(2)}
                                className="border rounded p-1 w-20 text-xs"
                                value={item.colorCosts?.[color] || ''}
                                onChange={e => {
                                    const newCosts = { ...(item.colorCosts || {}) };
                                    if (e.target.value === '') delete newCosts[color];
                                    else newCosts[color] = parseFloat(e.target.value);
                                    onUpdate(idx, 'colorCosts', newCosts);
                                }}
                              />
                          </div>
                      ))}
                  </div>
              </td>
          </tr>
      )}
    </React.Fragment>
  );
};

export const TechPackModule: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [standardOps, setStandardOps] = useState<StandardOperation[]>([]);
  const [allSizes, setAllSizes] = useState<string[]>([]);
  const [allColors, setAllColors] = useState<Color[]>([]);
  const [allObs, setAllObs] = useState<StandardObservation[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [selectedTechPackId, setSelectedTechPackId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [formTechPack, setFormTechPack] = useState<Partial<TechPack>>({});
  const [formProductImage, setFormProductImage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'bom' | 'cuts' | 'ops' | 'measurements' | 'pricing'>('bom');
  
  // Image Options Menu State
  const [showImageMenu, setShowImageMenu] = useState(false);

  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // Approval State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approverName, setApproverName] = useState('');
  
  const [selectedColorToAdd, setSelectedColorToAdd] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [prods, mats, stdOps, sizes, cols, obs, ptrs] = await Promise.all([
      MockService.getProducts(),
      MockService.getMaterials(),
      MockService.getStandardOperations(),
      MockService.getStandardSizes(),
      MockService.getColors(),
      MockService.getObservations(),
      MockService.getPartners()
    ]);
    setProducts(prods);
    setMaterials(mats);
    setStandardOps(stdOps);
    setAllSizes(sizes);
    setAllColors(cols);
    setAllObs(obs);
    setPartners(ptrs);
  };

  const colorsMap = useMemo(() => {
      const map: Record<string, string> = {};
      allColors.forEach(c => map[c.name] = c.hex);
      return map;
  }, [allColors]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const viewingTechPack = useMemo(() => {
    if (!viewingProduct) return null;
    if (selectedTechPackId) {
      return viewingProduct.techPacks.find(tp => tp.id === selectedTechPackId);
    }
    const approved = viewingProduct.techPacks.filter(tp => tp.status === 'aprovado').sort((a,b) => b.version - a.version)[0];
    if (approved) return approved;
    const latest = viewingProduct.techPacks.sort((a,b) => b.version - a.version)[0];
    return latest;
  }, [viewingProduct, selectedTechPackId]);

  useEffect(() => {
      if (viewingProduct) {
          // Allow opening product even without tech packs
          if(viewingTechPack && viewingTechPack.id !== selectedTechPackId) {
              // logic to auto select latest if needed
          }
      }
  }, [viewingProduct]);

  // --- Logic & Handlers ---

  const calculateTotals = () => {
    const matCost = (formTechPack.materials || []).reduce((acc, item) => {
      const mat = materials.find(m => m.id === item.materialId);
      if (!mat) return acc;
      let basePrice = mat.costUnit;
      if (item.colorCosts) {
          const values = Object.values(item.colorCosts) as number[];
          if (values.length > 0) basePrice = Math.max(mat.costUnit, ...values);
      }
      const cost = basePrice * item.usagePerPiece * (1 + item.wasteMargin);
      return acc + cost;
    }, 0);

    const laborCost = (formTechPack.operations || []).reduce((acc, op) => {
      if (op.laborType === 'Terceirizado' && op.negotiatedPrice) {
          return acc + op.negotiatedPrice;
      }
      const costPerMin = op.costPerMinute || 0.5; 
      return acc + (op.standardTimeMinutes * costPerMin);
    }, 0);

    const extraCostTotal = (formTechPack.extraCosts || []).reduce((acc, ex) => acc + ex.value, 0);

    const totalCost = matCost + laborCost + extraCostTotal;
    
    const marginDecimal = (formTechPack.targetMargin || 0) / 100;
    const suggestedPrice = marginDecimal < 1 ? totalCost / (1 - marginDecimal) : 0;

    return { materialCost: matCost, laborCost, extraCostTotal, totalCost, suggestedPrice };
  };

  const handleStartEdit = (techPack?: TechPack) => {
    if (techPack) {
      // ALWAYS CREATE A NEW VERSION ON EDIT
      const copy = JSON.parse(JSON.stringify(techPack));
      const maxVersion = Math.max(0, ...(viewingProduct?.techPacks.map(t => t.version) || []));
      
      setFormTechPack({
        ...copy,
        id: undefined, // Reset ID to create new
        version: maxVersion + 1, // Increment version
        status: 'rascunho', // Reset status
        isFrozen: false,
        approvedBy: '',
        createdAt: new Date().toISOString()
      });
    } else {
      // Completely new Tech Pack for a product that has none
      setFormTechPack({
        productId: viewingProduct?.id,
        version: 1,
        status: 'rascunho',
        materials: [],
        operations: [],
        measurements: [],
        secondaryCuts: [],
        extraCosts: [],
        activeSizes: viewingProduct?.sizes || [], 
        standardObservations: [],
        targetMargin: 50,
        createdAt: new Date().toISOString(),
        salesType: 'Normal'
      });
    }
    setFormProductImage(viewingProduct?.imageUrl || '');
    setIsEditing(true);
    setShowImageMenu(false); // Reset menu
    setActiveTab('bom');
  };

  const handleExitEdit = () => {
      // REQUEST 1: Confirmation to discard changes + Clean reset
      if (confirm("ATENÇÃO: Deseja descartar todas as alterações e sair? \n\nO progresso NÃO será salvo como rascunho.")) {
          setIsEditing(false);
          setFormTechPack({});
          // Ensure we go back to a clean state
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const executeSave = async (status: 'rascunho' | 'aprovado' = 'rascunho') => {
    if (!viewingProduct || !formTechPack.version) return;
    
    // Validate again just in case
    if (!viewingProduct.colors || viewingProduct.colors.length === 0) {
        alert("O Produto precisa ter cores cadastradas.");
        return;
    }
    if (!formTechPack.materials || formTechPack.materials.length === 0) {
        alert("A Lista de Materiais (BOM) não pode estar vazia.");
        return;
    }

    const totals = calculateTotals();
    
    const finalTP: TechPack = {
      ...formTechPack as TechPack,
      id: formTechPack.id || `tp-${Date.now()}`,
      productId: viewingProduct.id,
      status: status,
      approvedBy: status === 'aprovado' ? approverName : undefined,
      materialCost: totals.materialCost,
      laborCost: totals.laborCost,
      totalCost: totals.totalCost,
      suggestedPrice: totals.suggestedPrice,
      isFrozen: status === 'aprovado',
      createdAt: formTechPack.createdAt || new Date().toISOString()
    };

    await MockService.saveTechPack(finalTP);
    if (formProductImage !== viewingProduct.imageUrl) {
        const updatedProd = { ...viewingProduct, imageUrl: formProductImage };
        await MockService.saveProduct(updatedProd);
    }

    await loadData();
    const freshProd = (await MockService.getProducts()).find(p => p.id === viewingProduct.id);
    setViewingProduct(freshProd || null);
    setSelectedTechPackId(finalTP.id);
    setIsEditing(false);
    setIsApproveModalOpen(false);
    setApproverName('');
  };

  const handleSaveDraft = () => {
      executeSave('rascunho');
  };

  const handleOpenApproveModal = () => {
      setIsApproveModalOpen(true);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const newProd: Partial<Product> = {
      sku: fd.get('sku') as string,
      name: fd.get('name') as string,
      collection: fd.get('collection') as string,
      status: ProductStatus.ACTIVE,
      sizes: ['P', 'M', 'G'], 
      colors: []
    };
    await MockService.saveProduct(newProd);
    await loadData();
    const allProds = await MockService.getProducts();
    const created = allProds.find(p => p.sku === newProd.sku);
    setIsNewProductModalOpen(false);
    if (created) {
      setViewingProduct(created);
      handleStartEdit(); 
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
          setFormProductImage(reader.result as string);
          setShowImageMenu(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBOMUpdate = (idx: number, field: keyof BOMItem | 'colorCosts', value: any) => {
    const newMaterials = [...(formTechPack.materials || [])];
    if (field === 'colorCosts') {
        newMaterials[idx].colorCosts = value;
    } else {
        (newMaterials[idx] as any)[field] = value;
    }
    setFormTechPack({ ...formTechPack, materials: newMaterials });
  };

  const handleBOMRemove = (idx: number) => {
    const newMaterials = [...(formTechPack.materials || [])];
    newMaterials.splice(idx, 1);
    setFormTechPack({ ...formTechPack, materials: newMaterials });
  };

  const handleBack = () => {
      if (activeTab === 'cuts') setActiveTab('bom');
      else if (activeTab === 'ops') setActiveTab('cuts');
      else if (activeTab === 'measurements') setActiveTab('ops');
      else if (activeTab === 'pricing') setActiveTab('measurements');
  };

  // REQUIREMENT 2: MANDATORY FIELDS VALIDATION
  const handleNext = () => {
      // Validate BOM / Colors before leaving the first tab
      if (activeTab === 'bom') {
          if (!viewingProduct?.colors || viewingProduct.colors.length === 0) {
              alert("ERRO: É obrigatório adicionar pelo menos 1 Cor ao produto antes de avançar.");
              return;
          }
          if (!formTechPack.materials || formTechPack.materials.length === 0) {
              alert("ERRO: A lista de materiais (BOM) é obrigatória. Adicione pelo menos 1 material.");
              return;
          }
          // Validate if material fields are filled and if Variant is selected when needed
          const invalidMat = formTechPack.materials.find(m => {
              if(!m.materialId) return true;
              const matDef = materials.find(mat => mat.id === m.materialId);
              if (matDef?.hasColors && !m.materialVariantId) return true;
              return false;
          });

          if (invalidMat) {
              alert("ERRO: Existem materiais sem item ou sem COR selecionada. Materiais com variação de cor EXIGEM que você selecione a variante.");
              return;
          }
      }

      if (activeTab === 'bom') setActiveTab('cuts');
      else if (activeTab === 'cuts') setActiveTab('ops');
      else if (activeTab === 'ops') setActiveTab('measurements');
      else if (activeTab === 'measurements') setActiveTab('pricing');
      else if (activeTab === 'pricing') handleSaveDraft();
  };

  // --- Renderers ---

  const renderProductList = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredProducts.map(p => {
         const approved = p.techPacks.find(t => t.status === 'aprovado');
         const latest = p.techPacks.sort((a,b) => b.version - a.version)[0];
         const displayTP = approved || latest;

         return (
           <div 
             key={p.id} 
             onClick={() => { setViewingProduct(p); setSelectedTechPackId(null); }}
             className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all flex items-start gap-4"
           >
             <img src={p.imageUrl} className="w-20 h-20 rounded-lg bg-gray-100 object-cover"/>
             <div className="flex-1 min-w-0">
               <div className="flex justify-between items-start">
                   <h3 className="font-bold text-gray-900 truncate">{p.name}</h3>
                   {displayTP && <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${displayTP.status === 'aprovado' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>v{displayTP.version}</span>}
               </div>
               <div className="text-sm text-gray-500">{p.sku}</div>
               <div className="text-xs text-gray-400 mt-1">{p.collection}</div>
               <div className="mt-2 text-right font-bold text-gray-800 text-sm">
                   {displayTP ? `Custo: R$ ${displayTP.totalCost.toFixed(2)}` : 'Sem Engenharia'}
               </div>
             </div>
           </div>
         )
      })}
    </div>
  );

  // --- EDITOR TABS (BOM, CUTS, OPS, MEASUREMENTS, PRICING) ---
  
  const renderBOMEditor = () => (
    <div className="bg-white p-6 rounded-xl border shadow-sm h-full flex flex-col">
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6">
          <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Palette size={16}/> Cores do Produto (Variantes de Venda) <span className="text-red-500 text-xs normal-case ml-2">(Obrigatório)</span>
          </h4>
          <div className="flex flex-wrap gap-2 mb-3">
              {viewingProduct?.colors.map(c => (
                  <span key={c} className="bg-white border px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm">
                      <div className="w-3 h-3 rounded-full border" style={{backgroundColor: colorsMap[c] || '#ccc'}}></div> {c}
                      <button onClick={async () => {
                          if(!confirm(`Excluir ${c}?`)) return;
                          const upd = {...viewingProduct, colors: viewingProduct.colors.filter(x=>x!==c)};
                          await MockService.saveProduct(upd);
                          setViewingProduct(upd);
                      }} className="text-gray-400 hover:text-red-600 ml-1"><X size={12}/></button>
                  </span>
              ))}
              {viewingProduct?.colors.length === 0 && <span className="text-red-500 text-sm font-bold animate-pulse">Adicione pelo menos 1 cor!</span>}
          </div>
          <div className="flex gap-2 max-w-sm">
              <select className="flex-1 border rounded px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={selectedColorToAdd} onChange={e => setSelectedColorToAdd(e.target.value)}>
                  <option value="">Adicionar cor...</option>
                  {allColors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <button onClick={async () => {
                  if(!selectedColorToAdd) return;
                  if(viewingProduct?.colors.includes(selectedColorToAdd)) return alert('Já existe');
                  const upd = {...viewingProduct!, colors: [...viewingProduct!.colors, selectedColorToAdd]};
                  await MockService.saveProduct(upd);
                  setViewingProduct(upd);
                  setSelectedColorToAdd('');
              }} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-blue-700">Add</button>
          </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold flex items-center gap-2 text-gray-800 text-lg">
            <Layers className="text-blue-600"/> Lista de Materiais (BOM) <span className="text-red-500 text-xs normal-case ml-2">(Obrigatório)</span>
        </h3>
        <button onClick={() => setFormTechPack({...formTechPack, materials: [...(formTechPack.materials || []), { materialId: '', usagePerPiece: 0, wasteMargin: 0, variesWithColor: true }]})} className="bg-blue-50 text-blue-600 text-sm font-bold flex items-center gap-1 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Adicionar Material</button>
      </div>
      
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left sticky top-0 z-10">
            <tr>
                <th className="p-3 w-1/3">Material / Insumo</th>
                <th className="p-3 w-1/4">Combinação / Cor (Aplicação)</th>
                <th className="p-3 w-20 text-center">Varia Cor?</th>
                <th className="p-3 w-28 text-center">Consumo Unit.</th>
                <th className="p-3 w-20 text-center">Un</th>
                <th className="p-3 w-24 text-center">Perda %</th>
                <th className="p-3 w-32 text-right">Custo Ref.</th>
                <th className="p-3 w-24 text-center">Ações</th>
            </tr>
            </thead>
            <tbody>
            {(formTechPack.materials || []).map((item, idx) => (
                <BOMRow 
                    key={idx}
                    item={item} 
                    idx={idx}
                    materials={materials} 
                    viewingProduct={viewingProduct}
                    onUpdate={handleBOMUpdate}
                    onRemove={handleBOMRemove}
                    colorsMap={colorsMap}
                />
            ))}
            {(formTechPack.materials || []).length === 0 && (
                <tr>
                    <td colSpan={8} className="p-8 text-center text-red-500 font-bold bg-red-50 rounded">
                        <AlertTriangle className="inline mr-2"/> A lista de materiais está vazia. Adicione insumos para calcular o custo.
                    </td>
                </tr>
            )}
            </tbody>
        </table>
      </div>
    </div>
  );

  const renderSecondaryCutsEditor = () => (
    <div className="bg-white p-6 rounded-xl border shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold flex items-center gap-2 text-gray-800 text-lg">
            <Scissors className="text-orange-600"/> Cortes Secundários (Consumo Extra)
        </h3>
        <button onClick={() => setFormTechPack({...formTechPack, secondaryCuts: [...(formTechPack.secondaryCuts || []), { id: `sc-${Date.now()}`, name: '', consumption: 0 }]})} className="bg-orange-50 text-orange-600 text-sm font-bold flex items-center gap-1 hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Adicionar Corte</button>
      </div>
      <div className="space-y-3 overflow-auto flex-1">
          {(formTechPack.secondaryCuts || []).map((sc, idx) => (
              <div key={idx} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border">
                  <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Nome (ex: Gola, Viés)</label>
                      <input className="w-full border rounded p-2 text-sm" value={sc.name} onChange={e => {
                          const newCuts = [...formTechPack.secondaryCuts!]; newCuts[idx].name = e.target.value; setFormTechPack({...formTechPack, secondaryCuts: newCuts});
                      }}/>
                  </div>
                  <div className="w-32">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Consumo (m/kg)</label>
                      <DecimalInput 
                        className="w-full border rounded p-2 text-sm text-center" 
                        value={sc.consumption} 
                        onChange={(val: number) => {
                            const newCuts = [...formTechPack.secondaryCuts!]; newCuts[idx].consumption = val; setFormTechPack({...formTechPack, secondaryCuts: newCuts});
                        }}
                      />
                  </div>
                  <button onClick={() => {
                      const newCuts = [...formTechPack.secondaryCuts!]; newCuts.splice(idx, 1); setFormTechPack({...formTechPack, secondaryCuts: newCuts});
                  }} className="text-red-400 hover:text-red-600 mt-4"><Trash2 size={18}/></button>
              </div>
          ))}
          {(formTechPack.secondaryCuts || []).length === 0 && <div className="text-gray-400 text-center py-8">Nenhum corte secundário definido.</div>}
      </div>
    </div>
  );

  const renderOpsEditor = () => (
    <div className="bg-white p-6 rounded-xl border shadow-sm h-full flex gap-6">
      <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2 text-gray-800 text-lg">
                <Settings2 className="text-blue-600"/> Sequência Operacional (Roteiro)
            </h3>
            <button onClick={() => setFormTechPack({...formTechPack, operations: [...(formTechPack.operations || []), { id: `op-${Date.now()}`, name: '', machine: '', standardTimeMinutes: 0, costPerMinute: 0.5, laborType: 'CLT' }]})} className="bg-blue-50 text-blue-600 text-sm font-bold flex items-center gap-1 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Adicionar Operação</button>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left sticky top-0 z-10">
                    <tr>
                        <th className="p-3">Operação</th>
                        <th className="p-3">Máquina</th>
                        <th className="p-3">Tipo M.O.</th>
                        <th className="p-3 text-center">Tempo (min)</th>
                        <th className="p-3 text-right">Custo Est.</th>
                        <th className="p-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {(formTechPack.operations || []).map((op, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-3">
                                <input className="w-full border rounded p-2 text-sm" value={op.name} placeholder="Nome da operação" onChange={e => {
                                    const newOps = [...formTechPack.operations!]; newOps[idx].name = e.target.value; setFormTechPack({...formTechPack, operations: newOps});
                                }} list="std-ops"/>
                                <datalist id="std-ops">{standardOps.map(s => <option key={s.id} value={s.name}/>)}</datalist>
                            </td>
                            <td className="p-3">
                                <input className="w-full border rounded p-2 text-sm" value={op.machine} placeholder="Máquina" onChange={e => {
                                    const newOps = [...formTechPack.operations!]; newOps[idx].machine = e.target.value; setFormTechPack({...formTechPack, operations: newOps});
                                }}/>
                            </td>
                            <td className="p-3">
                                <select className="w-full border rounded p-2 text-sm" value={op.laborType} onChange={e => {
                                    const newOps = [...formTechPack.operations!]; newOps[idx].laborType = e.target.value as any; setFormTechPack({...formTechPack, operations: newOps});
                                }}>
                                    <option value="CLT">Interno (CLT)</option>
                                    <option value="Terceirizado">Externo (Facção)</option>
                                </select>
                                {op.laborType === 'Terceirizado' && (
                                    <select className="w-full border rounded p-2 text-xs mt-1 bg-purple-50 text-purple-700" value={op.partnerId || ''} onChange={e => {
                                        const newOps = [...formTechPack.operations!]; newOps[idx].partnerId = e.target.value; setFormTechPack({...formTechPack, operations: newOps});
                                    }}>
                                        <option value="">Qualquer Parceiro</option>
                                        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                )}
                            </td>
                            <td className="p-3 text-center">
                                {op.laborType === 'CLT' ? (
                                    <DecimalInput className="w-20 border rounded p-2 text-center" value={op.standardTimeMinutes} onChange={(val: number) => {
                                        const newOps = [...formTechPack.operations!]; newOps[idx].standardTimeMinutes = val; setFormTechPack({...formTechPack, operations: newOps});
                                    }}/>
                                ) : (
                                    <span className="text-gray-400">-</span>
                                )}
                            </td>
                            <td className="p-3 text-right">
                                {op.laborType === 'CLT' ? (
                                    <span>R$ {(op.standardTimeMinutes * (op.costPerMinute || 0.5)).toFixed(2)}</span>
                                ) : (
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-xs text-gray-500">R$</span>
                                        <DecimalInput className="w-20 border rounded p-2 text-right bg-purple-50 text-purple-700 font-bold" value={op.negotiatedPrice || 0} onChange={(val: number) => {
                                            const newOps = [...formTechPack.operations!]; newOps[idx].negotiatedPrice = val; setFormTechPack({...formTechPack, operations: newOps});
                                        }}/>
                                    </div>
                                )}
                            </td>
                            <td className="p-3 text-center">
                                <button onClick={() => {
                                    const newOps = [...formTechPack.operations!]; newOps.splice(idx, 1); setFormTechPack({...formTechPack, operations: newOps});
                                }} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
      </div>

      {/* REQUEST 5: Standard Observations Sidebar */}
      <div className="w-80 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm"><StickyNote size={16}/> Observações Padrão</h4>
          <div className="overflow-y-auto flex-1 space-y-2 max-h-[400px]">
              {allObs.map(obs => {
                  const isSelected = formTechPack.standardObservations?.includes(obs.id);
                  return (
                      <div 
                        key={obs.id} 
                        onClick={() => {
                            const current = formTechPack.standardObservations || [];
                            const newObs = isSelected ? current.filter(id => id !== obs.id) : [...current, obs.id];
                            setFormTechPack({...formTechPack, standardObservations: newObs});
                        }}
                        className={`p-3 rounded-lg border cursor-pointer text-xs transition-all
                            ${isSelected ? 'bg-blue-100 border-blue-300 text-blue-800 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}
                        `}
                      >
                          <div className="font-bold mb-1 uppercase text-[10px] opacity-70">{obs.category}</div>
                          {obs.text}
                          {isSelected && <CheckCircle size={14} className="ml-auto mt-1 text-blue-600"/>}
                      </div>
                  )
              })}
              {allObs.length === 0 && <div className="text-gray-400 text-xs text-center italic">Nenhuma observação cadastrada em configurações.</div>}
          </div>
      </div>
    </div>
  );

  const renderMeasurementsEditor = () => (
    <div className="bg-white p-6 rounded-xl border shadow-sm h-full flex flex-col">
      {/* REQUEST 4 & 2: Grade Configuration */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
          <h4 className="font-bold text-blue-800 text-sm mb-3 flex items-center gap-2"><Ruler size={16}/> Configuração de Grade (Tamanhos Ativos)</h4>
          <div className="flex flex-wrap gap-2">
              {allSizes.map(size => {
                  const isActive = (formTechPack.activeSizes || viewingProduct?.sizes || []).includes(size);
                  return (
                      <button 
                        key={size}
                        onClick={() => {
                            const current = formTechPack.activeSizes || [];
                            const newSizes = isActive ? current.filter(s => s !== size) : [...current, size];
                            setFormTechPack({...formTechPack, activeSizes: newSizes});
                        }}
                        className={`px-3 py-1.5 rounded-md text-sm font-bold border transition-all
                            ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}
                        `}
                      >
                          {size}
                      </button>
                  )
              })}
          </div>
          <p className="text-xs text-blue-600 mt-2">Selecione os tamanhos que serão produzidos para habilitar a tabela abaixo.</p>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold flex items-center gap-2 text-gray-800 text-lg">
            <Ruler className="text-green-600"/> Tabela de Medidas
        </h3>
        <button onClick={() => setFormTechPack({...formTechPack, measurements: [...(formTechPack.measurements || []), { id: `m-${Date.now()}`, name: '', tolerance: 1, values: {} }]})} className="bg-green-50 text-green-600 text-sm font-bold flex items-center gap-1 hover:bg-green-100 px-4 py-2 rounded-lg transition-colors"><Plus size={16}/> Adicionar Ponto</button>
      </div>
      <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-center">
              <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                  <tr>
                      <th className="p-3 text-left">Ponto de Medição</th>
                      <th className="p-3 w-20">Tol. (+/-)</th>
                      {(formTechPack.activeSizes || []).map(s => <th key={s} className="p-3 w-20">{s}</th>)}
                      <th className="p-3 w-10"></th>
                  </tr>
              </thead>
              <tbody className="divide-y">
                  {(formTechPack.measurements || []).map((m, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-3 text-left">
                              <input className="w-full border rounded p-2 text-sm" value={m.name} placeholder="Ex: Largura Tórax" onChange={e => {
                                  const newMeas = [...formTechPack.measurements!]; newMeas[idx].name = e.target.value; setFormTechPack({...formTechPack, measurements: newMeas});
                              }}/>
                          </td>
                          <td className="p-3">
                              <input type="number" className="w-full border rounded p-2 text-center text-xs" value={m.tolerance} onChange={e => {
                                  const newMeas = [...formTechPack.measurements!]; newMeas[idx].tolerance = parseFloat(e.target.value); setFormTechPack({...formTechPack, measurements: newMeas});
                              }}/>
                          </td>
                          {(formTechPack.activeSizes || []).map(s => (
                              <td key={s} className="p-3">
                                  <input type="number" className="w-full border rounded p-2 text-center" value={m.values[s] || ''} onChange={e => {
                                      const newMeas = [...formTechPack.measurements!]; 
                                      newMeas[idx].values = { ...newMeas[idx].values, [s]: parseFloat(e.target.value) };
                                      setFormTechPack({...formTechPack, measurements: newMeas});
                                  }}/>
                              </td>
                          ))}
                          <td className="p-3">
                              <button onClick={() => {
                                  const newMeas = [...formTechPack.measurements!]; newMeas.splice(idx, 1); setFormTechPack({...formTechPack, measurements: newMeas});
                              }} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
          {(formTechPack.activeSizes || []).length === 0 && (
              <div className="text-center py-8 text-gray-400">
                  <AlertTriangle className="mx-auto mb-2 opacity-50" size={32}/>
                  Selecione os tamanhos na grade acima para preencher as medidas.
              </div>
          )}
      </div>
    </div>
  );

  const renderPricingEditor = () => {
      const totals = calculateTotals();
      const currentMargin = formTechPack.currentPrice 
        ? ((formTechPack.currentPrice - totals.totalCost) / formTechPack.currentPrice) * 100 
        : 0;

      // Sales Type Config
      const salesTypes = ['Normal', 'Vende Bem', 'Vende Tudo', 'Hype'];
      const currentSalesType = formTechPack.salesType || 'Normal';

      const getSalesTypeColor = (type: string) => {
          switch(type) {
              case 'Hype': return 'bg-purple-600 text-white border-purple-600';
              case 'Vende Tudo': return 'bg-orange-500 text-white border-orange-500';
              case 'Vende Bem': return 'bg-blue-500 text-white border-blue-500';
              default: return 'bg-gray-100 text-gray-700 border-gray-200';
          }
      };

      return (
        <div className="bg-white p-8 rounded-xl border shadow-sm animate-fade-in h-full flex flex-col overflow-auto">
            <h3 className="font-bold text-gray-800 mb-8 flex items-center gap-2 text-xl"><DollarSign className="text-green-600"/> Precificação & Estratégia</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* LEFT: COSTS */}
                <div className="space-y-6">
                    {/* Mandatory Sales Type Selector */}
                    <div className="bg-white p-6 rounded-xl border-2 border-indigo-100 shadow-sm">
                        <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2"><Flame className="text-indigo-600"/> Potencial de Venda (Obrigatório)</h4>
                        <div className="grid grid-cols-4 gap-2">
                            {salesTypes.map(type => (
                                <button
                                    key={type}
                                    onClick={() => setFormTechPack({...formTechPack, salesType: type as any})}
                                    className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${currentSalesType === type ? getSalesTypeColor(type) : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic">Define a prioridade de finalização nas fases de Embalagem e Revisão.</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Composição de Custo (Industrial)</h4>
                        <div className="flex justify-between mb-3 text-sm"><span>Matéria Prima:</span> <span className="font-bold">R$ {totals.materialCost.toFixed(2)}</span></div>
                        <div className="flex justify-between mb-3 text-sm"><span>Mão de Obra / Facção:</span> <span className="font-bold">R$ {totals.laborCost.toFixed(2)}</span></div>
                        <div className="flex justify-between mb-3 text-sm"><span>Custos Extras:</span> <span className="font-bold">R$ {totals.extraCostTotal.toFixed(2)}</span></div>
                        <div className="flex justify-between pt-4 border-t border-slate-300 font-bold text-xl text-slate-900 mt-2">
                            <span>Custo Total:</span>
                            <span>R$ {totals.totalCost.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-700">Custos Extras</h4>
                            <button onClick={() => setFormTechPack({...formTechPack, extraCosts: [...(formTechPack.extraCosts||[]), { id: `ec-${Date.now()}`, name: '', category: 'Logística', value: 0 }]})} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 font-bold">+ Adicionar</button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-auto">
                            {(formTechPack.extraCosts || []).map((ec, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <input className="border rounded p-1.5 text-sm flex-1" placeholder="Nome (ex: Frete)" value={ec.name} onChange={e => {
                                        const newEc = [...formTechPack.extraCosts!]; newEc[idx].name = e.target.value; setFormTechPack({...formTechPack, extraCosts: newEc});
                                    }}/>
                                    <DecimalInput 
                                        className="border rounded p-1.5 text-sm w-24 text-right" 
                                        value={ec.value} 
                                        onChange={(val: number) => {
                                            const newEc = [...formTechPack.extraCosts!]; newEc[idx].value = val; setFormTechPack({...formTechPack, extraCosts: newEc});
                                        }}
                                        step="0.01"
                                    />
                                    <button onClick={() => {
                                        const newEc = [...formTechPack.extraCosts!]; newEc.splice(idx, 1); setFormTechPack({...formTechPack, extraCosts: newEc});
                                    }} className="text-red-400"><Trash2 size={14}/></button>
                                </div>
                            ))}
                            {(formTechPack.extraCosts || []).length === 0 && <p className="text-xs text-gray-400 italic">Nenhum custo extra lançado.</p>}
                        </div>
                    </div>
                </div>

                {/* RIGHT: PRICING STRATEGY */}
                <div className="space-y-6">
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                         <h4 className="font-bold text-blue-800 mb-6 flex items-center gap-2"><BarChart3 size={18}/> Definição de Preço</h4>
                         
                         <div className="mb-6">
                             <label className="block text-sm font-bold text-blue-900 mb-1">Margem Alvo (%)</label>
                             <div className="flex items-center gap-4">
                                <input 
                                    type="number" 
                                    className="w-32 border border-blue-200 rounded p-3 font-bold text-xl text-blue-700 focus:ring-2 focus:ring-blue-400 outline-none"
                                    value={formTechPack.targetMargin || 50}
                                    onChange={e => setFormTechPack({...formTechPack, targetMargin: parseFloat(e.target.value)})}
                                />
                                <div className="flex-1">
                                    <div className="text-xs text-blue-600 mb-1">Preço Sugerido (Calculado)</div>
                                    <div className="text-2xl font-bold text-blue-900">R$ {totals.suggestedPrice.toFixed(2)}</div>
                                </div>
                             </div>
                         </div>

                         <div className="pt-6 border-t border-blue-200">
                             <label className="block text-sm font-bold text-blue-900 mb-1">Preço de Venda ATUAL (Real)</label>
                             <div className="flex items-center gap-4">
                                <DecimalInput 
                                    className="w-32 border border-blue-200 rounded p-3 font-bold text-xl text-green-700 bg-white focus:ring-2 focus:ring-green-400 outline-none"
                                    value={formTechPack.currentPrice || 0}
                                    onChange={(val: number) => setFormTechPack({...formTechPack, currentPrice: val})}
                                    placeholder="0.00"
                                    step="0.01"
                                />
                                <div className="flex-1">
                                    <div className="text-xs text-blue-600 mb-1">Margem Real Atingida</div>
                                    <div className={`text-2xl font-bold ${currentMargin >= (formTechPack.targetMargin||0) ? 'text-green-600' : 'text-orange-500'}`}>
                                        {currentMargin.toFixed(1)}%
                                    </div>
                                </div>
                             </div>
                             {currentMargin < (formTechPack.targetMargin||0) && (
                                 <div className="mt-2 text-xs text-orange-600 font-bold bg-orange-100 p-2 rounded flex items-center gap-1">
                                     <AlertTriangle size={12}/> Margem abaixo do alvo! Revise custos ou preço.
                                 </div>
                             )}
                         </div>
                    </div>
                </div>
            </div>
        </div>
      );
  };

  const renderSpecSheet = () => {
      if(!viewingProduct) return null;
      
      // REQUEST 6: Fix for "No Engineering". Even if no techpack, show header and create button.
      const statusColor = viewingTechPack?.status === 'aprovado' ? 'bg-green-600' : viewingTechPack?.status === 'obsoleto' ? 'bg-red-500' : 'bg-gray-500';

      return (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto no-print">
            {/* Header / Toolbar */}
            <div className="sticky top-0 bg-white border-b shadow-sm px-8 py-4 flex justify-between items-center z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setViewingProduct(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft/></button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{viewingProduct.name}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="font-mono bg-gray-100 px-2 rounded">{viewingProduct.sku}</span>
                            <span>• {viewingProduct.collection}</span>
                            {viewingTechPack && (
                                <>
                                    <span className={`px-2 py-0.5 rounded text-white text-xs font-bold uppercase ${statusColor}`}>{viewingTechPack.status}</span>
                                    <span>• Versão {viewingTechPack.version}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {viewingTechPack ? (
                        <>
                            <button onClick={() => setIsHistoryModalOpen(true)} className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2 text-gray-700" title="Histórico de Versões">
                                <Clock size={16}/> Histórico
                            </button>
                            <button onClick={() => window.print()} className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2"><Printer size={16}/> Imprimir</button>
                            <button onClick={() => handleStartEdit(viewingTechPack)} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 flex items-center gap-2"><Edit2 size={16}/> Editar</button>
                        </>
                    ) : (
                        <button onClick={() => handleStartEdit()} className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-lg animate-pulse-slow">
                            <PackagePlus size={20}/> Criar Primeira Engenharia
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-8 space-y-8">
                {/* Header Grid */}
                <div className="grid grid-cols-3 gap-8">
                    <div className="col-span-1">
                        <img src={viewingProduct.imageUrl} className="w-full aspect-square object-cover rounded-xl border shadow-sm bg-gray-100"/>
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Grade de Tamanhos</h3>
                            <div className="flex gap-2">
                                {(viewingTechPack?.activeSizes || viewingProduct.sizes).map(s => <span key={s} className="bg-white border px-3 py-1 rounded font-bold">{s}</span>)}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Variantes de Cor</h3>
                            <div className="flex gap-2 flex-wrap">
                                {viewingProduct.colors.map(c => (
                                    <span key={c} className="flex items-center gap-1 bg-white border px-2 py-1 rounded text-sm"><div className="w-3 h-3 rounded-full border" style={{backgroundColor: colorsMap[c]}}></div>{c}</span>
                                ))}
                            </div>
                        </div>
                        {viewingTechPack ? (
                            <>
                                <div className="bg-gray-50 p-4 rounded-xl border col-span-2">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Custos & Preço</h3>
                                    <div className="grid grid-cols-4 gap-4 text-center">
                                        <div><div className="text-xs text-gray-400">Material</div><div className="font-bold">R$ {viewingTechPack.materialCost.toFixed(2)}</div></div>
                                        <div><div className="text-xs text-gray-400">Mão de Obra</div><div className="font-bold">R$ {viewingTechPack.laborCost.toFixed(2)}</div></div>
                                        <div><div className="text-xs text-gray-400">Total</div><div className="font-bold text-lg">R$ {viewingTechPack.totalCost.toFixed(2)}</div></div>
                                        <div className="bg-green-100 rounded p-1"><div className="text-xs text-green-700 font-bold">Venda</div><div className="font-bold text-green-800 text-lg">R$ {viewingTechPack.currentPrice?.toFixed(2) || viewingTechPack.suggestedPrice.toFixed(2)}</div></div>
                                    </div>
                                </div>
                                {viewingTechPack.approvedBy && (
                                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-center gap-2 col-span-2">
                                        <CheckCircle2 className="text-green-600"/>
                                        <span className="text-green-800 text-sm font-bold">Aprovado por {viewingTechPack.approvedBy} em {new Date(viewingTechPack.createdAt).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {/* Sales Type Display */}
                                <div className={`col-span-2 p-3 rounded-lg border text-center font-bold uppercase text-sm ${
                                    viewingTechPack.salesType === 'Hype' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                    viewingTechPack.salesType === 'Vende Tudo' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                    'bg-gray-100 text-gray-600 border-gray-200'
                                }`}>
                                    Tipo: {viewingTechPack.salesType || 'Normal'}
                                </div>
                            </>
                        ) : (
                            <div className="col-span-2 flex flex-col items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400">
                                <FileWarning size={48} className="mb-2 opacity-30"/>
                                <p>Este produto ainda não possui engenharia/ficha técnica definida.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Details Grid (Only if TP exists) */}
                {viewingTechPack && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* BOM */}
                        <div className="border rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-gray-100 px-4 py-3 font-bold text-gray-800 border-b flex items-center gap-2"><Layers size={16}/> Materiais (BOM)</div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="p-3 text-left">Item</th>
                                        <th className="p-3 text-left">Variação</th>
                                        <th className="p-3 text-center">Consumo</th>
                                        <th className="p-3 text-center">Perda</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {viewingTechPack.materials.map((m, i) => {
                                        const mat = materials.find(x => x.id === m.materialId);
                                        return (
                                            <tr key={i}>
                                                <td className="p-3">
                                                    <div className="font-bold">{mat?.name}</div>
                                                    {/* Show specific variant if selected */}
                                                    {m.materialVariantName && (
                                                        <div className="text-xs text-orange-600 font-bold mt-0.5">Cor: {m.materialVariantName}</div>
                                                    )}
                                                    <div className="text-xs text-gray-400">{mat?.code}</div>
                                                </td>
                                                <td className="p-3 text-xs">
                                                    {m.colorVariant ? 
                                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold">{m.colorVariant}</span> 
                                                        : <span className="text-gray-400">Todas</span>}
                                                </td>
                                                <td className="p-3 text-center font-mono">{m.usagePerPiece} {mat?.unit}</td>
                                                <td className="p-3 text-center text-gray-400">{(m.wasteMargin*100).toFixed(0)}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Operations */}
                        <div className="border rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-gray-100 px-4 py-3 font-bold text-gray-800 border-b flex items-center gap-2"><Settings2 size={16}/> Sequência Operacional</div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="p-3 text-left">Operação</th>
                                        <th className="p-3 text-left">Execução</th>
                                        <th className="p-3 text-center">Tempo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {viewingTechPack.operations.map((op, i) => (
                                        <tr key={i}>
                                            <td className="p-3">
                                                <div className="font-bold">{i+1}. {op.name}</div>
                                                <div className="text-xs text-gray-400">{op.machine}</div>
                                            </td>
                                            <td className="p-3">
                                                {op.laborType === 'Terceirizado' ? (
                                                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">
                                                        Externo {op.partnerId ? `(${partners.find(p=>p.id===op.partnerId)?.name})` : ''}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500 text-xs">Interno</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center font-mono">{op.standardTimeMinutes} min</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Measurements & Observations */}
                {viewingTechPack && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                         <div className="border rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-gray-100 px-4 py-3 font-bold text-gray-800 border-b flex items-center gap-2"><Ruler size={16}/> Tabela de Medidas (cm)</div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-center">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                        <tr>
                                            <th className="p-2 text-left">Ponto</th>
                                            <th className="p-2">Tol.</th>
                                            {(viewingTechPack.activeSizes || viewingProduct.sizes).map(s => <th key={s} className="p-2">{s}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {viewingTechPack.measurements.map((m, i) => (
                                            <tr key={i}>
                                                <td className="p-2 text-left font-medium">{m.name}</td>
                                                <td className="p-2 text-gray-400 text-xs">+/- {m.tolerance}</td>
                                                {(viewingTechPack.activeSizes || viewingProduct.sizes).map(s => (
                                                    <td key={s} className="p-2 font-mono text-gray-700">{m.values[s] || '-'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                         </div>

                         <div className="border rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-gray-100 px-4 py-3 font-bold text-gray-800 border-b flex items-center gap-2"><StickyNote size={16}/> Observações de Produção</div>
                            <ul className="p-4 space-y-2 text-sm text-gray-700">
                                {(viewingTechPack.standardObservations || []).map((obsId, i) => {
                                    const obs = allObs.find(o => o.id === obsId);
                                    return obs ? (
                                        <li key={i} className="flex gap-2 items-start">
                                            <span className="text-blue-500 font-bold">•</span>
                                            <span><span className="text-xs font-bold uppercase text-gray-400 mr-2">{obs.category}</span>{obs.text}</span>
                                        </li>
                                    ) : null;
                                })}
                                {(!viewingTechPack.standardObservations || viewingTechPack.standardObservations.length === 0) && (
                                    <li className="text-gray-400 italic">Nenhuma observação registrada.</li>
                                )}
                            </ul>
                         </div>
                    </div>
                )}
            </div>
        </div>
      );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shirt className="text-purple-600" /> Fichas Técnicas
          </h1>
          <p className="text-gray-500 text-sm">Biblioteca de produtos e engenharia.</p>
        </div>
        <button onClick={() => setIsNewProductModalOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 flex items-center gap-2 shadow-sm">
          <PackagePlus size={18}/> Novo Modelo
        </button>
      </div>

      <div className="relative no-print">
        <Search className="absolute left-3 top-3 text-gray-400" size={20}/>
        <input placeholder="Buscar modelo por nome ou SKU..." className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none shadow-sm mb-4 focus:ring-2 focus:ring-purple-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="no-print">{renderProductList()}</div>

      {viewingProduct && !isEditing && renderSpecSheet()}

      {/* HISTORY MODAL AND APPROVE MODAL REMAIN THE SAME */}
      {/* ... */}
      
      {/* EDIT MODAL AND CREATE MODAL */}
      {isEditing && (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col animate-fade-in no-print">
          {/* Header */}
          <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm shrink-0">
            <div className="flex items-center gap-4">
               <button onClick={handleExitEdit} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowLeft/></button>
               <div>
                 <h2 className="text-lg font-bold text-gray-900 leading-tight">
                   {formTechPack.version === 1 ? 'Nova Ficha Técnica' : `Criando Nova Versão ${formTechPack.version}`}
                 </h2>
                 <p className="text-gray-500 text-xs">{viewingProduct?.name} • {viewingProduct?.sku}</p>
               </div>
               {/* REQUEST 3: Image Upload in Edit Header */}
               <div className="ml-4 relative group">
                   <img src={formProductImage || viewingProduct?.imageUrl} className="w-10 h-10 rounded-lg object-cover border border-gray-200"/>
                   <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => imageInputRef.current?.click()}>
                       <Camera size={16} className="text-white"/>
                   </div>
               </div>
            </div>
            
            <div className="flex items-center gap-3 bg-gray-100 p-1 rounded-lg">
               <button onClick={() => setActiveTab('bom')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'bom' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>1. Materiais</button>
               <button onClick={() => setActiveTab('cuts')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'cuts' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>2. Cortes</button>
               <button onClick={() => setActiveTab('ops')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'ops' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>3. Operações</button>
               <button onClick={() => setActiveTab('measurements')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'measurements' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>4. Medidas</button>
               <button onClick={() => setActiveTab('pricing')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'pricing' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>5. Custo & Preço</button>
            </div>

            <div className="flex gap-2 relative">
                <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                
                <button onClick={handleSaveDraft} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 flex items-center gap-2 text-sm shadow-sm">
                    <Save size={16}/> Salvar Rascunho
                </button>
                <button onClick={handleOpenApproveModal} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 text-sm shadow-sm">
                    <CheckCircle2 size={16}/> Aprovar Ficha
                </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden bg-gray-50 p-4 lg:p-8">
             <div className="max-w-7xl mx-auto h-full">
                {activeTab === 'bom' && renderBOMEditor()}
                {activeTab === 'cuts' && renderSecondaryCutsEditor()}
                {activeTab === 'ops' && renderOpsEditor()}
                {activeTab === 'measurements' && renderMeasurementsEditor()}
                {activeTab === 'pricing' && renderPricingEditor()}
             </div>
          </div>

          <div className="bg-white border-t p-4 flex justify-between items-center shrink-0">
             <button onClick={handleBack} disabled={activeTab === 'bom'} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 font-medium"><ChevronLeft size={20}/> Anterior</button>
             <button onClick={handleNext} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm">{activeTab === 'pricing' ? 'Finalizar' : 'Próximo'} {activeTab !== 'pricing' && <ChevronRight size={20}/>}</button>
          </div>
        </div>
      )}
      
      {/* Create Product Modal */}
      {isNewProductModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full animate-scale-in">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><PackagePlus className="text-purple-600"/> Novo Modelo</h2>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                 <div><label className="block text-sm font-bold text-gray-700 mb-1">Referência (SKU)</label><input name="sku" placeholder="Ex: CAM-2024-001" className="w-full border rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none uppercase" required /></div>
                 <div><label className="block text-sm font-bold text-gray-700 mb-1">Nome do Produto</label><input name="name" placeholder="Ex: Camiseta Algodão Premium" className="w-full border rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none" required /></div>
                 <div><label className="block text-sm font-bold text-gray-700 mb-1">Coleção</label><input name="collection" placeholder="Ex: Verão 2025" className="w-full border rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none" /></div>
                 <div className="flex justify-end gap-3 mt-8">
                   <button type="button" onClick={() => setIsNewProductModalOpen(false)} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancelar</button>
                   <button type="submit" className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-lg shadow-purple-200">Criar e Iniciar Ficha</button>
                 </div>
              </form>
            </div>
          </div>
      )}
    </div>
  );
};
