
// ... existing imports ...
import React, { useEffect, useState, useMemo } from 'react';
import { ProductionOrder, OrderStatus, SubcontractorOrder, Product, ReturnItem, Partner, StandardObservation, ProductionOrderItem, Material } from '../types';
import { MockService } from '../services/mockDb';
import { Truck, CheckCircle2, AlertTriangle, ArrowRight, Printer, X, FileText, Undo2, Save, History, ClipboardList, UserCheck, MoreVertical, RotateCcw, Filter, Search, Calendar, Infinity, Share2, Link, MapPin, Phone, FileBox, LayoutList, Clock, Scissors } from 'lucide-react';
import { ModernDatePicker } from './ModernDatePicker';

// ... (No change to interface DateRange or main logic up to renderPrintableOsf)

interface DateRange {
    label: string;
    days: number | 'custom' | 'all';
    start: Date;
    end: Date;
}

export const SubcontractorModule: React.FC = () => {
  // ... (State logic unchanged until renderPrintableOsf)
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [osfs, setOsfs] = useState<SubcontractorOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [observations, setObservations] = useState<StandardObservation[]>([]);
  
  // State for filters
  const [dateRange, setDateRange] = useState<DateRange>({
      label: 'Últimos 30 dias',
      days: 30,
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date()
  });
  const [filters, setFilters] = useState({
      search: '',
      type: 'ALL', // ALL, INTERNAL, EXTERNAL
      partnerId: ''
  });
  // NEW: Card Filter Status
  const [cardFilter, setCardFilter] = useState<string>('');

  // Filtered lists
  const [filteredCutOps, setFilteredCutOps] = useState<ProductionOrder[]>([]);
  const [filteredActiveOsfs, setFilteredActiveOsfs] = useState<SubcontractorOrder[]>([]);
  const [filteredCompletedOsfs, setFilteredCompletedOsfs] = useState<SubcontractorOrder[]>([]);

  // Modal State
  const [selectedOpForPrint, setSelectedOpForPrint] = useState<ProductionOrder | null>(null); // For Confirmation Modal (Creating new)
  const [selectedOsfForPrint, setSelectedOsfForPrint] = useState<SubcontractorOrder | null>(null); // For Actual Document Print (Viewing)
  
  // New State for Mandatory Partner Selection
  const [targetPartner, setTargetPartner] = useState<string>('');

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedOsfForReturn, setSelectedOsfForReturn] = useState<SubcontractorOrder | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [opGridRef, setOpGridRef] = useState<ProductionOrderItem[]>([]); 
  const [conferenteName, setConferenteName] = useState('');
  const [conferenteError, setConferenteError] = useState(false); 
  const [activeMenuOsfId, setActiveMenuOsfId] = useState<string | null>(null);

  const loadData = async () => {
    const allOps = await MockService.getProductionOrders();
    const prods = await MockService.getProducts();
    const ptrs = await MockService.getPartners();
    const allOsfs = await MockService.getSubcontractorOrders();
    const obs = await MockService.getObservations();
    const mats = await MockService.getMaterials();
    
    setProducts(prods);
    setPartners(ptrs);
    setObservations(obs);
    setMaterials(mats);
    setOps(allOps);
    setOsfs(allOsfs);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- STATS CALCULATION ---
  const osfStats = useMemo(() => {
      let total = 0;
      let awaiting = 0;
      let sent = 0;
      let partial = 0;
      let completed = 0;

      // Calculate Awaiting Shipment from OPs
      awaiting = ops.filter(op => op.status === OrderStatus.CUTTING).length;

      osfs.forEach(osf => {
          total++;
          if (osf.status === 'Enviado') sent++;
          else if (osf.status === 'Parcial') partial++;
          else if (osf.status === 'Concluido') completed++;
      });

      // Total includes historical OSFs + current backlog (awaiting)
      return { total: total + awaiting, awaiting, sent, partial, completed };
  }, [osfs, ops]);

  // --- FILTERING LOGIC ---
  useEffect(() => {
      filterData();
  }, [ops, osfs, dateRange, filters, cardFilter]);

  const filterData = () => {
      const start = new Date(dateRange.start);
      start.setHours(0,0,0,0);
      const end = new Date(dateRange.end);
      end.setHours(23,59,59,999);

      // 1. Filter Ready to Ship (CUTTING status)
      // Uses CreatedAt for date filter as they are not sent yet
      const readyToShip = ops.filter(op => {
          const isStatus = op.status === OrderStatus.CUTTING;
          const d = new Date(op.createdAt);
          const dateMatch = d >= start && d <= end;
          
          const partnerName = op.subcontractor || '';
          const isInternal = partnerName.toLowerCase().includes('interno') || partnerName.toLowerCase().includes('interna');
          const typeMatch = 
            filters.type === 'ALL' ? true :
            filters.type === 'INTERNAL' ? isInternal : !isInternal; // EXTERNAL

          const searchMatch = !filters.search || 
            op.lotNumber.toLowerCase().includes(filters.search.toLowerCase()) || 
            op.productId.toLowerCase().includes(filters.search.toLowerCase()) ||
            partnerName.toLowerCase().includes(filters.search.toLowerCase());

          // Partner ID check (if specific partner selected)
          const partnerMatch = !filters.partnerId || 
            partners.find(p => p.id === filters.partnerId)?.name === partnerName;

          return isStatus && dateMatch && typeMatch && searchMatch && partnerMatch;
      });
      setFilteredCutOps(readyToShip);

      // 2. Filter OSFs (Active & Completed)
      // Uses SentDate for date filter
      const filterOsf = (osf: SubcontractorOrder) => {
          const d = new Date(osf.sentDate);
          const dateMatch = d >= start && d <= end;

          const partnerName = osf.subcontractorName || '';
          const isInternal = partnerName.toLowerCase().includes('interno') || partnerName.toLowerCase().includes('interna');
          const typeMatch = 
            filters.type === 'ALL' ? true :
            filters.type === 'INTERNAL' ? isInternal : !isInternal;

          const searchMatch = !filters.search || 
            osf.id.toLowerCase().includes(filters.search.toLowerCase()) ||
            osf.opId.toLowerCase().includes(filters.search.toLowerCase()) ||
            partnerName.toLowerCase().includes(filters.search.toLowerCase());

          const partnerMatch = !filters.partnerId || 
            partners.find(p => p.id === filters.partnerId)?.name === partnerName;

          // CARD FILTER
          const statusMatch = !cardFilter || cardFilter === 'AguardandoEnvio' ? true : osf.status === cardFilter;

          return dateMatch && typeMatch && searchMatch && partnerMatch && statusMatch;
      };

      const active = osfs.filter(osf => osf.status !== 'Concluido' && filterOsf(osf));
      const completed = osfs.filter(osf => osf.status === 'Concluido' && filterOsf(osf));

      setFilteredActiveOsfs(active);
      setFilteredCompletedOsfs(completed);
  };

  // ... (Keep Open Modal functions unchanged) ...
  const openPrintModal = (op: ProductionOrder) => {
      setTargetPartner(op.subcontractor || '');
      setSelectedOpForPrint(op);
  };

  const openOsfPrintModal = async (osf: SubcontractorOrder) => {
      setSelectedOsfForPrint(osf); 
  };

  const handleConfirmSend = async () => {
    if(!selectedOpForPrint) return;
    if (!targetPartner || targetPartner.trim() === '') {
        alert("É OBRIGATÓRIO informar a Facção/Destino para gerar a remessa.");
        return;
    }
    const newOsf = await MockService.createSubcontractorOrder({
      opId: selectedOpForPrint.id,
      subcontractorName: targetPartner, 
      sentQuantity: selectedOpForPrint.quantityTotal
    });
    setSelectedOpForPrint(null); 
    await loadData();
    setSelectedOsfForPrint(newOsf);
  };

  const handleReverseShipment = async (osf: SubcontractorOrder) => {
      setActiveMenuOsfId(null);
      if(!confirm(`Tem certeza que deseja cancelar a Remessa ${osf.id}? A OP voltará para o setor de Corte.`)) return;
      try {
          await MockService.cancelSubcontractorShipment(osf.id);
          loadData();
          alert('Remessa estornada com sucesso.');
      } catch (err: any) {
          alert(err.message);
      }
  };

  const openReturnModal = (osf: SubcontractorOrder) => {
      MockService.getProductionOrderById(osf.opId).then(op => {
          if(!op) return;
          setOpGridRef(op.items);
          const initialItems: ReturnItem[] = op.items.map(i => ({
              color: i.color,
              size: i.size,
              quantity: 0,
              type: 'approved'
          }));
          setReturnItems(initialItems);
          setConferenteName('');
          setConferenteError(false);
          setSelectedOsfForReturn(osf);
          setIsReturnModalOpen(true);
      });
  };

  const handleSaveReturn = async () => {
      if(!selectedOsfForReturn) return;
      if(!conferenteName.trim()) {
          setConferenteError(true);
          return;
      }
      const errors: string[] = [];
      returnItems.forEach(item => {
          const original = opGridRef.find(i => i.color === item.color && i.size === item.size);
          const maxAllowed = original ? original.quantity : 0;
          if (item.quantity > maxAllowed) {
              errors.push(`- ${item.color} / ${item.size}: Informado ${item.quantity} (Máx OP: ${maxAllowed})`);
          }
      });
      if (errors.length > 0) {
          alert(`ERRO: Devolução fora da grade da OP!\n\n${errors.join('\n')}`);
          return;
      }
      await MockService.registerReturn(selectedOsfForReturn.id, returnItems, conferenteName);
      setIsReturnModalOpen(false);
      loadData();
      alert('Retorno registrado! Saldo pendente gerou nova OSF Filha.');
  };

  const updateReturnQty = (idx: number, field: 'quantity', value: number) => {
      const newItems = [...returnItems];
      newItems[idx][field] = value;
      setReturnItems(newItems);
  };

  const handleCopyLink = (osf: SubcontractorOrder) => {
      if (!osf.externalToken) {
          alert('Token não gerado para esta ordem.');
          return;
      }
      const baseUrl = window.location.href.split('#')[0];
      const portalUrl = `${baseUrl}#/portal/${osf.externalToken}`;
      navigator.clipboard.writeText(portalUrl).then(() => {
          alert(`Link do Portal copiado!\n\nEnvie para o parceiro:\n${portalUrl}`);
          setActiveMenuOsfId(null);
      });
  };

  // ... (renderPrintableOsf unchanged) ...
  const renderPrintableOsf = () => {
      if (!selectedOsfForPrint) return null;
      const op = ops.find(o => o.id === selectedOsfForPrint.opId);
      const prod = products.find(p => p.id === op?.productId);
      const partner = partners.find(p => p.name === selectedOsfForPrint.subcontractorName);
      const items = op?.items || [];
      const sizes = Array.from(new Set(items.map(i => i.size))).sort();
      const colors = Array.from(new Set(items.map(i => i.color)));
      const tp = prod?.techPacks.find(t => t.version === op?.techPackVersion);
      const calculatedMaterials: any[] = [];
      if (tp && op) {
          tp.materials.forEach(bom => {
              const mat = materials.find(m => m.id === bom.materialId);
              if (mat) {
                  const qtyNeeded = bom.usagePerPiece * op.quantityTotal;
                  let displayMaterialName = mat.name;
                  if (bom.materialVariantName) {
                      displayMaterialName += ` (${bom.materialVariantName})`;
                  }
                  calculatedMaterials.push({
                      name: displayMaterialName,
                      unit: mat.unit,
                      qty: qtyNeeded,
                      color: bom.colorVariant || 'Geral'
                  });
              }
          });
      }

      return (
          <div className="w-[210mm] min-h-[297mm] bg-white p-12 mx-auto shadow-2xl printable-sheet text-gray-900 font-sans relative">
              <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
                  <div className="flex gap-4">
                      {prod?.imageUrl && (
                          <img src={prod.imageUrl} className="w-24 h-24 object-cover border border-gray-200 rounded"/>
                      )}
                      <div>
                          <h1 className="text-2xl font-bold uppercase tracking-wide mb-1">Ficha de Produção / Remessa</h1>
                          <div className="text-xs font-bold text-gray-500 uppercase">Ordem de Serviço de Facção (OSF)</div>
                          <div className="mt-2 text-4xl font-mono font-bold text-gray-900">{selectedOsfForPrint.id}</div>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className="text-sm font-bold">Data Emissão: {new Date(selectedOsfForPrint.sentDate).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500 mt-1">Lote OP: {op?.lotNumber}</div>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="border border-gray-300 rounded p-3 bg-gray-50">
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Truck size={12}/> Destinatário (Facção)</h3>
                      <div className="text-lg font-bold mb-1">{selectedOsfForPrint.subcontractorName}</div>
                      <div className="text-sm text-gray-600">{partner?.address || 'Endereço não cadastrado'}</div>
                      <div className="text-sm text-gray-600 flex gap-4 mt-1">
                          <span>Tel: {partner?.phone || '-'}</span>
                          <span>CNPJ: {partner?.cnpj || '-'}</span>
                      </div>
                  </div>
                  <div className="border border-gray-300 rounded p-3">
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><FileBox size={12}/> Produto</h3>
                      <div className="text-lg font-bold mb-1">{prod?.sku}</div>
                      <div className="text-sm text-gray-700">{prod?.name}</div>
                      <div className="text-sm text-gray-500 mt-1">Coleção: {prod?.collection}</div>
                  </div>
              </div>
              <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-800 uppercase mb-2 border-b border-gray-300 pb-1">Grade de Envio (Cores x Tamanhos)</h3>
                  <table className="w-full text-center border-collapse border border-gray-300 text-sm">
                      <thead className="bg-gray-200 font-bold">
                          <tr>
                              <th className="border border-gray-300 p-2 text-left">Cor</th>
                              {sizes.map(s => <th key={s} className="border border-gray-300 p-2 w-16">{s}</th>)}
                              <th className="border border-gray-300 p-2 w-20 bg-gray-300">Total</th>
                          </tr>
                      </thead>
                      <tbody>
                          {colors.map(c => {
                              const rowTotal = items.filter(i => i.color === c).reduce((a,b) => a + b.quantity, 0);
                              return (
                                  <tr key={c}>
                                      <td className="border border-gray-300 p-2 text-left font-bold">{c}</td>
                                      {sizes.map(s => {
                                          const qty = items.find(i => i.color === c && i.size === s)?.quantity;
                                          return <td key={s} className="border border-gray-300 p-2">{qty || '-'}</td>;
                                      })}
                                      <td className="border border-gray-300 p-2 font-bold bg-gray-100">{rowTotal}</td>
                                  </tr>
                              );
                          })}
                          <tr className="bg-gray-100 font-bold">
                              <td className="border border-gray-300 p-2 text-left">TOTAIS</td>
                              {sizes.map(s => (
                                  <td key={s} className="border border-gray-300 p-2">{items.filter(i => i.size === s).reduce((a,b)=>a+b.quantity,0)}</td>
                              ))}
                              <td className="border border-gray-300 p-2 text-lg">{selectedOsfForPrint.sentQuantity}</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-800 uppercase mb-2 border-b border-gray-300 pb-1">Insumos e Matéria Prima Enviada</h3>
                  <table className="w-full text-sm border border-gray-300">
                      <thead className="bg-gray-100 font-bold text-left">
                          <tr>
                              <th className="p-2 border-b border-r">Insumo / Material</th>
                              <th className="p-2 border-b border-r w-32 text-center">Cor / Var.</th>
                              <th className="p-2 border-b w-32 text-right">Qtd Enviada</th>
                              <th className="p-2 border-b w-24 text-center">Conf.</th>
                          </tr>
                      </thead>
                      <tbody>
                          {calculatedMaterials.map((mat, idx) => (
                              <tr key={idx} className="border-b">
                                  <td className="p-2 border-r font-medium">{mat.name}</td>
                                  <td className="p-2 border-r text-center text-xs uppercase text-gray-600">{mat.color}</td>
                                  <td className="p-2 border-r text-right font-bold">{mat.qty.toFixed(2)} {mat.unit}</td>
                                  <td className="p-2 text-center text-gray-300">___</td>
                              </tr>
                          ))}
                          {calculatedMaterials.length === 0 && <tr><td colSpan={4} className="p-2 text-center italic">Nenhum insumo cadastrado na ficha técnica.</td></tr>}
                      </tbody>
                  </table>
              </div>
              <div className="mb-8 border border-gray-300 rounded min-h-[100px] p-2 relative">
                  <div className="absolute top-0 left-0 bg-gray-100 px-2 py-1 text-xs font-bold uppercase border-b border-r rounded-br">Observações & Logs</div>
                  <div className="mt-6 text-xs font-mono whitespace-pre-wrap text-gray-700">
                      {selectedOsfForPrint.observations || 'Nenhuma observação registrada.'}
                  </div>
              </div>
              <div className="mt-12 pt-4 border-t-2 border-dashed border-gray-400 grid grid-cols-2 gap-20">
                  <div className="text-center">
                      <div className="border-b border-gray-400 h-8 mb-2"></div>
                      <div className="text-xs uppercase font-bold text-gray-500">Assinatura Expedição (Interno)</div>
                  </div>
                  <div className="text-center">
                      <div className="border-b border-gray-400 h-8 mb-2"></div>
                      <div className="text-xs uppercase font-bold text-gray-500">Assinatura Recebedor ({selectedOsfForPrint.subcontractorName})</div>
                  </div>
              </div>
              <div className="absolute bottom-4 left-0 w-full text-center text-[10px] text-gray-400">
                  Sistema B-Hub PCP • Documento gerado em {new Date().toLocaleString()}
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6" onClick={() => setActiveMenuOsfId(null)}>
      {/* HEADER */}
      <div className="flex flex-col gap-4 no-print">
        <div className="flex justify-between items-center">
            <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Truck className="text-indigo-600" /> Facções & Terceirização
            </h1>
            <p className="text-gray-500 text-sm">Controle de envio e retorno de oficinas externas.</p>
            </div>
        </div>

        {/* STATUS SUMMARY CARDS (NEW) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div 
                onClick={() => setCardFilter('')}
                className={`bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md border-gray-500 ${cardFilter === '' ? 'ring-2 ring-gray-500' : ''}`}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-gray-100 text-gray-600 rounded-lg"><LayoutList size={20}/></div>
                    <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">{osfStats.total}</span>
                </div>
                <div className="text-gray-500 text-xs font-bold uppercase">Todos (Histórico)</div>
            </div>

            <div 
                onClick={() => setCardFilter('AguardandoEnvio')}
                className={`bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md border-orange-500 ${cardFilter === 'AguardandoEnvio' ? 'ring-2 ring-orange-500' : ''}`}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Scissors size={20}/></div>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">{osfStats.awaiting}</span>
                </div>
                <div className="text-gray-500 text-xs font-bold uppercase">Cortado (Aguardando)</div>
            </div>

            <div 
                onClick={() => setCardFilter('Enviado')}
                className={`bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md border-blue-500 ${cardFilter === 'Enviado' ? 'ring-2 ring-blue-500' : ''}`}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Truck size={20}/></div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{osfStats.sent}</span>
                </div>
                <div className="text-gray-500 text-xs font-bold uppercase">Na Rua (Enviado)</div>
            </div>

            <div 
                onClick={() => setCardFilter('Parcial')}
                className={`bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md border-yellow-500 ${cardFilter === 'Parcial' ? 'ring-2 ring-yellow-500' : ''}`}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg"><Clock size={20}/></div>
                    <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">{osfStats.partial}</span>
                </div>
                <div className="text-gray-500 text-xs font-bold uppercase">Parcial (Retornando)</div>
            </div>

            <div 
                onClick={() => setCardFilter('Concluido')}
                className={`bg-white p-4 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md border-green-500 ${cardFilter === 'Concluido' ? 'ring-2 ring-green-500' : ''}`}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle2 size={20}/></div>
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">{osfStats.completed}</span>
                </div>
                <div className="text-gray-500 text-xs font-bold uppercase">Concluídos</div>
            </div>
        </div>

        {/* MODERN FILTER BAR */}
        <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-4 flex-1 items-center">
                <ModernDatePicker 
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    label={dateRange.label}
                    onChange={(range) => setDateRange({
                        label: range.label || 'Personalizado',
                        days: 'custom',
                        start: range.start,
                        end: range.end
                    })}
                />

                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                    <input 
                        type="text" 
                        placeholder="Buscar Lote, Produto ou Facção..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        value={filters.search}
                        onChange={e => setFilters({...filters, search: e.target.value})}
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <select 
                    className="border rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={filters.type}
                    onChange={e => setFilters({...filters, type: e.target.value})}
                >
                    <option value="ALL">Todos os Tipos</option>
                    <option value="EXTERNAL">Produção Externa</option>
                    <option value="INTERNAL">Produção Interna</option>
                </select>
                
                {(filters.search || filters.type !== 'ALL' || filters.partnerId || cardFilter) && (
                    <button 
                        onClick={() => { setFilters({ search: '', type: 'ALL', partnerId: '' }); setCardFilter(''); }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        title="Limpar Filtros"
                    >
                        <X size={20}/>
                    </button>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 no-print animate-fade-in">
        {/* Section 1: Ready to Ship */}
        {(!cardFilter || cardFilter === 'AguardandoEnvio') && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="text-orange-500"/> Cortadas - Aguardando Envio ({filteredCutOps.length})
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600">
                    <tr>
                    <th className="p-3">Data Corte</th>
                    <th className="p-3">OP #</th>
                    <th className="p-3">Produto</th>
                    <th className="p-3">Qtd</th>
                    <th className="p-3">Facção Prevista</th>
                    <th className="p-3 text-right">Ação</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {filteredCutOps.map(op => {
                        const prod = products.find(p => p.id === op.productId);
                        return (
                        <tr key={op.id}>
                            <td className="p-3 text-gray-500">{new Date(op.createdAt).toLocaleDateString()}</td>
                            <td className="p-3 font-mono font-bold">{op.lotNumber}</td>
                            <td className="p-3">
                                <div className="font-bold text-gray-900">{prod?.sku} - {prod?.name}</div>
                            </td>
                            <td className="p-3 font-bold">{op.quantityTotal}</td>
                            <td className="p-3 text-indigo-600 font-medium">{op.subcontractor}</td>
                            <td className="p-3 text-right">
                            <button 
                                onClick={() => openPrintModal(op)}
                                className="bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 text-xs font-bold flex items-center gap-1 ml-auto"
                            >
                                Gerar Remessa <ArrowRight size={12}/>
                            </button>
                            </td>
                        </tr>
                        );
                    })}
                    {filteredCutOps.length === 0 && (
                    <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                            Nenhuma OP aguardando envio com os filtros atuais.
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
            </div>
        )}

        {/* Section 2: Active OSFs */}
        {cardFilter !== 'AguardandoEnvio' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
             <CheckCircle2 size={20} className="text-green-500"/> Em Produção Externa - OSF ({filteredActiveOsfs.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {filteredActiveOsfs.map(osf => {
               const op = ops.find(o => o.id === osf.opId);
               const prod = products.find(p => p.id === op?.productId);
               return (
               <div key={osf.id} className="border rounded-lg p-4 hover:border-indigo-300 transition-colors bg-white relative group">
                  {osf.parentId && <div className="absolute top-2 right-2 text-[10px] bg-purple-100 text-purple-700 px-2 rounded">Saldo {osf.parentId}</div>}
                  
                  {/* 3 Dots Menu */}
                  <div className="absolute top-2 right-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenuOsfId(activeMenuOsfId === osf.id ? null : osf.id); }}
                        className="p-1 hover:bg-gray-100 rounded-full text-gray-400"
                      >
                          <MoreVertical size={16}/>
                      </button>
                      {activeMenuOsfId === osf.id && (
                          <div className="absolute right-0 top-6 bg-white shadow-xl border rounded-lg z-10 w-40 overflow-hidden animate-fade-in">
                              <button 
                                onClick={() => handleCopyLink(osf)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2"
                              >
                                <Share2 size={14}/> Link do Parceiro
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleReverseShipment(osf); }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                disabled={osf.receivedQuantity > 0}
                              >
                                <RotateCcw size={14}/> Estornar Remessa
                              </button>
                          </div>
                      )}
                  </div>

                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-indigo-700">{osf.id}</span>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full uppercase mr-6">{osf.status}</span>
                  </div>
                  
                  {/* Product Info inside Card */}
                  <div className="mb-3 pb-3 border-b border-gray-100">
                      <div className="font-bold text-gray-800 text-sm">{prod?.name}</div>
                      <div className="text-xs text-gray-500">{prod?.sku}</div>
                  </div>

                  <div className="text-sm text-gray-600 mb-1">OP Vinculada: <b>{osf.opId}</b></div>
                  <div className="text-sm text-gray-600 mb-3">Oficina: {osf.subcontractorName}</div>
                  
                  <div className="bg-gray-50 p-2 rounded text-xs grid grid-cols-2 gap-2 mb-3">
                    <div>Enviado: <br/><span className="font-bold text-base">{osf.sentQuantity}</span></div>
                    <div>Recebido: <br/><span className="font-bold text-base text-gray-400">{osf.receivedQuantity}</span></div>
                  </div>
                  <div className="text-xs text-gray-400 mb-2">Enviado em: {new Date(osf.sentDate).toLocaleDateString()}</div>

                  <div className="flex gap-2">
                      <button onClick={() => openOsfPrintModal(osf)} className="flex-1 py-2 border border-gray-300 text-gray-600 font-medium rounded hover:bg-gray-50 text-sm flex justify-center items-center gap-1">
                        <FileText size={14}/> 2a Via
                      </button>
                      <button onClick={() => openReturnModal(osf)} className="flex-1 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 text-sm flex justify-center items-center gap-1">
                        <Undo2 size={14}/> Retorno
                      </button>
                  </div>
               </div>
             );
             })}
             {filteredActiveOsfs.length === 0 && <div className="text-gray-400 text-sm col-span-3 text-center py-8 italic">Nenhuma ordem encontrada com os filtros selecionados.</div>}
          </div>
        </div>
        )}

        {/* Section 3: History (Completed) */}
        {( !cardFilter || cardFilter === 'Concluido' ) && (
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <History size={20}/> Histórico de Facções (Concluídos: {filteredCompletedOsfs.length})
                </h3>
                <div className="overflow-x-auto bg-white rounded-lg border">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-600">
                            <tr>
                                <th className="p-3">Data Envio</th>
                                <th className="p-3">OSF</th>
                                <th className="p-3">OP</th>
                                <th className="p-3">Facção</th>
                                <th className="p-3 text-right">Enviado</th>
                                <th className="p-3 text-right">Retornado</th>
                                <th className="p-3">Data Retorno</th>
                                <th className="p-3 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredCompletedOsfs.map(osf => (
                                <tr key={osf.id} className="hover:bg-gray-50">
                                    <td className="p-3 text-gray-500">{new Date(osf.sentDate).toLocaleDateString()}</td>
                                    <td className="p-3 font-mono text-gray-600">{osf.id}</td>
                                    <td className="p-3 font-bold">{osf.opId}</td>
                                    <td className="p-3">{osf.subcontractorName}</td>
                                    <td className="p-3 text-right">{osf.sentQuantity}</td>
                                    <td className="p-3 text-right font-bold text-green-700">{osf.receivedQuantity}</td>
                                    <td className="p-3 text-gray-500">{new Date(osf.returnDate || '').toLocaleDateString()}</td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => openOsfPrintModal(osf)} className="text-blue-600 hover:underline">Ver Ficha</button>
                                    </td>
                                </tr>
                            ))}
                            {filteredCompletedOsfs.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-gray-400 italic">Nenhum histórico encontrado com os filtros selecionados.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

      {/* NEW SHIPMENT CONFIRMATION MODAL */}
      {selectedOpForPrint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Truck/> Confirmar Envio</h3>
                    <button onClick={() => setSelectedOpForPrint(null)}><X/></button>
                </div>
                <div className="p-6">
                    <div className="mb-6 text-center">
                        <div className="text-gray-500 text-sm uppercase font-bold">OP Destino</div>
                        <div className="text-3xl font-bold text-indigo-600">{selectedOpForPrint.lotNumber}</div>
                        <div className="text-gray-600 mt-2 mb-4">
                            Enviar <b>{selectedOpForPrint.quantityTotal}</b> peças.
                        </div>
                        
                        {/* MANDATORY PARTNER SELECTION */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-left">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Selecione a Facção Responsável <span className="text-red-500">*</span></label>
                            <select 
                                className="w-full border-2 border-indigo-100 rounded-lg p-3 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-800"
                                value={targetPartner}
                                onChange={e => setTargetPartner(e.target.value)}
                            >
                                <option value="">-- Selecione o Parceiro --</option>
                                <optgroup label="Facções">
                                    {partners.filter(p => p.type === 'Facção' || p.type === 'Outro').map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </optgroup>
                                <option value="Produção Interna">Produção Interna</option>
                            </select>
                            {(!targetPartner) && <p className="text-xs text-red-500 mt-1 font-medium">Obrigatório selecionar.</p>}
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button 
                            onClick={() => setSelectedOpForPrint(null)}
                            className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirmSend}
                            disabled={!targetPartner}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Confirmar & Imprimir
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* PRINT MODAL (Professional Layout) */}
      {selectedOsfForPrint && (
          <div className="fixed inset-0 bg-gray-600/90 z-50 flex justify-center overflow-y-auto">
              <div className="relative my-8">
                  <div className="absolute -top-10 right-0 flex gap-2 no-print">
                      <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-blue-700 flex items-center gap-2"><Printer size={18}/> Imprimir</button>
                      <button onClick={() => setSelectedOsfForPrint(null)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded shadow font-bold hover:bg-gray-300 flex items-center gap-2"><X size={18}/> Fechar</button>
                  </div>
                  {renderPrintableOsf()}
              </div>
          </div>
      )}

      {/* Return Modal Code... (unchanged) */}
      {isReturnModalOpen && selectedOsfForReturn && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              {/* Modal Content - Unchanged Logic */}
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
                  <div className="bg-green-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Undo2/> Registrar Retorno de Facção</h3>
                      <button onClick={() => setIsReturnModalOpen(false)}><X/></button>
                  </div>
                  <div className="p-6">
                      <div className="mb-4 bg-green-50 p-4 rounded text-sm grid grid-cols-2 gap-4">
                          <div>OSF: <b>{selectedOsfForReturn.id}</b></div>
                          <div>Enviado Total: <b>{selectedOsfForReturn.sentQuantity}</b></div>
                      </div>
                      
                      <div className="mb-4">
                          <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Conferente <span className="text-red-500">*</span></label>
                          <input 
                            className={`w-full border rounded p-2 focus:outline-none ${conferenteError ? 'border-red-500 ring-2 ring-red-200 bg-red-50' : 'focus:ring-2 focus:ring-green-500'}`}
                            placeholder="Quem recebeu as peças?"
                            value={conferenteName}
                            onChange={e => { setConferenteName(e.target.value); setConferenteError(false); }}
                          />
                      </div>

                      <div className="max-h-64 overflow-y-auto border rounded mb-4">
                          <table className="w-full text-sm text-center">
                              <thead className="bg-gray-100 font-bold sticky top-0">
                                  <tr>
                                      <th className="p-2">Cor</th>
                                      <th className="p-2">Tam</th>
                                      <th className="p-2">Qtd Recebida</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {returnItems.map((item, idx) => (
                                      <tr key={idx} className="border-b">
                                          <td className="p-2">{item.color}</td>
                                          <td className="p-2">{item.size}</td>
                                          <td className="p-2">
                                              <input 
                                                type="number" className="border rounded w-20 text-center font-bold p-1"
                                                value={item.quantity || ''}
                                                onChange={e => updateReturnQty(idx, 'quantity', Number(e.target.value))}
                                                placeholder="0"
                                              />
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                      
                      <div className="mt-4 text-right">
                          <button onClick={handleSaveReturn} className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 flex items-center gap-2 ml-auto">
                              <Save size={18}/> Salvar & Calcular Saldo
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
