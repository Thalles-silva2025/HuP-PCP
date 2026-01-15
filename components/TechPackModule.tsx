
/**
 * 🔒 MÓDULO FICHA TÉCNICA
 * ATUALIZAÇÃO: Correção para Carregar sempre a ÚLTIMA VERSÃO (v19 > v1).
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Product, TechPack, Material, BOMItem, Operation, MaterialType, UnitOfMeasure, ProductStatus, MeasurementPoint, StandardOperation, Color, StandardObservation, Partner, ExtraCost, SalesType } from '../types';
import { ApiService } from '../services/api'; 
import { Shirt, Layers, Settings2, Plus, Save, DollarSign, Trash2, ArrowLeft, PackagePlus, Search, Edit2, ChevronRight, ChevronLeft, Ruler, X, Eye, Printer, History, CheckCircle2, Upload, Camera, Scissors, Lock, Palette, StickyNote, BarChart3, AlertTriangle, Clock, CheckCircle, Image as ImageIcon, Flame, HelpCircle, AlertCircle, FileText, Download, UserCheck, CheckSquare, Square, TrendingUp, Zap, Star, Calculator, Coins, ListChecks, ArrowUpRight, ArrowDownRight, Activity, Tag, Box, Percent, CalendarDays, GitCommit, User, Quote, ShieldCheck, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SystemLogService } from '../services/SystemLogService';

// ... (DecimalInput e SystemAlert components mantidos iguais) ...
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
            if (!isNaN(numVal)) onChange(numVal);
            else if (val === '') onChange(0);
        }
    };
    const handleBlur = () => {
        const numVal = parseFloat(localValue.replace(',', '.'));
        if (!isNaN(numVal)) setLocalValue(numVal.toString().replace('.', ','));
    };
    return <input type="text" inputMode="decimal" className={className} value={localValue} onChange={handleChange} onBlur={handleBlur} placeholder={placeholder} />;
};

const SystemAlert = ({ isOpen, title, message, onClose }: { isOpen: boolean, title: string, message: string, onClose: () => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 animate-scale-in">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border-l-4 border-blue-500">
                <h3 className="font-bold text-lg text-gray-800 mb-2">{title}</h3>
                <p className="text-gray-600 text-sm mb-4">{message}</p>
                <div className="flex justify-end"><button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700">OK</button></div>
            </div>
        </div>
    );
};

// ... (BOMRow e calculatePreviewFinancials mantidos iguais) ...
interface BOMRowProps {
  item: BOMItem; idx: number; materials: Material[]; viewingProduct: Product | null; formColors: string[]; 
  onUpdate: (idx: number, field: keyof BOMItem | 'colorCosts', value: any) => void; onRemove: (idx: number) => void; colorsMap: Record<string, string>;
}
const BOMRow: React.FC<BOMRowProps> = ({ item, idx, materials, viewingProduct, formColors, onUpdate, onRemove, colorsMap }) => {
  const [showColorCost, setShowColorCost] = useState(false);
  const mat = materials.find(m => m.id === item.materialId);
  const baseCost = mat ? (mat.costUnit * item.usagePerPiece * (1 + item.wasteMargin)) : 0;
  const hasColorCosts = item.colorCosts && Object.keys(item.colorCosts).length > 0;
  return (
    <React.Fragment>
      <tr className="hover:bg-gray-50 border-b border-gray-100 transition-colors">
        <td className="p-3">
            <select className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={item.materialId} onChange={e => onUpdate(idx, 'materialId', e.target.value)}>
              <option value="">Selecione Material...</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
            </select>
        </td>
        <td className="p-3 align-top">
            <select className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-700 bg-white" value={item.colorVariant || ''} onChange={e => onUpdate(idx, 'colorVariant', e.target.value)}>
                <option value="">Geral / Todas</option>
                {formColors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
        </td>
        <td className="p-3 text-center align-middle">
            <div className="flex items-center justify-center">
                <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer" checked={item.variesWithColor || false} onChange={e => onUpdate(idx, 'variesWithColor', e.target.checked)} title="Marque se este item deve ser separado por cor na produção"/>
            </div>
        </td>
        <td className="p-3 align-top"><DecimalInput className="w-full border border-gray-300 rounded-lg p-2 text-center text-sm font-mono" value={item.usagePerPiece} onChange={(val: number) => onUpdate(idx, 'usagePerPiece', val)} placeholder="0,000"/></td>
        <td className="p-3 text-center text-gray-500 font-medium text-xs align-middle">{mat?.unit || '-'}</td>
        <td className="p-3 align-top">
            <div className="relative">
              <DecimalInput className="w-full border border-gray-300 rounded-lg p-2 text-center text-sm pr-6" value={item.wasteMargin ? (item.wasteMargin * 100) : 0} onChange={(val: number) => onUpdate(idx, 'wasteMargin', val / 100)} placeholder="0"/>
              <span className="absolute right-2 top-2 text-gray-400 text-xs">%</span>
            </div>
        </td>
        <td className="p-3 text-right font-bold text-gray-800 text-sm align-middle">{hasColorCosts ? <span className="text-orange-600 text-xs">(Varia)</span> : `R$ ${baseCost.toFixed(3)}`}</td>
        <td className="p-3 text-center flex justify-center gap-2 align-middle">
            <button onClick={() => setShowColorCost(!showColorCost)} className={`p-2 rounded-lg transition-colors ${hasColorCosts || showColorCost ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100'}`} title="Custo Diferenciado por Cor"><DollarSign size={16}/></button>
            <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
        </td>
      </tr>
      {showColorCost && (
          <tr className="bg-orange-50/50">
              <td colSpan={8} className="p-4 border-b">
                  <div className="text-xs font-bold text-orange-800 mb-2">Custos Específicos por Cor (Substitui o custo padrão do material)</div>
                  <div className="grid grid-cols-4 gap-3">
                      {formColors.map(color => (
                          <div key={color} className="flex items-center gap-2 bg-white p-2 rounded border border-orange-100">
                              <div className="w-3 h-3 rounded-full border" style={{backgroundColor: colorsMap[color] || '#ccc'}}></div>
                              <span className="text-xs font-bold w-16 truncate" title={color}>{color}:</span>
                              <input type="number" step="0.01" placeholder={mat?.costUnit?.toFixed(2)} className="border rounded p-1 w-20 text-xs" value={item.colorCosts?.[color] || ''} onChange={e => { const newCosts = { ...(item.colorCosts || {}) }; if (e.target.value === '') delete newCosts[color]; else newCosts[color] = parseFloat(e.target.value); onUpdate(idx, 'colorCosts', newCosts); }}/>
                          </div>
                      ))}
                  </div>
              </td>
          </tr>
      )}
    </React.Fragment>
  );
};

const calculatePreviewFinancials = (techPack: TechPack) => {
    const parsePercent = (val: string | number | undefined) => {
        if (!val) return 0;
        if (typeof val === 'number') return val; 
        const str = val.toString().replace('%', '').replace(',', '.').trim();
        return parseFloat(str) || 0;
    };
    const taxesRate = parsePercent(techPack.taxes); 
    const commRate = parsePercent(techPack.commercialExpenses); 
    const taxesDecimal = taxesRate > 1 ? taxesRate / 100 : taxesRate;
    const commDecimal = commRate > 1 ? commRate / 100 : commRate;
    const price = techPack.suggestedPrice || 0;
    const directCost = techPack.totalCost || 0;
    const taxesValue = price * taxesDecimal;
    const commValue = price * commDecimal;
    const totalDeductions = directCost + taxesValue + commValue;
    const netProfit = price - totalDeductions;
    const marginPercent = price > 0 ? (netProfit / price) * 100 : 0;
    return { price, directCost, taxesValue, commValue, netProfit, marginPercent, taxesRate: (taxesDecimal * 100).toFixed(1), commRate: (commDecimal * 100).toFixed(1) };
};

export const TechPackModule: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: products = [], refetch: refetchProducts, isFetching: loadingProducts } = useQuery({ queryKey: ['products'], queryFn: ApiService.getProducts, staleTime: 1000 * 60 * 5 });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: ApiService.getMaterials, staleTime: 1000 * 60 * 10 });
  const { data: standardOps = [] } = useQuery({ queryKey: ['standardOperations'], queryFn: ApiService.getStandardOperations, staleTime: 1000 * 60 * 30 });
  const { data: allSizes = [] } = useQuery({ queryKey: ['standardSizes'], queryFn: ApiService.getStandardSizes, staleTime: Infinity });
  const { data: allColors = [] } = useQuery({ queryKey: ['colors'], queryFn: ApiService.getColors, staleTime: 1000 * 60 * 15 });
  const { data: allObs = [] } = useQuery({ queryKey: ['observations'], queryFn: ApiService.getObservations, staleTime: Infinity });
  const { data: partners = [] } = useQuery({ queryKey: ['partners'], queryFn: ApiService.getPartners, staleTime: 1000 * 60 * 5 });
  
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [selectedTechPackId, setSelectedTechPackId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formTechPack, setFormTechPack] = useState<Partial<TechPack>>({});
  const [formProduct, setFormProduct] = useState<Partial<Product>>({});
  const [initialFormState, setInitialFormState] = useState<string>('');
  const [initialImage, setInitialImage] = useState<string>('');
  const [formProductImage, setFormProductImage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'bom' | 'cuts' | 'ops' | 'measurements' | 'observations' | 'pricing'>('bom');
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{product: Product, techPack: TechPack} | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, type: 'single' | 'bulk', id?: string}>({isOpen: false, type: 'single'});
  const [newExtraCostName, setNewExtraCostName] = useState('');
  const [newExtraCostValue, setNewExtraCostValue] = useState('');
  const [selectedColorToAdd, setSelectedColorToAdd] = useState('');
  const [systemAlert, setSystemAlert] = useState({ isOpen: false, title: '', message: '' });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [overheadRate, setOverheadRate] = useState<string>('');

  useEffect(() => {
      if (isEditing && formTechPack.extraCosts) {
          const overhead = formTechPack.extraCosts.find(c => c.name === 'Rateio Operacional (Custo Fixo)');
          if (overhead) setOverheadRate(overhead.value.toString());
          else setOverheadRate('');
      }
  }, [isEditing, formTechPack.extraCosts]);

  const refreshData = async () => {
      await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['products'] }),
          queryClient.invalidateQueries({ queryKey: ['materials'] })
      ]);
  };

  const colorsMap = useMemo(() => { const map: Record<string, string> = {}; allColors.forEach(c => map[c.name] = c.hex); return map; }, [allColors]);
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
  const toggleProductColor = (colorName: string) => { const currentColors = formProduct.colors || []; let newColors; if(currentColors.includes(colorName)) { newColors = currentColors.filter(c => c !== colorName); } else { newColors = [...currentColors, colorName]; } setFormProduct(prev => ({ ...prev, colors: newColors })); };
  const toggleProductActiveSize = (size: string) => { const currentSizes = formTechPack.activeSizes || []; let newSizes; if (currentSizes.includes(size)) { newSizes = currentSizes.filter(s => s !== size); } else { newSizes = [...currentSizes, size]; } newSizes.sort((a,b) => allSizes.indexOf(a) - allSizes.indexOf(b)); setFormTechPack(prev => ({ ...prev, activeSizes: newSizes })); };
  const toggleObservation = (obsId: string) => { const currentObs = formTechPack.standardObservations || []; let newObs; if (currentObs.includes(obsId)) { newObs = currentObs.filter(id => id !== obsId); } else { newObs = [...currentObs, obsId]; } setFormTechPack(prev => ({ ...prev, standardObservations: newObs })); };
  const toggleSelect = (id: string, e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id] ); };
  const toggleSelectAll = () => { if (selectedProductIds.length === filteredProducts.length) { setSelectedProductIds([]); } else { setSelectedProductIds(filteredProducts.map(p => p.id)); } };
  const handleRequestDelete = (id: string, e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); setDeleteConfirmation({isOpen: true, type: 'single', id}); };
  const handleRequestBulkDelete = () => { setDeleteConfirmation({isOpen: true, type: 'bulk'}); };
  
  const executeDeletion = async () => {
      try {
          if (deleteConfirmation.type === 'single' && deleteConfirmation.id) {
              await ApiService.deleteProduct(deleteConfirmation.id);
              if (viewingProduct?.id === deleteConfirmation.id) { setViewingProduct(null); setIsPreviewOpen(false); }
          } else if (deleteConfirmation.type === 'bulk') {
              await ApiService.deleteProducts(selectedProductIds);
              setSelectedProductIds([]);
          }
          await refreshData();
      } catch (e: any) { alert(e.message); } finally { setDeleteConfirmation({isOpen: false, type: 'single'}); }
  };

  const parseValue = (input: string | undefined, basis: number): { value: number, isPercent: boolean, raw: string } => { if (!input) return { value: 0, isPercent: false, raw: '' }; const clean = input.replace(',', '.').trim(); if (clean.endsWith('%')) { const pct = parseFloat(clean.replace('%', '')); return { value: basis * (pct / 100), isPercent: true, raw: input }; } return { value: parseFloat(clean) || 0, isPercent: false, raw: input }; };

  const calculateTotals = () => {
    const matCost = (formTechPack.materials || []).reduce((acc, item) => { const mat = materials.find(m => m.id === item.materialId); if (!mat) return acc; let basePrice = mat.costUnit; if (item.colorCosts) { const values = Object.values(item.colorCosts) as number[]; if (values.length > 0) basePrice = Math.max(mat.costUnit, ...values); } const cost = basePrice * item.usagePerPiece * (1 + item.wasteMargin); return acc + cost; }, 0);
    const laborCost = (formTechPack.operations || []).reduce((acc, op) => { if (op.laborType === 'Terceirizado' && op.negotiatedPrice) { return acc + op.negotiatedPrice; } const costPerMin = op.costPerMinute || 0.5; return acc + (op.standardTimeMinutes * costPerMin); }, 0);
    const extraCostTotal = (formTechPack.extraCosts || []).filter(ex => ex.name !== 'Rateio Operacional (Custo Fixo)').reduce((acc, ex) => acc + ex.value, 0);
    const overheadCost = parseFloat(overheadRate) || 0;
    const directCost = matCost + laborCost + extraCostTotal + overheadCost;
    const userDefinedPrice = formTechPack.suggestedPrice || 0;
    const taxParsed = parseValue(formTechPack.taxes || '', userDefinedPrice || directCost); 
    const commParsed = parseValue(formTechPack.commercialExpenses || '', userDefinedPrice || directCost);
    let taxPercent = taxParsed.isPercent ? parseFloat((formTechPack.taxes || '').replace('%','')) : 0;
    let commPercent = commParsed.isPercent ? parseFloat((formTechPack.commercialExpenses || '').replace('%','')) : 0;
    const targetMargin = formTechPack.targetMargin || 0;
    const totalDeductionsPercent = (targetMargin + taxPercent + commPercent) / 100;
    let theoreticalSuggestedPrice = 0;
    if (totalDeductionsPercent < 1) { theoreticalSuggestedPrice = directCost / (1 - totalDeductionsPercent); } else { theoreticalSuggestedPrice = directCost * (1 + totalDeductionsPercent); }
    const currentPrice = userDefinedPrice > 0 ? userDefinedPrice : theoreticalSuggestedPrice;
    const realTaxValue = currentPrice * (taxPercent / 100);
    const realCommValue = currentPrice * (commPercent / 100);
    const totalDeductions = directCost + realTaxValue + realCommValue;
    const realProfitValue = currentPrice - totalDeductions;
    const realProfitMargin = currentPrice > 0 ? (realProfitValue / currentPrice) * 100 : 0;
    return { materialCost: matCost, laborCost, extraCostTotal, overheadCost, directCost, taxValue: realTaxValue, commValue: realCommValue, realProfitValue, realProfitMargin, totalCost: totalDeductions, suggestedPrice: theoreticalSuggestedPrice };
  };

  const handleStartEdit = (techPack?: TechPack, currentImage?: string, productContext?: Product) => {
    const prod = productContext || viewingProduct;
    if (!prod) return;
    setViewingProduct(prod);
    let startData: Partial<TechPack> = {};
    const img = currentImage || prod.imageUrl || '';
    setFormProduct({ id: prod.id, name: prod.name, sku: prod.sku, collection: prod.collection, colors: prod.colors || [] });
    if (techPack) {
      const copy = JSON.parse(JSON.stringify(techPack));
      const maxVersion = Math.max(0, ...(prod.techPacks.map(t => t.version) || []));
      const isDraft = techPack.status === 'rascunho';
      startData = { ...copy, id: isDraft ? techPack.id : undefined, version: isDraft ? techPack.version : maxVersion + 1, status: 'rascunho', isFrozen: false, approvedBy: '', createdAt: isDraft ? techPack.createdAt : new Date().toISOString(), activeSizes: copy.activeSizes || prod.sizes || [], };
    } else {
      startData = { productId: prod.id, version: 1, status: 'rascunho', materials: [], operations: [], measurements: [], secondaryCuts: [], extraCosts: [], activeSizes: prod.sizes || [], standardObservations: [], targetMargin: 0, currentPrice: 0, taxes: '', commercialExpenses: '', createdAt: new Date().toISOString(), salesType: 'Normal' };
    }
    setFormTechPack(startData); setInitialFormState(JSON.stringify(startData)); setFormProductImage(img); setInitialImage(img); setIsPreviewOpen(false); setIsEditing(true); setShowImageMenu(false); setActiveTab('bom');
  };

  const handleOpenPreview = (product: Product, techPack?: TechPack) => {
      let tpToView = techPack;
      // LOGIC FIX: Always prefer the Latest Tech Pack if not explicitly provided
      if (!tpToView && product.techPacks.length > 0) {
          // The API now returns techPacks sorted by version descending.
          // So index 0 is always the absolute latest (even if it's a draft v19)
          const latest = product.techPacks[0];
          tpToView = latest;
      }
      if (tpToView) { setViewingProduct(product); setPreviewData({ product, techPack: tpToView }); setIsPreviewOpen(true); } else { setViewingProduct(product); handleStartEdit(undefined, product.imageUrl, product); }
  };

  const handleExitClick = () => {
      const currentFormStr = JSON.stringify(formTechPack);
      const isDirty = currentFormStr !== initialFormState || formProductImage !== initialImage;
      if (isDirty) { setShowExitModal(true); } else { setIsEditing(false); setFormTechPack({}); window.scrollTo({ top: 0, behavior: 'smooth' }); if (viewingProduct) { const tpToShow = viewingProduct.techPacks.find(t => t.id === formTechPack.id) || viewingProduct.techPacks[0] || (previewData ? previewData.techPack : undefined); if (tpToShow) { setPreviewData({ product: viewingProduct, techPack: tpToShow }); setIsPreviewOpen(true); } } }
  };

  const confirmExit = (action: 'save' | 'discard') => {
      if (action === 'save') { executeSave('rascunho'); } else { setFormTechPack({}); setIsEditing(false); window.scrollTo({ top: 0, behavior: 'smooth' }); if (viewingProduct) { let tpToShow = null; if (previewData && previewData.techPack) { tpToShow = previewData.techPack; } else if (viewingProduct.techPacks.length > 0) { tpToShow = [...viewingProduct.techPacks].sort((a,b) => b.version - a.version)[0]; } if (tpToShow) { setPreviewData({ product: viewingProduct, techPack: tpToShow }); setIsPreviewOpen(true); } } } setShowExitModal(false);
  };

  const updateOverhead = (val: string) => {
      setOverheadRate(val);
      const numVal = parseFloat(val) || 0;
      let newExtras = [...(formTechPack.extraCosts || [])];
      newExtras = newExtras.filter(e => e.name !== 'Rateio Operacional (Custo Fixo)');
      if (numVal > 0) { newExtras.push({ id: 'fixed-overhead', name: 'Rateio Operacional (Custo Fixo)', category: 'Geral', value: numVal }); }
      setFormTechPack(prev => ({ ...prev, extraCosts: newExtras }));
  };

  // --- LÓGICA DE SALVAMENTO CORRIGIDA (UUID + LOGS) ---
  const executeSave = async (status: 'rascunho' | 'aprovado' = 'rascunho') => {
    if (!viewingProduct || !formTechPack.version) return;
    
    const overheadVal = parseFloat(overheadRate) || 0;
    let finalExtras = [...(formTechPack.extraCosts || [])].filter(e => e.name !== 'Rateio Operacional (Custo Fixo)');
    if (overheadVal > 0) { finalExtras.push({ id: 'fixed-overhead', name: 'Rateio Operacional (Custo Fixo)', category: 'Geral', value: overheadVal }); }
    const tempTechPack = { ...formTechPack, extraCosts: finalExtras };
    
    if (!formProduct.colors || formProduct.colors.length === 0) { alert("O Produto precisa ter pelo menos 1 cor cadastrada na aba 'Materiais' antes de salvar."); return; }
    if (!formTechPack.materials || formTechPack.materials.length === 0) { alert("A Ficha Técnica precisa ter pelo menos 1 material (BOM) cadastrado."); return; }

    const totals = calculateTotals();
    const finalPrice = formTechPack.suggestedPrice && formTechPack.suggestedPrice > 0 ? formTechPack.suggestedPrice : totals.suggestedPrice;

    // Use ID atual ou ID temporário para enviar ao método, mas o método sabe lidar.
    const currentId = formTechPack.id || `tp-${Date.now()}`;

    // IMPORTANT: Note that 'productId' here will be updated AFTER saving the product below
    const finalTP: TechPack = {
      ...tempTechPack as TechPack,
      id: currentId,
      productId: viewingProduct.id,
      status: status,
      approvedBy: status === 'aprovado' ? approverName : (status === 'rascunho' ? 'Usuário (Rascunho)' : undefined),
      materialCost: totals.materialCost,
      laborCost: totals.laborCost,
      totalCost: totals.directCost,
      suggestedPrice: finalPrice,
      taxes: formTechPack.taxes,
      commercialExpenses: formTechPack.commercialExpenses,
      isFrozen: status === 'aprovado',
      createdAt: new Date().toISOString()
    };

    const updatedProd = { ...viewingProduct, ...formProduct, imageUrl: formProductImage } as Product;

    // --- EXECUÇÃO DO SALVAMENTO ---
    try {
        // 1. Salva Produto (Atualiza ou Cria e RETORNA UUID REAL)
        const savedProdId = await ApiService.saveProduct(updatedProd);
        
        // 2. Atualiza o TechPack para usar o UUID Real do Produto (Evita erro de FK)
        const tpToSave = { ...finalTP, productId: savedProdId };

        // 3. Salva Ficha (Se ID temporário -> Insert e recebe UUID. Se UUID -> Update)
        const realTechPackId = await ApiService.saveTechPack(tpToSave);

        // 4. Log de Sucesso
        SystemLogService.addLog('success', 'Ficha Salva', `Produto: ${updatedProd.sku}, Versão: ${finalTP.version}, ID: ${realTechPackId}`);

        // 5. Atualiza Estado Local IMEDIATAMENTE com o ID Real para evitar duplicação em cliques subsequentes
        setFormTechPack(prev => ({ ...prev, id: realTechPackId }));
        
        // 6. Atualiza Cache e UI
        await refreshData();
        
        // Reconstrói objeto completo para visualização
        const freshProd = { ...updatedProd, id: savedProdId };
        const freshTP = { ...tpToSave, id: realTechPackId };
        
        setViewingProduct(freshProd);
        setSelectedTechPackId(realTechPackId);
        setPreviewData({ product: freshProd, techPack: freshTP });
        
        setIsApproveModalOpen(false);
        setApproverName('');
        setIsEditing(false);
        setIsPreviewOpen(true); 

        alert(status === 'aprovado' ? 'Ficha Técnica Aprovada com Sucesso!' : 'Rascunho Salvo com Sucesso!');

    } catch (e: any) {
        // Log de Erro
        SystemLogService.addLog('error', 'Falha ao Salvar Ficha', e.message || 'Erro desconhecido de conexão');
        console.error(e);
        alert(`Erro ao salvar: ${e.message}. Verifique os Logs em Configurações.`);
    }
  };

  const handleSaveDraft = () => { executeSave('rascunho'); };
  const handleOpenApproveModal = () => { setIsApproveModalOpen(true); };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const fd = new FormData(e.target as HTMLFormElement);
        const newProd: Partial<Product> = { sku: fd.get('sku') as string, name: fd.get('name') as string, collection: fd.get('collection') as string, status: ProductStatus.ACTIVE, sizes: ['P', 'M', 'G'], colors: [] };
        
        // Usa apiService aqui também
        const id = await ApiService.saveProduct(newProd);
        await refreshData();
        
        const created = { ...newProd, id } as Product;
        setIsNewProductModalOpen(false);
        setViewingProduct(created);
        handleStartEdit(undefined, undefined, created); 
        SystemLogService.addLog('success', 'Produto Criado', `SKU: ${created.sku}`);
    } catch (e: any) {
        SystemLogService.addLog('error', 'Erro Criar Produto', e.message);
        alert(e.message);
    }
  };

  // ... (Resto dos handlers: handleImageUpload, handleBOMUpdate, etc. mantidos iguais) ...
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setFormProductImage(reader.result as string); setShowImageMenu(false); }; reader.readAsDataURL(file); } };
  const handleBOMUpdate = (idx: number, field: keyof BOMItem | 'colorCosts', value: any) => { const newMaterials = [...(formTechPack.materials || [])]; if (field === 'colorCosts') { newMaterials[idx].colorCosts = value; } else { (newMaterials[idx] as any)[field] = value; } setFormTechPack({ ...formTechPack, materials: newMaterials }); };
  const handleBOMRemove = (idx: number) => { const newMaterials = [...(formTechPack.materials || [])]; newMaterials.splice(idx, 1); setFormTechPack({ ...formTechPack, materials: newMaterials }); };
  const handleBack = () => { if (activeTab === 'cuts') setActiveTab('bom'); else if (activeTab === 'ops') setActiveTab('cuts'); else if (activeTab === 'measurements') setActiveTab('ops'); else if (activeTab === 'observations') setActiveTab('measurements'); else if (activeTab === 'pricing') setActiveTab('observations'); };
  const handleNext = () => { if (activeTab === 'bom') { if (!formProduct.colors || formProduct.colors.length === 0) { alert("É obrigatório adicionar pelo menos 1 Cor ao produto antes de avançar."); return; } if (!formTechPack.materials || formTechPack.materials.length === 0) { alert("A lista de materiais (BOM) é obrigatória."); return; } } if (activeTab === 'bom') setActiveTab('cuts'); else if (activeTab === 'cuts') setActiveTab('ops'); else if (activeTab === 'ops') setActiveTab('measurements'); else if (activeTab === 'measurements') setActiveTab('observations'); else if (activeTab === 'observations') setActiveTab('pricing'); else if (activeTab === 'pricing') handleSaveDraft(); };

  // ... (Render Functions mantidos iguais) ...
  const renderBOMEditor = () => (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs"><tr><th className="p-3">Material</th><th className="p-3 w-40">Cor / Variante</th><th className="p-3 text-center w-24">Separação?</th><th className="p-3 w-24 text-center">Consumo</th><th className="p-3 text-center w-16">Unid.</th><th className="p-3 w-24 text-center">Quebra %</th><th className="p-3 text-right">Custo Total</th><th className="p-3 text-center w-24">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{formTechPack.materials?.map((item, idx) => (<BOMRow key={idx} item={item} idx={idx} materials={materials} viewingProduct={viewingProduct} formColors={formProduct.colors || []} onUpdate={handleBOMUpdate} onRemove={handleBOMRemove} colorsMap={colorsMap}/>))}{(!formTechPack.materials || formTechPack.materials.length === 0) && (<tr><td colSpan={8} className="p-8 text-center text-gray-400 italic">Nenhum material adicionado.</td></tr>)}</tbody></table></div>
        <div className="p-4 bg-gray-50 border-t flex flex-col gap-4">
            <div className="border rounded-lg p-3 bg-white"><div className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Palette size={14}/> Gerenciar Cores do Produto</div><div className="flex gap-4 items-start"><div className="flex-1"><div className="flex gap-2 flex-wrap mb-2">{formProduct.colors?.map(c => (<span key={c} className="bg-white border shadow-sm px-3 py-1 rounded-full flex items-center gap-2 text-sm"><div className="w-4 h-4 rounded-full border border-gray-200" style={{backgroundColor: colorsMap[c] || '#ccc'}}></div><span className="font-bold text-gray-700">{c}</span><button onClick={() => toggleProductColor(c)} className="text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full p-0.5"><X size={12}/></button></span>))}{(!formProduct.colors || formProduct.colors.length === 0) && <span className="text-sm text-gray-400 italic py-1">Nenhuma cor selecionada.</span>}</div></div><div className="w-1/3 min-w-[200px] border-l pl-4"><div className="text-xs text-gray-400 mb-2">Adicionar Cor do Cadastro:</div><div className="grid grid-cols-5 gap-2 max-h-24 overflow-y-auto">{allColors.filter(c => !formProduct.colors?.includes(c.name)).map(c => (<button key={c.id} onClick={() => toggleProductColor(c.name)} className="w-8 h-8 rounded-full border border-gray-200 shadow-sm hover:scale-110 transition-transform relative group" style={{backgroundColor: c.hex}} title={c.name}><div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-full text-white"><Plus size={14}/></div></button>))}</div></div></div></div>
            <button onClick={() => { const newMat: BOMItem = { materialId: '', usagePerPiece: 0, wasteMargin: 0, variesWithColor: false }; setFormTechPack({ ...formTechPack, materials: [...(formTechPack.materials || []), newMat] }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center gap-2 w-fit ml-auto"><Plus size={16}/> Adicionar Material à Lista</button>
        </div>
    </div>
  );

  const renderSecondaryCutsEditor = () => (
      <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-700">Cortes Secundários / Partes</h3><button onClick={() => setFormTechPack({...formTechPack, secondaryCuts: [...(formTechPack.secondaryCuts || []), { id: Date.now().toString(), name: '', consumption: 0 }]})} className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline"><Plus size={14}/> Adicionar Parte</button></div>
          <div className="space-y-3">{formTechPack.secondaryCuts?.map((cut, idx) => (<div key={idx} className="flex gap-4 items-center bg-gray-50 p-3 rounded border"><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">Nome da Parte</label><input className="w-full border rounded p-2 text-sm" placeholder="Ex: Gola, Bolso" value={cut.name} onChange={e => { const newCuts = [...(formTechPack.secondaryCuts || [])]; newCuts[idx].name = e.target.value; setFormTechPack({ ...formTechPack, secondaryCuts: newCuts }); }}/></div><div className="w-32"><label className="block text-xs font-bold text-gray-500 mb-1">Consumo (m)</label><input type="number" step="0.01" className="w-full border rounded p-2 text-sm" value={cut.consumption} onChange={e => { const newCuts = [...(formTechPack.secondaryCuts || [])]; newCuts[idx].consumption = parseFloat(e.target.value); setFormTechPack({ ...formTechPack, secondaryCuts: newCuts }); }}/></div><button onClick={() => { const newCuts = [...(formTechPack.secondaryCuts || [])]; newCuts.splice(idx, 1); setFormTechPack({ ...formTechPack, secondaryCuts: newCuts }); }} className="mt-5 text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button></div>))}{(!formTechPack.secondaryCuts || formTechPack.secondaryCuts.length === 0) && (<p className="text-center text-gray-400 text-sm italic py-4">Nenhum corte secundário definido.</p>)}</div>
      </div>
  );

  const renderOpsEditor = () => (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          <div className="lg:col-span-1 bg-white border rounded-xl p-4 h-fit"><h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">Banco de Operações</h3><div className="space-y-2 max-h-[500px] overflow-y-auto">{standardOps.map(op => (<div key={op.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50 cursor-pointer group" onClick={() => { const newOp: Operation = { id: `op-${Date.now()}`, name: op.name, machine: op.machine, standardTimeMinutes: op.standardTimeMinutes || 1, costPerMinute: op.costPerMinute || 0.50, laborType: op.laborType || 'CLT' }; setFormTechPack({ ...formTechPack, operations: [...(formTechPack.operations || []), newOp] }); }}><div><div className="font-bold text-sm text-gray-800">{op.name}</div><div className="text-xs text-gray-500">{op.machine}</div></div><Plus size={16} className="text-blue-600 opacity-0 group-hover:opacity-100"/></div>))}</div></div>
          <div className="lg:col-span-2 bg-white border rounded-xl overflow-hidden flex flex-col"><div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Sequência Operacional</h3><div className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">Tempo Total: {(formTechPack.operations || []).reduce((a,b)=>a+b.standardTimeMinutes,0).toFixed(2)} min</div></div><div className="flex-1 overflow-y-auto p-4 space-y-2">{formTechPack.operations?.map((op, idx) => (<div key={idx} className="flex items-center gap-3 bg-white p-2 border rounded shadow-sm"><span className="font-bold text-gray-400 w-6 text-center">{idx+1}</span><div className="flex-1 grid grid-cols-3 gap-2"><input className="border rounded p-1 text-sm font-bold" value={op.name} onChange={e => { const newOps = [...(formTechPack.operations || [])]; newOps[idx].name = e.target.value; setFormTechPack({...formTechPack, operations: newOps}); }}/> <input className="border rounded p-1 text-sm text-gray-600" value={op.machine} onChange={e => { const newOps = [...(formTechPack.operations || [])]; newOps[idx].machine = e.target.value; setFormTechPack({...formTechPack, operations: newOps}); }}/> <select className="border rounded p-1 text-sm" value={op.laborType} onChange={e => { const newOps = [...(formTechPack.operations || [])]; newOps[idx].laborType = e.target.value as any; setFormTechPack({...formTechPack, operations: newOps}); }}><option value="CLT">Interno (CLT)</option><option value="Terceirizado">Externo (Facção)</option></select></div><div className="w-20"><input type="number" step="0.1" className="border rounded p-1 text-sm w-full text-center" value={op.standardTimeMinutes} onChange={e => { const newOps = [...(formTechPack.operations || [])]; newOps[idx].standardTimeMinutes = parseFloat(e.target.value); setFormTechPack({...formTechPack, operations: newOps}); }}/></div><button onClick={() => { const newOps = [...(formTechPack.operations || [])]; newOps.splice(idx, 1); setFormTechPack({...formTechPack, operations: newOps}); }} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div>))}{(!formTechPack.operations || formTechPack.operations.length === 0) && (<div className="text-center text-gray-400 italic py-10">Adicione operações do banco ao lado.</div>)}</div></div>
      </div>
  );

  const renderMeasurementsEditor = () => (
      <div className="bg-white rounded-xl shadow-sm border p-6"><div className="flex justify-between items-center mb-6"><h3 className="font-bold text-gray-700">Tabela de Medidas</h3><div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-500 uppercase mr-2">Grade Ativa:</span><div className="flex gap-1 border rounded p-1 bg-gray-50">{allSizes.map(s => { const isActive = (formTechPack.activeSizes || []).includes(s); return (<button key={s} onClick={() => toggleProductActiveSize(s)} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${isActive ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-200'}`}>{s}</button>); })}</div></div></div><div className="overflow-x-auto"><table className="w-full text-center text-sm border-collapse"><thead><tr className="bg-gray-100 text-gray-600 font-bold"><th className="p-3 border text-left w-64">Ponto de Medida</th><th className="p-3 border w-24">Tol. (+/-)</th>{formTechPack.activeSizes?.map(s => <th key={s} className="p-3 border w-20">{s}</th>)}<th className="p-3 border w-16"></th></tr></thead><tbody>{formTechPack.measurements?.map((m, idx) => (<tr key={idx}><td className="p-2 border"><input className="w-full border-none outline-none font-bold text-gray-800" placeholder="Ex: Cintura" value={m.name} onChange={e => { const newM = [...(formTechPack.measurements || [])]; newM[idx].name = e.target.value; setFormTechPack({...formTechPack, measurements: newM}); }}/></td><td className="p-2 border"><input type="number" step="0.1" className="w-full text-center border-none outline-none text-gray-500" value={m.tolerance} onChange={e => { const newM = [...(formTechPack.measurements || [])]; newM[idx].tolerance = parseFloat(e.target.value); setFormTechPack({...formTechPack, measurements: newM}); }}/></td>{formTechPack.activeSizes?.map(s => (<td key={s} className="p-2 border"><input type="number" step="0.1" className="w-full text-center border-none outline-none font-medium" value={m.values[s] || ''} onChange={e => { const newM = [...(formTechPack.measurements || [])]; newM[idx].values[s] = parseFloat(e.target.value); setFormTechPack({...formTechPack, measurements: newM}); }}/></td>))}<td className="p-2 border"><button onClick={() => { const newM = [...(formTechPack.measurements || [])]; newM.splice(idx, 1); setFormTechPack({...formTechPack, measurements: newM}); }} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td></tr>))}</tbody></table><button onClick={() => setFormTechPack({...formTechPack, measurements: [...(formTechPack.measurements || []), { id: Date.now().toString(), name: '', tolerance: 0.5, values: {} }]})} className="mt-4 w-full border-2 border-dashed border-gray-300 text-gray-500 py-2 rounded-lg hover:border-blue-300 hover:text-blue-500 font-bold text-sm flex justify-center items-center gap-2"><Plus size={16}/> Adicionar Linha de Medida</button></div></div>
  );

  const renderObservationsEditor = () => {
      const groupedObs: Record<string, StandardObservation[]> = {};
      allObs.forEach(obs => { const cat = obs.category || 'Geral'; if (!groupedObs[cat]) groupedObs[cat] = []; groupedObs[cat].push(obs); });
      return (
          <div className="bg-white rounded-xl shadow-sm border p-6"><h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><ListChecks className="text-purple-600"/> Observações de Produção & Qualidade</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{Object.entries(groupedObs).map(([category, obsList]) => (<div key={category} className="border rounded-xl overflow-hidden"><div className="bg-gray-50 p-3 border-b font-bold text-gray-700 text-sm uppercase">{category}</div><div className="p-3 space-y-2 max-h-60 overflow-y-auto">{obsList.map(obs => { const isSelected = (formTechPack.standardObservations || []).includes(obs.id); return (<div key={obs.id} onClick={() => toggleObservation(obs.id)} className={`p-2 rounded border cursor-pointer text-sm transition-all flex items-start gap-2 ${isSelected ? 'bg-purple-50 border-purple-300 text-purple-800' : 'bg-white border-gray-100 hover:border-gray-300'}`}><div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>{isSelected && <CheckCircle2 size={12} className="text-white"/>}</div><span>{obs.text}</span></div>); })}</div></div>))}</div></div>
      );
  };

  const renderPricingEditor = () => {
      const totals = calculateTotals();
      const pieData = [ { name: 'Materiais', value: totals.materialCost, color: '#3b82f6' }, { name: 'Mão de Obra', value: totals.laborCost, color: '#f59e0b' }, { name: 'Custos Fixos', value: totals.overheadCost + totals.extraCostTotal, color: '#f97316' }, { name: 'Impostos/Com.', value: totals.taxValue + totals.commValue, color: '#ef4444' }, { name: 'Lucro Líquido', value: Math.max(0, totals.realProfitValue), color: '#10b981' } ];
      const priceDiff = totals.suggestedPrice - (formTechPack.suggestedPrice || 0);
      const isUnderPriced = (formTechPack.suggestedPrice || 0) < totals.suggestedPrice;
      return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
              <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border p-6 border-l-4 border-l-orange-500"><h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Activity className="text-orange-600"/> Rateio de Custo Fixo</h3><div className="grid grid-cols-2 gap-4 items-end"><div><label className="block text-xs font-bold text-gray-500 mb-1">Custo Fixo por Peça (R$)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R$</span><input type="number" step="0.01" className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-bold text-gray-700" placeholder="0.00" value={overheadRate} onChange={e => updateOverhead(e.target.value)}/></div></div><div className="text-xs text-gray-500 pb-2">Valor de rateio operacional (aluguel, luz, adm) atribuído a este modelo.</div></div></div>
                  <div className="bg-white rounded-xl shadow-sm border p-6"><h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Markup & Precificação</h3><div className="grid grid-cols-2 gap-4 mb-4"><div><label className="block text-xs font-bold text-gray-500 mb-1">Impostos (%)</label><input className="w-full border rounded p-2" placeholder="Ex: 6%" value={formTechPack.taxes} onChange={e => setFormTechPack({...formTechPack, taxes: e.target.value})}/></div><div><label className="block text-xs font-bold text-gray-500 mb-1">Despesas Comerciais (%)</label><input className="w-full border rounded p-2" placeholder="Ex: 10% (Comissão)" value={formTechPack.commercialExpenses} onChange={e => setFormTechPack({...formTechPack, commercialExpenses: e.target.value})}/></div></div><div className="mb-4"><label className="block text-xs font-bold text-gray-500 mb-1">Margem de Lucro Desejada (%)</label><input type="number" className="w-full border rounded p-2 font-bold text-green-700" value={formTechPack.targetMargin} onChange={e => setFormTechPack({...formTechPack, targetMargin: parseFloat(e.target.value)})}/></div><div className="pt-4 border-t border-gray-100"><label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Flame size={12} className="text-purple-500"/> Prioridade de Venda (Dashboard)</label><select className="w-full border rounded p-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none bg-white" value={formTechPack.salesType || 'Normal'} onChange={e => setFormTechPack({...formTechPack, salesType: e.target.value as any})}><option value="Normal">Normal</option><option value="Vende Bem">Vende Bem</option><option value="Vende Tudo">Vende Muito</option><option value="Hype">Hype (Alta Prioridade)</option></select></div></div>
                  <div className="bg-white rounded-xl shadow-sm border overflow-hidden"><div className="bg-gray-50 p-3 font-bold text-gray-700 text-sm border-b">Raio-X do Custo (Discriminado)</div><table className="w-full text-sm"><tbody className="divide-y divide-gray-100"><tr><td className="p-3 text-gray-600">Matéria Prima</td><td className="p-3 text-right font-medium">R$ {totals.materialCost.toFixed(2)}</td></tr><tr><td className="p-3 text-gray-600">Mão de Obra Direta</td><td className="p-3 text-right font-medium">R$ {totals.laborCost.toFixed(2)}</td></tr><tr><td className="p-3 text-gray-600">Custos Fixos / Indiretos</td><td className="p-3 text-right font-medium">R$ {(totals.overheadCost + totals.extraCostTotal).toFixed(2)}</td></tr><tr className="bg-gray-50 font-bold text-gray-800"><td className="p-3">CUSTO TOTAL DIRETO</td><td className="p-3 text-right">R$ {totals.directCost.toFixed(2)}</td></tr><tr><td className="p-3 text-gray-600">Impostos</td><td className="p-3 text-right text-red-500">- R$ {totals.taxValue.toFixed(2)}</td></tr><tr><td className="p-3 text-gray-600">Comissões/Taxas</td><td className="p-3 text-right text-red-500">- R$ {totals.commValue.toFixed(2)}</td></tr><tr className="bg-green-50 font-bold text-green-800"><td className="p-3">LUCRO LÍQUIDO REAL</td><td className="p-3 text-right">R$ {totals.realProfitValue.toFixed(2)}</td></tr></tbody></table></div>
              </div>
              <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"><div className="p-4 bg-slate-900 text-white font-bold flex justify-between items-center"><span>Composição do Preço</span><span className="text-xs bg-slate-700 px-2 py-1 rounded">Visualização</span></div><div className="p-6 flex flex-col items-center"><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} /><Legend verticalAlign="bottom" height={36}/></PieChart></ResponsiveContainer></div></div></div>
                  <div className="bg-white rounded-xl shadow-sm border p-6"><h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Calculator size={18}/> Simulador de Venda</h3><div className="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200"><div><div className="text-xs font-bold text-gray-500 uppercase">Preço Sugerido (Min)</div><div className="text-xl font-bold text-gray-800">R$ {totals.suggestedPrice.toFixed(2)}</div></div><div className="text-right"><div className="text-xs font-bold text-blue-600 uppercase">Preço Definido</div><div className="relative w-32 mt-1"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span><input type="number" step="0.01" className="w-full border-2 border-blue-500 rounded p-1 pl-8 font-bold text-right text-lg text-blue-700" value={formTechPack.suggestedPrice || ''} onChange={e => setFormTechPack({...formTechPack, suggestedPrice: parseFloat(e.target.value)})}/></div></div></div>{(formTechPack.suggestedPrice || 0) > 0 && (<div className={`p-4 rounded-lg flex items-center justify-between border-l-4 ${isUnderPriced ? 'bg-red-50 border-red-500 text-red-800' : 'bg-green-50 border-green-500 text-green-800'}`}><div className="flex items-center gap-3">{isUnderPriced ? <ArrowDownRight size={24}/> : <ArrowUpRight size={24}/>}<div><div className="font-bold">{isUnderPriced ? 'Preço Abaixo do Ideal' : 'Lucro Potencializado'}</div><div className="text-xs opacity-80">{isUnderPriced ? 'Você está perdendo margem.' : 'Margem acima do esperado.'}</div></div></div><div className="text-right"><div className="font-bold text-lg">{isUnderPriced ? '-' : '+'} R$ {Math.abs(priceDiff).toFixed(2)}</div><div className="text-xs font-bold opacity-70">{Math.abs((priceDiff / totals.suggestedPrice) * 100).toFixed(1)}%</div></div></div>)}</div>
                  <div className="grid grid-cols-2 gap-4 text-center"><div className="p-3 bg-gray-50 rounded border"><div className="text-xs text-gray-500 uppercase font-bold">Margem Real</div><div className={`font-bold text-lg ${totals.realProfitMargin < 0 ? 'text-red-600' : 'text-blue-600'}`}>{totals.realProfitMargin.toFixed(1)}%</div></div><div className="p-3 bg-gray-50 rounded border"><div className="text-xs text-gray-500 uppercase font-bold">Lucro / Peça</div><div className={`font-bold text-lg ${totals.realProfitValue < 0 ? 'text-red-600' : 'text-green-600'}`}>R$ {totals.realProfitValue.toFixed(2)}</div></div></div>
              </div>
          </div>
      );
  };

  const renderTechPackPreview = () => {
      if (!previewData) return null;
      const { product, techPack } = previewData;
      const financials = calculatePreviewFinancials(techPack);
      return (
          <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto font-sans no-print">
              <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-xl"><div className="max-w-[1920px] mx-auto px-6 py-4 flex justify-between items-center"><div className="flex items-center gap-6"><button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><ArrowLeft size={24}/></button><div><h1 className="text-xl font-bold tracking-wide flex items-center gap-3">{product.name} <span className="text-slate-500 font-mono font-normal text-sm border-l border-slate-700 pl-3">{product.sku}</span></h1><div className="flex gap-3 mt-1 text-xs font-bold uppercase tracking-wider text-slate-400 items-center"><span>{product.collection}</span><span className="text-slate-600">•</span><span>Versão {techPack.version}</span><span className="text-slate-600">•</span><span className={techPack.status === 'aprovado' ? 'text-green-400' : 'text-yellow-400'}>{techPack.status}</span>{techPack.status === 'aprovado' && (<><span className="text-slate-600 mx-2">|</span><span className="flex items-center gap-1 text-blue-400 border border-blue-900 bg-blue-900/30 px-2 py-0.5 rounded cursor-help" title="Este é um registro Mestre Protegido. Alterações aqui impactam todo o ERP."><ShieldCheck size={12}/> Módulo Central Protegido</span></>)}</div></div></div><div className="flex gap-3"><button onClick={() => { setIsPreviewOpen(false); handleStartEdit(techPack, product.imageUrl, product); }} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-all"><Edit2 size={16}/> Editar</button><button onClick={() => window.print()} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-900/50"><Printer size={16}/> Imprimir</button></div></div></header>
              <div className="max-w-[1920px] mx-auto p-6 space-y-6">
                  <div className="grid grid-cols-12 gap-6 h-[420px]">
                      <div className="col-span-3 bg-white rounded-3xl border border-gray-200 p-6 shadow-sm flex flex-col relative overflow-hidden group"><div className="flex-1 flex items-center justify-center bg-gray-50 rounded-2xl mb-4 relative overflow-hidden">{product.imageUrl ? (<img src={product.imageUrl} className="w-full h-full object-cover mix-blend-multiply"/>) : (<ImageIcon size={64} className="text-gray-300"/>)}<div className="absolute bottom-3 right-3 bg-white/90 px-3 py-1 rounded-full text-xs font-bold text-gray-600 shadow-sm backdrop-blur-sm">{product.collection}</div></div><div className="flex justify-between items-end"><div><div className="text-xs text-gray-400 font-bold uppercase mb-1">Status</div><div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${techPack.status === 'aprovado' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}><div className={`w-2 h-2 rounded-full ${techPack.status === 'aprovado' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>{techPack.status.toUpperCase()}</div></div><div className="text-right"><div className="text-xs text-gray-400 font-bold uppercase">Data Criação</div><div className="text-sm font-bold text-gray-700">{new Date(techPack.createdAt).toLocaleDateString()}</div></div></div></div>
                      <div className="col-span-6 bg-slate-900 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden flex flex-col justify-between"><div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 -mr-16 -mt-16 pointer-events-none"></div><div className="relative z-10 flex justify-between items-start"><div><h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1 flex items-center gap-2"><DollarSign size={14}/> Engenharia de Custo</h3><div className="text-5xl font-bold tracking-tight mt-2">R$ {financials.price.toFixed(2)}</div><p className="text-slate-400 text-sm mt-1">Preço de Venda Definido</p></div><div className="text-right"><div className={`text-3xl font-bold ${financials.marginPercent > 20 ? 'text-green-400' : 'text-yellow-400'}`}>{financials.marginPercent.toFixed(1)}%</div><div className="text-xs font-bold text-slate-500 uppercase mt-1">Margem Líquida</div></div></div><div className="grid grid-cols-3 gap-8 relative z-10 my-6"><div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50"><div className="text-slate-400 text-xs font-bold uppercase mb-1">Custo Direto</div><div className="text-xl font-bold text-white">R$ {financials.directCost.toFixed(2)}</div></div><div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50"><div className="text-slate-400 text-xs font-bold uppercase mb-1">Impostos/Comissões</div><div className="text-xl font-bold text-red-300">R$ {(financials.taxesValue + financials.commValue).toFixed(2)}</div><div className="text-[10px] text-slate-500 mt-1">Tax: {financials.taxesRate}% | Com: {financials.commRate}%</div></div><div className="bg-green-900/20 p-4 rounded-2xl border border-green-500/20"><div className="text-green-400 text-xs font-bold uppercase mb-1">Lucro Real</div><div className="text-xl font-bold text-green-300">R$ {financials.netProfit.toFixed(2)}</div></div></div><div className="relative z-10"><div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2"><span>Composição do Preço</span></div><div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex"><div style={{width: `${(techPack.materialCost / financials.price)*100}%`}} className="h-full bg-blue-500" title="Matéria Prima"></div><div style={{width: `${(techPack.laborCost / financials.price)*100}%`}} className="h-full bg-indigo-500" title="Mão de Obra"></div><div style={{width: `${((financials.taxesValue+financials.commValue) / financials.price)*100}%`}} className="h-full bg-red-500" title="Impostos"></div><div className="h-full bg-green-500 flex-1" title="Lucro"></div></div><div className="flex gap-4 mt-3 text-[10px] font-bold text-slate-500"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Matéria Prima</div><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Mão de Obra</div><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div> Impostos</div><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> Lucro</div></div></div></div>
                      <div className="col-span-3 bg-white rounded-3xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between"><div><h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><Tag size={14}/> Especificações</h3><div className="space-y-4"><div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><div className="text-xs font-bold text-gray-500 mb-2">GRADE ATIVA</div><div className="flex flex-wrap gap-2">{(techPack.activeSizes || product.sizes).map(s => (<span key={s} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 shadow-sm">{s}</span>))}</div></div><div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><div className="text-xs font-bold text-gray-500 mb-2">VARIANTES</div><div className="flex flex-wrap gap-2">{product.colors.map(c => (<div key={c} className="w-8 h-8 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-200" style={{backgroundColor: colorsMap[c] || '#ccc'}} title={c}></div>))}</div></div></div></div><div className="pt-4 border-t border-gray-100"><div className="flex justify-between items-center text-xs"><span className="text-gray-400 font-bold uppercase">Potencial Venda</span><span className="text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded">{techPack.salesType || 'Normal'}</span></div></div></div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
                      <div className="col-span-4 bg-white rounded-3xl border border-gray-200 p-0 shadow-sm flex flex-col overflow-hidden"><div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings2 size={18} className="text-indigo-600"/> Sequência Operacional</h3><div className="text-xs bg-white border border-gray-200 px-3 py-1 rounded-full font-bold shadow-sm text-gray-600">{techPack.operations.reduce((a,b)=>a+b.standardTimeMinutes,0).toFixed(2)} min</div></div><div className="flex-1 overflow-y-auto p-6 relative"><div className="absolute left-9 top-6 bottom-6 w-0.5 bg-gray-100"></div><div className="space-y-6">{techPack.operations.map((op, idx) => (<div key={idx} className="relative flex items-center gap-4 group"><div className="w-7 h-7 rounded-full bg-white border-2 border-indigo-100 text-[10px] font-bold flex items-center justify-center text-indigo-600 relative z-10 shadow-sm group-hover:border-indigo-500 group-hover:bg-indigo-50 transition-colors">{idx + 1}</div><div className="flex-1 p-3 rounded-xl border border-gray-100 bg-white hover:shadow-md hover:border-indigo-100 transition-all cursor-default"><div className="flex justify-between items-start"><span className="font-bold text-sm text-gray-800">{op.name}</span><span className="text-xs font-mono font-bold text-gray-400">{op.standardTimeMinutes}m</span></div><div className="text-[10px] font-bold text-gray-400 mt-1 flex items-center gap-1 uppercase tracking-wide"><Scissors size={10}/> {op.machine}</div></div></div>))}</div></div></div>
                      <div className="col-span-8 flex flex-col gap-6">
                          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex-1"><div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Layers size={18} className="text-blue-600"/> Consumo de Materiais (BOM)</h3></div><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-white text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100"><tr><th className="px-6 py-4">Material</th><th className="px-6 py-4 text-center">Consumo</th><th className="px-6 py-4 text-center">Quebra</th><th className="px-6 py-4 text-right">Custo Estimado</th></tr></thead><tbody className="divide-y divide-gray-50">{techPack.materials.map((m, i) => { const mat = materials.find(x => x.id === m.materialId); const lineCost = (mat?.costUnit || 0) * m.usagePerPiece * (1 + m.wasteMargin); return (<tr key={i} className="hover:bg-blue-50/30 transition-colors"><td className="px-6 py-4"><div className="font-bold text-gray-800">{mat?.name}</div><div className="text-xs text-gray-400 mt-0.5 font-mono">{mat?.code} {m.colorVariant ? `• ${m.colorVariant}` : ''}</div></td><td className="px-6 py-4 text-center"><span className="font-bold text-gray-700">{m.usagePerPiece}</span> <span className="text-xs text-gray-400">{mat?.unit}</span></td><td className="px-6 py-4 text-center text-xs font-bold text-gray-500 bg-gray-50/50">{(m.wasteMargin * 100).toFixed(0)}%</td><td className="px-6 py-4 text-right font-bold text-gray-700 font-mono">R$ {lineCost.toFixed(3)}</td></tr>); })}</tbody></table></div></div>
                          <div className="grid grid-cols-2 gap-6">
                              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Scissors size={18} className="text-pink-600"/> Cortes Secundários</h3>{techPack.secondaryCuts && techPack.secondaryCuts.length > 0 ? (<div className="space-y-2">{techPack.secondaryCuts.map((cut, idx) => (<div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100"><span className="text-sm font-bold text-gray-700">{cut.name}</span><span className="text-xs bg-white px-2 py-1 rounded border font-mono">{cut.consumption.toFixed(2)}m</span></div>))}</div>) : (<p className="text-xs text-gray-400 italic">Nenhum corte secundário definido.</p>)}</div>
                              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Ruler size={18} className="text-orange-600"/> Medidas Principais (cm)</h3><div className="overflow-x-auto pb-2"><div className="flex gap-4">{techPack.measurements && techPack.measurements.length > 0 ? (techPack.measurements.slice(0, 4).map((m, i) => { const sizeKeys = Object.keys(m.values); let displaySize = sizeKeys[0] || '-'; if (sizeKeys.includes('M')) displaySize = 'M'; else if (sizeKeys.includes('38')) displaySize = '38'; else if (sizeKeys.length > 0) displaySize = sizeKeys[Math.floor(sizeKeys.length / 2)]; return (<div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100 min-w-[140px]"><div className="text-xs font-bold text-gray-400 uppercase mb-2 truncate" title={m.name}>{m.name}</div><div className="flex justify-between items-end"><div><div className="text-xs text-gray-400 mb-0.5">Tam: {displaySize}</div><div className="text-xl font-bold text-gray-800">{m.values[displaySize] || '-'}</div></div><div className="text-[10px] text-gray-400 mb-1 whitespace-nowrap">Tol: ±{m.tolerance}</div></div></div>); })) : (<p className="text-xs text-gray-400 italic">Tabela de medidas vazia.</p>)}</div></div></div>
                          </div>
                          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6"><h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Quote size={18} className="text-gray-500"/> Observações Técnicas</h3>{techPack.standardObservations && techPack.standardObservations.length > 0 ? (<div className="grid grid-cols-2 gap-4">{techPack.standardObservations.map((obsId, i) => { const obsText = allObs.find(o => o.id === obsId)?.text || "Observação não encontrada"; return (<div key={i} className="flex gap-2 items-start text-sm text-gray-600"><div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></div>{obsText}</div>) })}</div>) : (<p className="text-xs text-gray-400 italic">Sem observações registradas.</p>)}</div>
                      </div>
                  </div>
                  <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8"><h3 className="font-bold text-gray-800 mb-8 flex items-center gap-2 text-lg"><GitCommit className="text-slate-500"/> Histórico de Modificações</h3><div className="relative pl-8 border-l-2 border-gray-100 space-y-10"><div className="relative"><div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-blue-600 border-4 border-white shadow-sm"></div><div className="flex justify-between items-start"><div><div className="font-bold text-gray-900 text-sm">Versão Atual ({techPack.version})</div><div className="text-gray-500 text-xs mt-1">Status definido como <span className="font-bold uppercase">{techPack.status}</span></div></div><div className="text-right text-xs text-gray-400"><div className="flex items-center gap-1 justify-end"><User size={12}/> {techPack.approvedBy || 'Sistema'}</div><div className="flex items-center gap-1 justify-end mt-1"><CalendarDays size={12}/> {new Date().toLocaleDateString()}</div></div></div></div><div className="relative opacity-60"><div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-gray-300 border-4 border-white"></div><div className="flex justify-between items-start"><div><div className="font-bold text-gray-900 text-sm">Ficha Técnica Criada</div><div className="text-gray-500 text-xs mt-1">Definição inicial de materiais e operações.</div></div><div className="text-right text-xs text-gray-400"><div className="flex items-center gap-1 justify-end"><User size={12}/> Estilista</div><div className="flex items-center gap-1 justify-end mt-1"><CalendarDays size={12}/> {new Date(techPack.createdAt).toLocaleDateString()}</div></div></div></div></div></div>
                  <div className="text-center py-8 text-slate-400 text-xs uppercase tracking-widest font-bold opacity-50">B-HUB Product Lifecycle Management • {new Date().getFullYear()}</div>
              </div>
          </div>
      );
  };

  const renderProductList = () => (
    <div>
        {selectedProductIds.length > 0 && (<div className="bg-blue-600 text-white p-3 rounded-lg flex justify-between items-center mb-4 shadow-md animate-fade-in no-print sticky top-20 z-30"><div className="flex items-center gap-4"><span className="font-bold ml-2">{selectedProductIds.length} selecionado(s)</span><button onClick={toggleSelectAll} className="text-xs bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded">{selectedProductIds.length === filteredProducts.length ? 'Desmarcar Todos' : 'Selecionar Todos'}</button></div><button onClick={handleRequestBulkDelete} className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded font-bold text-sm flex items-center gap-2"><Trash2 size={16}/> Excluir Selecionados</button></div>)}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(p => {
            const techPacks = p.techPacks || [];
            
            // PRIORITY CHANGE: Always show latest first, even if it's a draft.
            // Since API sorts techPacks by version desc, techPacks[0] is the latest.
            const latest = techPacks.length > 0 ? techPacks[0] : undefined;
            const displayTP = latest; // Simple and correct logic

            const isSelected = selectedProductIds.includes(p.id);
            return (
            <div key={p.id} onClick={() => handleOpenPreview(p, displayTP)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-lg transition-all flex items-start gap-4 group relative ${isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-400'}`}>
                <button type="button" className="absolute top-2 left-2 z-20 p-2 text-gray-400 hover:text-blue-600" onClick={(e) => toggleSelect(p.id, e)}>{isSelected ? (<CheckSquare className="text-blue-600 fill-blue-50" size={20}/>) : (<Square className="text-gray-300 hover:text-gray-500" size={20}/>)}</button>
                <button type="button" className="absolute top-2 right-2 z-20 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" onClick={(e) => handleRequestDelete(p.id, e)} title="Excluir Ficha Técnica"><Trash2 size={18}/></button>
                <div className="relative ml-6"><img src={p.imageUrl} className="w-20 h-20 rounded-lg bg-gray-100 object-cover"/><div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center"><Eye className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md"/></div></div>
                <div className="flex-1 min-w-0 pt-1"><div className="flex justify-between items-start pr-6"><h3 className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{p.name}</h3></div>{displayTP && <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${displayTP.status === 'aprovado' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{displayTP.status === 'rascunho' ? 'Rascunho' : 'Aprovado'} v{displayTP.version}</span>}<div className="text-sm text-gray-500">{p.sku}</div><div className="text-xs text-gray-400 mt-1">{p.collection}</div>
                {displayTP && (<div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs"><div><div className="text-gray-400 font-bold uppercase text-[10px]">Custo Ind.</div><div className="font-bold text-gray-700">R$ {displayTP.totalCost.toFixed(2)}</div></div><div className="text-right"><div className="text-gray-400 font-bold uppercase text-[10px]">Preço Venda</div><div className="font-bold text-blue-600">R$ {(displayTP.suggestedPrice || 0).toFixed(2)}</div></div><div className="col-span-2 flex justify-between items-center mt-1"><div className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${displayTP.salesType === 'Hype' ? 'bg-purple-50 text-purple-700 border-purple-200' : displayTP.salesType === 'Vende Tudo' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}><Flame size={10}/> {displayTP.salesType || 'Normal'}</div><div className={`font-bold ${displayTP.targetMargin > 0 ? 'text-green-600' : 'text-gray-400'}`}>Margem: {displayTP.targetMargin}%</div></div></div>)}
                {!displayTP && (<div className="mt-2 text-right font-bold text-gray-400 text-sm italic">Sem Engenharia</div>)}</div>
            </div>
            )
        })}
        </div>
    </div>
  );

  const renderHistoryModal = () => (
    <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="font-bold text-lg text-gray-800">Histórico de Versões</h3>
                <button onClick={() => setShowHistoryModal(false)}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <p className="text-gray-500 text-sm">Funcionalidade de histórico completo em desenvolvimento.</p>
            </div>
        </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Shirt className="text-purple-600" /> Fichas Técnicas</h1><p className="text-gray-500 text-sm">Biblioteca de produtos e engenharia.</p></div>
        <div className="flex gap-2"><button onClick={refreshData} disabled={loadingProducts} className="bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm" title="Recarregar Dados"><RefreshCw size={18} className={loadingProducts ? 'animate-spin' : ''} /></button><button onClick={() => setIsNewProductModalOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 flex items-center gap-2 shadow-sm"><PackagePlus size={18}/> Novo Modelo</button></div>
      </div>
      <div className="relative no-print"><Search className="absolute left-3 top-3 text-gray-400" size={20}/><input placeholder="Buscar modelo por nome ou SKU..." className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none shadow-sm mb-4 focus:ring-2 focus:ring-purple-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
      <div className="no-print">{loadingProducts ? (<div className="flex justify-center items-center h-64 text-gray-400 gap-2"><RefreshCw className="animate-spin" /> Carregando produtos...</div>) : (renderProductList())}</div>
      {isEditing && (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col animate-fade-in no-print">
          <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm shrink-0">
            <div className="flex items-center gap-4 flex-1">
               <button onClick={handleExitClick} className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Voltar"><ArrowLeft/></button>
               <div className="w-12 h-12 rounded bg-gray-200 overflow-hidden relative group cursor-pointer border hover:border-blue-500 shrink-0" onClick={() => imageInputRef.current?.click()} title="Alterar foto do produto"><input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />{formProductImage ? (<img src={formProductImage} className="w-full h-full object-cover"/>) : (<div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon size={20}/></div>)}<div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white text-[8px] font-bold uppercase">Alterar</div></div>
               <div className="flex flex-col gap-1 flex-1 mr-4"><div className="flex gap-2"><input className="font-bold text-gray-900 text-lg border-b border-dashed border-gray-300 focus:border-blue-500 outline-none bg-transparent w-full" value={formProduct.name || ''} onChange={e => setFormProduct({...formProduct, name: e.target.value})} placeholder="Nome do Produto"/></div><div className="flex gap-2 text-xs"><input className="w-32 border-b border-dashed border-gray-300 focus:border-blue-500 outline-none bg-transparent font-mono text-gray-600" value={formProduct.sku || ''} onChange={e => setFormProduct({...formProduct, sku: e.target.value})} placeholder="SKU"/><span className="text-gray-400">•</span><input className="flex-1 border-b border-dashed border-gray-300 focus:border-blue-500 outline-none bg-transparent text-gray-500" value={formProduct.collection || ''} onChange={e => setFormProduct({...formProduct, collection: e.target.value})} placeholder="Coleção"/><span className={`text-[10px] px-2 py-0.5 rounded ml-2 whitespace-nowrap ${formTechPack.version === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>{formTechPack.version === 1 ? 'Nova Ficha' : `v${formTechPack.version}`}</span></div></div>
            </div>
            <div className="flex items-center gap-3 bg-gray-100 p-1 rounded-lg"><button onClick={() => setActiveTab('bom')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'bom' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>1. Materiais</button><button onClick={() => setActiveTab('cuts')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'cuts' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>2. Cortes</button><button onClick={() => setActiveTab('ops')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'ops' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>3. Operações</button><button onClick={() => setActiveTab('measurements')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'measurements' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>4. Medidas</button><button onClick={() => setActiveTab('observations')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'observations' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>5. Obs</button><button onClick={() => setActiveTab('pricing')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'pricing' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>6. Custo & Preço</button></div>
            <div className="flex gap-2 ml-4"><button onClick={handleSaveDraft} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 flex items-center gap-2 text-sm shadow-sm"><Save size={16}/> Salvar Rascunho</button><button onClick={handleOpenApproveModal} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 text-sm shadow-sm"><CheckCircle2 size={16}/> Aprovar Ficha</button></div>
          </div>
          <div className="flex-1 overflow-hidden bg-gray-50 p-4 lg:p-8"><div className="max-w-7xl mx-auto h-full">{activeTab === 'bom' && renderBOMEditor()}{activeTab === 'cuts' && renderSecondaryCutsEditor()}{activeTab === 'ops' && renderOpsEditor()}{activeTab === 'measurements' && renderMeasurementsEditor()}{activeTab === 'observations' && renderObservationsEditor()}{activeTab === 'pricing' && renderPricingEditor()}</div></div>
          <div className="bg-white border-t p-4 flex justify-between items-center shrink-0"><button onClick={handleBack} disabled={activeTab === 'bom'} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 font-medium"><ChevronLeft size={20}/> Anterior</button><button onClick={handleNext} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm">{activeTab === 'pricing' ? 'Finalizar' : 'Próximo'} {activeTab !== 'pricing' && <ChevronRight size={20}/>}</button></div>
        </div>
      )}
      {isApproveModalOpen && (<div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-scale-in"><h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2"><CheckCircle2 className="text-green-600"/> Aprovar Ficha Técnica</h3><p className="text-sm text-gray-500 mb-4">Ao aprovar, esta versão ({formTechPack.version}) será congelada e definida como oficial para produção.</p><div className="mb-4"><label className="block text-sm font-bold text-gray-700 mb-1">Nome do Responsável</label><input className="w-full border rounded p-2 outline-none focus:border-green-500" placeholder="Quem aprovou?" value={approverName} onChange={e => setApproverName(e.target.value)} autoFocus/></div><div className="flex gap-2 justify-end"><button onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancelar</button><button onClick={() => executeSave('aprovado')} disabled={!approverName.trim()} className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 disabled:opacity-50">Confirmar Aprovação</button></div></div></div>)}
      {showExitModal && (<div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-scale-in border border-gray-100"><div className="flex flex-col items-center text-center mb-6"><div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={24}/></div><h3 className="font-bold text-xl text-gray-900 mb-2">Salvar alterações?</h3><p className="text-gray-500 text-sm">Você tem edições não salvas nesta Ficha Técnica. O que deseja fazer?</p></div><div className="flex flex-col gap-3"><button onClick={() => confirmExit('save')} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md flex items-center justify-center gap-2"><Save size={18}/> Salvar e Sair</button><button onClick={() => confirmExit('discard')} className="w-full py-3 bg-white border-2 border-red-100 text-red-600 rounded-xl font-bold hover:bg-red-50 hover:border-red-200 transition-colors">Descartar e Sair</button><button onClick={() => setShowExitModal(false)} className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm font-medium mt-1">Cancelar (Continuar Editando)</button></div></div></div>)}
      {deleteConfirmation.isOpen && (<div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-t-4 border-red-500 animate-scale-in"><div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><Trash2 size={32}/></div><h3 className="font-bold text-xl text-gray-900 mb-2">{deleteConfirmation.type === 'bulk' ? `Excluir ${selectedProductIds.length} Itens?` : 'Excluir Ficha Técnica?'}</h3><p className="text-gray-500 text-sm mb-6">Esta ação é irreversível. Todos os dados, histórico e versões desta ficha serão apagados permanentemente do sistema.</p><div className="flex gap-3 w-full"><button onClick={() => setDeleteConfirmation({isOpen: false, type: 'single'})} className="flex-1 py-3 border border-gray-300 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button><button onClick={executeDeletion} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md flex items-center justify-center gap-2 transition-colors"><Trash2 size={18}/> Confirmar Exclusão</button></div></div></div></div>)}
      <SystemAlert isOpen={systemAlert.isOpen} title={systemAlert.title} message={systemAlert.message} onClose={() => setSystemAlert({ ...systemAlert, isOpen: false })} />
      {isNewProductModalOpen && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print"><div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full animate-scale-in"><h2 className="text-xl font-bold mb-6 flex items-center gap-2"><PackagePlus className="text-purple-600"/> Novo Modelo</h2><form onSubmit={handleCreateProduct} className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Referência (SKU)</label><input name="sku" placeholder="Ex: CAM-2024-001" className="w-full border rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none uppercase" required /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Nome do Produto</label><input name="name" placeholder="Ex: Camiseta Algodão Premium" className="w-full border rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none" required /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Coleção</label><input name="collection" placeholder="Ex: Verão 2025" className="w-full border rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none" /></div><div className="flex justify-end gap-3 mt-8"><button type="button" onClick={() => setIsNewProductModalOpen(false)} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancelar</button><button type="submit" className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-lg shadow-purple-200">Criar e Iniciar Ficha</button></div></form></div></div>)}
      {isPreviewOpen && renderTechPackPreview()}
      {showHistoryModal && renderHistoryModal()}
    </div>
  );
};
