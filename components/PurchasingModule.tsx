
import React, { useState, useMemo, useEffect } from 'react';
import { ApiService } from '../services/api';
import { PurchasingService } from '../services/PurchasingService';
import { Material, Partner, MaterialPurchase } from '../types';
import { 
  ShoppingCart, Plus, Calendar, Search, DollarSign, Package, 
  Save, CheckSquare, ArrowRight, Loader2, History, TrendingUp, 
  AlertTriangle, Layers, BarChart3, Archive, ChevronRight, X, ListPlus, Trash2, ClipboardCheck
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { useDialog } from '../contexts/DialogContext';

// Helper for Color Style
const getColorStyle = (colorName: string) => {
    const map: any = {
        'Branco': '#ffffff', 'Preto': '#000000', 'Marinho': '#000080', 'Vermelho': '#ff0000',
        'Verde': '#008000', 'Amarelo': '#ffff00', 'Azul': '#0000ff', 'Cinza': '#808080',
        'Rosa': '#ffc0cb', 'Roxo': '#800080'
    };
    return map[colorName] || '#cccccc';
};

interface CartItem {
    tempId: string;
    materialId: string;
    materialName: string;
    quantity: number;
    unitPricePaid: number;
    colorBreakdown: Record<string, number>;
    unit: string;
}

export const PurchasingModule: React.FC = () => {
  const { addToast } = useToast();
  const { user } = useAuth();
  const dialog = useDialog();
  const queryClient = useQueryClient();
  
  // --- NAVIGATION STATE ---
  const [currentModule, setCurrentModule] = useState<'purchasing' | 'inventory'>('purchasing');
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list');

  // --- DATA FETCHING ---
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: ApiService.getMaterials });
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({ queryKey: ['purchases'], queryFn: PurchasingService.getPurchases });
  const { data: partners = [] } = useQuery({ queryKey: ['partners'], queryFn: ApiService.getPartners });
  
  const suppliers = partners.map(p => p.name);

  // --- PURCHASING FORM STATE (HEADER) ---
  const [headerForm, setHeaderForm] = useState({
      supplier: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      invoiceNumber: '',
      createPayment: true
  });

  // --- ITEM ADDER STATE ---
  const [itemForm, setItemForm] = useState({
      materialId: '',
      quantity: 0,
      unitPricePaid: 0,
  });
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [colorInputs, setColorInputs] = useState<Record<string, number>>({});
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- VERIFICATION MODAL STATE ---
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [purchaseToVerify, setPurchaseToVerify] = useState<MaterialPurchase | null>(null);
  const [verifyQty, setVerifyQty] = useState<number>(0);
  const [verifierName, setVerifierName] = useState('');

  // --- INVENTORY VIEW STATE ---
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<Material | null>(null);

  // --- DERIVED STATE (KPIs) ---
  const kpiStats = useMemo(() => {
      const totalSpend = purchases.reduce((acc, p) => acc + p.totalCost, 0);
      const pendingCount = purchases.filter(p => p.status === 'Pendente').length;
      return { totalSpend, pendingCount };
  }, [purchases]);

  const inventoryStats = useMemo(() => {
      const totalValue = materials.reduce((acc, m) => acc + (m.currentStock * m.costUnit), 0);
      return { totalValue };
  }, [materials]);

  const filteredInventory = useMemo(() => {
      return materials.filter(m => 
          m.name.toLowerCase().includes(inventorySearch.toLowerCase()) || 
          m.code.toLowerCase().includes(inventorySearch.toLowerCase())
      );
  }, [materials, inventorySearch]);

  const selectedItemHistory = useMemo(() => {
      if (!selectedInventoryItem) return [];
      return purchases.filter(p => p.materialId === selectedInventoryItem.id);
  }, [selectedInventoryItem, purchases]);

  // --- HANDLERS ---

  const handleMaterialSelect = (matId: string) => {
      const mat = materials.find(m => m.id === matId);
      setItemForm(prev => ({ 
          ...prev, 
          materialId: matId,
          unitPricePaid: mat?.costUnit || 0,
          quantity: 0
      }));
      setSelectedMaterial(mat || null);
      
      if (mat?.hasColors && mat.variants) {
          const inputs: Record<string, number> = {};
          mat.variants.forEach(v => inputs[v.name] = 0);
          setColorInputs(inputs);
      } else {
          setColorInputs({});
      }
  };

  useEffect(() => {
      if (selectedMaterial?.hasColors) {
          const total = Object.values(colorInputs).reduce((a: number, b: number) => a + b, 0);
          setItemForm(prev => ({ ...prev, quantity: total }));
      }
  }, [colorInputs, selectedMaterial]);

  const handleAddToCart = () => {
      if (!selectedMaterial || itemForm.quantity <= 0) {
          addToast({ type: 'warning', title: 'Inválido', message: 'Selecione um material e quantidade positiva.' });
          return;
      }

      const newItem: CartItem = {
          tempId: Math.random().toString(36),
          materialId: selectedMaterial.id,
          materialName: selectedMaterial.name,
          quantity: itemForm.quantity,
          unitPricePaid: itemForm.unitPricePaid,
          colorBreakdown: { ...colorInputs },
          unit: selectedMaterial.unit
      };

      setCart([...cart, newItem]);
      
      // Reset Item Form
      setItemForm({ materialId: '', quantity: 0, unitPricePaid: 0 });
      setSelectedMaterial(null);
      setColorInputs({});
  };

  const handleRemoveFromCart = (id: string) => {
      setCart(cart.filter(i => i.tempId !== id));
  };

  const handleFinalizeEntry = async () => {
      if (!headerForm.supplier || cart.length === 0) {
          addToast({ type: 'warning', title: 'Dados Incompletos', message: 'Preencha o fornecedor e adicione itens.' });
          return;
      }

      setIsSubmitting(true);
      try {
          const { data: profile } = await supabase.from('user_profiles').select('organization_id').eq('id', user?.id).single();
          
          // Loop through cart and create purchases
          // Note: Ideally this would be a single transaction, but for simplicity we loop
          for (const item of cart) {
              await PurchasingService.registerPurchase({
                  materialId: item.materialId,
                  supplier: headerForm.supplier,
                  purchaseDate: headerForm.purchaseDate,
                  invoiceNumber: headerForm.invoiceNumber,
                  quantity: item.quantity,
                  unitPricePaid: item.unitPricePaid,
                  totalCost: item.quantity * item.unitPricePaid,
                  colorBreakdown: item.colorBreakdown
              }, {
                  createPayment: headerForm.createPayment,
                  organizationId: profile?.organization_id
              });
          }

          addToast({ type: 'success', title: 'Nota Registrada', message: `${cart.length} itens aguardando conferência.` });
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          queryClient.invalidateQueries({ queryKey: ['payments'] }); // Provisioned payments
          
          // Reset All
          setCart([]);
          setHeaderForm({ supplier: '', purchaseDate: new Date().toISOString().split('T')[0], invoiceNumber: '', createPayment: true });
          setActiveTab('list');

      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleOpenVerification = (purchase: MaterialPurchase) => {
      if (purchase.status === 'Concluido') return;
      setPurchaseToVerify(purchase);
      setVerifyQty(purchase.quantity); // Default to invoice qty
      setVerifyModalOpen(true);
  };

  const handleConfirmVerification = async () => {
      if (!purchaseToVerify || !verifierName) {
          addToast({ type: 'warning', title: 'Atenção', message: 'Informe o responsável pela conferência.' });
          return;
      }

      const diff = verifyQty - purchaseToVerify.quantity;
      if (diff !== 0) {
          const confirm = await dialog.confirm({
              title: 'Divergência de Quantidade',
              message: `A quantidade conferida (${verifyQty}) é diferente da nota (${purchaseToVerify.quantity}). O financeiro será ajustado automaticamente. Confirma?`,
              type: 'warning'
          });
          if (!confirm) return;
      }

      setIsSubmitting(true);
      try {
          await PurchasingService.verifyPurchase(purchaseToVerify.id, verifyQty, verifierName);
          
          addToast({ type: 'success', title: 'Conferido', message: 'Estoque e Financeiro atualizados.' });
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          queryClient.invalidateQueries({ queryKey: ['materials'] });
          queryClient.invalidateQueries({ queryKey: ['payments'] });
          
          setVerifyModalOpen(false);
          setPurchaseToVerify(null);
          setVerifierName('');
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
        
        {/* SUB-MODULE NAVIGATION */}
        <div className="flex gap-4 border-b border-gray-200 pb-1">
            <button 
                onClick={() => setCurrentModule('purchasing')}
                className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-colors ${
                    currentModule === 'purchasing' 
                    ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                <ShoppingCart size={18}/> Gestão de Compras
            </button>
            <button 
                onClick={() => setCurrentModule('inventory')}
                className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-colors ${
                    currentModule === 'inventory' 
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-lg' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                <Layers size={18}/> Almoxarifado / Estoque
            </button>
        </div>

        {/* =====================================================================================
            MODULE 1: PURCHASING & RECEIVING (New Flow)
           ===================================================================================== */}
        {currentModule === 'purchasing' && (
            <div className="animate-slide-in">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Entradas & Recebimento</h2>
                        <p className="text-gray-500 text-sm">Registre notas fiscais e realize a conferência física.</p>
                    </div>
                    <button 
                        onClick={() => setActiveTab(activeTab === 'list' ? 'new' : 'list')}
                        className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-700 flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                    >
                        {activeTab === 'list' ? <><Plus size={18}/> Lançar Nota</> : <><History size={18}/> Voltar p/ Histórico</>}
                    </button>
                </div>

                {activeTab === 'list' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white p-5 rounded-xl border-l-4 border-teal-500 shadow-sm">
                                <div className="text-xs font-bold text-teal-600 uppercase mb-1">Total Comprado (Geral)</div>
                                <div className="text-2xl font-bold text-gray-900">R$ {kpiStats.totalSpend.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border-l-4 border-orange-500 shadow-sm">
                                <div className="text-xs font-bold text-orange-600 uppercase mb-1">Pendente Conferência</div>
                                <div className="text-2xl font-bold text-gray-900">{kpiStats.pendingCount} <span className="text-sm text-gray-400 font-normal">itens</span></div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                                    <tr>
                                        <th className="p-4">Data</th>
                                        <th className="p-4">Material</th>
                                        <th className="p-4">Fornecedor</th>
                                        <th className="p-4 text-center">Qtd Nota</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {purchases.map((p) => (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                            <td className="p-4 text-gray-500">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                                            <td className="p-4 font-bold text-gray-800">{p.materialName} <span className="font-normal text-xs text-gray-400 block">{p.materialCode}</span></td>
                                            <td className="p-4 text-gray-700">{p.supplier}</td>
                                            <td className="p-4 text-center font-bold">{p.quantity}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'Concluido' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {p.status === 'Concluido' ? 'Conferido' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                {p.status !== 'Concluido' && (
                                                    <button 
                                                        onClick={() => handleOpenVerification(p)}
                                                        className="bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-orange-700 flex items-center gap-1 ml-auto"
                                                    >
                                                        <ClipboardCheck size={14}/> Conferir
                                                    </button>
                                                )}
                                                {p.status === 'Concluido' && (
                                                    <span className="text-xs text-gray-400 flex items-center justify-end gap-1"><CheckSquare size={12}/> Ok</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {purchases.length === 0 && (
                                        <tr><td colSpan={6} className="p-12 text-center text-gray-400">Nenhuma compra registrada.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'new' && (
                    <div className="flex gap-6 items-start">
                        {/* LEFT: FORM */}
                        <div className="flex-1 space-y-6">
                            
                            {/* 1. Header (Invoice Data) */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Package size={18}/> Dados da Nota Fiscal</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Fornecedor</label>
                                        <input className="w-full border rounded p-2" list="suppliers-list" value={headerForm.supplier} onChange={e => setHeaderForm({...headerForm, supplier: e.target.value})} placeholder="Busque o fornecedor..." />
                                        <datalist id="suppliers-list">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Data Emissão</label>
                                        <input type="date" className="w-full border rounded p-2" value={headerForm.purchaseDate} onChange={e => setHeaderForm({...headerForm, purchaseDate: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Número Nota</label>
                                        <input className="w-full border rounded p-2" value={headerForm.invoiceNumber} onChange={e => setHeaderForm({...headerForm, invoiceNumber: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            {/* 2. Item Adder */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
                                <div className="absolute -left-3 top-6 bg-teal-600 text-white p-1 rounded-r shadow-sm"><Plus size={16}/></div>
                                <h3 className="font-bold text-gray-700 mb-4 ml-2">Adicionar Item à Nota</h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Material</label>
                                        <select className="w-full border rounded p-2 bg-gray-50" value={itemForm.materialId} onChange={e => handleMaterialSelect(e.target.value)}>
                                            <option value="">Selecione...</option>
                                            {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Preço Unit. (R$)</label>
                                            <input type="number" step="0.01" className="w-full border rounded p-2" value={itemForm.unitPricePaid || ''} onChange={e => setItemForm({...itemForm, unitPricePaid: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Quantidade ({selectedMaterial?.unit})</label>
                                            <input type="number" step="0.01" className="w-full border rounded p-2 font-bold" value={itemForm.quantity || ''} onChange={e => setItemForm({...itemForm, quantity: Number(e.target.value)})} disabled={selectedMaterial?.hasColors} />
                                        </div>
                                    </div>

                                    {/* Color Matrix if needed */}
                                    {selectedMaterial?.hasColors && (
                                        <div className="bg-gray-50 p-3 rounded border">
                                            <div className="text-xs font-bold text-gray-500 mb-2">Grade de Cores</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {Object.keys(colorInputs).map(color => (
                                                    <div key={color}>
                                                        <label className="text-[10px] text-gray-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full border" style={{backgroundColor: getColorStyle(color)}}></div> {color}</label>
                                                        <input type="number" className="w-full border rounded p-1 text-xs text-center" value={colorInputs[color] || ''} onChange={e => setColorInputs({...colorInputs, [color]: Number(e.target.value)})} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button onClick={handleAddToCart} className="w-full bg-slate-800 text-white py-2 rounded-lg font-bold text-sm hover:bg-slate-900">
                                        Adicionar Item
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: CART */}
                        <div className="w-96 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-[600px]">
                            <div className="p-4 bg-teal-600 text-white rounded-t-xl">
                                <h3 className="font-bold flex items-center gap-2"><ShoppingCart size={18}/> Resumo da Entrada</h3>
                                <div className="text-xs opacity-80 mt-1">{cart.length} itens adicionados</div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50">
                                {cart.map(item => (
                                    <div key={item.tempId} className="bg-white p-3 rounded-lg border shadow-sm relative group">
                                        <button onClick={() => handleRemoveFromCart(item.tempId)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500"><X size={14}/></button>
                                        <div className="font-bold text-sm text-gray-800 pr-4">{item.materialName}</div>
                                        <div className="flex justify-between items-center mt-2 text-sm">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">{item.quantity} {item.unit}</span>
                                            <span className="font-bold text-teal-700">R$ {(item.quantity * item.unitPricePaid).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                                {cart.length === 0 && <div className="text-center text-gray-400 py-10 text-sm">Carrinho vazio</div>}
                            </div>

                            <div className="p-4 border-t bg-white">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-bold text-gray-500">TOTAL NOTA</span>
                                    <span className="text-xl font-bold text-gray-900">R$ {cart.reduce((acc, i) => acc + (i.quantity * i.unitPricePaid), 0).toFixed(2)}</span>
                                </div>
                                
                                <div className="mb-4">
                                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                        <input type="checkbox" checked={headerForm.createPayment} onChange={e => setHeaderForm({...headerForm, createPayment: e.target.checked})} />
                                        Gerar Título no Financeiro
                                    </label>
                                </div>

                                <button 
                                    onClick={handleFinalizeEntry} 
                                    disabled={isSubmitting || cart.length === 0}
                                    className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin"/> : <Save size={18}/>} Finalizar Lançamento
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* =====================================================================================
            MODULE 2: INVENTORY & STOCK (Existing View - No Changes needed just rendering)
           ===================================================================================== */}
        {currentModule === 'inventory' && (
            <div className="animate-slide-in flex gap-6 h-[calc(100vh-200px)]">
                {/* Same Inventory View Code as Checkpoint V1 - No Logic Change */}
                {/* LEFT: MASTER LIST */}
                <div className={`flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-300 overflow-hidden ${selectedInventoryItem ? 'w-1/2' : 'w-full'}`}>
                    <div className="p-4 border-b bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Layers size={20} className="text-indigo-600"/> Visão Geral do Estoque</h2>
                            <div className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">Total: R$ {inventoryStats.totalValue.toLocaleString()}</div>
                        </div>
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none" placeholder="Buscar..." value={inventorySearch} onChange={e => setInventorySearch(e.target.value)}/></div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-gray-500 font-bold sticky top-0 shadow-sm z-10"><tr><th className="p-3 bg-gray-50">Material</th><th className="p-3 bg-gray-50 text-right">Saldo</th><th className="p-3 bg-gray-50 text-center">Status</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">{filteredInventory.map(m => (<tr key={m.id} onClick={() => setSelectedInventoryItem(m)} className="cursor-pointer hover:bg-gray-50"><td className="p-3 font-bold text-gray-800">{m.name}</td><td className="p-3 text-right">{m.currentStock} {m.unit}</td><td className="p-3 text-center">{m.currentStock < 50 ? <span className="text-red-500 font-bold text-xs">Baixo</span> : <span className="text-green-500 font-bold text-xs">Ok</span>}</td></tr>))}</tbody>
                        </table>
                    </div>
                </div>
                {/* RIGHT: DETAIL PANEL */}
                {selectedInventoryItem && (
                    <div className="w-1/2 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden animate-scale-in">
                        <div className="bg-slate-900 text-white p-6 flex justify-between items-start shrink-0"><div><h3 className="font-bold text-lg">{selectedInventoryItem.name}</h3><p className="text-slate-400 text-sm font-mono">{selectedInventoryItem.code}</p></div><button onClick={() => setSelectedInventoryItem(null)} className="text-slate-400 hover:text-white"><X size={20}/></button></div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="grid grid-cols-2 gap-4"><div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100"><div className="text-xs font-bold text-indigo-500 uppercase mb-1">Estoque Físico</div><div className="text-2xl font-bold text-indigo-900">{selectedInventoryItem.currentStock} {selectedInventoryItem.unit}</div></div><div className="bg-teal-50 p-4 rounded-xl border border-teal-100"><div className="text-xs font-bold text-teal-600 uppercase mb-1">Financeiro</div><div className="text-2xl font-bold text-teal-900">R$ {(selectedInventoryItem.currentStock * selectedInventoryItem.costUnit).toLocaleString()}</div></div></div>
                            {selectedInventoryItem.hasColors && selectedInventoryItem.variants && (<div className="bg-white border rounded-xl overflow-hidden shadow-sm"><div className="bg-gray-50 p-3 border-b font-bold text-gray-700 text-sm">Cores</div><div className="p-2 max-h-60 overflow-y-auto space-y-1">{selectedInventoryItem.variants.map((v: any) => (<div key={v.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded"><div className="w-3 h-3 rounded-full border" style={{backgroundColor: getColorStyle(v.name)}}></div><div className="flex-1 text-sm font-medium">{v.name}</div><div className="font-bold">{v.stock}</div></div>))}</div></div>)}
                            <div><h4 className="font-bold text-gray-800 mb-3">Histórico</h4><div className="space-y-2">{selectedItemHistory.map(p => (<div key={p.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border text-sm"><div><div className="font-bold text-gray-800">Entrada</div><div className="text-xs text-gray-500">{new Date(p.purchaseDate).toLocaleDateString()}</div></div><div className="font-bold text-teal-700">+{p.quantity}</div></div>))}</div></div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* VERIFICATION MODAL */}
        {verifyModalOpen && purchaseToVerify && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                    <div className="bg-orange-600 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><ClipboardCheck/> Conferência Física</h3>
                        <button onClick={() => setVerifyModalOpen(false)} className="hover:bg-orange-700 p-1 rounded"><X size={20}/></button>
                    </div>
                    <div className="p-6">
                        <div className="mb-4 bg-orange-50 p-3 rounded border border-orange-200">
                            <div className="text-xs font-bold text-orange-800 uppercase mb-1">Item a Conferir</div>
                            <div className="font-bold text-gray-800">{purchaseToVerify.materialName}</div>
                            <div className="text-sm text-gray-600">Nota Fiscal: {purchaseToVerify.quantity} {materials.find(m => m.id === purchaseToVerify.materialId)?.unit}</div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Quantidade Recebida (Real)</label>
                            <input 
                                type="number" 
                                className="w-full border-2 border-orange-200 rounded-lg p-3 text-xl font-bold text-center text-gray-800 focus:border-orange-500 outline-none"
                                value={verifyQty}
                                onChange={e => setVerifyQty(Number(e.target.value))}
                                autoFocus
                            />
                            {verifyQty !== purchaseToVerify.quantity && (
                                <p className="text-xs text-red-500 mt-1 font-bold">Diferença: {verifyQty - purchaseToVerify.quantity}</p>
                            )}
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Conferente</label>
                            <input 
                                className="w-full border rounded-lg p-2"
                                placeholder="Quem conferiu?"
                                value={verifierName}
                                onChange={e => setVerifierName(e.target.value)}
                            />
                        </div>

                        <button 
                            onClick={handleConfirmVerification}
                            disabled={isSubmitting}
                            className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin"/> : <CheckSquare size={18}/>} Confirmar Recebimento
                        </button>
                        <p className="text-[10px] text-gray-400 mt-2 text-center">Isso atualizará o estoque e ajustará o financeiro se houver divergência.</p>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
