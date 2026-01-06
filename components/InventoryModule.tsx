
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Material, Product, FinishedProductStock, WIPItem, ProductStatus, MaterialType, UnitOfMeasure, ImportPreviewItem, ProductionOrder } from '../types';
import { MockService } from '../services/mockDb';
import { 
  Package, Search, Plus, Download, Factory, 
  Layers, CheckCircle2, AlertTriangle, XCircle, History, MoreVertical, Lock, ClipboardList, RotateCcw, Truck, Scissors, FileText, ClipboardCheck, Calendar, Archive, FileOutput, Printer, X
} from 'lucide-react';

export const InventoryModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'raw' | 'finished' | 'wip'>('finished');
  
  // Data State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [finishedStock, setFinishedStock] = useState<FinishedProductStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wipItems, setWipItems] = useState<WIPItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection State (Stock IDs)
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  
  // Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modals State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Partial<Material> | null>(null);
  
  // WIP & OP Detail Modal
  const [selectedOpDetail, setSelectedOpDetail] = useState<ProductionOrder | null>(null);

  // Traceability Modal (Finished Product History)
  const [selectedStockOp, setSelectedStockOp] = useState<ProductionOrder | null>(null);

  // Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const loadData = async () => {
    const [mats, prods, finished, wip] = await Promise.all([
      MockService.getMaterials(),
      MockService.getProducts(),
      MockService.getFinishedGoods(),
      MockService.getWIPInventory()
    ]);
    setMaterials(mats);
    setProducts(prods);
    setFinishedStock(finished);
    setWipItems(wip);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Search Logic for Finished Stock ---
  const filteredStock = finishedStock.filter(item => {
      const prod = products.find(p => p.id === item.productId);
      const term = searchTerm.toLowerCase();
      return (
          prod?.sku.toLowerCase().includes(term) ||
          prod?.name.toLowerCase().includes(term) ||
          item.warehouse.toLowerCase().includes(term) ||
          item.opId?.toLowerCase().includes(term)
      );
  });

  // --- KPI Stats ---
  const stats = useMemo(() => {
      const totalItems = finishedStock.length;
      const available = finishedStock.filter(s => s.status === 'Disponível').length;
      const exported = finishedStock.filter(s => s.status === 'Exportado').length;
      const totalValue = finishedStock.reduce((acc, s) => acc + (s.price || 0), 0);
      return { totalItems, available, exported, totalValue };
  }, [finishedStock]);

  // --- Actions ---

  const handleOpClick = async (opId: string) => {
    const op = await MockService.getProductionOrderById(opId);
    if (op) {
        setSelectedOpDetail(op);
        setActiveMenuId(null);
    }
  };

  const handleTraceability = async (opId?: string) => {
      if (!opId) return;
      const op = await MockService.getProductionOrderById(opId);
      if (op) setSelectedStockOp(op);
      setActiveMenuId(null);
  };

  const handleRevertToPacking = async (id: string) => {
      if (!confirm('Tem certeza? Isso removerá o item do estoque e retornará a OP para o status de Embalagem.')) return;
      try {
          await MockService.revertStockToPacking(id);
          loadData();
          setActiveMenuId(null);
          alert('Item estornado e OP retornada para Embalagem.');
      } catch (err: any) {
          alert(err.message);
      }
  };

  const handleMarkExported = async () => {
      if (selectedStockIds.length === 0) return;
      await MockService.markStockAsExported(selectedStockIds);
      loadData();
      setSelectedStockIds([]);
      setIsReportModalOpen(false); // Close report modal
      setActiveMenuId(null);
      alert('Itens marcados como Exportado.');
  };

  const handleOpenExportReport = () => {
      if (selectedStockIds.length === 0) {
          alert('Selecione os itens para gerar o romaneio.');
          return;
      }
      setIsReportModalOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedStockIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getEventIcon = (action: string) => {
      const lower = action.toLowerCase();
      if (lower.includes('corte')) return <Scissors size={16}/>;
      if (lower.includes('envio') || lower.includes('facção')) return <Truck size={16}/>;
      if (lower.includes('retorno')) return <RotateCcw size={16}/>;
      if (lower.includes('revisão') || lower.includes('qualidade')) return <ClipboardCheck size={16}/>;
      if (lower.includes('estoque') || lower.includes('entrada')) return <Package size={16}/>;
      return <FileText size={16}/>;
  };

  // --- Render Helpers ---

  const renderFinishedGoods = () => {
    return (
      <div className="overflow-visible min-h-[400px]">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border-l-4 border-blue-500 shadow-sm flex items-center justify-between">
                <div>
                    <div className="text-gray-500 text-xs font-bold uppercase">Total em Estoque</div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalItems} <span className="text-sm font-normal text-gray-400">itens</span></div>
                </div>
                <Archive className="text-blue-500" size={24}/>
            </div>
            <div className="bg-white p-4 rounded-xl border-l-4 border-green-500 shadow-sm flex items-center justify-between">
                <div>
                    <div className="text-gray-500 text-xs font-bold uppercase">Disponível</div>
                    <div className="text-2xl font-bold text-green-700">{stats.available} <span className="text-sm font-normal text-gray-400">itens</span></div>
                </div>
                <CheckCircle2 className="text-green-500" size={24}/>
            </div>
            <div className="bg-white p-4 rounded-xl border-l-4 border-gray-500 shadow-sm flex items-center justify-between">
                <div>
                    <div className="text-gray-500 text-xs font-bold uppercase">Exportado / Baixado</div>
                    <div className="text-2xl font-bold text-gray-700">{stats.exported} <span className="text-sm font-normal text-gray-400">itens</span></div>
                </div>
                <FileOutput className="text-gray-500" size={24}/>
            </div>
        </div>

        <div className="p-2 bg-blue-50 flex justify-between items-center mb-2 rounded text-sm no-print">
          <div className="flex gap-2 items-center">
              <span className="font-bold text-blue-800">Selecionados ({selectedStockIds.length}):</span>
              <button 
                onClick={handleOpenExportReport}
                disabled={selectedStockIds.length === 0}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-bold shadow-sm"
              >
                  <FileText size={14}/> Romaneio de Expedição / Exportar
              </button>
          </div>
        </div>
        
        <table className="w-full text-left text-sm relative">
          <thead className="bg-gray-100 text-gray-600 font-medium">
            <tr>
              <th className="p-3 w-8"><input type="checkbox" onChange={(e) => setSelectedStockIds(e.target.checked ? filteredStock.map(p => p.id) : [])}/></th>
              <th className="p-3">Produto / SKU</th>
              <th className="p-3">Cor / Tamanho</th>
              <th className="p-3">Origem (OP)</th>
              <th className="p-3">Depósito</th>
              <th className="p-3 text-right">Qtd</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStock.map(stock => {
              const prod = products.find(p => p.id === stock.productId);
              const isExported = stock.status === 'Exportado';

              return (
                <tr key={stock.id} className={`hover:bg-blue-50/50 group relative ${isExported ? 'bg-gray-50 text-gray-400' : ''}`}>
                  <td className="p-3"><input type="checkbox" checked={selectedStockIds.includes(stock.id)} onChange={() => toggleSelect(stock.id)} /></td>
                  <td className="p-3">
                    <div className="font-bold text-gray-900">
                      {prod?.name}
                    </div>
                    <div className="text-xs text-blue-600 font-mono font-bold mt-0.5">{prod?.sku}</div>
                  </td>
                  <td className="p-3">
                     <span className="font-bold">{stock.size}</span>
                     <span className="text-gray-400 mx-1">|</span>
                     <span>{stock.color}</span>
                  </td>
                  <td className="p-3 font-mono text-xs">
                     {stock.opId}
                  </td>
                  <td className="p-3">{stock.warehouse}</td>
                  <td className="p-3 text-right font-bold">{stock.quantity}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold border flex items-center justify-center gap-1 w-fit mx-auto
                      ${isExported ? 'bg-gray-200 text-gray-600 border-gray-300' : 'bg-green-100 text-green-700 border-green-200'}
                    `}>
                      {isExported && <Lock size={10}/>}
                      {stock.status}
                    </span>
                  </td>
                  <td className="p-3 text-right relative">
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === stock.id ? null : stock.id);
                        }} 
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                      >
                          <MoreVertical size={16}/>
                      </button>
                      
                      {/* Context Menu - Correctly Positioned */}
                      {activeMenuId === stock.id && (
                          <div className="absolute right-10 top-2 bg-white shadow-2xl border border-gray-200 rounded-lg z-50 w-52 overflow-hidden animate-fade-in text-left">
                              <div className="py-1">
                                  <button onClick={() => handleTraceability(stock.opId)} className="w-full px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 text-sm">
                                      <History size={16}/> Histórico / Rastreio
                                  </button>
                                  <button onClick={() => handleOpClick(stock.opId || '')} className="w-full px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 text-sm">
                                      <ClipboardList size={16}/> Visualizar OP
                                  </button>
                                  
                                  {/* Logic: Destructive actions only if NOT exported */}
                                  {!isExported && (
                                    <>
                                        <div className="border-t my-1"></div>
                                        <button onClick={() => handleRevertToPacking(stock.id)} className="w-full px-4 py-2 hover:bg-orange-50 flex items-center gap-2 text-orange-700 font-medium text-sm">
                                            <RotateCcw size={16}/> Estornar (Embalagem)
                                        </button>
                                    </>
                                  )}
                              </div>
                          </div>
                      )}
                  </td>
                </tr>
              );
            })}
             {filteredStock.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum item encontrado no estoque.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderWIP = () => (
    <div className="space-y-4">
      {wipItems.map((item, idx) => (
        <div 
           key={idx} 
           className="bg-white p-4 rounded-lg border border-yellow-200 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
           onClick={() => handleOpClick(item.opId)}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 text-yellow-700 rounded-lg">
              <Factory size={24} />
            </div>
            <div>
              <div className="font-bold text-gray-900">{item.product?.name}</div>
              <div className="text-sm text-gray-500">OP: <span className="font-mono font-bold text-blue-600 hover:underline">{item.opId}</span></div>
            </div>
          </div>
          <div className="text-right">
             <div className="text-2xl font-bold text-gray-800">{item.quantity} <span className="text-sm font-normal text-gray-500">pçs</span></div>
             <div className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded mt-1 inline-block">
               {item.stage} • {item.subcontractor}
             </div>
          </div>
        </div>
      ))}
      {wipItems.length === 0 && <div className="text-center py-8 text-gray-400">Nenhuma OP em andamento no momento.</div>}
    </div>
  );

  const renderRawMaterials = () => (
    <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-4">Código</th>
              <th className="p-4">Nome / Descrição</th>
              <th className="p-4">Tipo</th>
              <th className="p-4 text-right">Saldo Atual</th>
              <th className="p-4 text-right">Custo Unit.</th>
              <th className="p-4">Fornecedor</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {materials.map(m => (
              <tr key={m.id} className="hover:bg-teal-50/30 cursor-pointer" onClick={() => { setEditingMaterial(m); setIsMaterialModalOpen(true); }}>
                <td className="p-4 font-mono text-gray-500">{m.code}</td>
                <td className="p-4 font-medium text-gray-900">{m.name}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs 
                    ${m.type === 'Tecido' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                  `}>
                    {m.type}
                  </span>
                </td>
                <td className="p-4 text-right font-bold text-gray-800">
                  {m.currentStock.toLocaleString()} <span className="text-xs font-normal text-gray-500">{m.unit}</span>
                </td>
                <td className="p-4 text-right">R$ {m.costUnit.toFixed(2)}</td>
                <td className="p-4 text-gray-600">{m.supplier}</td>
              </tr>
            ))}
          </tbody>
        </table>
  );

  return (
    <div className="space-y-6" onClick={() => setActiveMenuId(null)}>
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-teal-600" /> Gestão de Estoque
          </h1>
          <p className="text-gray-500 text-sm">Controle de matéria-prima, WIP e produtos acabados.</p>
        </div>
        <div className="flex gap-2">
          {/* Import Logic Hidden for brevity, same as before */}
          <button 
            onClick={() => {
               if(activeTab === 'raw') { setEditingMaterial({ type: MaterialType.FABRIC, unit: UnitOfMeasure.KG }); setIsMaterialModalOpen(true); }
               else { setEditingProduct(null); setIsProductModalOpen(true); }
            }} 
            className="bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700 flex items-center gap-2"
          >
            <Plus size={18}/> Novo Item
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button 
            onClick={() => setActiveTab('finished')}
            className={`pb-4 px-1 font-medium text-sm border-b-2 transition-colors flex items-center gap-2
              ${activeTab === 'finished' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <Package size={16}/> Produtos Acabados (Detalhado)
          </button>
          <button 
            onClick={() => setActiveTab('wip')}
            className={`pb-4 px-1 font-medium text-sm border-b-2 transition-colors flex items-center gap-2
              ${activeTab === 'wip' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <Factory size={16}/> Em Produção (WIP)
          </button>
          <button 
            onClick={() => setActiveTab('raw')}
            className={`pb-4 px-1 font-medium text-sm border-b-2 transition-colors flex items-center gap-2
              ${activeTab === 'raw' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <Layers size={16}/> Matéria Prima
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[400px]">
        {/* Search Bar */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
           <div className="relative max-w-md w-full">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder="Buscar SKU, Produto, Tamanho, OP..." 
               className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
        </div>

        {activeTab === 'finished' && renderFinishedGoods()}
        {activeTab === 'wip' && <div className="p-6">{renderWIP()}</div>}
        {activeTab === 'raw' && renderRawMaterials()}
      </div>

      {/* --- MODALS --- */}

      {/* 1. VIEW OP DETAIL MODAL (FIXED) */}
      {selectedOpDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-scale-in overflow-hidden">
                <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><ClipboardList/> Detalhes da Ordem de Produção</h3>
                    <button onClick={() => setSelectedOpDetail(null)} className="hover:bg-blue-700 p-1 rounded"><XCircle size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-gray-50 p-3 rounded">
                            <div className="text-gray-500 text-xs font-bold uppercase">Lote</div>
                            <div className="font-mono font-bold text-lg text-blue-700">{selectedOpDetail.lotNumber}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                            <div className="text-gray-500 text-xs font-bold uppercase">Status</div>
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">{selectedOpDetail.status}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs font-bold uppercase mb-1">Produto</div>
                        <div className="font-bold">{products.find(p => p.id === selectedOpDetail.productId)?.name}</div>
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs font-bold uppercase mb-1">Histórico Recente</div>
                        <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2 text-xs">
                            {selectedOpDetail.events?.map((ev, i) => (
                                <div key={i} className="flex gap-2">
                                    <span className="text-gray-400">{new Date(ev.date).toLocaleDateString()}</span>
                                    <span className="font-bold">{ev.action}</span>
                                    <span className="text-gray-600 truncate">{ev.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 2. REPORT / EXPORT MODAL */}
      {isReportModalOpen && (
          <div className="fixed inset-0 bg-gray-500/90 z-[60] flex justify-center overflow-y-auto">
              <div className="relative my-8 w-[210mm] min-h-[297mm] bg-white shadow-2xl p-12 animate-fade-in printable-sheet text-gray-900">
                  {/* Print Controls */}
                  <div className="absolute -top-12 right-0 flex gap-2 no-print">
                      <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-blue-700 flex items-center gap-2"><Printer size={18}/> Imprimir</button>
                      <button onClick={handleMarkExported} className="bg-green-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-green-700 flex items-center gap-2"><CheckCircle2 size={18}/> Confirmar Baixa (Exportar)</button>
                      <button onClick={() => setIsReportModalOpen(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded shadow font-bold hover:bg-gray-300 flex items-center gap-2"><X size={18}/> Cancelar</button>
                  </div>

                  {/* HEADER */}
                  <div className="border-b-2 border-gray-800 pb-6 mb-8 flex justify-between items-start">
                      <div>
                          <h1 className="text-3xl font-bold uppercase tracking-wide mb-1">Romaneio de Expedição</h1>
                          <div className="text-sm text-gray-500 uppercase font-bold">Relatório de Saída de Estoque</div>
                      </div>
                      <div className="text-right">
                          <div className="text-sm font-bold">Data Emissão: {new Date().toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500 mt-1">Ref: EXP-{Date.now().toString().slice(-6)}</div>
                      </div>
                  </div>

                  {/* SUMMARY */}
                  <div className="grid grid-cols-3 gap-6 mb-8 bg-gray-50 p-4 rounded border border-gray-200">
                      <div>
                          <div className="text-xs font-bold text-gray-500 uppercase">Total Itens</div>
                          <div className="text-2xl font-bold">{selectedStockIds.length}</div>
                      </div>
                      <div>
                          <div className="text-xs font-bold text-gray-500 uppercase">Volume Estimado</div>
                          <div className="text-2xl font-bold">{Math.ceil(selectedStockIds.length / 50)} <span className="text-sm font-normal text-gray-400">Caixas</span></div>
                      </div>
                      <div>
                          <div className="text-xs font-bold text-gray-500 uppercase">Status Destino</div>
                          <div className="text-2xl font-bold text-green-700">Exportado</div>
                      </div>
                  </div>

                  {/* TABLE */}
                  <div className="mb-8">
                      <table className="w-full text-sm border-collapse border border-gray-300">
                          <thead className="bg-gray-100 font-bold text-left uppercase text-xs">
                              <tr>
                                  <th className="border p-2">Item / SKU</th>
                                  <th className="border p-2">Descrição</th>
                                  <th className="border p-2 text-center">Tam</th>
                                  <th className="border p-2 text-center">Cor</th>
                                  <th className="border p-2 text-center">Qtd</th>
                                  <th className="border p-2 text-right">Lote Origem</th>
                              </tr>
                          </thead>
                          <tbody>
                              {finishedStock.filter(s => selectedStockIds.includes(s.id)).map((item, idx) => {
                                  const p = products.find(prod => prod.id === item.productId);
                                  return (
                                      <tr key={item.id}>
                                          <td className="border p-2 font-mono">{p?.sku}</td>
                                          <td className="border p-2">{p?.name}</td>
                                          <td className="border p-2 text-center font-bold">{item.size}</td>
                                          <td className="border p-2 text-center">{item.color}</td>
                                          <td className="border p-2 text-center font-bold">{item.quantity}</td>
                                          <td className="border p-2 text-right font-mono text-gray-500">{item.opId}</td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>

                  {/* FOOTER SIGNATURES */}
                  <div className="mt-20 grid grid-cols-2 gap-20 pt-8 border-t-2 border-dashed border-gray-300">
                      <div className="text-center">
                          <div className="border-b border-gray-400 h-8 mb-2"></div>
                          <div className="text-xs uppercase font-bold text-gray-500">Assinatura Expedição</div>
                      </div>
                      <div className="text-center">
                          <div className="border-b border-gray-400 h-8 mb-2"></div>
                          <div className="text-xs uppercase font-bold text-gray-500">Assinatura Transportadora / Recebedor</div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 3. TRACEABILITY MODAL (History) */}
      {selectedStockOp && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
             <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
                 <div className="bg-teal-600 p-4 text-white flex justify-between items-center">
                    <h2 className="font-bold text-lg flex items-center gap-2"><History/> Rastreabilidade do Lote</h2>
                    <button onClick={() => setSelectedStockOp(null)}><XCircle/></button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-8">
                     <div className="text-center mb-8">
                        <div className="text-3xl font-bold text-gray-900 mb-1">{selectedStockOp.lotNumber}</div>
                        <div className="text-gray-500">Ordem de Produção: {selectedStockOp.id}</div>
                     </div>

                     <div className="space-y-6 relative pl-4 border-l-2 border-gray-200 ml-4">
                         {(selectedStockOp.events || []).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((event, idx) => {
                             // Detect Materials List
                             const parts = event.description.split('\n\n');
                             const mainDesc = parts[0];
                             const materials = parts[1] && parts[1].includes('Insumos Enviados') ? parts[1] : null;

                             return (
                                <div key={idx} className="relative pl-6">
                                    <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-white border-4 border-teal-600 flex items-center justify-center text-[8px] text-teal-600">
                                        {getEventIcon(event.action)}
                                    </div>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-gray-800">{event.action}</div>
                                        <div className="text-xs text-gray-400 flex items-center gap-1">
                                            <Calendar size={10}/> {new Date(event.date).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-sm bg-gray-50 p-3 rounded border border-gray-100 text-gray-600">
                                        <p>{mainDesc}</p>
                                        
                                        {materials && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 text-xs bg-white p-2 rounded">
                                                <div className="font-bold text-teal-700 mb-1 flex items-center gap-1"><Layers size={10}/> Insumos Estimados:</div>
                                                <pre className="whitespace-pre-wrap font-sans text-gray-500">{materials}</pre>
                                            </div>
                                        )}
                                        
                                        <div className="mt-2 text-xs text-gray-400 font-medium flex items-center gap-1">
                                            Responsável: <span className="text-gray-600 font-bold">{event.user}</span>
                                        </div>
                                    </div>
                                </div>
                             );
                         })}
                         {(selectedStockOp.events || []).length === 0 && (
                             <p className="text-center text-gray-400 italic">Sem histórico registrado.</p>
                         )}
                     </div>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};
