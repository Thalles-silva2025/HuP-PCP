import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, SubcontractorOrder, Product, ReturnItem, Partner, StandardObservation, Material, ProductionOrderItem } from '../types';
import { ApiService } from '../services/api';
import { Truck, ArrowRight, Printer, X, Undo2, History, LayoutList, Scissors, Factory, Building2, User, AlertTriangle, Save, Grid3X3, ArrowDown, CheckCircle2, Eye, RotateCcw, Trash2, FileText, Package, Filter, Calendar, Info, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
    
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    
    return a.localeCompare(b);
};

// Helper: Normalize status checking
const isStatusCompleted = (status: string) => {
    const s = status?.toLowerCase().trim() || '';
    return s === 'concluido' || s === 'concluído' || s === 'completed';
};

type FilterType = 'ALL' | 'WAITING' | 'SENT' | 'PARTIAL' | 'COMPLETED' | 'LATE';

export const SubcontractorModule: React.FC = () => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const dialog = useDialog();
  const queryClient = useQueryClient();

  // --- REACT QUERY FETCHING (PERFORMANCE) ---
  const { data: ops = [], isLoading: loadingOps } = useQuery({
      queryKey: ['productionOrders'],
      queryFn: ApiService.getProductionOrders,
      staleTime: 1000 * 60 * 5 // 5 min cache
  });

  const { data: osfs = [], isLoading: loadingOsfs } = useQuery({
      queryKey: ['subcontractorOrders'],
      queryFn: ApiService.getSubcontractorOrders,
      staleTime: 1000 * 30 // 30s cache
  });

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: ApiService.getProducts });
  const { data: partners = [] } = useQuery({ queryKey: ['partners'], queryFn: ApiService.getPartners });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: ApiService.getMaterials });
  const { data: observations = [] } = useQuery({ queryKey: ['observations'], queryFn: ApiService.getObservations });

  // Modals
  const [selectedOpForRemessa, setSelectedOpForRemessa] = useState<ProductionOrder | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedOsfForReturn, setSelectedOsfForReturn] = useState<SubcontractorOrder | null>(null);
  const [selectedOsfForView, setSelectedOsfForView] = useState<SubcontractorOrder | null>(null);
  
  // Remessa Generation State
  const [targetPartner, setTargetPartner] = useState<string>('');
  const [isInternalProduction, setIsInternalProduction] = useState(false);
  const [remessaObservation, setRemessaObservation] = useState('');
  const [techPackSnapshot, setTechPackSnapshot] = useState<{materials: any[], observations: string}>({materials: [], observations: ''});

  // Return State
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [conferenteName, setConferenteName] = useState('');
  const [conferenteError, setConferenteError] = useState(false);
  
  // Filters
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  const getProductDisplayName = (productId: string) => {
      const prod = products.find(p => p.id === productId);
      if (prod) return `${prod.sku} - ${prod.name}`;
      return productId;
  };

  const readyToShipOps = useMemo(() => {
      return ops.filter(op => {
          if (op.status === OrderStatus.COMPLETED || op.status === OrderStatus.CANCELLED || op.status === OrderStatus.DRAFT) return false;

          const totalCut = op.cuttingDetails?.jobs?.reduce((acc, job) => acc + job.totalPieces, 0) || 0;
          const opOsfs = osfs.filter(osf => osf.opId === op.id && osf.type !== 'Retrabalho');
          const totalSent = opOsfs.reduce((acc, osf) => acc + (Number(osf.sentQuantity) || 0), 0);
          
          return totalCut > totalSent;
      });
  }, [ops, osfs]);

  const stats = useMemo(() => {
      const allActive = osfs.filter(o => !isStatusCompleted(o.status));
      const allHistory = osfs.filter(o => isStatusCompleted(o.status));
      
      // Calculate Late: Active AND DueDate passed
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const late = allActive.filter(osf => {
          const op = ops.find(o => o.id === osf.opId);
          if (!op || !op.dueDate) return false;
          const due = new Date(op.dueDate);
          return due < today;
      });

      return {
          total: osfs.length,
          awaiting: readyToShipOps.length,
          sent: allActive.filter(o => o.status === 'Enviado' || o.status === 'Parcial').length, // Now includes Partial in "Na Rua" logic concept
          partial: allActive.filter(o => o.status === 'Parcial').length,
          completed: allHistory.length,
          late: late.length
      };
  }, [osfs, readyToShipOps, ops]);

  const displayedOsfs = useMemo(() => {
      let list = osfs;
      const today = new Date();
      today.setHours(0,0,0,0);

      if (activeFilter === 'SENT') {
          // "Na Rua" = Enviado OR Parcial (Anything active outside)
          list = list.filter(o => (o.status === 'Enviado' || o.status === 'Parcial') && !isStatusCompleted(o.status));
      } else if (activeFilter === 'PARTIAL') {
          list = list.filter(o => o.status === 'Parcial');
      } else if (activeFilter === 'COMPLETED') {
          list = list.filter(o => isStatusCompleted(o.status));
      } else if (activeFilter === 'LATE') {
          list = list.filter(osf => {
              const op = ops.find(o => o.id === osf.opId);
              if (!op || !op.dueDate) return false;
              const due = new Date(op.dueDate);
              return !isStatusCompleted(osf.status) && due < today;
          });
      } else {
          // ALL active (default view)
          list = list.filter(o => !isStatusCompleted(o.status));
      }
      
      // ORDERING LOGIC:
      // If completed, sort by Return Date (Most recent first)
      // If active, sort by Sent Date (Most recent first)
      return list.sort((a,b) => {
          const dateA = isStatusCompleted(a.status) ? (a.returnDate || a.sentDate) : a.sentDate;
          const dateB = isStatusCompleted(b.status) ? (b.returnDate || b.sentDate) : b.sentDate;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [osfs, activeFilter, ops]);

  // --- ACTIONS ---

  const getAvailableItemsForOp = (op: ProductionOrder) => {
      let sourceItems: ProductionOrderItem[] = [];
      if (op.cuttingDetails?.jobs && op.cuttingDetails.jobs.length > 0) {
          const gradeMap: Record<string, Record<string, number>> = {};
          op.cuttingDetails.jobs.forEach(job => {
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
          sourceItems = op.items;
      }

      const opOsfs = osfs.filter(osf => osf.opId === op.id);
      const totalCut = sourceItems.reduce((a,b) => a+b.quantity, 0);
      const totalSent = opOsfs.reduce((acc, osf) => acc + (Number(osf.sentQuantity) || 0), 0);
      const remainingQty = Math.max(0, totalCut - totalSent);
      
      const ratio = totalCut > 0 ? remainingQty / totalCut : 0;

      const itemsToSend = sourceItems.map(i => ({
          ...i,
          quantity: Math.ceil(i.quantity * ratio)
      })).filter(i => i.quantity > 0);

      return { itemsToSend, remainingQty, totalCut, totalSent };
  };

  const handleOpenRemessa = (op: ProductionOrder) => {
      const prod = products.find(p => p.id === op.productId);
      const tp = prod?.techPacks.find(t => t.version === op.techPackVersion) || prod?.techPacks[0]; 
      const { itemsToSend, remainingQty } = getAvailableItemsForOp(op);

      const qtyByColor: Record<string, number> = {};
      itemsToSend.forEach(i => {
          qtyByColor[i.color] = (qtyByColor[i.color] || 0) + i.quantity;
      });

      const matSnapshot: any[] = [];
      if (tp && tp.materials) {
          tp.materials.forEach(bom => {
              const mat = materials.find(m => m.id === bom.materialId);
              if (!mat) return;
              
              if (mat.usageStage && mat.usageStage !== 'Facção') {
                  return;
              }
              
              const hasColorVariation = bom.variesWithColor || mat.hasColors;

              if (hasColorVariation) {
                  Object.entries(qtyByColor).forEach(([colorName, colorQty]) => {
                      if (colorQty > 0) {
                          const quantityNeeded = colorQty * bom.usagePerPiece * (1 + bom.wasteMargin);
                          matSnapshot.push({ name: mat.name, code: mat.code, unit: mat.unit, qty: quantityNeeded, color: colorName, type: mat.type, isVariant: true });
                      }
                  });
              } else {
                  const quantityNeeded = remainingQty * bom.usagePerPiece * (1 + bom.wasteMargin);
                  if (quantityNeeded > 0) {
                      matSnapshot.push({ name: mat.name, code: mat.code, unit: mat.unit, qty: quantityNeeded, color: 'Geral (Todas)', type: mat.type, isVariant: false });
                  }
              }
          });
      }

      const tpObsIds = tp?.standardObservations || [];
      const relevantObs = observations.filter(o => tpObsIds.includes(o.id));
      const obsSnapshot = relevantObs.map(o => `• [${o.category?.toUpperCase() || 'GERAL'}] ${o.text}`).join('\n');

      setTechPackSnapshot({ materials: matSnapshot, observations: obsSnapshot || "Nenhuma observação técnica registrada." });
      
      const preDefinedPartner = op.subcontractor && op.subcontractor !== 'Interno' ? op.subcontractor : '';
      setTargetPartner(preDefinedPartner);
      setIsInternalProduction(op.subcontractor === 'Interno');
      setRemessaObservation('');
      
      setSelectedOpForRemessa(op);
  };

  const handleConfirmRemessa = async () => {
      if (!selectedOpForRemessa) return;
      if (!isInternalProduction && !targetPartner) {
          addToast({ type: 'warning', title: 'Atenção', message: 'Selecione uma Facção parceira.' });
          return;
      }

      const { itemsToSend, remainingQty } = getAvailableItemsForOp(selectedOpForRemessa);

      try {
          const partnerId = isInternalProduction ? null : partners.find(p => p.name === targetPartner)?.id;

          const newOsf = await ApiService.createSubcontractorOrder({
              opId: selectedOpForRemessa.id,
              partnerId: partnerId,
              subcontractorName: isInternalProduction ? 'Produção Interna' : targetPartner,
              type: isInternalProduction ? 'Interna' : 'Externa',
              sentQuantity: remainingQty,
              itemsSnapshot: itemsToSend, 
              materialsSnapshot: techPackSnapshot.materials, 
              observations: remessaObservation || techPackSnapshot.observations
          });

          addToast({ type: 'success', title: 'Remessa Criada', message: 'Ordem de serviço gerada com sucesso.' });
          
          queryClient.invalidateQueries({ queryKey: ['subcontractorOrders'] });
          queryClient.invalidateQueries({ queryKey: ['productionOrders'] });
          
          setSelectedOpForRemessa(null);
          setSelectedOsfForView(newOsf); 
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      }
  };

  const handleOpenReturn = (osf: SubcontractorOrder) => {
      setSelectedOsfForReturn(osf);
      const initialItems: ReturnItem[] = (osf.itemsSnapshot || []).map((i: any) => ({
          color: i.color,
          size: i.size,
          quantity: 0,
          type: 'approved'
      }));
      setReturnItems(initialItems);
      setConferenteName(profile?.full_name || '');
      setIsReturnModalOpen(true);
  };

  const updateReturnMatrix = (color: string, size: string, quantity: number) => {
      const newItems = returnItems.map(item => {
          if (item.color === color && item.size === size) {
              return { ...item, quantity };
          }
          return item;
      });
      setReturnItems(newItems);
  };

  const handleConfirmReturn = async () => {
      if (!selectedOsfForReturn) return;
      if (!conferenteName) {
          setConferenteError(true);
          return;
      }

      // Validação de Recebimento
      const currentTotal = returnItems.reduce((a,b) => a+b.quantity, 0);
      const alreadyReceived = selectedOsfForReturn.receivedQuantity || 0;
      const sent = selectedOsfForReturn.sentQuantity;
      
      const isComplete = (alreadyReceived + currentTotal) >= sent;

      const confirmed = await dialog.confirm({
          title: 'Confirmar Recebimento?',
          message: isComplete 
            ? 'Este recebimento completará a remessa. A ordem será CONCLUÍDA.' 
            : `Recebimento PARCIAL (${currentTotal} pçs). A ordem continuará aberta.`,
          type: 'info',
          confirmText: 'Sim, Receber'
      });

      if (!confirmed) return;

      try {
          await ApiService.registerReturn(selectedOsfForReturn.id, returnItems, conferenteName);
          addToast({ type: 'success', title: 'Retorno Registrado', message: 'Estoque e status atualizados.' });
          
          queryClient.invalidateQueries({ queryKey: ['subcontractorOrders'] });
          queryClient.invalidateQueries({ queryKey: ['productionOrders'] });
          
          setIsReturnModalOpen(false);
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      }
  };

  const handleCancelShipment = async (osf: SubcontractorOrder) => {
      if (osf.receivedQuantity > 0) {
          addToast({ type: 'warning', title: 'Ação Bloqueada', message: 'Não é possível cancelar uma remessa que já possui recebimentos. Estorne o recebimento primeiro.' });
          return;
      }

      const confirmed = await dialog.confirm({
          title: 'Cancelar Remessa?',
          message: 'Esta ação excluirá permanentemente a Ordem de Serviço de Facção. O saldo voltará para "Aguardando Envio".',
          type: 'danger',
          confirmText: 'Excluir Remessa'
      });

      if (!confirmed) return;

      try {
          await ApiService.cancelSubcontractorShipment(osf.id);
          addToast({ type: 'success', title: 'Remessa Cancelada', message: 'A ordem foi removida com sucesso.' });
          
          queryClient.invalidateQueries({ queryKey: ['subcontractorOrders'] });
          queryClient.invalidateQueries({ queryKey: ['productionOrders'] });
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      }
  };

  const handleRevertReceipt = async (osf: SubcontractorOrder) => {
      const confirmed = await dialog.confirm({
          title: 'Estornar Recebimento?',
          message: 'Isso desfará a entrada das peças e retornará a ordem para o status "Enviado". A OP voltará para "Em Costura".',
          type: 'warning',
          confirmText: 'Estornar'
      });

      if (!confirmed) return;

      try {
          await ApiService.revertSubcontractorReceipt(osf.id);
          addToast({ type: 'info', title: 'Recebimento Estornado', message: 'Ordem reaberta para conferência.' });
          
          queryClient.invalidateQueries({ queryKey: ['subcontractorOrders'] });
          queryClient.invalidateQueries({ queryKey: ['productionOrders'] });
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      }
  };

  // --- HELPER: RENDER MATRIX GRID FOR REMESSA ---
  const renderRemessaGrid = (items: ProductionOrderItem[]) => {
      const sizes = Array.from(new Set(items.map(i => i.size))).sort(sortSizes);
      const colors = Array.from(new Set(items.map(i => i.color))).sort();

      return (
          <div className="border border-orange-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-center text-sm">
                  <thead className="bg-orange-50 text-orange-900 font-bold">
                      <tr>
                          <th className="p-2 text-left">Cor</th>
                          {sizes.map(s => <th key={s} className="p-2 w-12">{s}</th>)}
                          <th className="p-2 w-16 bg-orange-100 border-l border-orange-200">Qtd</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-100">
                      {colors.map(color => {
                          const rowTotal = items.filter(i => i.color === color).reduce((a,b) => a + b.quantity, 0);
                          return (
                              <tr key={color} className="hover:bg-orange-50/50">
                                  <td className="p-2 text-left font-medium text-gray-700 flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full border border-gray-300" style={{backgroundColor: getColorStyle(color)}}></div>
                                      {color}
                                  </td>
                                  {sizes.map(size => {
                                      const item = items.find(i => i.color === color && i.size === size);
                                      return (
                                          <td key={size} className={`p-2 ${item ? 'text-gray-800 font-bold' : 'text-gray-300'}`}>
                                              {item?.quantity || '-'}
                                          </td>
                                      );
                                  })}
                                  <td className="p-2 font-bold bg-orange-50 border-l border-orange-100 text-orange-800">{rowTotal}</td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      );
  };

  // --- 1. NEW: RENDER REFERENCE GRID (READ-ONLY) FOR RETURN ---
  const renderReferenceSnapshotGrid = () => {
      if (!selectedOsfForReturn || !selectedOsfForReturn.itemsSnapshot) return null;
      
      const items = selectedOsfForReturn.itemsSnapshot;
      const sizes = Array.from(new Set(items.map((i: any) => i.size))).sort(sortSizes);
      const colors: string[] = Array.from(new Set(items.map((i: any) => i.color as string))).sort();

      return (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white mb-6">
              <div className="bg-gray-100 p-2 text-xs font-bold text-gray-500 uppercase border-b border-gray-200 flex justify-between items-center">
                  <span>Grade Enviada (Referência)</span>
                  <span className="text-gray-400">Total Enviado: {selectedOsfForReturn.sentQuantity}</span>
              </div>
              <table className="w-full text-center text-xs opacity-75">
                  <thead className="bg-gray-50 text-gray-600 font-bold">
                      <tr>
                          <th className="p-2 text-left">Cor</th>
                          {sizes.map(s => <th key={s} className="p-2 w-12">{s}</th>)}
                          <th className="p-2 w-16 bg-gray-100 border-l border-gray-200">Env.</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {colors.map(color => {
                          const rowTotal = items.filter((i: any) => i.color === color).reduce((a: any,b: any) => a + b.quantity, 0);
                          return (
                              <tr key={color as string}>
                                  <td className="p-2 text-left font-medium text-gray-600 flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full border border-gray-300" style={{backgroundColor: getColorStyle(color as string)}}></div>
                                      {color}
                                  </td>
                                  {sizes.map(size => {
                                      const item = items.find((i: any) => i.color === color && i.size === size);
                                      return (
                                          <td key={size} className={`p-2 ${item ? 'text-gray-700 font-bold' : 'text-gray-300'}`}>
                                              {item?.quantity || '-'}
                                          </td>
                                      );
                                  })}
                                  <td className="p-2 font-bold bg-gray-50 border-l border-gray-100 text-gray-600">{rowTotal}</td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      );
  };

  // --- 3. HELPER: RENDER MATRIX GRID FOR RECEIVING ---
  const renderReceivingMatrix = () => {
      if (!selectedOsfForReturn) return null;
      
      const itemsSnapshot = selectedOsfForReturn.itemsSnapshot || [];
      // Dados já retornados anteriormente (Acumulado)
      const prevReturnedItems = selectedOsfForReturn.itemsReturned || [];

      const sizes = Array.from(new Set(itemsSnapshot.map((i: any) => i.size))).sort(sortSizes);
      const colors = Array.from(new Set(itemsSnapshot.map((i: any) => i.color as string))).sort();

      return (
          <div className="border border-green-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <table className="w-full text-center text-sm">
                  <thead className="bg-green-50 text-green-900 font-bold">
                      <tr>
                          <th className="p-3 text-left">Cor / Tamanho</th>
                          {sizes.map(s => <th key={s} className="p-2 w-16">{s}</th>)}
                          <th className="p-3 w-20 border-l border-green-200">Digitado</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-green-100">
                      {colors.map(color => {
                          let rowReceivedTotal = 0;
                          return (
                              <tr key={color as string} className="hover:bg-green-50/50 transition-colors">
                                  <td className="p-3 text-left font-bold text-gray-700 flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full border border-gray-300" style={{backgroundColor: getColorStyle(color as string)}}></div>
                                      {color}
                                  </td>
                                  {sizes.map(size => {
                                      // Quanto foi enviado
                                      const plannedItem = itemsSnapshot.find((i: any) => i.color === color && i.size === size);
                                      const totalSent = plannedItem?.quantity || 0;
                                      
                                      // Quanto já foi devolvido ANTES
                                      const prevReturned = prevReturnedItems.find((i: any) => i.color === color && i.size === size)?.quantity || 0;
                                      
                                      // Quanto resta receber
                                      const remainingToReceive = Math.max(0, totalSent - prevReturned);
                                      const isFullyReceived = remainingToReceive === 0;

                                      // Input atual (Sessão atual)
                                      const currentItem = returnItems.find(i => i.color === color && i.size === size);
                                      const currentVal = currentItem?.quantity || 0;
                                      rowReceivedTotal += currentVal;

                                      return (
                                          <td key={size} className="p-1">
                                              {totalSent > 0 ? (
                                                  <div className="relative group">
                                                      <input 
                                                          type="number"
                                                          disabled={isFullyReceived} // Bloqueia se já completou
                                                          className={`w-full text-center font-bold border rounded p-2 outline-none transition-colors text-base
                                                              ${currentVal > remainingToReceive ? 'bg-red-50 border-red-300 text-red-600' : 
                                                                isFullyReceived ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 
                                                                'bg-white border-green-200 text-gray-900 focus:ring-2 focus:ring-green-300'}
                                                          `}
                                                          value={isFullyReceived ? '' : (currentVal === 0 ? '' : currentVal)}
                                                          placeholder={isFullyReceived ? 'OK' : '0'}
                                                          onChange={e => updateReturnMatrix(color as string, size as string, Number(e.target.value))}
                                                      />
                                                      {!isFullyReceived && (
                                                          <div className="text-[10px] text-gray-400 mt-0.5">Resta: {remainingToReceive}</div>
                                                      )}
                                                  </div>
                                              ) : <span className="text-gray-300 text-xs">-</span>}
                                          </td>
                                      );
                                  })}
                                  <td className="p-3 font-bold border-l border-green-200 text-green-800 text-lg">
                                      {rowReceivedTotal}
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      );
  };

  // --- PRINT SHEET RENDERER ---
  const renderPrintSheet = () => {
      if (!selectedOsfForView) return null;
      const op = ops.find(o => o.id === selectedOsfForView.opId);
      const prod = products.find(p => p.id === op?.productId);
      const osf = selectedOsfForView; 
      
      const safeItems = osf.itemsSnapshot || [];
      const safeMaterials = osf.materialsSnapshot || [];

      // SORTING
      const sizes = Array.from(new Set(safeItems.map(i => i.size))).sort(sortSizes);
      const colors = Array.from(new Set(safeItems.map(i => i.color))).sort();

      // LOGIC FOR REWORK LOGS
      const reworkEvents = (op?.events || []).filter(e => e.action.toLowerCase().includes('retrabalho') || e.action.toLowerCase().includes('reprovado') || e.type === 'alert');

      return (
          <div className="bg-white p-8 w-[210mm] min-h-[297mm] mx-auto shadow-2xl printable-sheet text-gray-900 relative font-sans text-xs">
              {/* HEADER */}
              <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
                  <div className="flex flex-col">
                      <h1 className="text-2xl font-extrabold uppercase tracking-tight text-gray-900">
                          Ficha de Produção
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
                  </div>
                  <div className="p-4 bg-white">
                      <h3 className="font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><User size={14}/> Facção / Destino</h3>
                      <div className="text-sm font-bold text-gray-800">{osf.subcontractorName}</div>
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

              {/* MATRIX GRADE (NEW) */}
              <div className="mb-8">
                  <h3 className="font-bold text-gray-800 border-b-2 border-gray-800 mb-2 pb-1 flex items-center gap-2 uppercase">
                      <LayoutList size={14}/> Grade de Envio (Matriz)
                  </h3>
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
                                  const rowTotal = safeItems.filter(i => i.color === color).reduce((a,b) => a + b.quantity, 0);
                                  return (
                                      <tr key={color}>
                                          <td className="p-2 text-left font-bold border-r border-gray-300 flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full border border-gray-400" style={{backgroundColor: getColorStyle(color)}}></div>
                                              {color}
                                          </td>
                                          {sizes.map(size => {
                                              const qty = safeItems.find(i => i.color === color && i.size === size)?.quantity || 0;
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
                                          {safeItems.filter(i => i.size === s).reduce((a,b)=>a+b.quantity, 0)}
                                      </td>
                                  ))}
                                  <td className="p-2 text-base text-black">
                                      {safeItems.reduce((a,b)=>a+b.quantity,0)}
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* MATERIALS - UPDATED VISUALIZATION FOR COLORS */}
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
                              <tr key={idx} className={mat.isVariant ? 'bg-blue-50/20' : ''}>
                                  <td className="p-2 border-r">
                                      <div className="font-bold text-gray-800">{mat.name}</div>
                                      <div className="text-[10px] text-gray-500 font-mono">{mat.code}</div>
                                  </td>
                                  <td className="p-2 border-r">
                                      {mat.isVariant ? (
                                          <div className="flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full border border-gray-400 shadow-sm" style={{backgroundColor: getColorStyle(mat.color)}}></div>
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

              {/* NEW: REWORK LOGS */}
              {reworkEvents.length > 0 && (
                  <div className="mb-8 mt-4">
                      <h3 className="font-bold text-red-800 border-b-2 border-red-800 mb-2 pb-1 flex items-center gap-2 uppercase text-xs">
                          <History size={14}/> Histórico de Ocorrências & Retrabalho
                      </h3>
                      <div className="border border-red-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs text-left">
                              <thead className="bg-red-50 text-red-900 font-bold">
                                  <tr>
                                      <th className="p-2">Data</th>
                                      <th className="p-2">Responsável</th>
                                      <th className="p-2">Ocorrência</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-red-100">
                                  {reworkEvents.map((ev, i) => (
                                      <tr key={i} className="hover:bg-red-50/50">
                                          <td className="p-2 text-gray-500 font-mono">{new Date(ev.date).toLocaleString()}</td>
                                          <td className="p-2 font-bold text-gray-700">{ev.user}</td>
                                          <td className="p-2 text-red-700">{ev.description}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              <div className="mt-auto pt-12 pb-4">
                  <div className="grid grid-cols-2 gap-20">
                      <div className="text-center"><div className="border-b border-black h-8 mb-2"></div><div className="text-xs uppercase font-bold text-gray-800">Expedição Interna</div></div>
                      <div className="text-center"><div className="border-b border-black h-8 mb-2"></div><div className="text-xs uppercase font-bold text-gray-800">Recebido por</div></div>
                  </div>
              </div>
          </div>
      );
  };

  if (loadingOps || loadingOsfs) {
      return (
          <div className="flex h-96 items-center justify-center text-gray-400 gap-2">
              <Loader2 className="animate-spin" size={24}/>
              <span className="font-medium">Carregando módulo de facções...</span>
          </div>
      );
  }

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="text-blue-600" /> Facções & Terceirização
          </h1>
          <p className="text-gray-500 text-sm">Controle de remessas e retorno.</p>
        </div>
      </div>

      {/* KPI DASHBOARD (Clickable Filters) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div 
            onClick={() => setActiveFilter('ALL')}
            className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md ${activeFilter === 'ALL' ? 'ring-2 ring-gray-400' : ''}`}
          >
              <div className="text-xs font-bold text-gray-500 uppercase">Total Histórico</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          </div>
          <div 
            onClick={() => setActiveFilter('WAITING')}
            className={`bg-white p-4 rounded-xl border border-orange-200 border-l-4 border-l-orange-500 shadow-sm cursor-pointer transition-all hover:shadow-md ${activeFilter === 'WAITING' ? 'ring-2 ring-orange-400' : ''}`}
          >
              <div className="text-xs font-bold text-orange-600 uppercase">Aguardando Envio</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.awaiting}</div>
          </div>
          <div 
            onClick={() => setActiveFilter('SENT')}
            className={`bg-white p-4 rounded-xl border border-blue-200 border-l-4 border-l-blue-500 shadow-sm cursor-pointer transition-all hover:shadow-md ${activeFilter === 'SENT' ? 'ring-2 ring-blue-400' : ''}`}
          >
              <div className="text-xs font-bold text-blue-600 uppercase">Na Rua (Ativo)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.sent}</div>
          </div>
          <div 
            onClick={() => setActiveFilter('PARTIAL')}
            className={`bg-white p-4 rounded-xl border border-yellow-200 border-l-4 border-l-yellow-500 shadow-sm cursor-pointer transition-all hover:shadow-md ${activeFilter === 'PARTIAL' ? 'ring-2 ring-yellow-400' : ''}`}
          >
              <div className="text-xs font-bold text-yellow-600 uppercase">Retorno Parcial</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.partial}</div>
          </div>
          <div 
            onClick={() => setActiveFilter('LATE')}
            className={`bg-white p-4 rounded-xl border border-red-200 border-l-4 border-l-red-500 shadow-sm cursor-pointer transition-all hover:shadow-md ${activeFilter === 'LATE' ? 'ring-2 ring-red-400' : ''}`}
          >
              <div className="text-xs font-bold text-red-600 uppercase">Atrasados</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.late}</div>
          </div>
          <div 
            onClick={() => setActiveFilter('COMPLETED')}
            className={`bg-white p-4 rounded-xl border border-green-200 border-l-4 border-l-green-500 shadow-sm cursor-pointer transition-all hover:shadow-md ${activeFilter === 'COMPLETED' ? 'ring-2 ring-green-400' : ''}`}
          >
              <div className="text-xs font-bold text-green-600 uppercase">Concluídos</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.completed}</div>
          </div>
      </div>

      {/* FILTER INDICATOR */}
      {activeFilter !== 'ALL' && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter size={16}/> Filtro Ativo: 
              <span className="font-bold bg-gray-200 px-2 py-0.5 rounded text-gray-800">
                  {activeFilter === 'WAITING' ? 'Aguardando Envio' : 
                   activeFilter === 'SENT' ? 'Na Rua (Ativo)' :
                   activeFilter === 'PARTIAL' ? 'Parcial' : 
                   activeFilter === 'LATE' ? 'Atrasados' : 'Concluídos'}
              </span>
              <button onClick={() => setActiveFilter('ALL')} className="text-xs text-blue-600 hover:underline ml-2">Limpar Filtro</button>
          </div>
      )}

      {/* SECTION 1: CORTES DISPONIVEIS (Table Layout) */}
      {(activeFilter === 'ALL' || activeFilter === 'WAITING') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
                  <Scissors size={18} className="text-orange-600"/>
                  <h3 className="font-bold text-orange-900">Cortes Disponíveis</h3>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-orange-50/50 text-orange-900 font-bold border-b border-orange-100">
                          <tr>
                              <th className="p-4">Data</th>
                              <th className="p-4">Lote</th>
                              <th className="p-4">Produto</th>
                              <th className="p-4">Qtd</th>
                              <th className="p-4 text-right">Ação</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {readyToShipOps.map(op => {
                              const totalCut = op.cuttingDetails?.jobs?.reduce((acc, job) => acc + job.totalPieces, 0) || 0;
                              return (
                                  <tr key={op.id} className="hover:bg-orange-50/30">
                                      <td className="p-4 text-gray-500">{new Date(op.createdAt).toLocaleDateString()}</td>
                                      <td className="p-4 font-mono font-bold text-gray-700">{op.lotNumber}</td>
                                      <td className="p-4 text-gray-600 font-medium uppercase">{getProductDisplayName(op.productId)}</td>
                                      <td className="p-4 font-bold">{totalCut}</td>
                                      <td className="p-4 text-right">
                                          <button 
                                            onClick={() => handleOpenRemessa(op)}
                                            className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md transition-colors text-xs"
                                          >
                                              Gerar Remessa <ArrowRight size={12} className="inline ml-1"/>
                                          </button>
                                      </td>
                                  </tr>
                              )
                          })}
                          {readyToShipOps.length === 0 && (
                              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum corte aguardando envio.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* SECTION 2: EM PRODUÇÃO (Grid Layout) */}
      {activeFilter !== 'WAITING' && (
          <div className="space-y-4">
              <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                  {activeFilter === 'COMPLETED' ? 'Histórico de Remessas' : 'Em Produção'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedOsfs.map(osf => {
                      const op = ops.find(o => o.id === osf.opId);
                      const prodName = getProductDisplayName(op?.productId || '');
                      const opLot = op?.lotNumber || 'N/A'; // 1. REQUEST: ADD OP NUMBER
                      const isCompleted = isStatusCompleted(osf.status);
                      const isSent = osf.status === 'Enviado';

                      // Date / Deadline Logic (New Feature)
                      let deadlineTag = null;
                      if (!isCompleted && op?.dueDate) {
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          const due = new Date(op.dueDate);
                          due.setHours(0,0,0,0);
                          
                          const diffTime = due.getTime() - today.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                          if (diffDays < 0) {
                              deadlineTag = <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200">Atrasado {Math.abs(diffDays)} dias</span>;
                          } else if (diffDays === 0) {
                              deadlineTag = <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200">Entrega Hoje</span>;
                          } else {
                              deadlineTag = <span className="text-[10px] font-bold bg-green-50 text-green-600 px-2 py-0.5 rounded border border-green-200">Restam {diffDays} dias</span>;
                          }
                      }

                      return (
                          <div key={osf.id} className={`bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full ${isCompleted ? 'opacity-80' : ''}`}>
                              <div>
                                  <div className="flex justify-between items-start mb-3">
                                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded uppercase border border-blue-100">
                                          {osf.type}
                                      </span>
                                      <div className="flex flex-col items-end gap-1">
                                          <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${isCompleted ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                              {osf.status}
                                          </span>
                                      </div>
                                  </div>
                                  
                                  {deadlineTag && <div className="mb-2 text-right">{deadlineTag}</div>}

                                  <div className="flex items-center justify-between mb-1">
                                      <h4 className="font-bold text-gray-800">{osf.subcontractorName}</h4>
                                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono font-bold">OP: {opLot}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mb-4 uppercase font-medium">{prodName}</p>
                                  
                                  <div className="flex justify-between text-xs text-gray-500 font-bold mb-4 pt-4 border-t border-gray-100">
                                      <div className="text-center">
                                          <div className="text-[10px] uppercase text-gray-400 mb-1">Enviado</div>
                                          <div className="text-lg text-gray-800">{osf.sentQuantity}</div>
                                      </div>
                                      <div className="text-center">
                                          <div className="text-[10px] uppercase text-gray-400 mb-1">Recebido</div>
                                          <div className={`text-lg ${osf.receivedQuantity < osf.sentQuantity ? 'text-yellow-600' : 'text-green-600'}`}>
                                              {osf.receivedQuantity}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="flex gap-2 mt-2">
                                  <button 
                                    onClick={() => setSelectedOsfForView(osf)}
                                    className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 text-xs font-bold hover:bg-gray-50"
                                  >
                                      Ficha
                                  </button>
                                  {!isCompleted && (
                                      <button 
                                        onClick={() => handleOpenReturn(osf)}
                                        className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-1"
                                      >
                                          <Undo2 size={12}/> Receber
                                      </button>
                                  )}
                                  
                                  {/* NOVOS BOTÕES DE ESTORNO */}
                                  {isSent && (
                                      <button 
                                        onClick={() => handleCancelShipment(osf)}
                                        className="p-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
                                        title="Cancelar Remessa (Excluir)"
                                      >
                                          <Trash2 size={14}/>
                                      </button>
                                  )}
                                  {isCompleted && (
                                      <button 
                                        onClick={() => handleRevertReceipt(osf)}
                                        className="p-2 border border-orange-200 text-orange-500 rounded-lg hover:bg-orange-50"
                                        title="Estornar Recebimento (Desfazer)"
                                      >
                                          <RotateCcw size={14}/>
                                      </button>
                                  )}
                              </div>
                          </div>
                      );
                  })}
                  {displayedOsfs.length === 0 && (
                      <div className="col-span-full py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center text-gray-400">
                          <Truck size={48} className="mx-auto mb-2 opacity-20"/>
                          <p>Nenhuma ordem encontrada com este filtro.</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* REMESSA MODAL - ATUALIZADO COM GRADE MATRIX E TOTAL */}
      {selectedOpForRemessa && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl animate-scale-in flex flex-col max-h-[90vh]">
                  <div className="bg-orange-600 p-4 text-white flex justify-between items-center rounded-t-xl shrink-0">
                      <h3 className="font-bold flex items-center gap-2"><Truck/> Nova Remessa</h3>
                      <button onClick={() => setSelectedOpForRemessa(null)} className="hover:bg-orange-700 p-1 rounded"><X/></button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">
                      <div className="mb-6 bg-gray-50 p-3 rounded border">
                          <div className="grid grid-cols-2 gap-4">
                              <div><div className="text-xs text-gray-500 font-bold uppercase">OP / Lote</div><div className="font-mono font-bold text-lg">{selectedOpForRemessa.lotNumber}</div></div>
                              <div><div className="text-xs text-gray-500 font-bold uppercase">Produto</div><div className="font-bold truncate">{getProductDisplayName(selectedOpForRemessa.productId)}</div></div>
                          </div>
                      </div>

                      {/* AREA DE GRADE E QUANTIDADE (NOVO MATRIX) */}
                      <div className="mb-6 border border-orange-200 rounded-lg overflow-hidden">
                          <div className="bg-orange-100 p-4 border-b border-orange-200 flex justify-between items-center">
                              <span className="text-orange-900 font-bold text-sm">Resumo do Envio</span>
                              <span className="text-orange-800 font-bold text-2xl">
                                  {getAvailableItemsForOp(selectedOpForRemessa).remainingQty} <span className="text-sm font-normal">pçs</span>
                              </span>
                          </div>
                          
                          {/* Use Matrix Grid Helper */}
                          <div className="p-4 bg-white">
                              {renderRemessaGrid(getAvailableItemsForOp(selectedOpForRemessa).itemsToSend)}
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Destino (Facção) <span className="text-red-500">*</span></label>
                              <div className="flex gap-2">
                                  <select 
                                    disabled={isInternalProduction}
                                    className={`flex-1 border rounded p-2 bg-white ${isInternalProduction ? 'bg-gray-100 text-gray-400' : ''}`}
                                    value={targetPartner}
                                    onChange={e => setTargetPartner(e.target.value)}
                                  >
                                      <option value="">Selecione...</option>
                                      {partners.filter((p: any) => p.type === 'Facção' || p.type === 'Outro').map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                                  </select>
                                  <div className="flex items-center gap-2 border px-3 rounded bg-gray-50">
                                      <input type="checkbox" id="chkInternal" checked={isInternalProduction} onChange={e => { setIsInternalProduction(e.target.checked); if(e.target.checked) setTargetPartner('Interno'); else setTargetPartner(''); }} />
                                      <label htmlFor="chkInternal" className="text-sm font-bold text-gray-700 cursor-pointer">Produção Interna</label>
                                  </div>
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Observações da Remessa</label>
                              <textarea 
                                className="w-full border rounded p-2 text-sm h-20" 
                                placeholder="Instruções específicas para este lote..."
                                value={remessaObservation}
                                onChange={e => setRemessaObservation(e.target.value)}
                              />
                          </div>

                          <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 border border-blue-100">
                              <div className="font-bold mb-1 flex items-center gap-2"><FileText size={14}/> Resumo Técnico (Automático)</div>
                              <ul className="list-disc pl-4 text-xs space-y-1">
                                  <li>Insumos calculados conforme Ficha Técnica.</li>
                                  <li>Observações padrão do produto incluídas.</li>
                                  <li>Grade enviada conforme corte realizado.</li>
                              </ul>
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-end gap-3 p-6 pt-4 border-t shrink-0">
                      <button onClick={() => setSelectedOpForRemessa(null)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded">Cancelar</button>
                      <button onClick={handleConfirmRemessa} className="px-6 py-2 bg-orange-600 text-white font-bold rounded hover:bg-orange-700 shadow-md flex items-center gap-2">
                          <CheckCircle2 size={18}/> Confirmar e Gerar OS
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* PRINT MODAL (FICHA) - ATUALIZADO */}
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

      {/* RETURN MODAL */}
      {isReturnModalOpen && selectedOsfForReturn && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl animate-scale-in flex flex-col max-h-[90vh]">
                  <div className="bg-green-600 p-4 text-white flex justify-between items-center shrink-0 rounded-t-xl">
                      <h3 className="font-bold flex items-center gap-2"><Undo2/> Recebimento de Facção</h3>
                      <button onClick={() => setIsReturnModalOpen(false)} className="hover:bg-green-700 p-1 rounded"><X/></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1">
                      <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border">
                          <div><div className="text-xs text-gray-500 uppercase font-bold">Facção</div><div className="font-bold text-gray-800">{selectedOsfForReturn.subcontractorName}</div></div>
                          <div><div className="text-xs text-gray-500 uppercase font-bold">Qtd Enviada</div><div className="font-bold text-gray-800">{selectedOsfForReturn.sentQuantity} pçs</div></div>
                          <div><div className="text-xs text-gray-500 uppercase font-bold">Data Envio</div><div className="font-bold text-gray-800">{new Date(selectedOsfForReturn.sentDate).toLocaleDateString()}</div></div>
                      </div>

                      {/* 1. NEW: REFERENCE GRID (READ-ONLY) */}
                      {renderReferenceSnapshotGrid()}

                      <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2 mt-6"><Grid3X3 size={16}/> Conferência de Retorno (Entrada)</h4>
                      
                      {/* 3. REQUEST: MATRIX RECEIVING GRID (WITH PARTIAL LOGIC) */}
                      <div className="mb-6">
                          {renderReceivingMatrix()}
                      </div>

                      <div className="mb-4">
                          <label className="block text-sm font-bold text-gray-700 mb-1">Responsável pela Conferência <span className="text-red-500">*</span></label>
                          <input 
                            className={`w-full border rounded p-2 ${conferenteError ? 'border-red-500 bg-red-50' : ''}`}
                            value={conferenteName}
                            onChange={e => { setConferenteName(e.target.value); setConferenteError(false); }}
                            placeholder="Nome do conferente"
                          />
                          {conferenteError && <p className="text-xs text-red-500 mt-1">Campo obrigatório.</p>}
                      </div>
                  </div>

                  <div className="bg-gray-50 p-4 border-t flex justify-end gap-3 shrink-0">
                      <button onClick={() => setIsReturnModalOpen(false)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded">Cancelar</button>
                      <button onClick={handleConfirmReturn} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 shadow-md">
                          Confirmar Recebimento
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};