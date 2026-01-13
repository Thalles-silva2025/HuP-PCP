
import { supabase } from './supabase';
import {
  Product, ProductionOrder, Partner, Material, StandardOperation,
  StandardObservation, Color, SubcontractorOrder, FinishedProductStock,
  WIPItem, OrderStatus, ProductStatus,
  UnitOfMeasure, ReturnItem, MaterialType, CuttingJob, PaymentRecord,
  Warehouse, ProductionGoal, TechPack, BOMItem, Operation, MeasurementPoint,
  ProductionOrderItem, MaterialVariant, ConsolidatedRequirement
} from '../types';

/**
 * 🔒 CORE API SERVICE
 * -------------------
 * Responsável por todas as chamadas ao Supabase.
 * Inclui verificação de Organização para garantir Multi-tenancy.
 * AGORA COM AUTO-REPARO DE PERFIL E LOGS DETALHADOS.
 */

const getOrgId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
      console.error("API ERROR: Tentativa de acesso sem usuário autenticado.");
      throw new Error('Sessão expirada. Recarregue a página.');
  }
  
  // 1. Tenta buscar perfil existente
  let { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, id')
    .eq('id', user.id)
    .maybeSingle();
    
  // 2. Lógica de Auto-Reparo (Self-Healing)
  if (!profile || !profile.organization_id) {
      console.log("⚠️ Usuário sem organização detectado. Iniciando provisionamento automático...");
      
      try {
          // A. Cria uma nova Organização
          const { data: newOrg, error: orgError } = await supabase
              .from('organizations')
              .insert([{ name: 'Minha Confecção' }]).select('id').single();

          if (orgError || !newOrg) {
              console.error("Erro ao criar organização automática:", orgError);
              throw new Error("Falha ao criar organização.");
          }

          // B. Cria ou Atualiza o Perfil com a nova Organização
          const updates = {
              id: user.id,
              email: user.email,
              organization_id: newOrg.id,
              role: 'admin',
              onboarding_completed: false,
              updated_at: new Date().toISOString()
          };

          const { data: newProfile, error: profError } = await supabase
              .from('user_profiles')
              .upsert(updates)
              .select('organization_id')
              .single();

          if (profError || !newProfile) {
              console.error("Erro ao vincular perfil:", profError);
              throw new Error("Falha ao vincular usuário.");
          }

          return newProfile.organization_id;

      } catch (err) {
          console.error("CRITICAL: Falha no auto-reparo de conta:", err);
          throw new Error('Configuração de conta incompleta. Contate o suporte.');
      }
  }
  
  return profile.organization_id;
};

// Helper interno para obter nome do usuário atual
const getCurrentUserName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Sistema';
    
    const { data } = await supabase.from('user_profiles').select('full_name, email').eq('id', user.id).single();
    return data?.full_name || data?.email?.split('@')[0] || 'Usuário';
};

