
import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, SubcontractorOrder, Product, ReturnItem, Partner, StandardObservation, Material, ProductionOrderItem } from '../types';
import { ApiService } from '../services/api';
import { Truck, ArrowRight, Printer, X, Undo2, History, LayoutList, Scissors, Factory, Building2, User, AlertTriangle, Save, Grid3X3, ArrowDown, CheckCircle2, Eye, RotateCcw, Trash2, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

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

export const SubcontractorModule: React.FC = () => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [osfs, setOsfs] = useState<SubcontractorOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [observations, setObservations] = useState<StandardObservation[]>([]); 
  const [loading, setLoading] = useState(false);
  
  // Filters & State
  const [cardFilter, setCardFilter] = useState<string>('');

  // Modals
  const [selectedOpForRemessa, setSelectedOpForRemessa] = useState<ProductionOrder | null>(null);
  const [selectedOsfForView, setSelectedOsfForView] = useState<SubcontractorOrder | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedOsfForReturn, setSelectedOsfForReturn] = useState<SubcontractorOrder | null>(null);
  
  // Remessa Generation State
  const [targetPartner, setTargetPartner] = useState<string>('');
  const [isInternalProduction, setIsInternalProduction] = useState(false);
  const [remessaObservation, setRemessaObservation] = useState(''); // NEW FIELD
  const [techPackSnapshot, setTechPackSnapshot] = useState<{materials: any[], observations: string}>({materials: [], observations: ''});

  // Return State
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [conferenteName, setConferenteName] = useState('');
  const [conferenteError, setConferenteError] = useState(false);

  // Derived Matrix Keys for Return Modal
  const [matrixKeys, setMatrixKeys] = useState<{colors: string[], sizes: string[]}>({ colors: [], sizes: [] });

  const loadData = async () => {
    setLoading(true);
    try {
        const [allOps, allOsfs, prods, ptrs, mats, obs] = await Promise.all([
            ApiService.getProductionOrders(),
            ApiService.getSubcontractorOrders(),
            ApiService.getProducts(),
            ApiService.getPartners(),
            ApiService.getMaterials(),
            ApiService.getObservations()
        ]);
        setOps(allOps);
        setOsfs(allOsfs);
        setProducts(prods);
        setPartners(ptrs);
        setMaterials(mats);
        setObservations(obs);
    } catch (err: any) {
        addToast({ type: 'error', title: 'Erro de Carregamento', message: err.message });
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getProductDisplayName = (productId: string) => {
      const prod = products.find(p => p.id === productId);
      if (prod) return `${prod.sku} - ${prod.name}`;
      return productId;
  };

  const readyToShipOps = useMemo(() => {
      return ops.filter(op => {
          const totalCut = op.cuttingDetails?.jobs?.reduce((acc, job) => acc + job.totalPieces, 0) || 0;
          const opOsfs = osfs.filter(osf => osf.opId === op.id && osf.type !== 'Retrabalho'); // Don't count reworks as regular shipments
          const totalSent = opOsfs.reduce((acc, osf) => acc + osf.sentQuantity, 0);
          return totalCut > totalSent && op.status !== OrderStatus.CANCELLED && op.status !== OrderStatus.DRAFT;
      });
  }, [ops, osfs]);

  const activeOsfs = useMemo(() => osfs.filter(o => o.status !== 'Concluido'), [osfs]);
  const historyOsfs = useMemo(() => osfs.filter(o => o.status === 'Concluido'), [osfs]);

  const stats = {
      total: osfs.length,
      awaiting: readyToShipOps.length,
      sent: activeOsfs.filter(o => o.status === 'Enviado').length,
      partial: activeOsfs.filter(o => o.status === 'Parcial').length,
      completed: historyOsfs.length
  };

  // --- ACTIONS ---

  const handleOpenRemessa = (op: ProductionOrder) => {
      const prod = products.find(p => p.id === op.productId);
      const tp = prod?.techPacks.find(t => t.version === op.techPackVersion) || prod?.techPacks[0]; 
      
      const totalCut = op.cuttingDetails?.jobs?.reduce((acc, job) => acc + job.totalPieces, 0) || 0;
      const opOsfs = osfs.filter(osf => osf.opId === op.id);
      const totalSent = opOsfs.reduce((acc, osf) => acc + osf.sentQuantity, 0);
      const remainingQty = Math.max(0, totalCut - totalSent);
      
      // FIX 2: RECONSTRUCT GRADE FROM ACTUAL CUTTING JOBS (NOT PLANNED ITEMS)
      let sourceItems: ProductionOrderItem[] = [];
      
      if (op.cuttingDetails?.jobs && op.cuttingDetails.jobs.length > 0) {
          // Rebuild grade from actual cut
          const gradeMap: Record<string, Record<string, number>> = {};
          
          op.cuttingDetails.jobs.forEach(job => {
              job.layers.forEach(layer => {
                  if (!gradeMap[layer.color]) gradeMap[layer.color] = {};
                  job.matrix.forEach(ratio => {
                      gradeMap[layer.color][ratio.size] = (gradeMap[layer.color][ratio.size] || 0) + (layer.layers * ratio.ratio);
                  });
              });
          });

          // Flatten to items array
          Object.entries(gradeMap).forEach(([color, sizes]) => {
              Object.entries(sizes).forEach(([size, qty]) => {
                  if (qty > 0) sourceItems.push({ color, size, quantity: qty });
              });
          });
      } else {
          // Fallback to planned if no cutting details (should not happen in this module but safe to keep)
          sourceItems = op.items;
      }

      // Calculate ratio if partial shipment (usually 1 if sending full cut)
      const ratio = totalCut > 0 ? remainingQty / totalCut : 0;

      const itemsToSend = sourceItems.map(i => ({
          ...i,
          quantity: Math.ceil(i.quantity * ratio)
      })).filter(i => i.quantity > 0);

      // --- MATERIALS CALCULATION ---
      const qtyByColor: Record<string, number> = {};
      itemsToSend.forEach(i => {
          qtyByColor[i.color] = (qtyByColor[i.color] || 0) + i.quantity;
      });

      const matSnapshot: any[] = [];
      if (tp && tp.materials) {
          tp.materials.forEach(bom => {
              const mat = materials.find(m => m.id === bom.materialId);
              if (!mat) return;
              
              if (bom.variesWithColor) {
                  Object.entries(qtyByColor).forEach(([colorName, colorQty]) => {
                      if (colorQty > 0) {
                          const quantityNeeded = colorQty * bom.usagePerPiece * (1 + bom.wasteMargin);
                          matSnapshot.push({
                              name: mat.name,
                              code: mat.code,
                              unit: mat.unit,
                              qty: quantityNeeded,
                              color: colorName, 
                              type: mat.type,
                              isVariant: true
                          });
                      }
                  });
              } else if (bom.colorVariant && bom.colorVariant !== '' && bom.colorVariant !== 'Geral') {
                  const qtyOfThisColor = qtyByColor[bom.colorVariant] || 0;
                  if (qtyOfThisColor > 0) {
                      const quantityNeeded = qtyOfThisColor * bom.usagePerPiece * (1 + bom.wasteMargin);
                      matSnapshot.push({
                          name: mat.name,
                          code: mat.code,
                          unit: mat.unit,
                          qty: quantityNeeded,
                          color: bom.colorVariant,
                          type: mat.type,
                          isVariant: true
                      });
                  }
              } else {
                  const quantityNeeded = remainingQty * bom.usagePerPiece * (1 + bom.wasteMargin);
                  if (quantityNeeded > 0) {
                      matSnapshot.push({
                          name: mat.name,
                          code: mat.code,
                          unit: mat.unit,
                          qty: quantityNeeded,
                          color: 'Geral (Todas)', 
                          type: mat.type,
                          isVariant: false
                      });
                  }
              }
          });
      }

      const tpObsIds = tp?.standardObservations || [];
      const relevantObs = observations.filter(o => tpObsIds.includes(o.id));
      
      const obsSnapshot = relevantObs
          .sort((a, b) => {
              if (a.category === 'Costura' && b.category !== 'Costura') return -1;
              if (a.category !== 'Costura' && b.category === 'Costura') return 1;
              return 0;
          })
          .map(o => `• [${o.category?.toUpperCase() || 'GERAL'}] ${o.text}`)
          .join('\n');

      setTechPackSnapshot({ 
          materials: matSnapshot, 
          observations: obsSnapshot || "Nenhuma observação de costura/técnica registrada na Ficha Técnica." 
      });
      
      // FIX 1: Check PRE-DEFINED PARTNER
      const preDefinedPartner = op.subcontractor && op.subcontractor !== 'Interno' ? op.subcontractor : '';
      setTargetPartner(preDefinedPartner);
      setIsInternalProduction(op.subcontractor === 'Interno');
      setRemessaObservation(''); // Reset observation
      
      setSelectedOpForRemessa(op);
  };

  const handleConfirmRemessa = async () => {
      if (!selectedOpForRemessa) return;
      if (!isInternalProduction && !targetPartner) {
          addToast({ type: 'warning', title: 'Atenção', message: 'Selecione uma Facção parceira.' });
          return;
      }

      const totalCut = selectedOpForRemessa.cuttingDetails?.jobs?.reduce((acc, job) => acc + job.totalPieces, 0) || 0;
      const opOsfs = osfs.filter(osf => osf.opId === selectedOpForRemessa.id);
      const totalSent = opOsfs.reduce((acc, osf) => acc + osf.sentQuantity, 0);
      const quantityToSend = totalCut - totalSent;
      
      // Calculate ratio based on CUT QUANTITY (Fix 2 continued)
      const ratio = totalCut > 0 ? quantityToSend / totalCut : 0;
      
      // Re-calculate Items Snapshot based on ACTUAL CUT (same logic as handleOpenRemessa)
      let sourceItems: ProductionOrderItem[] = [];
      if (selectedOpForRemessa.cuttingDetails?.jobs && selectedOpForRemessa.cuttingDetails.jobs.length > 0) {
          const gradeMap: Record<string, Record<string, number>> = {};
          selectedOpForRemessa.cuttingDetails.jobs.forEach(job => {
              job.layers.forEach(layer => {
                  if (!gradeMap[layer.color]) gradeMap[layer.color] = {};
                  job.matrix.forEach(ratio => {
                      gradeMap[layer.color][ratio.size] = (gradeMap[layer.color][ratio.size] || 0) + (layer.layers * ratio.ratio);
                  });
              });
          });
          Object.entries(gradeMap).forEach(([color, sizes]) => {
              Object.entries(sizes).forEach(([size, qty]) => {
                  if (qty > 0) sourceItems.push({ color, size, quantity: qty });
              });
          });
      } else {
          sourceItems = selectedOpForRemessa.items;
      }

      const itemsSnapshot = sourceItems.map(i => ({
          color: i.color,
          size: i.size,
          quantity: Math.ceil(i.quantity * ratio)
      })).filter(i => i.quantity > 0);

      try {
          const partnerId = isInternalProduction ? null : partners.find(p => p.name === targetPartner)?.id;

          const newOsf = await ApiService.createSubcontractorOrder({
              opId: selectedOpForRemessa.id,
              partnerId: partnerId,
              subcontractorName: isInternalProduction ? 'Produção Interna' : targetPartner,
              type: isInternalProduction ? 'Interna' : 'Externa',
              sentQuantity: quantityToSend,
              itemsSnapshot: itemsSnapshot, 
              materialsSnapshot: techPackSnapshot.materials, 
              observations: remessaObservation || techPackSnapshot.observations // Use Custom Observation if provided
          });
          
          await loadData();
          setSelectedOpForRemessa(null);
          setSelectedOsfForView(newOsf); 
          addToast({ type: 'success', title: 'Remessa Gerada', message: 'Ficha de Produção criada com materiais separados por cor.' });
      } catch (err: any) {
          addToast({ type: 'error', title: 'Erro', message: err.message });
      }
  };

  const handleCancelShipment = async (osfId: string) => {
      if(!confirm("Deseja estornar este envio? A OP retornará para a Sala de Corte.")) return;
      
      try {
          await ApiService.cancelSubcontractorShipment(osfId);
          await loadData();
          addToast({ type: 'info', title: 'Envio Estornado', message: 'Ordem removida e OP retornada para Corte.' });
      } catch (err: any) {
          addToast({ type: 'error', title: 'Erro', message: err.message });
      }
  };

  const handleOpenReturn = (osf: SubcontractorOrder) => {
      const op = ops.find(o => o.id === osf.opId);
      if (!op) return;

      const itemsSource = (osf as any).itemsSnapshot || (osf as any).items_snapshot || [];
      
      const uniqueColors = Array.from(new Set((itemsSource as ReturnItem[]).map(i => i.color)));
      // SORT SIZES HERE
      const uniqueSizes = Array.from(new Set((itemsSource as ReturnItem[]).map(i => i.size))).sort(sortSizes);
      setMatrixKeys({ colors: uniqueColors, sizes: uniqueSizes });

      const grid: ReturnItem[] = itemsSource.map((i: any) => ({
          color: i.color,
          size: i.size,
          quantity: 0,
          type: 'approved'
      }));

      setReturnItems(grid);
      setConferenteName('');
      setConferenteError(false);
      setSelectedOsfForReturn(osf);
      setIsReturnModalOpen(true);
  };

  const updateMatrixValue = (color: string, size: string, value: number) => {
      setReturnItems(prev => prev.map(item => 
          item.color === color && item.size === size ? { ...item, quantity: value } : item
      ));
  };

  const getReturnQty = (color: string, size: string) => {
      return returnItems.find(i => i.color === color && i.size === size)?.quantity || 0;
  };

  const getSentQty = (color: string, size: string) => {
      const source = (selectedOsfForReturn as any)?.itemsSnapshot || [];
      return source.find((i:any) => i.color === color && i.size === size)?.quantity || 0;
  };

  const handleSaveReturn = async () => {
      if (!selectedOsfForReturn) return;
      if (!conferenteName.trim()) { 
          setConferenteError(true);
          addToast({ type: 'error', title: 'Campo Obrigatório', message: 'Informe o nome do conferente.' });
          return; 
      }

      const totalReturned = returnItems.reduce((a,b) => a + b.quantity, 0);
      if (totalReturned === 0) {
          if(!confirm("O retorno total é 0. Deseja salvar mesmo assim?")) return;
      }

      try {
          await ApiService.registerReturn(selectedOsfForReturn.id, returnItems, conferenteName);
          await loadData();
          setIsReturnModalOpen(false);
          addToast({ type: 'success', title: 'Retorno Registrado', message: 'Ordem atualizada com sucesso.' });
      } catch (err: any) {
          console.error(err);
          addToast({ type: 'error', title: 'Erro ao Salvar', message: err.message });
      }
  };

  // --- INTELLIGENT MATRIX RENDERER ---
  const renderMatrixTable = (items: any[]) => {
      if (!items || items.length === 0) return <p className="text-sm text-gray-500 italic">Nenhum item.</p>;

      // SORT SIZES HERE
      const sizes = Array.from(new Set(items.map(i => i.size))).sort(sortSizes);
      const colors = Array.from(new Set(items.map(i => i.color))).sort();

      return (
          <div className="border border-gray-300 rounded overflow-hidden">
              <table className="w-full text-center text-xs">
                  <thead className="bg-gray-100 font-bold text-gray-800 uppercase">
                      <tr>
                          <th className="p-2 text-left w-32 border-r border-gray-300">Cor / Variante</th>
                          {sizes.map(s => <th key={s} className="p-2 border-r border-gray-300">{s}</th>)}
                          <th className="p-2 bg-gray-200 w-24">Total</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                      {colors.map(color => {
                          const rowTotal = items.filter(i => i.color === color).reduce((a,b) => a + b.quantity, 0);
                          return (
                              <tr key={color}>
                                  <td className="p-2 text-left font-bold border-r border-gray-300 flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full border border-gray-400" style={{backgroundColor: getColorStyle(color)}}></div>
                                      {color}
                                  </td>
                                  {sizes.map(size => {
                                      const qty = items.find(i => i.color === color && i.size === size)?.quantity || 0;
                                      return (
                                          <td key={size} className="p-2 border-r border-gray-300 text-gray-600">
                                              {qty > 0 ? qty : '-'}
                                          </td>
                                      )
                                  })}
                                  <td className="p-2 font-bold bg-gray-50">{rowTotal}</td>
                              </tr>
                          );
                      })}
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                          <td className="p-2 text-left">TOTAL GERAL</td>
                          {sizes.map(s => (
                              <td key={s} className="p-2 border-r border-gray-300 text-gray-700">
                                  {items.filter(i => i.size === s).reduce((a,b)=>a+b.quantity, 0)}
                              </td>
                          ))}
                          <td className="p-2 text-base text-black">
                              {items.reduce((a,b)=>a+b.quantity,0)}
                          </td>
                      </tr>
                  </tbody>
              </table>
          </div>
      );
  };

  const renderPrintSheet = () => {
      if (!selectedOsfForView) return null;
      const op = ops.find(o => o.id === selectedOsfForView.opId);
      const prod = products.find(p => p.id === op?.productId);
      const osf = selectedOsfForView as any; 
      
      const subcontractorName = osf.subcontractorName || osf.partner_name || 'Desconhecido';
      const partnerId = osf.partnerId || osf.partner_id;
      const partnerDetails = partners.find(p => p.id === partnerId || p.name === subcontractorName);

      const safeItems = osf.itemsSnapshot || osf.items_snapshot || [];
      const safeMaterials = osf.materialsSnapshot || osf.materials_snapshot || [];

      // FIX 3: Detect Overcut
      const plannedQty = op?.quantityTotal || 0;
      const sentQty = osf.sentQuantity || 0;
      const diff = sentQty - plannedQty;

      return (
          <div className="bg-white p-8 w-[210mm] min-h-[297mm] mx-auto shadow-2xl printable-sheet text-gray-900 relative font-sans text-xs">
              {/* HEADER */}
              <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
                  <div className="flex flex-col">
                      <h1 className="text-2xl font-extrabold uppercase tracking-tight text-gray-900">
                          {osf.type === 'Retrabalho' ? 'Ficha de Conserto (Retrabalho)' : 'Ficha de Produção'}
                      </h1>
                      <div className="text-gray-500 font-bold uppercase mt-1">OSF #{osf.id.split('-')[0]}</div>
                  </div>
                  <div className="text-right">
                      <div className="font-bold text-lg text-gray-800">{profile?.company_name || "Confecção"}</div>
                      <div className="text-gray-500">{new Date().toLocaleDateString()}</div>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-6 border border-gray-300 rounded-lg overflow-hidden">
                  <div className="p-4 border-r border-gray-300 bg-gray-50">
                      <h3 className="font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><Building2 size={14}/> Remetente</h3>
                      <div className="text-sm font-bold text-gray-800">{profile?.company_name}</div>
                      <div className="text-gray-600 mt-1">{profile?.phone}</div>
                  </div>
                  <div className="p-4 bg-white">
                      <h3 className="font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><User size={14}/> Facção / Destino</h3>
                      <div className="text-sm font-bold text-gray-800">{subcontractorName}</div>
                      <div className="text-gray-600 mt-1">{partnerDetails?.phone}</div>
                  </div>
              </div>

              <div className="flex gap-6 mb-6">
                  {prod?.imageUrl && (
                      <div className="w-24 h-24 border border-gray-300 rounded-lg overflow-hidden shrink-0">
                          <img src={prod.imageUrl} className="w-full h-full object-cover"/>
                      </div>
                  )}
                  <div className="flex-1 grid grid-cols-2 gap-y-2 content-start">
                      <div><span className="font-bold text-gray-500">Produto:</span> <span className="font-bold text-base ml-2">{prod?.name}</span></div>
                      <div><span className="font-bold text-gray-500">SKU:</span> <span className="font-bold ml-2">{prod?.sku}</span></div>
                      <div><span className="font-bold text-gray-500">OP Lote:</span> <span className="bg-gray-100 px-2 rounded font-mono font-bold ml-2">{op?.lotNumber}</span></div>
                      <div><span className="font-bold text-gray-500">Qtd Total:</span> <span className="font-bold ml-2">{osf.sentQuantity} pçs</span></div>
                  </div>
              </div>

              {/* OVERCUT ALERT */}
              {diff > 0 && (
                  <div className="mb-6 p-3 bg-orange-100 border border-orange-300 rounded-lg text-orange-900 flex items-center gap-2 font-bold animate-pulse-slow">
                      <AlertTriangle size={18}/>
                      ATENÇÃO: CORTE AMPLIADO! +{diff} peças além do programado original.
                  </div>
              )}

              {/* MATRIX GRADE (NEW) */}
              <div className="mb-8">
                  <h3 className="font-bold text-gray-800 border-b-2 border-gray-800 mb-2 pb-1 flex items-center gap-2 uppercase">
                      <LayoutList size={14}/> Grade de Envio (Matriz)
                  </h3>
                  {renderMatrixTable(safeItems)}
              </div>

              {/* MATERIALS (COLOR AWARE) */}
              <div className="mb-6">
                  <h3 className="font-bold text-gray-800 border-b-2 border-gray-800 mb-2 pb-1 flex items-center gap-2 uppercase">
                      <Factory size={14}/> Aviamentos & Insumos Enviados
                  </h3>
                  <table className="w-full text-left border border-gray-300">
                      <thead className="bg-gray-100 font-bold text-gray-700">
                          <tr>
                              <th className="p-2 border-r w-5/12">Material / Componente</th>
                              <th className="p-2 border-r w-3/12">Variante / Aplicação</th>
                              <th className="p-2 border-r w-2/12 text-center">Qtd. Enviada</th>
                              <th className="p-2 text-center w-2/12">Conf.</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                          {safeMaterials.slice().sort((a: any, b: any) => (a.color || '').localeCompare(b.color || '')).map((mat: any, idx: number) => (
                              <tr key={idx} className={mat.isVariant ? 'bg-blue-50/30' : ''}>
                                  <td className="p-2 border-r">
                                      <div className="font-bold text-gray-800">{mat.name}</div>
                                      <div className="text-[10px] text-gray-500 font-mono">{mat.code}</div>
                                  </td>
                                  <td className="p-2 border-r">
                                      {mat.isVariant ? (
                                          <div className="flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full border border-gray-300" style={{backgroundColor: getColorStyle(mat.color)}}></div>
                                              <span className="font-bold text-blue-800 uppercase text-[10px]">{mat.color}</span>
                                          </div>
                                      ) : (
                                          <span className="text-[10px] text-gray-500 italic">Geral (Todas)</span>
                                      )}
                                  </td>
                                  <td className="p-2 border-r text-center font-bold">
                                      {(mat.qty || 0).toFixed(2)} {mat.unit}
                                  </td>
                                  <td className="p-2 text-center"><div className="w-4 h-4 border border-gray-400 rounded mx-auto"></div></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              {/* OBSERVATIONS */}
              <div className="mb-8 border-2 border-gray-200 rounded-lg p-4 bg-yellow-50/20">
                  <h3 className="font-bold text-gray-800 uppercase mb-2 flex items-center gap-2 text-xs">
                      <AlertTriangle size={14} className="text-orange-500"/> Observações Técnicas
                  </h3>
                  <div className="text-sm whitespace-pre-line text-gray-700 leading-relaxed min-h-[60px]">
                      {osf.observations || "• Seguir rigorosamente a ficha técnica."}
                  </div>
              </div>

              <div className="mt-auto pt-12 pb-4">
                  <div className="grid grid-cols-2 gap-20">
                      <div className="text-center"><div className="border-b border-black h-8 mb-2"></div><div className="text-xs uppercase font-bold text-gray-800">Expedição Interna</div></div>
                      <div className="text-center"><div className="border-b border-black h-8 mb-2"></div><div className="text-xs uppercase font-bold text-gray-800">Recebido por</div></div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6">
        {/* HEADER & CARDS (SAME AS BEFORE) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Truck className="text-indigo-600" /> Facções & Terceirização</h1>
                <p className="text-gray-500 text-sm">Controle de remessas e retorno.</p>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 no-print">
            {/* Same Cards as previous implementation */}
            <div onClick={() => setCardFilter('')} className="bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer border-gray-500"><div className="text-xs font-bold text-gray-600">Total Histórico</div><div className="font-bold text-lg">{stats.total}</div></div>
            <div onClick={() => setCardFilter('awaiting')} className="bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer border-orange-500"><div className="text-xs font-bold text-orange-600">Aguardando Envio</div><div className="font-bold text-lg">{stats.awaiting}</div></div>
            <div onClick={() => setCardFilter('sent')} className="bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer border-blue-500"><div className="text-xs font-bold text-blue-600">Na Rua (Enviado)</div><div className="font-bold text-lg">{stats.sent}</div></div>
            <div onClick={() => setCardFilter('partial')} className="bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer border-yellow-500"><div className="text-xs font-bold text-yellow-600">Retorno Parcial</div><div className="font-bold text-lg">{stats.partial}</div></div>
            <div onClick={() => setCardFilter('completed')} className="bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer border-green-500"><div className="text-xs font-bold text-green-600">Concluídos</div><div className="font-bold text-lg">{stats.completed}</div></div>
        </div>

        {/* LISTS */}
        <div className="grid grid-cols-1 gap-6 no-print">
            {/* 1. READY TO SHIP */}
            {(!cardFilter || cardFilter === 'awaiting') && (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-orange-50 flex justify-between items-center">
                        <h3 className="font-bold text-orange-800 flex items-center gap-2"><Scissors size={18}/> Cortes Disponíveis</h3>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-orange-100 text-orange-900 font-bold">
                            <tr><th className="p-3">Data</th><th className="p-3">Lote</th><th className="p-3">Produto</th><th className="p-3">Qtd</th><th className="p-3 text-right">Ação</th></tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                            {readyToShipOps.map(op => (
                                <tr key={op.id} className="hover:bg-orange-50/50">
                                    <td className="p-3 text-gray-500">{new Date(op.createdAt).toLocaleDateString()}</td>
                                    <td className="p-3 font-mono font-bold text-gray-800">{op.lotNumber}</td>
                                    <td className="p-3">{getProductDisplayName(op.productId)}</td>
                                    <td className="p-3 font-bold">{op.cuttingDetails?.jobs?.reduce((acc, job) => acc + job.totalPieces, 0)}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => handleOpenRemessa(op)} className="bg-orange-600 text-white px-3 py-1.5 rounded hover:bg-orange-700 font-bold text-xs flex items-center gap-1 ml-auto shadow-sm">
                                            Gerar Remessa <ArrowRight size={14}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 2. ACTIVE ORDERS */}
            {(!cardFilter || ['sent', 'partial'].includes(cardFilter)) && (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-blue-50 flex justify-between items-center"><h3 className="font-bold text-blue-800">Em Produção</h3></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50">
                        {activeOsfs.map(osf => {
                            const isRework = osf.type === 'Retrabalho';
                            return (
                                <div key={osf.id} className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${isRework ? 'border-l-4 border-l-red-500' : ''}`}>
                                    <div className="flex justify-between mb-2">
                                        <span className={`font-bold text-xs px-2 py-1 rounded border ${isRework ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                            {osf.type}
                                        </span>
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${osf.status === 'Parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{osf.status}</span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 mb-1">{osf.subcontractorName}</h4>
                                    <div className="text-xs text-gray-500 mb-3">{getProductDisplayName(ops.find(o => o.id === osf.opId)?.productId || '')}</div>
                                    <div className="flex justify-between items-end border-t pt-3 mt-2">
                                        <div><div className="text-xs text-gray-400 font-bold uppercase">Enviado</div><div className="font-bold text-lg">{osf.sentQuantity}</div></div>
                                        <div className="text-right"><div className="text-xs text-gray-400 font-bold uppercase">Recebido</div><div className="font-bold text-lg text-green-600">{osf.receivedQuantity}</div></div>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => setSelectedOsfForView(osf)} className="flex-1 py-2 border rounded text-xs font-bold text-gray-600 hover:bg-gray-50">Ficha</button>
                                        
                                        {/* REVERT BUTTON (NEW) */}
                                        {osf.receivedQuantity === 0 && (
                                            <button 
                                                onClick={() => handleCancelShipment(osf.id)} 
                                                className="p-2 border border-red-200 bg-red-50 text-red-600 rounded hover:bg-red-100" 
                                                title="Estornar Envio"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        )}

                                        <button onClick={() => handleOpenReturn(osf)} className="flex-1 py-2 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 shadow-sm flex items-center justify-center gap-1"><Undo2 size={12}/> Receber</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* 3. COMPLETED ORDERS (FIXED) */}
            {cardFilter === 'completed' && (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-green-50 flex justify-between items-center">
                        <h3 className="font-bold text-green-800 flex items-center gap-2"><CheckCircle2 size={18}/> Histórico de Concluídos</h3>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-green-100 text-green-900 font-bold">
                            <tr><th className="p-3">Data Retorno</th><th className="p-3">Facção</th><th className="p-3">Produto</th><th className="p-3 text-center">Enviado</th><th className="p-3 text-center">Recebido</th><th className="p-3 text-right">Ação</th></tr>
                        </thead>
                        <tbody className="divide-y divide-green-100">
                            {historyOsfs.map(osf => {
                                return (
                                    <tr key={osf.id} className="hover:bg-green-50/50">
                                        <td className="p-3 text-gray-500">{osf.returnDate ? new Date(osf.returnDate).toLocaleDateString() : '-'}</td>
                                        <td className="p-3 font-bold text-gray-700">{osf.subcontractorName}</td>
                                        <td className="p-3 text-gray-600">{getProductDisplayName(ops.find(o => o.id === osf.opId)?.productId || '')}</td>
                                        <td className="p-3 text-center">{osf.sentQuantity}</td>
                                        <td className="p-3 text-center font-bold text-green-700">{osf.receivedQuantity}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => setSelectedOsfForView(osf)} className="text-blue-600 hover:underline text-xs font-bold flex items-center gap-1 justify-end">
                                                <Eye size={14}/> Ver Ficha
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {historyOsfs.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Nenhum histórico encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {/* MODALS */}
        {selectedOpForRemessa && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                    <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><Truck/> Nova Remessa</h3>
                        <button onClick={() => setSelectedOpForRemessa(null)}><X/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-xs text-yellow-800">
                            <span className="font-bold">Automático:</span> Os insumos e grade serão calculados baseados no corte realizado.
                        </div>
                        <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input type="checkbox" className="w-5 h-5" checked={isInternalProduction} onChange={e => setIsInternalProduction(e.target.checked)}/>
                            <span className="font-bold text-gray-700">Produção Interna?</span>
                        </label>
                        {!isInternalProduction && (
                            <div>
                                {targetPartner && targetPartner !== '' ? (
                                    // FIX 1: READ ONLY PARTNER + OBSERVATION FIELD
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Facção Definida (OP)</label>
                                            <div className="w-full bg-gray-100 border p-3 rounded-lg font-bold text-gray-800">
                                                {targetPartner}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Observações para Ficha <span className="text-gray-400 font-normal">(Opcional)</span></label>
                                            <textarea 
                                                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                                                placeholder="Ex: Cuidado com o viés, atenção ao lote..."
                                                value={remessaObservation}
                                                onChange={e => setRemessaObservation(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Selecione a Facção <span className="text-red-500">*</span></label>
                                        <select className="w-full border p-3 rounded-lg bg-white" value={targetPartner} onChange={e => setTargetPartner(e.target.value)}>
                                            <option value="">Selecione...</option>
                                            {partners.filter(p => p.type === 'Facção' || p.type === 'Outro').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                        <button onClick={handleConfirmRemessa} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg">Confirmar Envio</button>
                    </div>
                </div>
            </div>
        )}

        {selectedOsfForView && (
            <div className="fixed inset-0 bg-gray-600/90 z-[60] flex justify-center overflow-y-auto">
                <div className="relative my-8 animate-fade-in">
                    <div className="absolute -top-10 right-0 flex gap-2 no-print">
                        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-blue-700 flex items-center gap-2"><Printer size={18}/> Imprimir</button>
                        <button onClick={() => setSelectedOsfForView(null)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded shadow font-bold hover:bg-gray-300 flex items-center gap-2"><X size={18}/> Fechar</button>
                    </div>
                    {renderPrintSheet()}
                </div>
            </div>
        )}

        {/* RETURN MODAL - REFACTORED TO MATRIX */}
        {isReturnModalOpen && selectedOsfForReturn && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                    <div className="bg-green-600 p-4 text-white flex justify-between items-center shrink-0">
                        <h3 className="font-bold flex items-center gap-2 text-lg"><Undo2/> Conferência de Retorno (Facção)</h3>
                        <button onClick={() => setIsReturnModalOpen(false)}><X/></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto">
                        
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-gray-50 p-3 rounded-lg border">
                                <div className="text-xs text-gray-500 font-bold uppercase">Facção</div>
                                <div className="font-bold text-gray-800">{selectedOsfForReturn.subcontractorName}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg border text-right">
                                <div className="text-xs text-gray-500 font-bold uppercase">Enviado</div>
                                <div className="font-bold text-lg text-blue-600">{selectedOsfForReturn.sentQuantity} pçs</div>
                            </div>
                        </div>

                        {/* PREVIEW MATRIX (REFERENCE) */}
                        <div className="mb-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                            <h4 className="text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-2"><LayoutList size={14}/> Grade de Envio (Referência)</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-center text-xs opacity-80">
                                    <thead>
                                        <tr className="text-gray-500 border-b border-blue-200">
                                            <th className="text-left py-1">Cor</th>
                                            {matrixKeys.sizes.map(s => <th key={s} className="w-12">{s}</th>)}
                                            <th className="w-12 font-bold">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matrixKeys.colors.map(color => (
                                            <tr key={color}>
                                                <td className="text-left font-bold py-1 text-gray-700">{color}</td>
                                                {matrixKeys.sizes.map(size => {
                                                    const sent = getSentQty(color, size);
                                                    return <td key={size} className={sent > 0 ? "text-blue-700 font-bold" : "text-gray-300"}>{sent || '-'}</td>
                                                })}
                                                <td className="font-bold text-gray-800">{matrixKeys.sizes.reduce((acc, s) => acc + getSentQty(color, s), 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-center mb-4 text-gray-300"><ArrowDown size={24}/></div>

                        {/* MATRIX INPUT */}
                        <div className="mb-6">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-3 flex items-center gap-2"><Grid3X3 size={16}/> Grade de Recebimento (Real)</h4>
                            
                            <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-center text-sm">
                                    <thead className="bg-green-50 text-green-900 font-bold">
                                        <tr>
                                            <th className="p-3 text-left">Cor / Tamanho</th>
                                            {matrixKeys.sizes.map(s => <th key={s} className="p-3 w-16">{s}</th>)}
                                            <th className="p-3 w-20 bg-green-100 border-l border-green-200">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {matrixKeys.colors.map(color => {
                                            const rowTotal = matrixKeys.sizes.reduce((acc, s) => acc + getReturnQty(color, s), 0);
                                            return (
                                                <tr key={color} className="hover:bg-gray-50">
                                                    <td className="p-3 text-left font-medium text-gray-800 flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(color)}}></div>
                                                        {color}
                                                    </td>
                                                    {matrixKeys.sizes.map(size => {
                                                        const sent = getSentQty(color, size);
                                                        const current = getReturnQty(color, size);
                                                        const isFull = current === sent && sent > 0;
                                                        
                                                        return (
                                                            <td key={size} className="p-1">
                                                                {sent > 0 ? (
                                                                    <div className="relative">
                                                                        <input 
                                                                            type="number"
                                                                            min="0"
                                                                            className={`w-full text-center font-bold border rounded p-1.5 outline-none transition-colors
                                                                                ${isFull ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'}
                                                                            `}
                                                                            placeholder="0"
                                                                            value={current === 0 ? '' : current}
                                                                            onChange={(e) => updateMatrixValue(color, size, Number(e.target.value))}
                                                                        />
                                                                        <div className="text-[9px] text-gray-400 mt-0.5 text-center">Env: {sent}</div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-200 text-xs">-</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-3 font-bold bg-gray-50 border-l text-gray-800">{rowTotal}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* Total Row */}
                                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                            <td className="p-3 text-left text-gray-600">TOTAL GERAL</td>
                                            {matrixKeys.sizes.map(s => (
                                                <td key={s} className="p-3 text-gray-700">
                                                    {matrixKeys.colors.reduce((acc, c) => acc + getReturnQty(c, s), 0)}
                                                </td>
                                            ))}
                                            <td className="p-3 text-lg text-green-700">
                                                {returnItems.reduce((a,b) => a + b.quantity, 0)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Conferente <span className="text-red-500">*</span></label>
                            <input className={`w-full border rounded p-3 ${conferenteError ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'}`} placeholder="Quem está recebendo?" value={conferenteName} onChange={e => { setConferenteName(e.target.value); if(e.target.value) setConferenteError(false); }}/>
                            {conferenteError && <p className="text-xs text-red-500 mt-1">Este campo é obrigatório.</p>}
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 border-t text-right shrink-0 flex justify-end gap-3">
                        <button onClick={() => setIsReturnModalOpen(false)} className="px-6 py-2 rounded text-gray-600 font-bold hover:bg-gray-100">Cancelar</button>
                        <button onClick={handleSaveReturn} className="bg-green-600 text-white px-8 py-2 rounded font-bold hover:bg-green-700 shadow-lg flex items-center gap-2">
                            <Save size={18}/> Salvar Retorno
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
