
import React, { useState, useEffect } from 'react';
import { MockService } from '../services/mockDb';
import { Material, MaterialType, UnitOfMeasure, StandardOperation, Partner, Color, StandardObservation, Warehouse, MaterialVariant } from '../types';
import { Settings, Plus, Trash2, Database, Truck, Scissors, Box, Layers, Ruler, Tag, Save, Edit2, MapPin, Phone, Palette, StickyNote, Users, Power, X, ChevronDown, Check } from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState('materials'); // Default alterado para materiais
  const [standardOps, setStandardOps] = useState<StandardOperation[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [observations, setObservations] = useState<StandardObservation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
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

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    const [ops, sz, un, mats, ptrs, cols, obs, wh] = await Promise.all([
       MockService.getStandardOperations(),
       MockService.getStandardSizes(),
       MockService.getStandardUnits(),
       MockService.getMaterials(),
       MockService.getPartners(),
       MockService.getColors(),
       MockService.getObservations(),
       MockService.getWarehouses()
    ]);
    setStandardOps(ops);
    setSizes(sz);
    setUnits(un);
    setMaterials(mats);
    setPartners(ptrs);
    setColors(cols);
    setObservations(obs);
    setWarehouses(wh);
  };

  // ... (Keep existing add/remove/save handlers for standard types) ...
  const handleAdd = async (e: React.FormEvent, type: 'op' | 'size' | 'unit') => {
    e.preventDefault();
    if (!newInput) return;
    if (type === 'op') {
        if(!newMachine) { alert('Informe a máquina/recurso'); return; }
        setStandardOps(await MockService.addStandardOperation(newInput, newMachine));
        setNewMachine('');
    }
    if (type === 'size') setSizes(await MockService.addStandardSize(newInput));
    if (type === 'unit') setUnits(await MockService.addStandardUnit(newInput));
    setNewInput('');
  };

  const handleAddColor = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newColorName) return;
      setColors(await MockService.addColor(newColorName, newColorHex));
      setNewColorName('');
      setNewColorHex('#000000');
  };

  const handleAddObs = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newObsText) return;
      setObservations(await MockService.addObservation(newObsText, newObsCategory));
      setNewObsText('');
  };

  const handleRemove = async (nameOrId: string, type: 'op' | 'size' | 'unit' | 'color' | 'obs') => {
    if (type === 'op') setStandardOps(await MockService.removeStandardOperation(nameOrId));
    if (type === 'size') setSizes(await MockService.removeStandardSize(nameOrId));
    if (type === 'unit') setUnits(await MockService.removeStandardUnit(nameOrId));
    if (type === 'color') setColors(await MockService.removeColor(nameOrId));
    if (type === 'obs') setObservations(await MockService.removeObservation(nameOrId));
  };

  // --- MATERIAL LOGIC REFACTORED ---

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial.name) return;
    
    // Calculate total stock if hasColors
    let finalStock = editingMaterial.currentStock || 0;
    if (editingMaterial.hasColors && editingMaterial.variants) {
        finalStock = editingMaterial.variants.reduce((acc, v) => acc + v.stock, 0);
    }

    await MockService.saveMaterial({
        ...editingMaterial,
        currentStock: finalStock
    });
    
    const updatedMats = await MockService.getMaterials();
    setMaterials(updatedMats);
    setEditingMaterial({ type: MaterialType.FABRIC, unit: UnitOfMeasure.KG, status: 'Ativo', hasColors: false, variants: [] }); 
    alert('Material salvo com sucesso!');
  };

  const handleAddVariant = () => {
      if (!variantInputName) return;
      
      // Check if variant name already exists
      if (editingMaterial.variants?.some(v => v.name.toLowerCase() === variantInputName.toLowerCase())) {
          alert('Esta cor já foi adicionada.');
          return;
      }

      const newVariant: MaterialVariant = {
          id: `var-${Date.now()}`,
          name: variantInputName,
          stock: variantInputStock
      };

      setEditingMaterial({
          ...editingMaterial,
          variants: [...(editingMaterial.variants || []), newVariant]
      });
      setVariantInputName('');
      setVariantInputStock(0);
  };

  const handleRemoveVariant = (variantId: string) => {
      setEditingMaterial({
          ...editingMaterial,
          variants: editingMaterial.variants?.filter(v => v.id !== variantId)
      });
  };

  const handleEditMaterial = (material: Material) => {
      setEditingMaterial({ ...material, variants: material.variants || [] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteMaterial = async (id: string) => {
      if(confirm('Tem certeza que deseja excluir este material?')) {
          const updated = await MockService.deleteMaterial(id);
          setMaterials(updated);
      }
  };

  const handleToggleMaterialStatus = async (material: Material) => {
      const newStatus = material.status === 'Ativo' ? 'Inativo' : 'Ativo';
      await MockService.saveMaterial({ ...material, status: newStatus });
      setMaterials(await MockService.getMaterials());
  };

  // ... (Partner & Warehouse logic unchanged)
  const handleSavePartner = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingPartner.name) return;
      const newPartner: Partner = {
          id: editingPartner.id || '', 
          name: editingPartner.name,
          type: editingPartner.type || 'Facção',
          contractType: editingPartner.contractType || 'PJ',
          address: editingPartner.address,
          phone: editingPartner.phone,
          defaultRate: editingPartner.defaultRate || 0
      };
      const updated = await MockService.savePartner(newPartner);
      setPartners(updated);
      setIsPartnerModalOpen(false);
      setEditingPartner({});
  };

  const handleDeletePartner = async (id: string) => {
      if(confirm('Tem certeza?')) {
          setPartners(await MockService.deletePartner(id));
      }
  };

  const openPartnerModal = (partner?: Partner) => {
      setEditingPartner(partner || { type: 'Facção', contractType: 'PJ' });
      setIsPartnerModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingWarehouse.name) return;
      const updated = await MockService.saveWarehouse(editingWarehouse as Warehouse);
      setWarehouses(updated);
      setIsWarehouseModalOpen(false);
      setEditingWarehouse({ type: 'Interno' });
  };

  const handleDeleteWarehouse = async (id: string) => {
      if(confirm('Tem certeza que deseja excluir este depósito?')) {
          const updated = await MockService.deleteWarehouse(id);
          setWarehouses(updated);
      }
  };

  const openWarehouseModal = (wh?: Warehouse) => {
      setEditingWarehouse(wh || { type: 'Interno' });
      setIsWarehouseModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="text-gray-600" /> Cadastros Gerais
        </h1>
        <p className="text-gray-500 text-sm">Gerenciamento de dados mestres e tabelas auxiliares.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="bg-white rounded-xl shadow-sm border p-2 h-fit">
           <button onClick={() => setActiveTab('materials')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'materials' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
             <Layers size={18}/> Insumos & Tecidos
           </button>
           <button onClick={() => setActiveTab('ops')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'ops' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
             <Settings size={18}/> Sequência Operacional
           </button>
           <button onClick={() => setActiveTab('sizes')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'sizes' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
             <Ruler size={18}/> Tamanhos & Grade
           </button>
           <button onClick={() => setActiveTab('colors')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'colors' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
             <Palette size={18}/> Cores & Variantes
           </button>
           <button onClick={() => setActiveTab('observations')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'observations' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
             <StickyNote size={18}/> Observações Padrão
           </button>
           <button onClick={() => setActiveTab('units')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'units' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
             <Tag size={18}/> Unidades de Medida
           </button>
           <button onClick={() => setActiveTab('partners')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'partners' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
             <Users size={18}/> Parceiros de Serviço
           </button>
           <button onClick={() => setActiveTab('warehouses')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'warehouses' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
             <Box size={18}/> Depósitos
           </button>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 bg-white rounded-xl shadow-sm border p-6 min-h-[500px]">
          
          {/* MATERIALS TAB (FULL FORM REFACTORED) */}
          {activeTab === 'materials' && (
            <div>
              <h2 className="text-xl font-bold mb-6 border-b pb-2 flex items-center gap-2">
                <Layers className="text-teal-600"/> Cadastro de Insumos & Tecidos
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form */}
                <form onSubmit={handleSaveMaterial} className="space-y-4 bg-gray-50 p-6 rounded-xl border h-fit">
                  <div className="flex justify-between items-center">
                      <h3 className="font-bold text-gray-700 mb-4">{editingMaterial.id ? 'Editar Item' : 'Novo Item'}</h3>
                      {editingMaterial.id && <button type="button" onClick={() => setEditingMaterial({ type: MaterialType.FABRIC, unit: UnitOfMeasure.KG, status: 'Ativo', hasColors: false, variants: [] })} className="text-xs text-blue-600 underline">Limpar</button>}
                  </div>
                  
                  {/* Basic Fields */}
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Código</label>
                       <input 
                         className="w-full border rounded p-2" 
                         value={editingMaterial.code || ''}
                         onChange={e => setEditingMaterial({...editingMaterial, code: e.target.value})}
                         placeholder="Ex: TEC-001" required 
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                       <select 
                         className="w-full border rounded p-2"
                         value={editingMaterial.type}
                         onChange={e => setEditingMaterial({...editingMaterial, type: e.target.value as MaterialType})}
                       >
                         {Object.values(MaterialType).map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                     </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Descrição do Material</label>
                    <input 
                      className="w-full border rounded p-2" 
                      value={editingMaterial.name || ''}
                      onChange={e => setEditingMaterial({...editingMaterial, name: e.target.value})}
                      placeholder="Ex: Malha 100% Algodão" required 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Unidade</label>
                       <select 
                         className="w-full border rounded p-2"
                         value={editingMaterial.unit}
                         onChange={e => setEditingMaterial({...editingMaterial, unit: e.target.value as UnitOfMeasure})}
                       >
                         {units.map(u => <option key={u} value={u}>{u}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Custo Unit. (R$)</label>
                       <input 
                         type="number" step="0.01" className="w-full border rounded p-2" 
                         value={editingMaterial.costUnit || ''}
                         onChange={e => setEditingMaterial({...editingMaterial, costUnit: parseFloat(e.target.value)})}
                         placeholder="0.00"
                       />
                     </div>
                  </div>

                  {/* HAS COLORS TOGGLE */}
                  <div className="border-t pt-4 mt-2">
                      <div className="flex items-center gap-2 mb-2">
                          <input 
                            type="checkbox" 
                            id="hasColors"
                            className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            checked={editingMaterial.hasColors}
                            onChange={e => setEditingMaterial({...editingMaterial, hasColors: e.target.checked})}
                          />
                          <label htmlFor="hasColors" className="font-bold text-gray-800">Este item tem variação de cor?</label>
                      </div>
                      
                      {editingMaterial.hasColors ? (
                          <div className="bg-white p-4 rounded border border-gray-200 shadow-inner">
                              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Gerenciar Cores Disponíveis (Estoque Individual)</label>
                              <div className="flex gap-2 mb-3">
                                  <input 
                                    className="flex-1 border rounded p-2 text-sm" 
                                    placeholder="Nome da Cor (ex: Azul Marinho)"
                                    value={variantInputName}
                                    onChange={e => setVariantInputName(e.target.value)}
                                    list="color-suggestions"
                                  />
                                  <datalist id="color-suggestions">
                                      {colors.map(c => <option key={c.id} value={c.name}/>)}
                                  </datalist>
                                  <input 
                                    type="number" className="w-24 border rounded p-2 text-sm text-center" 
                                    placeholder="Qtd"
                                    value={variantInputStock || ''}
                                    onChange={e => setVariantInputStock(Number(e.target.value))}
                                  />
                                  <button type="button" onClick={handleAddVariant} className="bg-teal-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-teal-700">Add</button>
                              </div>
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {editingMaterial.variants?.map((v) => (
                                      <div key={v.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border text-sm">
                                          <div className="font-bold text-gray-700">{v.name}</div>
                                          <div className="flex items-center gap-3">
                                              <span>Estoque: <b>{v.stock}</b></span>
                                              <button type="button" onClick={() => handleRemoveVariant(v.id)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                          </div>
                                      </div>
                                  ))}
                                  {(!editingMaterial.variants || editingMaterial.variants.length === 0) && (
                                      <p className="text-xs text-red-500 italic">Nenhuma cor adicionada. Adicione pelo menos uma.</p>
                                  )}
                              </div>
                          </div>
                      ) : (
                          <div className="mt-2">
                             <label className="block text-sm font-bold text-gray-700 mb-1">Estoque Total</label>
                             <input 
                                type="number" step="0.01" className="w-full border rounded p-2" 
                                value={editingMaterial.currentStock || ''}
                                onChange={e => setEditingMaterial({...editingMaterial, currentStock: parseFloat(e.target.value)})}
                                placeholder="0"
                             />
                          </div>
                      )}
                  </div>

                  {/* Technical Properties for Fabrics */}
                  {(editingMaterial.type === MaterialType.FABRIC) && (
                    <div className="bg-white p-4 rounded border border-blue-200 mt-2">
                       <h4 className="font-bold text-blue-800 text-sm mb-2">Dados Técnicos do Tecido</h4>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Largura (m)</label>
                            <input 
                              type="number" step="0.01" className="w-full border rounded p-2 text-sm"
                              placeholder="Ex: 1.80"
                              value={editingMaterial.properties?.width || ''}
                              onChange={e => setEditingMaterial({
                                ...editingMaterial, 
                                properties: { ...editingMaterial.properties, width: parseFloat(e.target.value) }
                              })}
                            />
                          </div>
                          <div>
                            {editingMaterial.unit === UnitOfMeasure.KG ? (
                               <>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Rendimento (m/kg)</label>
                                <input 
                                  type="number" step="0.01" className="w-full border rounded p-2 text-sm"
                                  placeholder="Ex: 3.2"
                                  value={editingMaterial.properties?.yield || ''}
                                  onChange={e => setEditingMaterial({
                                    ...editingMaterial, 
                                    properties: { ...editingMaterial.properties, yield: parseFloat(e.target.value) }
                                  })}
                                />
                               </>
                            ) : (
                               <>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Gramatura (g/m²)</label>
                                <input 
                                  type="number" step="1" className="w-full border rounded p-2 text-sm"
                                  placeholder="Ex: 180"
                                  value={editingMaterial.properties?.grammage || ''}
                                  onChange={e => setEditingMaterial({
                                    ...editingMaterial, 
                                    properties: { ...editingMaterial.properties, grammage: parseFloat(e.target.value) }
                                  })}
                                />
                               </>
                            )}
                          </div>
                       </div>
                    </div>
                  )}

                  <div className="pt-4">
                     <button type="submit" className="w-full bg-teal-600 text-white py-2 rounded-lg font-bold hover:bg-teal-700 flex items-center justify-center gap-2">
                       <Save size={18}/> Salvar Cadastro
                     </button>
                  </div>
                </form>

                {/* List Preview */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                   <h3 className="font-bold text-gray-700 mb-2">Materiais Cadastrados ({materials.length})</h3>
                   {materials.slice().reverse().map(m => (
                     <div key={m.id} className={`p-3 border rounded-lg flex justify-between items-center text-sm group ${m.status === 'Inativo' ? 'bg-gray-100 opacity-70' : 'bg-white'}`}>
                        <div>
                           <div className="font-bold text-gray-800 flex items-center gap-2">
                               {m.name}
                               {m.hasColors && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-bold">Com Cores</span>}
                               {m.status === 'Inativo' && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">Inativo</span>}
                           </div>
                           <div className="text-xs text-gray-500">{m.code} • {m.type} • {m.unit}</div>
                           {m.hasColors && m.variants && (
                               <div className="text-[10px] text-gray-400 mt-1 max-w-[200px] truncate">
                                   Cores: {m.variants.map(v => v.name).join(', ')}
                               </div>
                           )}
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="text-right">
                               <div className="font-bold">R$ {m.costUnit.toFixed(2)}</div>
                               <div className="text-xs text-gray-500 font-medium">Estoque: {m.currentStock}</div>
                           </div>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                               <button onClick={() => handleEditMaterial(m)} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="Editar"><Edit2 size={14}/></button>
                               <button onClick={() => handleToggleMaterialStatus(m)} className={`p-1.5 rounded hover:opacity-80 ${m.status === 'Inativo' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`} title={m.status === 'Inativo' ? 'Ativar' : 'Inativar'}><Power size={14}/></button>
                               <button onClick={() => handleDeleteMaterial(m.id)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Excluir"><Trash2 size={14}/></button>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          )}

          {/* ... Other Tabs (Partner, Warehouse, Standard Ops) Logic same as before ... */}
          
          {/* PARTNERS TAB (Generalized) */}
          {activeTab === 'partners' && (
            <div>
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h2 className="text-xl font-bold">Parceiros de Serviço (Facções, Cortadores, Revisores)</h2>
                  <button onClick={() => openPartnerModal()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2"><Plus size={16}/> Novo Parceiro</button>
              </div>
              <ul className="space-y-2">
                {partners.map((sub) => (
                  <li key={sub.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-gray-50 group">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded text-white font-bold text-xs uppercase w-20 text-center
                            ${sub.type === 'Facção' ? 'bg-indigo-500' : sub.type === 'Cortador' ? 'bg-orange-500' : 'bg-green-600'}
                        `}>
                            {sub.type}
                        </div>
                        <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                                {sub.name}
                                <span className={`text-[10px] border px-1 rounded ${sub.contractType === 'PJ' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                    {sub.contractType}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                                {sub.phone && <span className="flex items-center gap-1"><Phone size={12}/> {sub.phone}</span>}
                                {sub.address && <span className="flex items-center gap-1"><MapPin size={12}/> {sub.address}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {sub.defaultRate && sub.defaultRate > 0 && (
                            <div className="text-right mr-4">
                                <div className="text-xs text-gray-400 uppercase">Taxa Padrão</div>
                                <div className="font-bold text-green-700">R$ {sub.defaultRate.toFixed(2)}</div>
                            </div>
                        )}
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openPartnerModal(sub)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit2 size={16}/></button>
                            <button onClick={() => handleDeletePartner(sub.id)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16}/></button>
                        </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

           {/* WAREHOUSES TAB (Enhanced) */}
           {activeTab === 'warehouses' && (
            <div>
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h2 className="text-xl font-bold">Depósitos e Locais de Estoque</h2>
                  <button onClick={() => openWarehouseModal()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2"><Plus size={16}/> Novo Depósito</button>
              </div>
               <ul className="space-y-2">
                {warehouses.map((w) => (
                  <li key={w.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-gray-50 group">
                    <div className="flex items-center gap-3">
                        <Box size={20} className="text-gray-400"/> 
                        <div>
                            <div className="font-bold text-gray-800">{w.name}</div>
                            <div className="text-xs text-gray-500">{w.type} • {w.location}</div>
                        </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openWarehouseModal(w)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteWarehouse(w.id)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16}/></button>
                    </div>
                  </li>
                ))}
                {warehouses.length === 0 && <p className="text-gray-400 italic p-4">Nenhum depósito cadastrado.</p>}
              </ul>
            </div>
          )}
          {activeTab === 'ops' && (
            <div>
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Sequência Operacional Padrão</h2>
              <form onSubmit={e => handleAdd(e, 'op')} className="flex gap-2 mb-6 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Nome da Operação</label>
                    <input 
                      className="w-full border rounded-lg p-3" 
                      placeholder="Ex: Pregar Botão, Caseado"
                      value={newInput}
                      onChange={e => setNewInput(e.target.value)}
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Máquina / Recurso</label>
                    <input 
                      className="w-full border rounded-lg p-3" 
                      placeholder="Ex: Reta, Manual"
                      value={newMachine}
                      onChange={e => setNewMachine(e.target.value)}
                    />
                </div>
                <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700">
                  Adicionar
                </button>
              </form>
              <div className="space-y-2">
                {standardOps.map(op => (
                  <div key={op.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border">
                    <div>
                        <span className="font-bold text-gray-800">{op.name}</span>
                        <span className="text-sm text-gray-500 ml-2">({op.machine})</span>
                    </div>
                    <button onClick={() => handleRemove(op.name, 'op')} className="text-red-400 hover:text-red-600 p-2">
                      <Trash2 size={18}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SIZES TAB */}
          {activeTab === 'sizes' && (
            <div>
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Tamanhos (Grade)</h2>
              <form onSubmit={e => handleAdd(e, 'size')} className="flex gap-2 mb-6">
                <input 
                  className="flex-1 border rounded-lg p-3" 
                  placeholder="Novo tamanho (ex: G1, G2, 38, 40)"
                  value={newInput}
                  onChange={e => setNewInput(e.target.value)}
                />
                <button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700">
                  Adicionar
                </button>
              </form>
              <div className="flex flex-wrap gap-2">
                {sizes.map(s => (
                  <div key={s} className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded border">
                    <span className="font-bold text-gray-800">{s}</span>
                    <button onClick={() => handleRemove(s, 'size')} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COLORS TAB */}
          {activeTab === 'colors' && (
            <div>
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Cadastro de Cores</h2>
              <form onSubmit={handleAddColor} className="flex gap-2 mb-6 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Nome da Cor</label>
                    <input 
                      className="w-full border rounded-lg p-3" 
                      placeholder="Ex: Azul Bebê, Marsala"
                      value={newColorName}
                      onChange={e => setNewColorName(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Visual</label>
                    <input 
                        type="color" 
                        className="h-[50px] w-16 border rounded cursor-pointer"
                        value={newColorHex}
                        onChange={e => setNewColorHex(e.target.value)}
                    />
                </div>
                <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700">
                  Adicionar
                </button>
              </form>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {colors.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm" style={{backgroundColor: c.hex}}></div>
                        <span className="font-medium text-gray-800">{c.name}</span>
                    </div>
                    <button onClick={() => handleRemove(c.id, 'color')} className="text-red-400 hover:text-red-600">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OBSERVATIONS TAB */}
          {activeTab === 'observations' && (
            <div>
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Observações Padrão de Produção</h2>
              <form onSubmit={handleAddObs} className="flex gap-2 mb-6 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Texto da Observação</label>
                    <input 
                      className="w-full border rounded-lg p-3" 
                      placeholder="Ex: Descanso de tecido de 24h"
                      value={newObsText}
                      onChange={e => setNewObsText(e.target.value)}
                    />
                </div>
                <div className="w-40">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Categoria</label>
                    <select className="w-full border rounded-lg p-3" value={newObsCategory} onChange={(e: any) => setNewObsCategory(e.target.value)}>
                        <option>Corte</option>
                        <option>Costura</option>
                        <option>Geral</option>
                    </select>
                </div>
                <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700">
                  Adicionar
                </button>
              </form>
              <div className="space-y-2">
                {observations.map(obs => (
                  <div key={obs.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border">
                    <div className="flex-1">
                        <div className="text-xs text-blue-600 font-bold uppercase mb-1">{obs.category}</div>
                        <span className="font-medium text-gray-800">{obs.text}</span>
                    </div>
                    <button onClick={() => handleRemove(obs.id, 'obs')} className="text-red-400 hover:text-red-600 p-2">
                      <Trash2 size={18}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UNITS TAB */}
          {activeTab === 'units' && (
            <div>
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Unidades de Medida</h2>
              <form onSubmit={e => handleAdd(e, 'unit')} className="flex gap-2 mb-6">
                <input 
                  className="flex-1 border rounded-lg p-3" 
                  placeholder="Nova unidade (ex: caixa, litro)"
                  value={newInput}
                  onChange={e => setNewInput(e.target.value)}
                />
                <button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700">
                  Adicionar
                </button>
              </form>
              <div className="space-y-2">
                {units.map(u => (
                  <div key={u} className="flex justify-between items-center bg-gray-50 p-3 rounded border">
                    <span className="font-medium text-gray-800">{u}</span>
                    <button onClick={() => handleRemove(u, 'unit')} className="text-red-400 hover:text-red-600 p-2">
                      <Trash2 size={18}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PARTNER & WAREHOUSE MODALS ... */}
      {isPartnerModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                  <h3 className="font-bold text-lg mb-4">{editingPartner.id ? 'Editar Cadastro' : 'Novo Cadastro'}</h3>
                  <form onSubmit={handleSavePartner} className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Parceiro</label>
                          <input className="w-full border rounded p-2" value={editingPartner.name || ''} onChange={e => setEditingPartner({...editingPartner, name: e.target.value})} required placeholder="Razão Social ou Nome"/>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Serviço</label>
                              <select className="w-full border rounded p-2" value={editingPartner.type} onChange={(e: any) => setEditingPartner({...editingPartner, type: e.target.value})}>
                                  <option value="Facção">Facção</option>
                                  <option value="Cortador">Cortador</option>
                                  <option value="Revisão">Revisão</option>
                                  <option value="Embalagem">Embalagem</option>
                                  <option value="Outro">Outro</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Regime Contratual</label>
                              <div className="flex gap-2 mt-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="radio" name="contractType" value="PJ" checked={editingPartner.contractType === 'PJ'} onChange={() => setEditingPartner({...editingPartner, contractType: 'PJ'})}/>
                                      <span className="text-sm font-bold">PJ</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="radio" name="contractType" value="CLT" checked={editingPartner.contractType === 'CLT'} onChange={() => setEditingPartner({...editingPartner, contractType: 'CLT'})}/>
                                      <span className="text-sm font-bold">CLT</span>
                                  </label>
                              </div>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Taxa / Preço Padrão (Por Peça)</label>
                          <input type="number" step="0.01" className="w-full border rounded p-2" value={editingPartner.defaultRate || ''} onChange={e => setEditingPartner({...editingPartner, defaultRate: parseFloat(e.target.value)})} placeholder="0.00"/>
                          <p className="text-xs text-gray-500 mt-1">Usado para cálculo automático de pagamentos.</p>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Telefone / Contato</label>
                          <input className="w-full border rounded p-2" value={editingPartner.phone || ''} onChange={e => setEditingPartner({...editingPartner, phone: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Endereço Completo</label>
                          <textarea className="w-full border rounded p-2 h-20" value={editingPartner.address || ''} onChange={e => setEditingPartner({...editingPartner, address: e.target.value})}/>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                          <button type="button" onClick={() => setIsPartnerModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Salvar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {isWarehouseModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">{editingWarehouse.id ? 'Editar Depósito' : 'Novo Depósito'}</h3>
                      <button onClick={() => setIsWarehouseModalOpen(false)}><X size={20}/></button>
                  </div>
                  <form onSubmit={handleSaveWarehouse} className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Local</label>
                          <input className="w-full border rounded p-2" value={editingWarehouse.name || ''} onChange={e => setEditingWarehouse({...editingWarehouse, name: e.target.value})} required placeholder="Ex: Loja Centro"/>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Localização / Endereço</label>
                          <input className="w-full border rounded p-2" value={editingWarehouse.location || ''} onChange={e => setEditingWarehouse({...editingWarehouse, location: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                          <select className="w-full border rounded p-2" value={editingWarehouse.type} onChange={(e: any) => setEditingWarehouse({...editingWarehouse, type: e.target.value})}>
                              <option>Interno</option>
                              <option>Loja</option>
                              <option>Expedição</option>
                          </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                          <button type="button" onClick={() => setIsWarehouseModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Salvar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
