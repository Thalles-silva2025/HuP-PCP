
// ... (imports remain the same)
import { supabase } from './supabase';
import {
  Product, ProductionOrder, Partner, Material, StandardOperation,
  StandardObservation, Color, SubcontractorOrder, FinishedProductStock,
  WIPItem, OrderStatus, ProductStatus,
  UnitOfMeasure, ReturnItem, MaterialType, CuttingJob, PaymentRecord,
  Warehouse, ProductionGoal, TechPack, BOMItem, Operation, MeasurementPoint,
  ProductionOrderItem, MaterialVariant, ConsolidatedRequirement, OrganizationConfig
} from '../types';

// ... (helper functions getOrgId, getCurrentUserName, mapOpFromDB, mapOsfFromDB remain the same)
const getOrgId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada. Recarregue a página.');
  
  let { data: profile } = await supabase.from('user_profiles').select('organization_id').eq('id', user.id).maybeSingle();
  
  if (!profile || !profile.organization_id) {
      const { data: newOrg } = await supabase.from('organizations').insert([{ name: 'Minha Confecção' }]).select('id').single();
      if(newOrg) {
          await supabase.from('user_profiles').upsert({ id: user.id, organization_id: newOrg.id, role: 'admin' });
          return newOrg.id;
      }
  }
  return profile.organization_id;
};

const getCurrentUserName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Sistema';
    const { data } = await supabase.from('user_profiles').select('full_name').eq('id', user.id).single();
    return data?.full_name || 'Usuário';
};

// Helper Mappers
function mapOpFromDB(data: any): ProductionOrder {
    if (!data) return {} as ProductionOrder;
    return {
        ...data,
        lotNumber: data.lot_number,
        productId: data.product_id,
        techPackVersion: data.tech_pack_version,
        quantityTotal: data.quantity_total,
        startDate: data.start_date,
        dueDate: data.due_date,
        createdAt: data.created_at,
        cuttingDetails: data.cutting_details,
        revisionDetails: data.revision_details,
        packingDetails: data.packing_details,
        originalItems: data.original_items,
        phaseDates: data.phase_dates,
        subcontractor: data.subcontractor
    };
}

function mapOsfFromDB(data: any): SubcontractorOrder {
    if (!data) return {} as SubcontractorOrder;
    return {
        id: data.id,
        opId: data.op_id,
        subcontractorName: data.subcontractor_name,
        type: data.type,
        sentDate: data.sent_date,
        sentQuantity: data.sent_quantity,
        receivedQuantity: data.received_quantity,
        defectiveQuantity: data.defective_quantity || 0,
        status: data.status,
        itemsSnapshot: data.items_snapshot,
        materialsSnapshot: data.materials_snapshot,
        itemsReturned: data.items_returned,
        returnDate: data.return_date,
        conferente: data.conferente,
        observations: data.observations
    };
}

