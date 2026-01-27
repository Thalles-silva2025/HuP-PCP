
/**
 * 🔒 MÓDULO CADASTROS (SETTINGS) - PROTEGIDO
 */

import React, { useState } from 'react';
import { ApiService } from '../services/api';
import { Material, MaterialType, UnitOfMeasure, StandardOperation, Partner, Color, StandardObservation, Warehouse, MaterialVariant } from '../types';
import { Settings, Plus, Trash2, Database, Truck, Scissors, Box, Layers, Ruler, Tag, Save, Edit2, MapPin, Phone, Palette, StickyNote, Users, Power, X, ChevronDown, Check, AlertTriangle, Activity, Terminal, Loader2, FileText } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { SystemLogService, SystemLog } from '../services/SystemLogService';
import { useDialog } from '../contexts/DialogContext'; // IMPORTED
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const SettingsModule: React.FC = () => {
  const { addToast } = useToast();
  const dialog = useDialog(); // HOOK
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('materials'); 
  
  // --- REACT QUERY IMPLEMENTATION (SMART CACHE) ---
  
  // 1. Materiais (Heavy Data) - Carrega apenas se tab ativa
  const { data: materials = [] } = useQuery({
      queryKey: ['materials'],
      queryFn: ApiService.getMaterials,
      enabled: activeTab === 'materials',
      staleTime: 1000 * 60 * 10 // 10 min cache
  });

  // 2. Operações
  const { data: standardOps = [] } = useQuery({
      queryKey: ['standardOperations'],
      queryFn: ApiService.getStandardOperations,
      enabled: activeTab === 'ops',
      staleTime: Infinity // Static data essentially
  });

  // 3. Tamanhos
  const { data: sizes = [] } = useQuery({
      queryKey: ['standardSizes'],
      queryFn: ApiService.getStandardSizes,
      enabled: activeTab === 'sizes',
      staleTime: Infinity
  });

  // 4. Cores
  const { data: colors = [] } = useQuery({
      queryKey: ['colors'],
      queryFn: ApiService.getColors,
      enabled: activeTab === 'colors',
      staleTime: 1000 * 60 * 30
  });

  // 5. Observações
  const { data: observations = [] } = useQuery({
      queryKey: ['observations'],
      queryFn: ApiService.getObservations,
      enabled: activeTab === 'observations',
      staleTime: Infinity
  });

  // 6. Unidades
  const { data: units = [] } = useQuery({
      queryKey: ['standardUnits'],
      queryFn: ApiService.getStandardUnits,
      enabled: activeTab === 'units',
      staleTime: Infinity
  });

  // 7. Parceiros
  const { data: partners = [] } = useQuery({
      queryKey: ['partners'],
      queryFn: ApiService.getPartners,
      enabled: activeTab === 'partners' || activeTab === 'suppliers', // Also used for Suppliers
      staleTime: 1000 * 60 * 5
  });

  // 8. Depósitos
  const { data: warehouses = [] } = useQuery({
      queryKey: ['warehouses'],
      queryFn: ApiService.getWarehouses,
      enabled: activeTab === 'warehouses',
      staleTime: Infinity
  });

  // 9. Logs (Always fresh)
  const { data: systemLogs = [], isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
      queryKey: ['systemLogs'],
      queryFn: SystemLogService.getLogs,
      enabled: activeTab === 'logs'
  });

  const [isSubmitting, setIsSubmitting] = useState(false); // NOVO STATE PARA BLOQUEIO

  const [newInput, setNewInput] = useState('');
  const [newMachine, setNewMachine] = useState('');
  
  // Color Form
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');

  // Observation Form
  const [newObsText, setNewObsText] = useState('');
  const [newObsCategory, setNewObsCategory] = useState<'Corte'|'Costura'|'Geral'>('Geral');

  // Partner Editing
  const [editingPartner, setEditingPartner] = useState<Partial<Partner>>({});
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);

  // Material Form State
  const [editingMaterial, setEditingMaterial] = useState<Partial<Material>>({
     type: MaterialType.FABRIC,
     unit: UnitOfMeasure.KG,
     status: 'Ativo',
     hasColors: false,
     variants: []
  });
  // Material Variant Input State
  const [variantInputName, setVariantInputName] = useState('');
  const [variantInputStock, setVariantInputStock] = useState<number>(0);

  // Warehouse Form State
  const [editingWarehouse, setEditingWarehouse] = useState<Partial<Warehouse>>({ type: 'Interno' });
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);

  // --- ACTIONS WITH CACHE INVALIDATION ---

  const handleClearLogs = async () => {
      const confirmed = await dialog.confirm({
          title: 'Limpar Logs',
          message: 'Deseja apagar todo o histórico de logs? Esta ação não pode ser desfeita.',
          type: 'warning'
      });
      if (!confirmed) return;

      await SystemLogService.clearLogs();
      refetchLogs();
      addToast({ type: 'info', title: 'Limpo', message: 'Histórico de logs apagado.' });
  };

  const handleAdd = async (e: React.FormEvent, type: 'op' | 'size' | 'unit') => {
    e.preventDefault();
    if (!newInput) return;
    if (isSubmitting) return; // Prevent double click

    // VALIDAÇÃO DE DUPLICIDADE
    if (type === 'op' && standardOps.some(o => o.name.toLowerCase() === newInput.toLowerCase())) {
        addToast({ type: 'warning', title: 'Duplicado', message: 'Esta operação já existe.' });
        return;
    }
    if (type === 'size' && sizes.includes(newInput)) {
        addToast({ type: 'warning', title: 'Duplicado', message: 'Este tamanho já existe.' });
        return;
    }
    if (type === 'unit' && units.includes(newInput)) {
        addToast({ type: 'warning', title: 'Duplicado', message: 'Esta unidade já existe.' });
        return;
    }

    setIsSubmitting(true);
    try {
        if (type === 'op') {
            if(!newMachine) { addToast({ type: 'warning', title: 'Atenção', message: 'Informe a máquina/recurso' }); setIsSubmitting(false); return; }
            const updated = await ApiService.addStandardOperation(newInput, newMachine);
            queryClient.setQueryData(['standardOperations'], updated);
            setNewMachine('');
        }
        if (type === 'size') {
            const updated = await ApiService.addStandardSize(newInput);
            queryClient.setQueryData(['standardSizes'], updated);
        }
        if (type === 'unit') {
            const updated = await ApiService.addStandardUnit(newInput);
            queryClient.setQueryData(['standardUnits'], updated);
        }
        setNewInput('');
        addToast({ type: 'success', title: 'Sucesso', message: 'Item adicionado.' });
    } catch (e: any) { 
        addToast({ type: 'error', title: 'Erro', message: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleAddColor = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newColorName) return;
      if (isSubmitting) return;

      // Validação Duplicidade
      if (colors.some(c => c.name.toLowerCase() === newColorName.toLowerCase())) {
          addToast({ type: 'warning', title: 'Duplicado', message: 'Esta cor já existe.' });
          return;
      }

      setIsSubmitting(true);
      try {
          const updated = await ApiService.addColor(newColorName, newColorHex);
          queryClient.setQueryData(['colors'], updated);
          setNewColorName('');
          setNewColorHex('#000000');
          addToast({ type: 'success', title: 'Sucesso', message: 'Cor adicionada.' });
      } catch (e: any) { addToast({ type: 'error', title: 'Erro', message: e.message }); }
      finally { setIsSubmitting(false); }
  };

  const handleAddObs = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newObsText) return;
      if (isSubmitting) return;

      // Validação Duplicidade
      if (observations.some(o => o.text.toLowerCase() === newObsText.toLowerCase())) {
          addToast({ type: 'warning', title: 'Duplicado', message: 'Esta observação já existe.' });
          return;
      }

      setIsSubmitting(true);
      try {
          const updated = await ApiService.addObservation(newObsText, newObsCategory);
          queryClient.setQueryData(['observations'], updated);
          setNewObsText('');
          addToast({ type: 'success', title: 'Sucesso', message: 'Observação adicionada.' });
      } catch (e: any) { addToast({ type: 'error', title: 'Erro', message: e.message }); }
      finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string, type: any, label: string) => {
      const confirmed = await dialog.confirm({
          title: `Excluir ${label}?`,
          message: 'Esta ação removerá o item do cadastro permanentemente.',
          type: 'danger',
          confirmText: 'Excluir',
      });

      if (!confirmed) return;

      try {
        if (type === 'op') queryClient.setQueryData(['standardOperations'], await ApiService.removeStandardOperation(id));
        if (type === 'size') queryClient.setQueryData(['standardSizes'], await ApiService.removeStandardSize(id));
        if (type === 'unit') queryClient.setQueryData(['standardUnits'], await ApiService.removeStandardUnit(id));
        if (type === 'color') queryClient.setQueryData(['colors'], await ApiService.removeColor(id));
        if (type === 'obs') queryClient.setQueryData(['observations'], await ApiService.removeObservation(id));
        
        if (type === 'material') {
            await ApiService.deleteMaterial(id);
            queryClient.invalidateQueries({ queryKey: ['materials'] });
        }
        if (type === 'partner') {
            await ApiService.deletePartner(id);
            queryClient.invalidateQueries({ queryKey: ['partners'] });
        }
        if (type === 'warehouse') {
            await ApiService.deleteWarehouse(id);
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
        }

        addToast({ type: 'success', title: 'Excluído', message: 'Item removido com sucesso.' });
      } catch (e: any) { 
        addToast({ type: 'error', title: 'Erro ao excluir', message: e.message });
      }
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial.name) return;
    if (isSubmitting) return;

    // 1. CONFIRMATION WINDOW (REQUISITO 1 - GARANTIDO)
    const confirmed = await dialog.confirm({
        title: 'Salvar Alterações?',
        message: 'Deseja confirmar o salvamento deste material? Se houver cores, novos itens serão criados.',
        type: 'info',
        confirmText: 'Sim, Salvar',
        cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    // VALIDAÇÃO DE DUPLICIDADE (Apenas se não tiver cores, pois com cores o nome muda)
    if (!editingMaterial.hasColors) {
        const duplicate = materials.find(m => 
            (m.name.toLowerCase() === editingMaterial.name?.toLowerCase() || m.code.toLowerCase() === editingMaterial.code?.toLowerCase()) &&
            m.id !== editingMaterial.id
        );

        if (duplicate) {
            addToast({ type: 'warning', title: 'Duplicado', message: 'Já existe um material com este nome ou código.' });
            return;
        }
    }
    
    setIsSubmitting(true);
    try {
        // REQUISITO 2 & 3: DESMEMBRAMENTO POR COR
        if (editingMaterial.hasColors && editingMaterial.variants && editingMaterial.variants.length > 0) {
            const baseName = editingMaterial.name;
            const baseCode = editingMaterial.code || `MAT-${Date.now().toString().slice(-6)}`;
            
            // Loop para criar/atualizar cada cor como um material INDIVIDUAL
            for (let i = 0; i < editingMaterial.variants.length; i++) {
                const variant = editingMaterial.variants[i];
                const targetId = (i === 0 && editingMaterial.id) ? editingMaterial.id : undefined;
                const colorSuffix = variant.name.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
                const uniqueVariantCode = `${baseCode}-${colorSuffix}-${i + 1}`;

                await ApiService.saveMaterial({
                    ...editingMaterial,
                    id: targetId, 
                    name: `${baseName} - ${variant.name}`,
                    code: uniqueVariantCode,
                    currentStock: variant.stock,
                    hasColors: false, 
                    variants: [] 
                });
            }
            addToast({ type: 'success', title: 'Sucesso', message: `Material desmembrado em ${editingMaterial.variants.length} itens individuais.` });
        } else {
            let finalStock = editingMaterial.currentStock || 0;
            await ApiService.saveMaterial({
                ...editingMaterial,
                currentStock: finalStock
            });
            addToast({ type: 'success', title: 'Salvo', message: 'Material salvo com sucesso!' });
        }
        
        queryClient.invalidateQueries({ queryKey: ['materials'] });
        setEditingMaterial({ type: MaterialType.FABRIC, unit: UnitOfMeasure.KG, status: 'Ativo', hasColors: false, variants: [] }); 
        
    } catch (err: any) {
        console.error("Erro ao salvar material:", err);
        addToast({ type: 'error', title: 'Erro ao Salvar', message: err.message || 'Verifique sua conexão ou contate o suporte.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleAddVariant = () => {
      if (!variantInputName) return;
      if (editingMaterial.variants?.some(v => v.name.toLowerCase() === variantInputName.toLowerCase())) { addToast({ type: 'warning', title: 'Duplicado', message: 'Esta cor já foi adicionada.' }); return; }
      const newVariant: MaterialVariant = { id: `var-${Date.now()}`, name: variantInputName, stock: variantInputStock };
      setEditingMaterial({ ...editingMaterial, variants: [...(editingMaterial.variants || []), newVariant] });
      setVariantInputName(''); setVariantInputStock(0);
  };

  const handleRemoveVariant = (variantId: string) => { setEditingMaterial({ ...editingMaterial, variants: editingMaterial.variants?.filter(v => v.id !== variantId) }); };
  const handleEditMaterial = (material: Material) => { setEditingMaterial({ ...material, variants: material.variants || [] }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleToggleMaterialStatus = async (material: Material) => { 
      const newStatus = material.status === 'Ativo' ? 'Inativo' : 'Ativo'; 
      await ApiService.saveMaterial({ ...material, status: newStatus }); 
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      addToast({ type: 'info', title: 'Status Atualizado', message: `Material agora está ${newStatus}.` }); 
  };

  const handleSavePartner = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingPartner.name) return;
      if (isSubmitting) return;

      // Validação Duplicidade
      if (partners.some(p => p.name.toLowerCase() === editingPartner.name?.toLowerCase() && p.id !== editingPartner.id)) {
          addToast({ type: 'warning', title: 'Duplicado', message: 'Já existe um parceiro com este nome.' });
          return;
      }

      setIsSubmitting(true);
      try {
          const newPartner: Partner = { 
              id: editingPartner.id || '', 
              name: editingPartner.name, 
              type: editingPartner.type || 'Facção', 
              contractType: editingPartner.contractType || 'PJ', 
              address: editingPartner.address, 
              phone: editingPartner.phone, 
              defaultRate: editingPartner.defaultRate || 0,
              observations: editingPartner.observations // NEW FIELD
          };
          await ApiService.savePartner(newPartner);
          queryClient.invalidateQueries({ queryKey: ['partners'] });
          setIsPartnerModalOpen(false); setEditingPartner({}); addToast({ type: 'success', title: 'Salvo', message: 'Parceiro salvo com sucesso.' });
      } catch(err: any) { addToast({ type: 'error', title: 'Erro', message: err.message }); }
      finally { setIsSubmitting(false); }
  };

  const openPartnerModal = (partner?: Partner, typeConstraint?: Partner['type']) => { 
      if (partner) {
          setEditingPartner(partner);
      } else {
          setEditingPartner({ 
              type: typeConstraint || 'Facção', 
              contractType: 'PJ' 
          }); 
      }
      setIsPartnerModalOpen(true); 
  };
  
  const handleSaveWarehouse = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if(!editingWarehouse.name) return; 
      if (isSubmitting) return;

      // Validação Duplicidade
      if (warehouses.some(w => w.name.toLowerCase() === editingWarehouse.name?.toLowerCase() && w.id !== editingWarehouse.id)) {
          addToast({ type: 'warning', title: 'Duplicado', message: 'Já existe um depósito com este nome.' });
          return;
      }

      setIsSubmitting(true);
      try {
          await ApiService.saveWarehouse(editingWarehouse as Warehouse); 
          queryClient.invalidateQueries({ queryKey: ['warehouses'] });
          setIsWarehouseModalOpen(false); setEditingWarehouse({ type: 'Interno' }); addToast({ type: 'success', title: 'Salvo', message: 'Depósito salvo com sucesso.' }); 
      } catch(err: any) { addToast({ type: 'error', title: 'Erro', message: err.message }); }
      finally { setIsSubmitting(false); }
  };
  const openWarehouseModal = (wh?: Warehouse) => { setEditingWarehouse(wh || { type: 'Interno' }); setIsWarehouseModalOpen(true); };

  // New: Handle Close with Discard/Save Option
  const handleClosePartnerModal = async () => {
      if (editingPartner.name || editingPartner.phone || editingPartner.address) {
          const result = await dialog.confirm({
              title: 'Descartar alterações?',
              message: 'Você tem dados não salvos. Deseja sair sem salvar?',
              type: 'warning',
              confirmText: 'Sair sem Salvar',
              cancelText: 'Continuar Editando'
          });
          if (!result) return;
      }
      setIsPartnerModalOpen(false);
      setEditingPartner({});
  };

  return (
    <div className="space-y-6 relative">
      <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Database className="text-gray-600" /> Cadastros Gerais</h1><p className="text-gray-500 text-sm">Gerenciamento de dados mestres e tabelas auxiliares.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-2 h-fit">
           <button onClick={() => setActiveTab('materials')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'materials' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><Layers size={18}/> Insumos & Tecidos</button>
           <button onClick={() => setActiveTab('suppliers')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'suppliers' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><Truck size={18}/> Fornecedores</button>
           <button onClick={() => setActiveTab('ops')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'ops' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><Settings size={18}/> Sequência Operacional</button>
           <button onClick={() => setActiveTab('sizes')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'sizes' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><Ruler size={18}/> Tamanhos & Grade</button>
           <button onClick={() => setActiveTab('colors')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'colors' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><Palette size={18}/> Cores & Variantes</button>
           <button onClick={() => setActiveTab('observations')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'observations' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><StickyNote size={18}/> Observações Padrão</button>
           <button onClick={() => setActiveTab('units')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'units' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><Tag size={18}/> Unidades de Medida</button>
           <button onClick={() => setActiveTab('partners')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'partners' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><Users size={18}/> Parceiros de Serviço</button>
           <button onClick={() => setActiveTab('warehouses')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'warehouses' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><Box size={18}/> Depósitos</button>
           <div className="my-2 border-t border-gray-100"></div>
           <button onClick={() => setActiveTab('logs')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'logs' ? 'bg-orange-50 text-orange-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}><Terminal size={18}/> Logs de Sistema</button>
        </div>

        <div className="md:col-span-3 bg-white rounded-xl shadow-sm border p-6 min-h-[500px]">
          
          {activeTab === 'materials' && (
            <div>
              {/* ... Material Form ... */}
              <h2 className="text-xl font-bold mb-6 border-b pb-2 flex items-center gap-2"><Layers className="text-teal-600"/> Cadastro de Insumos & Tecidos</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form onSubmit={handleSaveMaterial} className="space-y-4 bg-gray-50 p-6 rounded-xl border h-fit">
                    <div className="flex justify-between items-center"><h3 className="font-bold text-gray-700 mb-4">{editingMaterial.id ? 'Editar Item' : 'Novo Item'}</h3>{editingMaterial.id && <button type="button" onClick={() => setEditingMaterial({ type: MaterialType.FABRIC, unit: UnitOfMeasure.KG, status: 'Ativo', hasColors: false, variants: [] })} className="text-xs text-blue-600 underline">Limpar</button>}</div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Código</label>
                            <input className="w-full border rounded p-2" value={editingMaterial.code || ''} onChange={e => setEditingMaterial({...editingMaterial, code: e.target.value})} placeholder="Ex: TEC-001" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                            <select className="w-full border rounded p-2" value={editingMaterial.type} onChange={e => setEditingMaterial({...editingMaterial, type: e.target.value as MaterialType})}>{Object.values(MaterialType).map(t => <option key={t} value={t}>{t}</option>)}</select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Etapa de Uso</label>
                            <select 
                                className="w-full border rounded p-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none" 
                                value={editingMaterial.usageStage || ''} 
                                onChange={e => setEditingMaterial({...editingMaterial, usageStage: e.target.value as any})}
                            >
                                <option value="">Geral</option>
                                <option value="Corte">Corte</option>
                                <option value="Facção">Facção</option>
                                <option value="Revisão">Revisão</option>
                                <option value="Embalagem">Embalagem</option>
                            </select>
                        </div>
                    </div>

                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Descrição do Material</label><input className="w-full border rounded p-2" value={editingMaterial.name || ''} onChange={e => setEditingMaterial({...editingMaterial, name: e.target.value})} placeholder="Ex: Malha 100% Algodão" required /></div>
                    <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Unidade</label><select className="w-full border rounded p-2" value={editingMaterial.unit} onChange={e => setEditingMaterial({...editingMaterial, unit: e.target.value as UnitOfMeasure})}>{units.map(u => <option key={u} value={u}>{u}</option>)}</select></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Custo Unit. (R$)</label><input type="number" step="0.01" className="w-full border rounded p-2" value={editingMaterial.costUnit || ''} onChange={e => setEditingMaterial({...editingMaterial, costUnit: parseFloat(e.target.value)})} placeholder="0.00"/></div></div><div className="border-t pt-4 mt-2"><div className="flex items-center gap-2 mb-2"><input type="checkbox" id="hasColors" className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" checked={editingMaterial.hasColors} onChange={e => setEditingMaterial({...editingMaterial, hasColors: e.target.checked})}/><label htmlFor="hasColors" className="font-bold text-gray-800">Este item tem variação de cor?</label></div>{editingMaterial.hasColors ? (<div className="bg-white p-4 rounded border border-gray-200 shadow-inner"><div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded mb-2 border border-yellow-200">Atenção: Ao salvar, cada cor se tornará um material independente com o nome "Nome - Cor".</div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Adicionar Cores</label><div className="flex gap-2 mb-3"><input className="flex-1 border rounded p-2 text-sm" placeholder="Nome da Cor (ex: Azul Marinho)" value={variantInputName} onChange={e => setVariantInputName(e.target.value)} list="color-suggestions"/><datalist id="color-suggestions">{colors.map(c => <option key={c.id} value={c.name}/>)}</datalist><input type="number" className="w-24 border rounded p-2 text-sm text-center" placeholder="Qtd" value={variantInputStock || ''} onChange={e => setVariantInputStock(Number(e.target.value))}/><button type="button" onClick={handleAddVariant} className="bg-teal-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-teal-700">Add</button></div><div className="space-y-1 max-h-40 overflow-y-auto">{editingMaterial.variants?.map((v) => (<div key={v.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border text-sm"><div className="font-bold text-gray-700">{v.name}</div><div className="flex items-center gap-3"><span>Estoque: <b>{v.stock}</b></span><button type="button" onClick={() => handleRemoveVariant(v.id)} className="text-red-400 hover:text-red-600"><X size={14}/></button></div></div>))}{(!editingMaterial.variants || editingMaterial.variants.length === 0) && (<p className="text-xs text-red-500 italic">Nenhuma cor adicionada. Adicione pelo menos uma.</p>)}</div></div>) : (<div className="mt-2"><label className="block text-sm font-bold text-gray-700 mb-1">Estoque Total</label><input type="number" step="0.01" className="w-full border rounded p-2" value={editingMaterial.currentStock || ''} onChange={e => setEditingMaterial({...editingMaterial, currentStock: parseFloat(e.target.value)})} placeholder="0"/></div>)}</div>{(editingMaterial.type === MaterialType.FABRIC) && (<div className="bg-white p-4 rounded border border-blue-200 mt-2"><h4 className="font-bold text-blue-800 text-sm mb-2">Dados Técnicos do Tecido</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-600 mb-1">Largura (m)</label><input type="number" step="0.01" className="w-full border rounded p-2 text-sm" placeholder="Ex: 1.80" value={editingMaterial.properties?.width || ''} onChange={e => setEditingMaterial({ ...editingMaterial, properties: { ...editingMaterial.properties, width: parseFloat(e.target.value) } })}/></div><div>{editingMaterial.unit === UnitOfMeasure.KG ? (<><label className="block text-xs font-bold text-gray-600 mb-1">Rendimento (m/kg)</label><input type="number" step="0.01" className="w-full border rounded p-2 text-sm" placeholder="Ex: 3.2" value={editingMaterial.properties?.yield || ''} onChange={e => setEditingMaterial({ ...editingMaterial, properties: { ...editingMaterial.properties, yield: parseFloat(e.target.value) } })}/></>) : (<><label className="block text-xs font-bold text-gray-600 mb-1">Gramatura (g/m²)</label><input type="number" step="1" className="w-full border rounded p-2 text-sm" placeholder="Ex: 180" value={editingMaterial.properties?.grammage || ''} onChange={e => setEditingMaterial({ ...editingMaterial, properties: { ...editingMaterial.properties, grammage: parseFloat(e.target.value) } })}/></>)}</div></div></div>)}<div className="pt-4"><button type="submit" disabled={isSubmitting} className="w-full bg-teal-600 text-white py-2 rounded-lg font-bold hover:bg-teal-700 flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Salvar Cadastro</button></div></form>
                <div className="space-y-2 max-h-[600px] overflow-y-auto"><h3 className="font-bold text-gray-700 mb-2">Materiais Cadastrados ({materials.length})</h3>{materials.slice().reverse().map(m => (<div key={m.id} className={`p-3 border rounded-lg flex justify-between items-center text-sm group ${m.status === 'Inativo' ? 'bg-gray-100 opacity-70' : 'bg-white'}`}><div><div className="font-bold text-gray-800 flex items-center gap-2">{m.name}{m.usageStage && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 font-bold uppercase">{m.usageStage}</span>}{m.hasColors && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-bold">Com Cores</span>}{m.status === 'Inativo' && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">Inativo</span>}</div><div className="text-xs text-gray-500">{m.code} • {m.type} • {m.unit}</div>{m.hasColors && m.variants && (<div className="text-[10px] text-gray-400 mt-1 max-w-[200px] truncate">Cores: {m.variants.map(v => v.name).join(', ')}</div>)}</div><div className="flex items-center gap-2"><div className="text-right"><div className="font-bold">R$ {m.costUnit.toFixed(2)}</div><div className="text-xs text-gray-500 font-medium">Estoque: {m.currentStock}</div></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2"><button onClick={() => handleEditMaterial(m)} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="Editar"><Edit2 size={14}/></button><button onClick={() => handleToggleMaterialStatus(m)} className={`p-1.5 rounded hover:opacity-80 ${m.status === 'Inativo' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`} title={m.status === 'Inativo' ? 'Ativar' : 'Inativar'}><Power size={14}/></button><button onClick={() => handleDelete(m.id, 'material', m.name)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Excluir"><Trash2 size={14}/></button></div></div></div>))}</div>
              </div>
            </div>
          )}

          {activeTab === 'partners' && (
            <div><div className="flex justify-between items-center mb-4 border-b pb-2"><h2 className="text-xl font-bold">Parceiros de Serviço (Facções, Cortadores, Revisores)</h2><button onClick={() => openPartnerModal(undefined, 'Facção')} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2"><Plus size={16}/> Novo Parceiro</button></div>
            <ul className="space-y-2">{partners.filter(p => p.type !== 'Fornecedor').map((sub) => (<li key={sub.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-gray-50 group"><div className="flex items-center gap-4"><div className={`p-3 rounded text-white font-bold text-xs uppercase w-20 text-center ${sub.type === 'Facção' ? 'bg-indigo-500' : sub.type === 'Cortador' ? 'bg-orange-500' : 'bg-green-600'}`}>{sub.type}</div><div><div className="font-bold text-gray-800 flex items-center gap-2">{sub.name}<span className={`text-[10px] border px-1 rounded ${sub.contractType === 'PJ' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{sub.contractType}</span></div><div className="text-xs text-gray-500 flex items-center gap-3 mt-1">{sub.phone && <span className="flex items-center gap-1"><Phone size={12}/> {sub.phone}</span>}{sub.address && <span className="flex items-center gap-1"><MapPin size={12}/> {sub.address}</span>}</div></div></div><div className="flex items-center gap-4">{sub.defaultRate && sub.defaultRate > 0 && (<div className="text-right mr-4"><div className="text-xs text-gray-400 uppercase">Taxa Padrão</div><div className="font-bold text-green-700">R$ {sub.defaultRate.toFixed(2)}</div></div>)}<div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openPartnerModal(sub)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit2 size={16}/></button><button onClick={() => handleDelete(sub.id, 'partner', sub.name)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16}/></button></div></div></li>))}</ul></div>
          )}

          {activeTab === 'suppliers' && (
            <div><div className="flex justify-between items-center mb-4 border-b pb-2"><h2 className="text-xl font-bold">Fornecedores de Materiais</h2><button onClick={() => openPartnerModal(undefined, 'Fornecedor')} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2"><Plus size={16}/> Novo Fornecedor</button></div>
            <ul className="space-y-2">{partners.filter(p => p.type === 'Fornecedor').map((sup) => (<li key={sup.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-gray-50 group"><div className="flex items-center gap-4"><div className="p-3 rounded text-white font-bold text-xs uppercase w-20 text-center bg-teal-600">Fornecedor</div><div><div className="font-bold text-gray-800 flex items-center gap-2">{sup.name}</div><div className="text-xs text-gray-500 flex items-center gap-3 mt-1">{sup.phone && <span className="flex items-center gap-1"><Phone size={12}/> {sup.phone}</span>}{sup.address && <span className="flex items-center gap-1"><MapPin size={12}/> {sup.address}</span>}</div></div></div><div className="flex items-center gap-4"><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openPartnerModal(sup)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit2 size={16}/></button><button onClick={() => handleDelete(sup.id, 'partner', sup.name)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16}/></button></div></div></li>))}</ul></div>
          )}

           {activeTab === 'warehouses' && (
            <div><div className="flex justify-between items-center mb-4 border-b pb-2"><h2 className="text-xl font-bold">Depósitos e Locais de Estoque</h2><button onClick={() => openWarehouseModal()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2"><Plus size={16}/> Novo Depósito</button></div><ul className="space-y-2">{warehouses.map((w) => (<li key={w.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-gray-50 group"><div className="flex items-center gap-3"><Box size={20} className="text-gray-400"/> <div><div className="font-bold text-gray-800">{w.name}</div><div className="text-xs text-gray-500">{w.type} • {w.location}</div></div></div><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openWarehouseModal(w)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit2 size={16}/></button><button onClick={() => handleDelete(w.id, 'warehouse', w.name)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16}/></button></div></li>))}{warehouses.length === 0 && <p className="text-gray-400 italic p-4">Nenhum depósito cadastrado.</p>}</ul></div>
          )}
          {activeTab === 'ops' && (<div><h2 className="text-xl font-bold mb-4 border-b pb-2">Sequência Operacional Padrão</h2><form onSubmit={e => handleAdd(e, 'op')} className="flex gap-2 mb-6 items-end"><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">Nome da Operação</label><input className="w-full border rounded-lg p-3" placeholder="Ex: Pregar Botão, Caseado" value={newInput} onChange={e => setNewInput(e.target.value)}/></div><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">Máquina / Recurso</label><input className="w-full border rounded-lg p-3" placeholder="Ex: Reta, Manual" value={newMachine} onChange={e => setNewMachine(e.target.value)}/></div><button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">Adicionar</button></form><div className="space-y-2">{standardOps.map(op => (<div key={op.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border"><div><span className="font-bold text-gray-800">{op.name}</span><span className="text-sm text-gray-500 ml-2">({op.machine})</span></div><button onClick={() => handleDelete(op.id, 'op', op.name)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18}/></button></div>))}</div></div>)}
          {activeTab === 'sizes' && (<div><h2 className="text-xl font-bold mb-4 border-b pb-2">Tamanhos (Grade)</h2><form onSubmit={e => handleAdd(e, 'size')} className="flex gap-2 mb-6"><input className="flex-1 border rounded-lg p-3" placeholder="Novo tamanho (ex: G1, G2, 38, 40)" value={newInput} onChange={e => setNewInput(e.target.value)}/><button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">Adicionar</button></form><div className="flex flex-wrap gap-2">{sizes.map(s => (<div key={s} className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded border"><span className="font-bold text-gray-800">{s}</span><button onClick={() => handleDelete(s, 'size', `Tamanho ${s}`)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>))}</div></div>)}
          {activeTab === 'colors' && (<div><h2 className="text-xl font-bold mb-4 border-b pb-2">Cadastro de Cores</h2><form onSubmit={handleAddColor} className="flex gap-2 mb-6 items-end"><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">Nome da Cor</label><input className="w-full border rounded-lg p-3" placeholder="Ex: Azul Bebê, Marsala" value={newColorName} onChange={e => setNewColorName(e.target.value)}/></div><div><label className="block text-xs font-bold text-gray-500 mb-1">Visual</label><input type="color" className="h-[50px] w-16 border rounded cursor-pointer" value={newColorHex} onChange={e => setNewColorHex(e.target.value)}/></div><button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">Adicionar</button></form><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{colors.map(c => (<div key={c.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border"><div className="flex items-center gap-3"><div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style={{backgroundColor: c.hex}}></div><span className="font-medium text-gray-800">{c.name}</span></div><button onClick={() => handleDelete(c.id, 'color', c.name)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div>))}</div></div>)}
          {activeTab === 'observations' && (<div><h2 className="text-xl font-bold mb-4 border-b pb-2">Observações Padrão de Produção</h2><form onSubmit={handleAddObs} className="flex gap-2 mb-6 items-end"><div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">Texto da Observação</label><input className="w-full border rounded-lg p-3" placeholder="Ex: Descanso de tecido de 24h" value={newObsText} onChange={e => setNewObsText(e.target.value)}/></div><div className="w-40"><label className="block text-xs font-bold text-gray-500 mb-1">Categoria</label><select className="w-full border rounded-lg p-3" value={newObsCategory} onChange={(e: any) => setNewObsCategory(e.target.value)}><option>Corte</option><option>Costura</option><option>Geral</option></select></div><button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">Adicionar</button></form><div className="space-y-2">{observations.map(obs => (<div key={obs.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border"><div className="flex-1"><div className="text-xs text-blue-600 font-bold uppercase mb-1">{obs.category}</div><span className="font-medium text-gray-800">{obs.text}</span></div><button onClick={() => handleDelete(obs.id, 'obs', 'Observação')} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18}/></button></div>))}</div></div>)}
          {activeTab === 'units' && (<div><h2 className="text-xl font-bold mb-4 border-b pb-2">Unidades de Medida</h2><form onSubmit={e => handleAdd(e, 'unit')} className="flex gap-2 mb-6"><input className="flex-1 border rounded-lg p-3" placeholder="Nova unidade (ex: caixa, litro)" value={newInput} onChange={e => setNewInput(e.target.value)}/><button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">Adicionar</button></form><div className="space-y-2">{units.map(u => (<div key={u} className="flex justify-between items-center bg-gray-50 p-3 rounded border"><span className="font-medium text-gray-800">{u}</span><button onClick={() => handleDelete(u, 'unit', u)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18}/></button></div>))}</div></div>)}
          
          {activeTab === 'logs' && (
              <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-6 border-b pb-4">
                      <div><h2 className="text-xl font-bold flex items-center gap-2 text-gray-800"><Terminal className="text-orange-600"/> Logs de Sistema & Erros</h2><p className="text-gray-500 text-sm">Histórico de comunicação com o Banco de Dados.</p></div>
                      <div className="flex gap-2"><button onClick={() => refetchLogs()} className="text-gray-600 hover:text-blue-600 p-2"><Activity size={18}/></button><button onClick={handleClearLogs} className="text-red-500 hover:text-red-700 px-3 py-1 border border-red-200 rounded text-sm font-bold bg-red-50">Limpar Histórico</button></div>
                  </div>
                  {loadingLogs ? (
                      <div className="text-center py-12 text-gray-400">Carregando logs...</div>
                  ) : (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                          {systemLogs.length === 0 && <div className="text-center text-gray-400 py-12">Nenhum log registrado recentemente.</div>}
                          {systemLogs.map((log) => (
                              <div key={log.id} className={`p-4 rounded-lg border-l-4 shadow-sm text-sm ${log.type === 'error' ? 'border-red-500 bg-red-50' : log.type === 'success' ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'}`}>
                                  <div className="flex justify-between items-start mb-1"><span className="font-bold uppercase tracking-wide flex items-center gap-2">{log.type === 'error' ? <AlertTriangle size={14}/> : <Check size={14}/>} {log.action}</span><span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span></div>
                                  <div className="text-gray-700 font-mono text-xs break-all">{log.details}</div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}
        </div>
      </div>

      {isPartnerModalOpen && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"><h3 className="font-bold text-lg mb-4">{editingPartner.id ? 'Editar Cadastro' : 'Novo Cadastro'}</h3><form onSubmit={handleSavePartner} className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Nome / Razão Social</label><input className="w-full border rounded p-2" value={editingPartner.name || ''} onChange={e => setEditingPartner({...editingPartner, name: e.target.value})} required placeholder="Razão Social ou Nome"/></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label><select className="w-full border rounded p-2" value={editingPartner.type} onChange={(e: any) => setEditingPartner({...editingPartner, type: e.target.value})} disabled={editingPartner.type === 'Fornecedor' && !editingPartner.id}><option value="Facção">Facção</option><option value="Cortador">Cortador</option><option value="Revisão">Revisão</option><option value="Embalagem">Embalagem</option><option value="Fornecedor">Fornecedor</option><option value="Outro">Outro</option></select></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Regime Contratual</label><div className="flex gap-2 mt-2"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="contractType" value="PJ" checked={editingPartner.contractType === 'PJ'} onChange={() => setEditingPartner({...editingPartner, contractType: 'PJ'})}/><span className="text-sm font-bold">PJ</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="contractType" value="CLT" checked={editingPartner.contractType === 'CLT'} onChange={() => setEditingPartner({...editingPartner, contractType: 'CLT'})}/><span className="text-sm font-bold">CLT</span></label></div></div></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Taxa / Preço Padrão (Por Peça)</label><input type="number" step="0.01" className="w-full border rounded p-2" value={editingPartner.defaultRate || ''} onChange={e => setEditingPartner({...editingPartner, defaultRate: parseFloat(e.target.value)})} placeholder="0.00"/><p className="text-xs text-gray-500 mt-1">Usado para cálculo automático de pagamentos.</p></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Telefone / Contato</label><input className="w-full border rounded p-2" value={editingPartner.phone || ''} onChange={e => setEditingPartner({...editingPartner, phone: e.target.value})}/></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Endereço Completo</label><textarea className="w-full border rounded p-2 h-20" value={editingPartner.address || ''} onChange={e => setEditingPartner({...editingPartner, address: e.target.value})}/></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Observações</label><textarea className="w-full border rounded p-2 h-20" placeholder="Dados bancários, horário de entrega, etc..." value={editingPartner.observations || ''} onChange={e => setEditingPartner({...editingPartner, observations: e.target.value})}/></div><div className="flex justify-end gap-2 pt-4"><button type="button" onClick={handleClosePartnerModal} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button><button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50">Salvar</button></div></form></div></div>)}
      {isWarehouseModalOpen && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{editingWarehouse.id ? 'Editar Depósito' : 'Novo Depósito'}</h3><button onClick={() => setIsWarehouseModalOpen(false)}><X size={20}/></button></div><form onSubmit={handleSaveWarehouse} className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Nome do Local</label><input className="w-full border rounded p-2" value={editingWarehouse.name || ''} onChange={e => setEditingWarehouse({...editingWarehouse, name: e.target.value})} required placeholder="Ex: Loja Centro"/></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Localização / Endereço</label><input className="w-full border rounded p-2" value={editingWarehouse.location || ''} onChange={e => setEditingWarehouse({...editingWarehouse, location: e.target.value})}/></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label><select className="w-full border rounded p-2" value={editingWarehouse.type} onChange={(e: any) => setEditingWarehouse({...editingWarehouse, type: e.target.value})}><option>Interno</option><option>Loja</option><option>Expedição</option></select></div><div className="flex justify-end gap-2 pt-4"><button type="button" onClick={() => setIsWarehouseModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button><button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50">Salvar</button></div></form></div></div>)}
    </div>
  );
};
