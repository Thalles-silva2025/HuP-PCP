
import React, { useState, useMemo } from 'react';
import { ApiService } from '../services/api';
import { Package, Search, Download, Layers, FileOutput, Loader2, RefreshCw, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';

// Helper: Cor
const getColorStyle = (colorName: string) => {
    const map: any = {
        'Branco': '#ffffff', 'Preto': '#000000', 'Marinho': '#000080', 'Vermelho': '#ff0000',
        'Verde': '#008000', 'Amarelo': '#ffff00', 'Azul': '#0000ff', 'Cinza': '#808080',
        'Rosa': '#ffc0cb', 'Roxo': '#800080'
    };
    return map[colorName] || '#cccccc';
};

interface ConsolidatedStockItem {
    id: string; // Composite ID: ProductID-Color-Size
    productId: string;
    productName: string;
    sku: string;
    color: string;
    size: string;
    fullName: string; // "REF - NOME - TAM - COR"
    stockIn: number;
    stockOut: number;
    balance: number;
}

interface ExportItem extends ConsolidatedStockItem {
    exportQty: number;
}

export const InventoryModule: React.FC = () => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]); // Array of Composite IDs
  const [exportList, setExportList] = useState<ExportItem[]>([]);
  
  // Form State
  const [responsible, setResponsible] = useState('');
  const [destination, setDestination] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 1. DATA FETCHING (CACHE INTELIGENTE) ---
  
  const { data: products = [] } = useQuery({
      queryKey: ['products'],
      queryFn: ApiService.getProducts,
      staleTime: 1000 * 60 * 5 
  });

  const { data: finishedGoods = [], isLoading: loadingIn } = useQuery({
      queryKey: ['finishedGoods'], // ENTRIES (From Packing)
      queryFn: ApiService.getFinishedGoods,
      staleTime: 1000 * 60 * 2
  });

  const { data: exports = [], isLoading: loadingOut } = useQuery({
      queryKey: ['inventoryExports'], // EXITS (New Table)
      queryFn: ApiService.getInventoryExports,
      staleTime: 1000 * 60 * 2
  });

  // --- 2. CORE LOGIC: CONSOLIDATION (EVENT SOURCING) ---
  
  const consolidatedStock = useMemo(() => {
      const stockMap: Record<string, ConsolidatedStockItem> = {};

      // A. Initialize Variants from Tech Packs (Source of Truth)
      products.forEach(p => {
          // Determine active variants from tech pack or product default
          const tp = p.techPacks?.[0];
          const activeSizes = tp?.activeSizes?.length ? tp.activeSizes : p.sizes;
          const activeColors = p.colors || [];

          activeSizes.forEach((size: string) => {
              activeColors.forEach((color: string) => {
                  const key = `${p.id}-${color}-${size}`;
                  stockMap[key] = {
                      id: key,
                      productId: p.id,
                      productName: p.name,
                      sku: p.sku,
                      color,
                      size,
                      fullName: `${p.sku} - ${p.name} - ${size} - ${color}`,
                      stockIn: 0,
                      stockOut: 0,
                      balance: 0
                  };
              });
          });
      });

      // B. Process Entries (Finished Goods)
      finishedGoods.forEach((item: any) => {
          const key = `${item.productId}-${item.color}-${item.size}`;
          // If variant exists in map (it should), add to stockIn
          if (stockMap[key]) {
              stockMap[key].stockIn += Number(item.quantity) || 0;
          } else {
              // Fallback for orphans (e.g. old products)
              // We create a temporary entry to show this stock exists
              const prod = products.find(p => p.id === item.productId);
              if (prod) {
                  stockMap[key] = {
                      id: key,
                      productId: prod.id,
                      productName: prod.name,
                      sku: prod.sku,
                      color: item.color,
                      size: item.size,
                      fullName: `${prod.sku} - ${prod.name} - ${item.size} - ${item.color}`,
                      stockIn: Number(item.quantity),
                      stockOut: 0,
                      balance: 0
                  };
              }
          }
      });

      // C. Process Exits (Exports)
      exports.forEach((item: any) => {
          const key = `${item.product_id}-${item.color}-${item.size}`;
          if (stockMap[key]) {
              stockMap[key].stockOut += Number(item.quantity) || 0;
          }
      });

      // D. Calculate Balance & Convert to Array
      return Object.values(stockMap).map(item => ({
          ...item,
          balance: item.stockIn - item.stockOut
      })).filter(item => {
          // Optional: Hide items with 0 history if desired, but user asked for "Products Created from Tech Pack" to be there.
          // So we show everything, or maybe filter by search.
          return true;
      });

  }, [products, finishedGoods, exports]);

  // --- 3. FILTERING ---
  const filteredStock = useMemo(() => {
      return consolidatedStock.filter(item => 
          item.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [consolidatedStock, searchTerm]);

  // --- ACTIONS ---

  const handleOpenExport = () => {
      if (selectedItems.length === 0) {
          addToast({ type: 'warning', title: 'Seleção Vazia', message: 'Selecione pelo menos um produto para exportar.' });
          return;
      }

      // Prepare Export List
      const list = selectedItems.map(id => {
          const item = consolidatedStock.find(x => x.id === id);
          return { ...item!, exportQty: 0 }; // Init with 0
      });
      
      setExportList(list);
      setResponsible('');
      setDestination('');
      setIsExportModalOpen(true);
  };

  const updateExportQty = (id: string, qty: number) => {
      setExportList(prev => prev.map(item => 
          item.id === id ? { ...item, exportQty: qty } : item
      ));
  };

  const handleConfirmExport = async () => {
      if (!responsible || !destination) {
          addToast({ type: 'error', title: 'Campos Obrigatórios', message: 'Informe o Responsável e o Destino.' });
          return;
      }

      const validItems = exportList.filter(i => i.exportQty > 0);
      if (validItems.length === 0) {
          addToast({ type: 'warning', title: 'Qtd Inválida', message: 'Informe a quantidade para pelo menos um item.' });
          return;
      }

      // Validate Stock Availability
      const hasError = validItems.some(i => i.exportQty > i.balance);
      if (hasError) {
          addToast({ type: 'error', title: 'Estoque Insuficiente', message: 'Você tentou exportar mais do que o saldo atual.' });
          return;
      }

      setIsSubmitting(true);
      try {
          const payload = validItems.map(i => ({
              productId: i.productId,
              color: i.color,
              size: i.size,
              quantity: i.exportQty,
              destination,
              responsible
          }));

          await ApiService.createInventoryExport(payload);
          
          addToast({ type: 'success', title: 'Exportação Realizada', message: 'Baixa no estoque efetuada com sucesso.' });
          
          // Invalidate Queries to Refresh Table
          queryClient.invalidateQueries({ queryKey: ['inventoryExports'] });
          
          setIsExportModalOpen(false);
          setSelectedItems([]);
      } catch (err: any) {
          addToast({ type: 'error', title: 'Erro', message: err.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  const toggleSelect = (id: string) => {
      setSelectedItems(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  };

  const toggleSelectAll = () => {
      if (selectedItems.length === filteredStock.length) setSelectedItems([]);
      else setSelectedItems(filteredStock.map(i => i.id));
  };

  // --- RENDERERS ---

  return (
    <div className="space-y-6 pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-teal-600" /> Estoque de Produtos Acabados
          </h1>
          <p className="text-gray-500 text-sm">Controle de saldo consolidado por variante (SKU + Cor + Tamanho).</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => queryClient.invalidateQueries()}
                className="p-2 border rounded-lg text-gray-500 hover:bg-gray-50"
                title="Atualizar"
            >
                <RefreshCw size={18} className={loadingIn || loadingOut ? 'animate-spin' : ''}/>
            </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-6 border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('stock')}
            className={`pb-3 px-1 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'stock' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500'}`}
          >
              <Layers size={16}/> Visão Geral do Estoque
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-1 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500'}`}
          >
              <FileOutput size={16}/> Histórico de Saídas (Log)
          </button>
      </div>

      {/* STOCK VIEW */}
      {activeTab === 'stock' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px] flex flex-col">
              
              {/* TOOLBAR */}
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                  <div className="relative w-96">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                      <input 
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        placeholder="Buscar Variante (Ref, Nome, Cor...)"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
                  
                  {selectedItems.length > 0 && (
                      <div className="flex items-center gap-4 animate-fade-in">
                          <span className="text-sm font-bold text-teal-800">{selectedItems.length} selecionados</span>
                          <button 
                            onClick={handleOpenExport}
                            className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-teal-700 flex items-center gap-2 shadow-sm"
                          >
                              <FileOutput size={16}/> Exportar em Massa
                          </button>
                      </div>
                  )}
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs sticky top-0 z-10">
                          <tr>
                              <th className="p-4 w-10 text-center">
                                  <input type="checkbox" onChange={toggleSelectAll} checked={selectedItems.length === filteredStock.length && filteredStock.length > 0}/>
                              </th>
                              <th className="p-4">Produto (Variante Única)</th>
                              <th className="p-4 text-center">Cor</th>
                              <th className="p-4 text-center">Tam</th>
                              <th className="p-4 text-right text-gray-400">Entradas</th>
                              <th className="p-4 text-right text-gray-400">Saídas</th>
                              <th className="p-4 text-right bg-gray-50 border-l">Saldo Atual</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {filteredStock.map(item => (
                              <tr key={item.id} className="hover:bg-teal-50/30 transition-colors group">
                                  <td className="p-4 text-center">
                                      <input 
                                        type="checkbox" 
                                        checked={selectedItems.includes(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                      />
                                  </td>
                                  <td className="p-4 font-mono font-bold text-gray-700">
                                      {item.fullName}
                                  </td>
                                  <td className="p-4 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                          <div className="w-3 h-3 rounded-full border border-gray-300" style={{backgroundColor: getColorStyle(item.color)}}></div>
                                          {item.color}
                                      </div>
                                  </td>
                                  <td className="p-4 text-center font-bold">{item.size}</td>
                                  <td className="p-4 text-right text-gray-400">{item.stockIn}</td>
                                  <td className="p-4 text-right text-red-400">{item.stockOut > 0 ? `-${item.stockOut}` : '0'}</td>
                                  <td className="p-4 text-right font-bold text-lg bg-gray-50 border-l text-gray-900">
                                      {item.balance}
                                  </td>
                              </tr>
                          ))}
                          {filteredStock.length === 0 && (
                              <tr><td colSpan={7} className="p-12 text-center text-gray-400">Nenhum produto encontrado.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600 font-bold">
                      <tr>
                          <th className="p-4">Data</th>
                          <th className="p-4">Produto</th>
                          <th className="p-4 text-center">Cor / Tam</th>
                          <th className="p-4 text-right">Qtd</th>
                          <th className="p-4">Destino</th>
                          <th className="p-4">Responsável</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {exports.slice().reverse().map((log: any) => {
                          const prod = products.find(p => p.id === log.product_id);
                          return (
                              <tr key={log.id} className="hover:bg-gray-50">
                                  <td className="p-4 text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                                  <td className="p-4 font-bold text-gray-800">{prod?.name || 'Produto Excluído'}</td>
                                  <td className="p-4 text-center">{log.color} / {log.size}</td>
                                  <td className="p-4 text-right font-bold text-red-600">-{log.quantity}</td>
                                  <td className="p-4">{log.destination}</td>
                                  <td className="p-4 text-gray-600 text-xs uppercase font-bold bg-gray-100 rounded w-fit px-2">{log.responsible}</td>
                              </tr>
                          );
                      })}
                      {exports.length === 0 && (
                          <tr><td colSpan={6} className="p-12 text-center text-gray-400">Nenhuma exportação registrada.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      )}

      {/* EXPORT MODAL */}
      {isExportModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-scale-in">
                  <div className="bg-teal-600 p-6 text-white flex justify-between items-center shrink-0">
                      <div>
                          <h2 className="text-xl font-bold flex items-center gap-2"><FileOutput/> Exportar / Baixa de Estoque</h2>
                          <p className="text-teal-100 text-sm mt-1">{selectedItems.length} itens selecionados para saída.</p>
                      </div>
                      <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-teal-700 rounded-full"><X/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                      {/* GLOBAL FIELDS */}
                      <div className="grid grid-cols-2 gap-6 mb-6 bg-white p-4 rounded-xl border shadow-sm">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Destino / Cliente</label>
                              <input 
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="Ex: Loja Centro, Cliente X..."
                                value={destination}
                                onChange={e => setDestination(e.target.value)}
                                autoFocus
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Responsável</label>
                              <input 
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="Quem autorizou?"
                                value={responsible}
                                onChange={e => setResponsible(e.target.value)}
                              />
                          </div>
                      </div>

                      {/* ITEMS LIST */}
                      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-gray-100 text-gray-600 font-bold">
                                  <tr>
                                      <th className="p-3">Produto</th>
                                      <th className="p-3 text-center">Saldo Atual</th>
                                      <th className="p-3 w-40 text-center">Qtd Saída</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {exportList.map(item => (
                                      <tr key={item.id}>
                                          <td className="p-3">
                                              <div className="font-bold text-gray-800">{item.fullName}</div>
                                          </td>
                                          <td className="p-3 text-center font-bold text-gray-600">{item.balance}</td>
                                          <td className="p-3">
                                              <input 
                                                type="number"
                                                min="0"
                                                max={item.balance}
                                                className="w-full border rounded p-2 text-center font-bold text-lg focus:border-teal-500 outline-none"
                                                value={item.exportQty || ''}
                                                onChange={e => updateExportQty(item.id, Number(e.target.value))}
                                                placeholder="0"
                                              />
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  <div className="p-6 bg-white border-t flex justify-end gap-3 shrink-0">
                      <button 
                        onClick={() => setIsExportModalOpen(false)}
                        className="px-6 py-3 rounded-lg font-bold text-gray-600 hover:bg-gray-100"
                      >
                          Cancelar
                      </button>
                      <button 
                        onClick={handleConfirmExport}
                        disabled={isSubmitting}
                        className="px-8 py-3 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 shadow-lg flex items-center gap-2 disabled:opacity-50"
                      >
                          {isSubmitting ? <Loader2 className="animate-spin"/> : <CheckCircle2/>}
                          Confirmar Saída
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