export const ApiService = {
  // ... (getOrganizationConfig, saveOrganizationConfig, Production Orders methods remain the same)
  getOrganizationConfig: async (): Promise<OrganizationConfig | null> => {
      const orgId = await getOrgId();
      const { data, error } = await supabase.from('organization_configs').select('*').eq('organization_id', orgId).single();
      if (!data) return null;
      return {
          organizationId: data.organization_id,
          companyLogoUrl: data.company_logo_url,
          primaryColor: data.primary_color,
          enableNotifications: data.enable_notifications,
          daysToAlertOverdue: data.days_to_alert_overdue,
          defaultPaymentTerms: data.default_payment_terms,
          invoiceFooterText: data.invoice_footer_text
      };
  },

  saveOrganizationConfig: async (config: Partial<OrganizationConfig>) => {
      const orgId = await getOrgId();
      const payload = {
          organization_id: orgId,
          company_logo_url: config.companyLogoUrl,
          primary_color: config.primaryColor,
          enable_notifications: config.enableNotifications,
          days_to_alert_overdue: config.daysToAlertOverdue,
          default_payment_terms: config.defaultPaymentTerms,
          invoice_footer_text: config.invoiceFooterText,
          updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('organization_configs').upsert(payload);
      if (error) throw error;
      return true;
  },

  getProductionOrders: async () => { 
      await getOrgId(); 
      const { data } = await supabase.from('production_orders').select('*'); 
      return (data || []).map(mapOpFromDB); 
  },

  getProductionOrderById: async (id: string) => {
      await getOrgId();
      const { data, error } = await supabase.from('production_orders').select('*').eq('id', id).single();
      if (error || !data) return null;
      return mapOpFromDB(data);
  },

  createProductionOrder: async (opData: any) => {
      const orgId = await getOrgId();
      const payload = {
          lot_number: opData.lotNumber,
          product_id: opData.productId,
          tech_pack_version: opData.techPackVersion,
          quantity_total: opData.quantityTotal,
          items: opData.items,
          status: opData.status,
          start_date: opData.startDate,
          due_date: opData.dueDate,
          phase_dates: opData.phaseDates,
          subcontractor: opData.subcontractor,
          cutting_details: opData.cuttingDetails,
          cost_snapshot: opData.costSnapshot,
          organization_id: orgId,
          created_at: new Date().toISOString(),
          events: opData.events || []
      };
      
      const { data, error } = await supabase.from('production_orders').insert([payload]).select().single();
      if (error) throw error;
      return mapOpFromDB(data);
  },

  updateProductionOrder: async (id: string, data: Partial<ProductionOrder>) => {
      const orgId = await getOrgId();
      const payload: any = {};
      if (data.status) payload.status = data.status;
      if (data.items) payload.items = data.items;
      if (data.quantityTotal !== undefined) payload.quantity_total = data.quantityTotal;
      if (data.cuttingDetails) payload.cutting_details = data.cuttingDetails;
      if (data.revisionDetails) payload.revision_details = data.revisionDetails;
      if (data.packingDetails) payload.packing_details = data.packingDetails;
      if (data.events) payload.events = data.events;
      if (data.subcontractor) payload.subcontractor = data.subcontractor;
      if (data.originalItems) payload.original_items = data.originalItems;

      const { error } = await supabase.from('production_orders').update(payload).eq('id', id).eq('organization_id', orgId);
      if (error) throw error;
      return true;
  },

  getSubcontractorOrders: async () => { 
      await getOrgId(); 
      const { data } = await supabase.from('subcontractor_orders').select('*'); 
      return (data || []).map(mapOsfFromDB); 
  },

  createSubcontractorOrder: async (data: any) => {
      const orgId = await getOrgId();
      const payload = {
          op_id: data.opId,
          partner_id: data.partnerId,
          subcontractor_name: data.subcontractorName,
          type: data.type,
          sent_quantity: data.sentQuantity,
          items_snapshot: data.itemsSnapshot,
          materials_snapshot: data.materialsSnapshot,
          observations: data.observations,
          status: 'Enviado',
          sent_date: new Date().toISOString(),
          organization_id: orgId
      };
      const { data: res, error } = await supabase.from('subcontractor_orders').insert([payload]).select().single();
      if (error) throw error;
      return mapOsfFromDB(res);
  },

  cancelSubcontractorShipment: async (osfId: string) => {
      const { error } = await supabase.from('subcontractor_orders').delete().eq('id', osfId);
      if (error) throw error;
      return true;
  },

  registerReturn: async (osfId: string, items: ReturnItem[], conferente: string) => {
      const receivedQty = items.reduce((a, b) => a + b.quantity, 0);
      const defectiveQty = items.filter(i => i.type === 'defect').reduce((a, b) => a + b.quantity, 0);
      const { error } = await supabase.from('subcontractor_orders').update({
          received_quantity: receivedQty,
          defective_quantity: defectiveQty,
          items_returned: items,
          return_date: new Date().toISOString(),
          conferente: conferente,
          status: 'Concluido'
      }).eq('id', osfId);
      if (error) throw error;
      return true;
  },

  createReworkOrder: async (opId: string, subcontractor: string, quantity: number, items: any[], description: string) => {
      const orgId = await getOrgId();
      const payload = {
          op_id: opId,
          subcontractor_name: subcontractor,
          type: 'Retrabalho',
          sent_quantity: quantity,
          items_snapshot: items,
          observations: description,
          status: 'Enviado',
          sent_date: new Date().toISOString(),
          organization_id: orgId
      };
      const { error } = await supabase.from('subcontractor_orders').insert([payload]);
      if (error) throw error;
      return true;
  },

  getFinishedGoods: async () => { 
      await getOrgId(); 
      const { data } = await supabase.from('finished_goods').select('*'); 
      return (data || []).map((item: any) => ({
          ...item,
          opId: item.op_id,
          opLotNumber: item.op_lot_number,
          productId: item.product_id
      })); 
  },

  revertStockToPacking: async (stockId: string) => {
      const { data: stock } = await supabase.from('finished_goods').select('op_id').eq('id', stockId).single();
      if (!stock) throw new Error("Item de estoque não encontrado");

      await supabase.from('finished_goods').delete().eq('id', stockId);
      await supabase.from('production_orders').update({
          status: 'Embalagem' // Reverts OP status
      }).eq('id', stock.op_id);
      
      return true;
  },

  markStockAsExported: async (ids: string[]) => {
      const { error } = await supabase.from('finished_goods').update({ status: 'Exportado' }).in('id', ids);
      if (error) throw error;
      return true;
  },

  getWIPInventory: async () => { 
      const ops = await ApiService.getProductionOrders();
      return ops.filter(op => op.status !== OrderStatus.COMPLETED && op.status !== OrderStatus.CANCELLED && op.status !== OrderStatus.DRAFT).map(op => ({
          opId: op.id,
          product: { name: 'Carregando...', id: op.productId } as any, // Join is heavy, we let component fetch details or improve this query
          quantity: op.quantityTotal,
          stage: op.status,
          startDate: op.startDate,
          subcontractor: op.subcontractor || 'Interno'
      }));
  },

  // --- Products & Tech Packs (CRITICAL UPDATE FOR VERSION SORTING) ---
  getProducts: async () => { 
      await getOrgId(); 
      const { data } = await supabase.from('products').select('*, tech_packs(*)'); 
      return (data || []).map((p: any) => ({
        ...p,
        imageUrl: p.image_url,
        techPacks: (p.tech_packs || [])
            .map((tp: any) => ({
                ...tp,
                productId: tp.product_id,
                materialCost: tp.material_cost,
                laborCost: tp.labor_cost,
                totalCost: tp.total_cost,
                suggestedPrice: tp.suggested_price,
                targetMargin: tp.target_margin,
                salesType: tp.sales_type,
                extraCosts: tp.extra_costs,
                commercialExpenses: tp.commercial_expenses,
                approvedBy: tp.approved_by,
                secondaryCuts: tp.secondary_cuts,
                activeSizes: tp.active_sizes,
                standardObservations: tp.standard_observations,
                isFrozen: tp.is_frozen,
                createdAt: tp.created_at
            }))
            // IMPORTANT: Sort Descending by Version to ensure latest is always first
            .sort((a: any, b: any) => b.version - a.version)
      })); 
  },

  saveProduct: async (product: Partial<Product>) => {
    const orgId = await getOrgId();
    const payload = {
        sku: product.sku,
        name: product.name,
        collection: product.collection,
        status: product.status,
        sizes: product.sizes,
        colors: product.colors,
        image_url: product.imageUrl,
        organization_id: orgId
    };
    
    if (product.id && product.id.length === 36) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id);
        if (error) throw error;
        return product.id;
    } else {
        const { data, error } = await supabase.from('products').insert([payload]).select('id').single();
        if (error) throw error;
        return data.id;
    }
  },

  deleteProduct: async (id: string) => {
    await getOrgId();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  deleteProducts: async (ids: string[]) => {
      await getOrgId();
      const { error } = await supabase.from('products').delete().in('id', ids);
      if (error) throw error;
      return true;
  },

  saveTechPack: async (techPack: TechPack) => {
    const orgId = await getOrgId();
    const currentUser = await getCurrentUserName();
    
    const payload = {
        product_id: techPack.productId,
        version: techPack.version,
        status: techPack.status,
        materials: techPack.materials,
        operations: techPack.operations,
        measurements: techPack.measurements,
        secondary_cuts: techPack.secondaryCuts,
        active_sizes: techPack.activeSizes,
        standard_observations: techPack.standardObservations,
        material_cost: techPack.materialCost,
        labor_cost: techPack.laborCost,
        total_cost: techPack.totalCost,
        suggested_price: techPack.suggestedPrice,
        target_margin: techPack.targetMargin,
        sales_type: techPack.salesType,
        extra_costs: techPack.extraCosts,
        taxes: techPack.taxes,
        commercial_expenses: techPack.commercialExpenses,
        approved_by: techPack.status === 'aprovado' ? currentUser : techPack.approvedBy,
        organization_id: orgId,
        is_frozen: techPack.isFrozen
    };

    const { data: existingTP } = await supabase
        .from('tech_packs')
        .select('id')
        .eq('product_id', techPack.productId)
        .eq('version', techPack.version)
        .eq('organization_id', orgId)
        .maybeSingle();

    if (existingTP) {
        const { error } = await supabase
            .from('tech_packs')
            .update(payload)
            .eq('id', existingTP.id);
        if (error) throw new Error(`Erro ao atualizar Ficha: ${error.message}`);
        return existingTP.id;
    } else {
        const { data, error } = await supabase
            .from('tech_packs')
            .insert([{ ...payload, created_at: new Date().toISOString() }])
            .select('id')
            .single();
        if (error) throw new Error(`Erro ao criar Ficha: ${error.message}`);
        return data.id;
    }
  },

  // ... (Other Master Data methods remain the same)
  getMaterials: async () => { await getOrgId(); const { data } = await supabase.from('materials').select('*'); return (data || []).map((m: any) => ({ ...m, costUnit: m.cost_unit, currentStock: m.current_stock, hasColors: m.has_colors })); },
  
  saveMaterial: async (material: Partial<Material>) => {
    const orgId = await getOrgId();
    const payload = { 
        name: material.name, code: material.code, type: material.type, unit: material.unit,
        cost_unit: material.costUnit, current_stock: material.currentStock, supplier: material.supplier,
        status: material.status, has_colors: material.hasColors, variants: material.variants, properties: material.properties,
        organization_id: orgId 
    };
    if (material.id && material.id.length === 36) await supabase.from('materials').update(payload).eq('id', material.id);
    else await supabase.from('materials').insert([payload]);
    return true;
  },
  
  deleteMaterial: async (id: string) => { await supabase.from('materials').delete().eq('id', id); return ApiService.getMaterials(); },

  getPartners: async () => { await getOrgId(); const { data } = await supabase.from('partners').select('*'); return (data || []).map((p: any) => ({ ...p, contractType: p.contract_type, defaultRate: p.default_rate })); },
  
  savePartner: async (partner: Partner) => {
      const orgId = await getOrgId();
      const payload = {
          name: partner.name, type: partner.type, contract_type: partner.contractType,
          address: partner.address, phone: partner.phone, default_rate: partner.defaultRate,
          organization_id: orgId
      };
      if (partner.id && partner.id.length === 36) await supabase.from('partners').update(payload).eq('id', partner.id);
      else await supabase.from('partners').insert([payload]);
      return ApiService.getPartners();
  },
  
  deletePartner: async (id: string) => { await supabase.from('partners').delete().eq('id', id); return ApiService.getPartners(); },

  getPayments: async () => { 
      await getOrgId(); 
      const { data } = await supabase.from('payments').select('*'); 
      return (data || []).map((p: any) => ({
          ...p,
          opId: p.op_id,
          partnerName: p.partner_name,
          partnerType: p.partner_type,
          totalAmount: p.total_amount,
          amountPaid: p.amount_paid,
          quantityDelivered: p.quantity_delivered,
          ratePerPiece: p.rate_per_piece,
          bankAccountName: p.bank_account_name,
          date: p.date || p.created_at
      })); 
  },

  getProductionGoals: async () => { 
      await getOrgId(); 
      const { data } = await supabase.from('production_goals').select('*'); 
      return (data || []).map((g: any) => ({ ...g, targetQuantity: g.target_quantity })); 
  },

  getStandardOperations: async () => { await getOrgId(); const { data } = await supabase.from('standard_operations').select('*'); return (data || []).map((op: any) => ({ ...op, standardTimeMinutes: op.standard_time_minutes, costPerMinute: op.cost_per_minute, laborType: op.labor_type })); },
  addStandardOperation: async (name: string, machine: string) => { const orgId = await getOrgId(); await supabase.from('standard_operations').insert([{ name, machine, organization_id: orgId }]); return ApiService.getStandardOperations(); },
  removeStandardOperation: async (id: string) => { await supabase.from('standard_operations').delete().eq('id', id); return ApiService.getStandardOperations(); },

  getStandardSizes: async () => { await getOrgId(); const { data } = await supabase.from('settings').select('value').eq('type', 'size'); return data?.map((s:any)=>s.value) || []; },
  addStandardSize: async (value: string) => { const orgId = await getOrgId(); await supabase.from('settings').insert([{ type: 'size', value, organization_id: orgId }]); return ApiService.getStandardSizes(); },
  removeStandardSize: async (value: string) => { await supabase.from('settings').delete().eq('type', 'size').eq('value', value); return ApiService.getStandardSizes(); },

  getStandardUnits: async () => { await getOrgId(); const { data } = await supabase.from('settings').select('value').eq('type', 'unit'); return data?.map((s:any)=>s.value) || []; },
  addStandardUnit: async (value: string) => { const orgId = await getOrgId(); await supabase.from('settings').insert([{ type: 'unit', value, organization_id: orgId }]); return ApiService.getStandardUnits(); },
  removeStandardUnit: async (value: string) => { await supabase.from('settings').delete().eq('type', 'unit').eq('value', value); return ApiService.getStandardUnits(); },

  getColors: async () => { await getOrgId(); const { data } = await supabase.from('colors').select('*'); return data || []; },
  addColor: async (name: string, hex: string) => { const orgId = await getOrgId(); await supabase.from('colors').insert([{ name, hex, organization_id: orgId }]); return ApiService.getColors(); },
  removeColor: async (id: string) => { await supabase.from('colors').delete().eq('id', id); return ApiService.getColors(); },

  getObservations: async () => { await getOrgId(); const { data } = await supabase.from('standard_observations').select('*'); return data || []; },
  addObservation: async (text: string, category: string) => { const orgId = await getOrgId(); await supabase.from('standard_observations').insert([{ text, category, organization_id: orgId }]); return ApiService.getObservations(); },
  removeObservation: async (id: string) => { await supabase.from('standard_observations').delete().eq('id', id); return ApiService.getObservations(); },

  getWarehouses: async () => { await getOrgId(); const { data } = await supabase.from('warehouses').select('*'); return data || []; },
  saveWarehouse: async (wh: Warehouse) => {
      const orgId = await getOrgId();
      const payload = { name: wh.name, location: wh.location, type: wh.type, organization_id: orgId };
      if (wh.id && wh.id.length === 36) await supabase.from('warehouses').update(payload).eq('id', wh.id);
      else await supabase.from('warehouses').insert([payload]);
      return ApiService.getWarehouses();
  },
  deleteWarehouse: async (id: string) => { await supabase.from('warehouses').delete().eq('id', id); return ApiService.getWarehouses(); },

  revertRevisionToSubcontractor: async (opId: string) => {
      const { error } = await supabase.from('production_orders').update({
          status: 'Em Costura (Facção)',
          revision_details: null
      }).eq('id', opId);
      if (error) throw error;
      return true;
  },

  revertPackingToRevision: async (opId: string) => {
      const { error } = await supabase.from('production_orders').update({
          status: 'Revisão',
          packing_details: null
      }).eq('id', opId);
      if (error) throw error;
      return true;
  }
};