export const ApiService = {
  getProductionOrders: async (): Promise<ProductionOrder[]> => {
    // RLS filtra automaticamente, mas chamamos getOrgId para garantir que a sessão é válida antes da request
    await getOrgId(); 
    const { data, error } = await supabase.from('production_orders').select('*');
    if (error) {
        console.error("Erro ao buscar OPs:", error);
        throw error;
    }
    
    return data.map((op: any) => ({
        id: op.id,
        lotNumber: op.lot_number,
        productId: op.product_id,
        techPackVersion: op.tech_pack_version,
        quantityTotal: op.quantity_total,
        items: op.items || [],
        status: op.status,
        startDate: op.start_date,
        dueDate: op.due_date,
        subcontractor: op.subcontractor,
        createdAt: op.created_at,
        costSnapshot: op.cost_snapshot,
        cuttingDetails: op.cutting_details,
        subcontractorDetails: op.subcontractor_details,
        revisionDetails: op.revision_details,
        packingDetails: op.packing_details,
        events: op.events || [],
        phaseDates: op.phase_dates
    }));
  },

  getProducts: async (): Promise<Product[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('products').select('*, tech_packs(*)');
    if (error) throw error;
    return data.map((p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        collection: p.collection,
        status: p.status,
        sizes: p.sizes || [],
        colors: p.colors || [],
        imageUrl: p.image_url,
        techPacks: (p.tech_packs || []).map((tp: any) => ({
            id: tp.id,
            productId: tp.product_id,
            version: tp.version,
            status: tp.status,
            materials: tp.materials || [],
            operations: tp.operations || [],
            measurements: tp.measurements || [],
            secondaryCuts: tp.secondary_cuts || [],
            activeSizes: tp.active_sizes || [],
            standardObservations: tp.standard_observations || [],
            materialCost: tp.material_cost,
            laborCost: tp.labor_cost,
            totalCost: tp.total_cost,
            suggestedPrice: tp.suggested_price,
            targetMargin: tp.target_margin,
            salesType: tp.sales_type,
            createdAt: tp.created_at,
            approvedBy: tp.approved_by,
            extraCosts: tp.extra_costs,
            taxes: tp.taxes,
            commercialExpenses: tp.commercial_expenses
        }))
    }));
  },

  getMaterials: async (): Promise<Material[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('materials').select('*');
    if (error) throw error;
    return data.map((m: any) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        type: m.type,
        unit: m.unit,
        currentStock: m.current_stock,
        costUnit: m.cost_unit,
        supplier: m.supplier,
        status: m.status,
        hasColors: m.has_colors,
        variants: m.variants || [],
        properties: m.properties
    }));
  },

  getPartners: async (): Promise<Partner[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('partners').select('*');
    if (error) throw error;
    return data.map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        contractType: p.contract_type,
        address: p.address,
        phone: p.phone,
        cnpj: p.cnpj,
        defaultRate: p.default_rate
    }));
  },

  getPayments: async (): Promise<PaymentRecord[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('payments').select('*');
    if (error) throw error;
    return data.map((p: any) => ({
        id: p.id,
        opId: p.op_id,
        partnerName: p.partner_name,
        partnerType: p.partner_type,
        stage: p.stage,
        totalAmount: p.total_amount,
        amountPaid: p.amount_paid,
        remainingAmount: p.total_amount - p.amount_paid,
        quantityDelivered: p.quantity_delivered,
        ratePerPiece: p.rate_per_piece,
        status: p.status,
        date: p.due_date || p.created_at,
        bankAccountName: p.bank_account_name
    }));
  },

  getProductionGoals: async (): Promise<ProductionGoal[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('production_goals').select('*');
    if (error) throw error;
    return data.map((g: any) => ({
        month: g.month,
        targetQuantity: g.target_quantity
    }));
  },

  getStandardOperations: async (): Promise<StandardOperation[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('standard_operations').select('*');
    if (error) throw error;
    return data.map((o: any) => ({
        id: o.id,
        name: o.name,
        machine: o.machine,
        standardTimeMinutes: o.standard_time_minutes,
        costPerMinute: o.cost_per_minute,
        laborType: o.labor_type
    }));
  },

  getStandardSizes: async (): Promise<string[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('settings').select('value').eq('type', 'size');
    if (error) throw error;
    return data.map((s: any) => s.value);
  },

  getStandardUnits: async (): Promise<string[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('settings').select('value').eq('type', 'unit');
    if (error) throw error;
    return data.map((s: any) => s.value);
  },

  getColors: async (): Promise<Color[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('colors').select('*');
    if (error) throw error;
    return data;
  },

  getObservations: async (): Promise<StandardObservation[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('standard_observations').select('*');
    if (error) throw error;
    return data;
  },

  getWarehouses: async (): Promise<Warehouse[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('warehouses').select('*');
    if (error) throw error;
    return data;
  },

  getFinishedGoods: async (): Promise<FinishedProductStock[]> => {
    await getOrgId();
    // 1. Busca os dados brutos de estoque
    const { data: stockData, error } = await supabase.from('finished_goods').select('*');
    if (error) throw error;

    // 2. Extrai IDs de OPs únicos para buscar os números de lote
    const opIds = Array.from(new Set(stockData.map((s: any) => s.op_id).filter(Boolean)));
    let opMap: Record<string, string> = {};

    if (opIds.length > 0) {
        // Busca OPs para fazer o "Join" manual (Mais seguro que join na query com RLS complexo)
        const { data: ops } = await supabase.from('production_orders').select('id, lot_number').in('id', opIds);
        if (ops) {
            ops.forEach((op: any) => { opMap[op.id] = op.lot_number; });
        }
    }

    return stockData.map((s: any) => ({
        id: s.id,
        productId: s.product_id,
        opId: s.op_id,
        opLotNumber: opMap[s.op_id] || s.op_id || 'N/A', // Mapeia UUID para Lote Legível
        warehouse: s.warehouse,
        quantity: s.quantity,
        color: s.color,
        size: s.size,
        cost: s.cost,
        price: s.price,
        date: s.created_at,
        status: s.status
    }));
  },

  getWIPInventory: async (): Promise<WIPItem[]> => {
    await getOrgId();
    const { data: ops, error } = await supabase.from('production_orders')
        .select('*, products(name)')
        .neq('status', OrderStatus.COMPLETED)
        .neq('status', OrderStatus.CANCELLED)
        .neq('status', OrderStatus.DRAFT);
    if (error) throw error;
    return ops.map((op: any) => ({
        opId: op.id,
        product: { name: op.products?.name } as Product, 
        quantity: op.quantity_total,
        stage: op.status,
        startDate: op.start_date,
        subcontractor: op.subcontractor
    }));
  },

  getSubcontractorOrders: async (): Promise<SubcontractorOrder[]> => {
    await getOrgId();
    const { data, error } = await supabase.from('subcontractor_orders').select('*');
    if (error) throw error;
    return data.map((o: any) => ({
        id: o.id,
        opId: o.op_id,
        parentId: o.parent_id,
        subcontractorName: o.partner_name,
        type: o.type,
        sentDate: o.sent_date,
        sentQuantity: o.quantity_sent,
        receivedQuantity: o.quantity_received,
        defectiveQuantity: o.quantity_defect,
        returnDate: o.return_date,
        itemsReturned: o.items_returned,
        returnHistory: o.return_history,
        status: o.status,
        externalToken: o.external_token,
        observations: o.observations_snapshot,
        itemsSnapshot: o.items_snapshot,
        materialsSnapshot: o.materials_snapshot
    }));
  },

  getProductionOrderById: async (id: string): Promise<ProductionOrder | null> => {
    await getOrgId();
    const { data, error } = await supabase.from('production_orders').select('*').eq('id', id).single();
    if (error) return null;
    return {
        id: data.id,
        lotNumber: data.lot_number,
        productId: data.product_id,
        techPackVersion: data.tech_pack_version,
        quantityTotal: data.quantity_total,
        items: data.items,
        status: data.status,
        startDate: data.start_date,
        dueDate: data.due_date,
        subcontractor: data.subcontractor,
        createdAt: data.created_at,
        costSnapshot: data.cost_snapshot,
        cuttingDetails: data.cutting_details,
        revisionDetails: data.revision_details,
        packingDetails: data.packing_details,
        events: data.events || [],
        phaseDates: data.phase_dates
    };
  },

  createProductionOrder: async (data: any) => {
    const orgId = await getOrgId();
    const currentUser = await getCurrentUserName();

    // Garante que evento inicial tenha usuário
    const initialEvents = (data.events || []).map((e: any) => ({ ...e, user: e.user === 'Sistema' ? currentUser : e.user }));

    const { error } = await supabase.from('production_orders').insert([{
        lot_number: data.lotNumber,
        product_id: data.productId,
        tech_pack_version: data.techPackVersion,
        quantity_total: data.quantityTotal,
        items: data.items,
        status: data.status,
        start_date: data.startDate,
        due_date: data.dueDate,
        subcontractor: data.subcontractor,
        cost_snapshot: data.costSnapshot,
        cutting_details: data.cuttingDetails,
        phase_dates: data.phaseDates,
        organization_id: orgId,
        events: initialEvents
    }]);
    if (error) throw error;
    return true;
  },

  updateProductionOrder: async (id: string, data: Partial<ProductionOrder>) => {
    await getOrgId();
    const currentUser = await getCurrentUserName();
    
    const updatePayload: any = {};
    if (data.status) updatePayload.status = data.status;
    if (data.quantityTotal) updatePayload.quantity_total = data.quantityTotal;
    if (data.cuttingDetails) updatePayload.cutting_details = data.cuttingDetails;
    if (data.revisionDetails) updatePayload.revision_details = data.revisionDetails;
    if (data.packingDetails) updatePayload.packing_details = data.packingDetails;
    if (data.subcontractor) updatePayload.subcontractor = data.subcontractor;
    
    // --- EVENT LOGIC REINFORCED ---
    // Se o payload já traz events, asseguramos que o último tenha o usuário real se estiver genérico
    if (data.events && data.events.length > 0) {
        const events = [...data.events];
        // Atualiza o último evento com o usuário real se necessário (para garantir rastreio)
        const lastEvent = events[events.length - 1];
        if (!lastEvent.user || lastEvent.user === 'Sistema') {
            events[events.length - 1] = { ...lastEvent, user: currentUser };
        }
        updatePayload.events = events;
    } else {
        // Se não veio evento, busca os atuais e adiciona um genérico para garantir que "cada salvamento gere log"
        const { data: currentOp } = await supabase.from('production_orders').select('events').eq('id', id).single();
        const existingEvents = currentOp?.events || [];
        
        // Evita duplicar log se o último for muito recente (debounce de 1s) ou idêntico
        const last = existingEvents[existingEvents.length - 1];
        const isRecent = last && (new Date().getTime() - new Date(last.date).getTime() < 2000);
        
        if (!isRecent) {
            existingEvents.push({
                date: new Date().toISOString(),
                user: currentUser,
                action: 'Atualização',
                description: 'Dados da ordem atualizados manualmente.',
                type: 'update'
            });
            updatePayload.events = existingEvents;
        }
    }
    
    // Logic for Final Stock Entry
    if (data.status === OrderStatus.COMPLETED && data.packingDetails?.isFinalized) {
        const orgId = await getOrgId();
        const items = data.packingDetails.itemsPacked || data.items || [];
        const stockInserts = items.map((item: any) => ({
            product_id: data.productId,
            op_id: id, // Mantém UUID para vínculo forte
            warehouse: data.packingDetails?.warehouse,
            quantity: item.quantity,
            color: item.color,
            size: item.size,
            cost: data.costSnapshot || 0,
            status: 'Disponível',
            organization_id: orgId
        }));
        await supabase.from('finished_goods').insert(stockInserts);
    }

    const { error } = await supabase.from('production_orders').update(updatePayload).eq('id', id);
    if (error) throw error;
    return true;
  },

  createReworkOrder: async (opId: string, partnerName: string, reworkQty: number, itemsSnapshot: any[], defectsDescription: string) => {
      const orgId = await getOrgId();
      const currentUser = await getCurrentUserName();
      
      const { data: partner } = await supabase.from('partners').select('id').eq('name', partnerName).single();
      const partnerId = partner?.id;

      const { error } = await supabase.from('subcontractor_orders').insert([{
          op_id: opId,
          partner_id: partnerId,
          partner_name: partnerName,
          type: 'Retrabalho', 
          quantity_sent: reworkQty,
          status: 'Enviado',
          sent_date: new Date().toISOString(),
          items_snapshot: itemsSnapshot,
          observations_snapshot: `RETRABALHO: ${defectsDescription}`, 
          organization_id: orgId
      }]);

      if (error) throw error;

      const { data: currentOp } = await supabase.from('production_orders').select('events').eq('id', opId).single();
      const events = currentOp?.events || [];
      events.push({
          date: new Date().toISOString(),
          user: currentUser, // Usa o usuário logado
          action: 'Envio Retrabalho',
          description: `Enviado ${reworkQty} pçs para conserto na facção ${partnerName}.`,
          type: 'alert'
      });

      await supabase.from('production_orders').update({ events }).eq('id', opId);
      return true;
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
    
    if (product.id) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
    }
    return true;
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

    if (techPack.id && !techPack.id.startsWith('tp-')) {
        const { error } = await supabase.from('tech_packs').update(payload).eq('id', techPack.id);
        if (error) throw error;
        return techPack.id;
    } else {
        const { data, error } = await supabase.from('tech_packs').insert([payload]).select('id').single();
        if (error) throw error;
        return data.id;
    }
  },

  savePartner: async (partner: Partner) => {
    const orgId = await getOrgId();
    const payload = {
        name: partner.name,
        type: partner.type,
        contract_type: partner.contractType,
        address: partner.address,
        phone: partner.phone,
        default_rate: partner.defaultRate,
        organization_id: orgId
    };
    if (partner.id && !partner.id.startsWith('PTR-')) {
        await supabase.from('partners').update(payload).eq('id', partner.id);
    } else {
        await supabase.from('partners').insert([payload]);
    }
    return ApiService.getPartners();
  },

  deletePartner: async (id: string) => {
    await getOrgId();
    await supabase.from('partners').delete().eq('id', id);
    return ApiService.getPartners();
  },

  saveMaterial: async (material: Partial<Material>) => {
    const orgId = await getOrgId();
    const payload = {
        code: material.code,
        name: material.name,
        type: material.type,
        unit: material.unit,
        current_stock: material.currentStock,
        cost_unit: material.costUnit,
        supplier: material.supplier,
        status: material.status,
        has_colors: material.hasColors,
        variants: material.variants,
        properties: material.properties,
        organization_id: orgId
    };
    if (material.id && !material.id.startsWith('MAT-')) {
        await supabase.from('materials').update(payload).eq('id', material.id);
    } else {
        await supabase.from('materials').insert([payload]);
    }
    return true;
  },

  deleteMaterial: async (id: string) => {
    await getOrgId();
    await supabase.from('materials').delete().eq('id', id);
    return ApiService.getMaterials();
  },

  addStandardOperation: async (name: string, machine: string) => {
    const orgId = await getOrgId();
    await supabase.from('standard_operations').insert([{ name, machine, organization_id: orgId }]);
    return ApiService.getStandardOperations();
  },
  removeStandardOperation: async (id: string) => {
    await getOrgId();
    await supabase.from('standard_operations').delete().eq('id', id);
    return ApiService.getStandardOperations();
  },
  addStandardSize: async (value: string) => {
    const orgId = await getOrgId();
    await supabase.from('settings').insert([{ type: 'size', value, organization_id: orgId }]);
    return ApiService.getStandardSizes();
  },
  removeStandardSize: async (value: string) => {
    await getOrgId();
    await supabase.from('settings').delete().eq('type', 'size').eq('value', value);
    return ApiService.getStandardSizes();
  },
  addStandardUnit: async (value: string) => {
    const orgId = await getOrgId();
    await supabase.from('settings').insert([{ type: 'unit', value, organization_id: orgId }]);
    return ApiService.getStandardUnits();
  },
  removeStandardUnit: async (value: string) => {
    await getOrgId();
    await supabase.from('settings').delete().eq('type', 'unit').eq('value', value);
    return ApiService.getStandardUnits();
  },
  addColor: async (name: string, hex: string) => {
    const orgId = await getOrgId();
    await supabase.from('colors').insert([{ name, hex, organization_id: orgId }]);
    return ApiService.getColors();
  },
  removeColor: async (id: string) => {
    await getOrgId();
    await supabase.from('colors').delete().eq('id', id);
    return ApiService.getColors();
  },
  addObservation: async (text: string, category: string) => {
    const orgId = await getOrgId();
    await supabase.from('standard_observations').insert([{ text, category, organization_id: orgId }]);
    return ApiService.getObservations();
  },
  removeObservation: async (id: string) => {
    await getOrgId();
    await supabase.from('standard_observations').delete().eq('id', id);
    return ApiService.getObservations();
  },
  saveWarehouse: async (wh: Warehouse) => {
    const orgId = await getOrgId();
    const payload = { name: wh.name, location: wh.location, type: wh.type, organization_id: orgId };
    if (wh.id) await supabase.from('warehouses').update(payload).eq('id', wh.id);
    else await supabase.from('warehouses').insert([payload]);
    return ApiService.getWarehouses();
  },
  deleteWarehouse: async (id: string) => {
    await getOrgId();
    await supabase.from('warehouses').delete().eq('id', id);
    return ApiService.getWarehouses();
  },

  revertStockToPacking: async (id: string) => {
    await getOrgId();
    const { data: stock, error } = await supabase.from('finished_goods').select('*').eq('id', id).single();
    if (error) throw error;
    await supabase.from('finished_goods').delete().eq('id', id);
    await supabase.from('production_orders').update({ status: OrderStatus.PACKING }).eq('id', stock.op_id);
    return true;
  },

  markStockAsExported: async (ids: string[]) => {
    await getOrgId();
    await supabase.from('finished_goods').update({ status: 'Exportado' }).in('id', ids);
    return true;
  },

  revertRevisionToSubcontractor: async (opId: string) => {
    await getOrgId();
    await supabase.from('production_orders').update({ status: OrderStatus.SEWING }).eq('id', opId);
    return true;
  },

  revertPackingToRevision: async (opId: string) => {
    await getOrgId();
    await supabase.from('production_orders').update({ status: OrderStatus.QUALITY_CONTROL }).eq('id', opId);
    return true;
  },

  saveProductionGoal: async (goal: ProductionGoal) => {
    const orgId = await getOrgId();
    const { data } = await supabase.from('production_goals').select('*').eq('month', goal.month).single();
    if (data) {
        await supabase.from('production_goals').update({ target_quantity: goal.targetQuantity }).eq('id', data.id);
    } else {
        await supabase.from('production_goals').insert([{ month: goal.month, target_quantity: goal.targetQuantity, organization_id: orgId }]);
    }
    return true;
  },

  registerReturn: async (osfId: string, items: ReturnItem[], conferente: string) => {
    await getOrgId(); // Valida sessão
    const totalReturned = items.reduce((a,b) => a + b.quantity, 0);
    
    const { data: osf, error } = await supabase.from('subcontractor_orders').select('*').eq('id', osfId).single();
    if (error || !osf) throw new Error('Ordem de serviço (OSF) não encontrada.');

    const newReceived = (osf.quantity_received || 0) + totalReturned;
    
    const isCompleted = newReceived >= (osf.quantity_sent || 0);
    const newStatus = isCompleted ? 'Concluido' : 'Parcial';
    
    const returnEvent = {
        date: new Date().toISOString(),
        conferente,
        items,
        totalQuantity: totalReturned
    };

    const newHistory = [...(osf.return_history || []), returnEvent];

    const { error: updateError } = await supabase.from('subcontractor_orders').update({
        quantity_received: newReceived,
        status: newStatus,
        return_date: new Date().toISOString(),
        return_history: newHistory,
        items_returned: items
    }).eq('id', osfId);

    if (updateError) throw updateError;

    if (isCompleted) {
        const { data: opData } = await supabase.from('production_orders').select('events').eq('id', osf.op_id).single();
        const currentEvents = opData?.events || [];

        await ApiService.updateProductionOrder(osf.op_id, {
            status: OrderStatus.QUALITY_CONTROL, 
            events: [
                ...currentEvents,
                {
                    date: new Date().toISOString(),
                    user: conferente,
                    action: osf.type === 'Retrabalho' ? 'Retorno Retrabalho' : 'Retorno Facção',
                    description: `Retorno total registrado (${osf.type}). OP movida para Revisão.`,
                    type: 'status_change'
                }
            ]
        });
    }

    return true;
  },

  createSubcontractorOrder: async (data: any) => {
      const orgId = await getOrgId();
      const currentUser = await getCurrentUserName();
      
      const { data: newOsf, error } = await supabase.from('subcontractor_orders').insert([{
          op_id: data.opId,
          partner_id: data.partnerId, 
          partner_name: data.subcontractorName,
          type: data.type,
          quantity_sent: data.sentQuantity,
          status: 'Enviado',
          sent_date: new Date().toISOString(),
          items_snapshot: data.itemsSnapshot,
          materials_snapshot: data.materialsSnapshot,
          observations_snapshot: data.observations,
          organization_id: orgId
      }]).select().single();

      if (error) throw new Error(error.message);

      const { data: currentOp } = await supabase
        .from('production_orders')
        .select('events')
        .eq('id', data.opId)
        .single();
      
      const currentEvents = currentOp?.events || [];

      const updateData: any = {
          events: [
              ...currentEvents,
              {
                  date: new Date().toISOString(),
                  user: currentUser,
                  action: data.type === 'Retrabalho' ? 'Envio Retrabalho' : 'Envio Facção',
                  description: `Remessa (${data.type}) gerada para ${data.subcontractorName}. Qtd: ${data.sentQuantity}`,
                  type: 'status_change'
              }
          ]
      };

      if (data.type !== 'Retrabalho') {
          updateData.status = OrderStatus.SEWING;
          updateData.subcontractor = data.subcontractorName;
      }

      await ApiService.updateProductionOrder(data.opId, updateData);

      return {
          id: newOsf.id,
          opId: newOsf.op_id,
          partnerId: newOsf.partner_id,
          subcontractorName: newOsf.partner_name,
          type: newOsf.type,
          sentDate: newOsf.sent_date,
          returnDate: newOsf.return_date,
          status: newOsf.status,
          sentQuantity: newOsf.quantity_sent,
          receivedQuantity: newOsf.quantity_received,
          defectiveQuantity: newOsf.quantity_defect,
          itemsSnapshot: newOsf.items_snapshot,
          materialsSnapshot: newOsf.materials_snapshot,
          observations: newOsf.observations_snapshot,
          returnHistory: newOsf.return_history || []
      } as SubcontractorOrder;
    },
};
