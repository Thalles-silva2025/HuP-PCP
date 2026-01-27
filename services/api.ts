
import { supabase } from './supabase';
import {
  Product, ProductionOrder, Partner, Material, StandardOperation,
  StandardObservation, Color, SubcontractorOrder, FinishedProductStock,
  WIPItem, OrderStatus, ProductStatus,
  UnitOfMeasure, ReturnItem, MaterialType, CuttingJob, PaymentRecord,
  Warehouse, ProductionGoal, TechPack, BOMItem, Operation, MeasurementPoint,
  ProductionOrderItem, MaterialVariant, ConsolidatedRequirement, OrganizationConfig
} from '../types';

// ... (helper functions getOrgId, getCurrentUserName remain unchanged)
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
        originalItems: data.original_items || [], // Garante array vazio se nulo
        phaseDates: data.phase_dates,
        subcontractor: data.subcontractor,
        // Novos campos mapeados do banco (snake_case) para o frontend (camelCase)
        selectedFabricId: data.selected_fabric_id || '', 
        fabricPurchasedTotal: Number(data.fabric_purchased_total) || 0,
        fabricPurchasedBreakdown: data.fabric_purchased_breakdown || {},
        plannedMarkerWidth: Number(data.planned_marker_width) || 0,
        plannedMarkerLength: Number(data.planned_marker_length) || 0
    };
}

function mapOsfFromDB(data: any): SubcontractorOrder {
    if (!data) return {} as SubcontractorOrder;
    return {
        id: data.id,
        opId: data.op_id,
        subcontractorName: data.subcontractor_name || data.partner_name, // Fallback para partner_name antigo
        type: data.type,
        sentDate: data.sent_date,
        // CORREÇÃO CRÍTICA: Mapear quantity_sent (banco) para sentQuantity (frontend)
        sentQuantity: data.quantity_sent !== undefined ? data.quantity_sent : data.sent_quantity, 
        receivedQuantity: data.quantity_received !== undefined ? data.quantity_received : data.received_quantity,
        defectiveQuantity: data.quantity_defect !== undefined ? data.quantity_defect : (data.defective_quantity || 0),
        
        status: data.status,
        itemsSnapshot: data.items_snapshot,
        materialsSnapshot: data.materials_snapshot,
        itemsReturned: data.items_returned || [], // Garante array
        returnDate: data.return_date,
        conferente: data.conferente,
        observations: data.observations
    };
}

export const ApiService = {
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
          invoiceFooterText: data.invoice_footer_text,
          leadTimeCutting: data.lead_time_cutting,
          leadTimeSewing: data.lead_time_sewing,
          leadTimeRevision: data.lead_time_revision,
          leadTimePacking: data.lead_time_packing
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
          lead_time_cutting: config.leadTimeCutting,
          lead_time_sewing: config.leadTimeSewing,
          lead_time_revision: config.leadTimeRevision,
          lead_time_packing: config.leadTimePacking,
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
      
      // Tratamento para UUID vazio
      const fabricId = opData.selectedFabricId && opData.selectedFabricId.trim() !== '' ? opData.selectedFabricId : null;

      const payload = {
          lot_number: opData.lot_number,
          product_id: opData.product_id,
          tech_pack_version: opData.tech_pack_version,
          quantity_total: opData.quantity_total,
          items: opData.items,
          original_items: opData.original_items || [], // Mapeamento correto na criação
          status: opData.status,
          start_date: opData.start_date,
          due_date: opData.due_date,
          phase_dates: opData.phase_dates,
          subcontractor: opData.subcontractor,
          cutting_details: opData.cutting_details,
          cost_snapshot: opData.cost_snapshot,
          organization_id: orgId,
          created_at: new Date().toISOString(),
          events: opData.events || [],
          // Novos Campos
          selected_fabric_id: fabricId,
          fabric_purchased_total: opData.fabric_purchased_total || 0,
          fabric_purchased_breakdown: opData.fabric_purchased_breakdown || {},
          planned_marker_width: opData.planned_marker_width || 0,
          planned_marker_length: opData.planned_marker_length || 0
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
      
      // CORREÇÃO: Mapeamento explícito para salvar o snapshot da grade original
      if (data.originalItems) payload.original_items = data.originalItems;
      
      // Novos Campos para atualização
      if (data.selectedFabricId !== undefined) {
          payload.selected_fabric_id = data.selectedFabricId && data.selectedFabricId.trim() !== '' ? data.selectedFabricId : null;
      }
      if (data.fabricPurchasedTotal !== undefined) payload.fabric_purchased_total = data.fabricPurchasedTotal;
      if (data.fabricPurchasedBreakdown !== undefined) payload.fabric_purchased_breakdown = data.fabricPurchasedBreakdown;
      if (data.plannedMarkerWidth !== undefined) payload.planned_marker_width = data.plannedMarkerWidth;
      if (data.plannedMarkerLength !== undefined) payload.planned_marker_length = data.plannedMarkerLength;

      const { error } = await supabase.from('production_orders').update(payload).eq('id', id).eq('organization_id', orgId);
      if (error) throw error;
      return true;
  },

  deleteProductionOrder: async (id: string) => {
      const orgId = await getOrgId();
      const { error } = await supabase.from('production_orders').delete().eq('id', id).eq('organization_id', orgId);
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
          subcontractor_name: data.subcontractorName || data.partnerName,
          partner_name: data.subcontractorName || data.partnerName, // Garante compatibilidade
          type: data.type,
          // CORREÇÃO: Salvar nos campos corretos do banco
          quantity_sent: data.sentQuantity, 
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
      const orgId = await getOrgId();
      // Permite cancelar (excluir) se estiver apenas Enviado
      const { error } = await supabase.from('subcontractor_orders').delete().eq('id', osfId).eq('organization_id', orgId);
      if (error) throw error;
      return true;
  },

  registerReturn: async (osfId: string, currentBatchItems: ReturnItem[], conferente: string) => {
      // 1. Busca a OSF para obter estado atual
      const { data: osfData, error: fetchError } = await supabase
          .from('subcontractor_orders')
          .select('*')
          .eq('id', osfId)
          .single();
      
      if (fetchError) throw fetchError;
      
      const osf = mapOsfFromDB(osfData);

      // 2. Calcula Quantidades Acumuladas
      // Soma o que já foi recebido antes (armazenado no banco) com o lote atual (input do usuário)
      const previousReceivedTotal = osf.receivedQuantity || 0;
      const currentBatchTotal = currentBatchItems.reduce((a, b) => a + b.quantity, 0);
      const newTotalReceived = previousReceivedTotal + currentBatchTotal;
      
      // Defeitos também acumulam
      const previousDefectTotal = osf.defectiveQuantity || 0;
      const currentBatchDefect = currentBatchItems.filter(i => i.type === 'defect').reduce((a, b) => a + b.quantity, 0);
      const newTotalDefect = previousDefectTotal + currentBatchDefect;

      // 3. Atualiza a Grade Acumulada (items_returned)
      // Mescla o array antigo com o novo para manter o histórico por tamanho/cor
      const previousItems = osf.itemsReturned || [];
      const newCumulativeItems = [...previousItems];

      currentBatchItems.forEach(newItem => {
          const existingIndex = newCumulativeItems.findIndex(
              prev => prev.color === newItem.color && prev.size === newItem.size
          );

          if (existingIndex >= 0) {
              // Se já existe, soma
              newCumulativeItems[existingIndex] = {
                  ...newCumulativeItems[existingIndex],
                  quantity: newCumulativeItems[existingIndex].quantity + newItem.quantity
              };
          } else {
              // Se novo, adiciona
              newCumulativeItems.push(newItem);
          }
      });

      // 4. Determina o Status (Parcial vs Concluído)
      const totalSent = osf.sentQuantity || 0;
      // Se recebeu tudo (ou mais), está concluído
      const isCompleted = newTotalReceived >= totalSent;
      const newStatus = isCompleted ? 'Concluido' : 'Parcial';

      // 5. Histórico de Logs (Append)
      const newHistoryEntry = {
          date: new Date().toISOString(),
          conferente: conferente,
          items: currentBatchItems,
          total: currentBatchTotal
      };
      const returnHistory = (osfData.return_history || []);
      returnHistory.push(newHistoryEntry);

      // 6. Atualiza a OSF no Banco
      const { error: updateError } = await supabase.from('subcontractor_orders').update({
          quantity_received: newTotalReceived,
          quantity_defect: newTotalDefect,
          items_returned: newCumulativeItems, // Salva o acumulado para a UI bloquear corretamente
          return_history: returnHistory,
          return_date: new Date().toISOString(), // Data do último recebimento
          conferente: conferente,
          status: newStatus
      }).eq('id', osfId);
      
      if (updateError) throw updateError;

      // 7. NEW: LOGAR NA OP (Ficha de Produção) COM NOME DO CONFERENTE E DETALHES
      if (osf.opId) {
          const { data: opData } = await supabase.from('production_orders').select('events').eq('id', osf.opId).single();
          const currentEvents = opData?.events || [];
          
          const newEvent = {
              date: new Date().toISOString(),
              user: conferente || 'Sistema',
              action: 'Recebimento Facção',
              description: `Recebido: ${currentBatchTotal} pçs | Defeitos: ${currentBatchDefect} pçs | Conferente: ${conferente} | Status: ${newStatus}`,
              type: 'info'
          };

          const updates: any = { events: [...currentEvents, newEvent] };

          // Lógica de Mudança de Status da OP
          // Se for Parcial, NÃO muda a OP (continua "Em Costura").
          // Se for Concluído, move a OP para "Revisão".
          if (isCompleted) {
              updates.status = 'Revisão'; // OrderStatus.QUALITY_CONTROL
          }

          await supabase.from('production_orders').update(updates).eq('id', osf.opId);
      }

      return true;
  },

  revertSubcontractorReceipt: async (osfId: string) => {
      // 1. Busca a OSF para saber qual é a OP
      const { data: osf, error: fetchError } = await supabase
          .from('subcontractor_orders')
          .select('op_id')
          .eq('id', osfId)
          .single();
      
      if (fetchError) throw fetchError;

      // 2. CHECKPOINT 3: VERIFICAR SE JÁ EXISTE REVISÃO
      // Se a OP já foi conferida (aprovada/rejeitada) no módulo de Revisão, não podemos estornar a facção
      // pois isso quebraria a integridade do estoque e dos dados.
      if (osf && osf.op_id) {
          const { data: op } = await supabase
              .from('production_orders')
              .select('status, revision_details')
              .eq('id', osf.op_id)
              .single();
          
          if (op) {
              // Verifica se avançou de fase
              if (op.status === 'Embalagem' || op.status === 'Concluído') {
                  throw new Error("Não é possível estornar: A OP já avançou para Embalagem/Finalização.");
              }

              // Verifica se tem apontamentos na revisão (JSONB)
              const approved = Number(op.revisionDetails?.approvedQty) || 0;
              const rejected = Number(op.revisionDetails?.rejectedQty) || 0;
              const rework = Number(op.revisionDetails?.reworkQty) || 0;

              if (approved > 0 || rejected > 0 || rework > 0) {
                  throw new Error("Não é possível estornar: Já existem peças conferidas no módulo de Revisão. Estorne a revisão primeiro.");
              }
          }
      }

      // 3. Reseta a OSF para 'Enviado' (Limpa tudo para recomeçar)
      const { error: updateError } = await supabase.from('subcontractor_orders').update({
          quantity_received: 0,
          quantity_defect: 0,
          items_returned: [], // Limpa grade
          return_history: [], // Limpa histórico
          return_date: null,
          conferente: null,
          status: 'Enviado'
      }).eq('id', osfId);

      if (updateError) throw updateError;

      // 4. Retorna a OP para 'Em Costura (Facção)'
      if (osf && osf.op_id) {
          await supabase.from('production_orders').update({
              status: 'Em Costura (Facção)' // OrderStatus.SEWING
          }).eq('id', osf.op_id);
      }

      return true;
  },

  createReworkOrder: async (opId: string, subcontractor: string, quantity: number, items: any[], description: string) => {
      const orgId = await getOrgId();
      const payload = {
          op_id: opId,
          subcontractor_name: subcontractor,
          partner_name: subcontractor,
          type: 'Retrabalho',
          quantity_sent: quantity, // CORREÇÃO
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
      // Busca todas as entradas de produtos acabados (vindas da Embalagem)
      const { data } = await supabase.from('finished_goods').select('*'); 
      return (data || []).map((item: any) => ({
          ...item,
          opId: item.op_id,
          opLotNumber: item.op_lot_number,
          productId: item.product_id
      })); 
  },

  // NEW: Busca as saídas/exportações
  getInventoryExports: async () => {
      await getOrgId();
      const { data } = await supabase.from('inventory_exports').select('*');
      return data || [];
  },

  // NEW: Cria registros de saída
  createInventoryExport: async (items: any[]) => {
      const orgId = await getOrgId();
      const payloads = items.map(item => ({
          organization_id: orgId,
          product_id: item.productId,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          destination: item.destination,
          responsible: item.responsible,
          created_at: new Date().toISOString()
      }));
      
      const { error } = await supabase.from('inventory_exports').insert(payloads);
      if (error) throw error;
      return true;
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

  // --- Products & Tech Packs ---
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
            .sort((a: any, b: any) => b.version - a.version)
      })); 
  },

  getProductsLite: async () => {
      await getOrgId();
      const { data } = await supabase
          .from('products')
          .select('id, sku, name, collection, image_url, sizes, colors, status, tech_packs(id, version, status, is_frozen, active_sizes, total_cost)');
      
      return (data || []).map((p: any) => ({
          ...p,
          imageUrl: p.image_url,
          techPacks: (p.tech_packs || []).map((tp: any) => ({
              id: tp.id,
              version: tp.version,
              status: tp.status,
              isFrozen: tp.is_frozen,
              activeSizes: tp.active_sizes,
              totalCost: tp.total_cost
          })).sort((a: any, b: any) => b.version - a.version)
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
    const { count } = await supabase
        .from('production_orders')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', id)
        .neq('status', 'Concluído')
        .neq('status', 'Cancelado');

    if (count !== null && count > 0) {
        throw new Error(`Não é possível excluir este produto pois existem ${count} ordens de produção ativas vinculadas a ele. Desative o produto em vez de excluir.`);
    }
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
        const { error } = await supabase.from('tech_packs').update(payload).eq('id', existingTP.id);
        if (error) throw new Error(`Erro ao atualizar Ficha: ${error.message}`);
        return existingTP.id;
    } else {
        const { data, error } = await supabase.from('tech_packs').insert([{ ...payload, created_at: new Date().toISOString() }]).select('id').single();
        if (error) throw new Error(`Erro ao criar Ficha: ${error.message}`);
        return data.id;
    }
  },

  getMaterials: async () => { 
      await getOrgId(); 
      const { data } = await supabase.from('materials').select('*'); 
      return (data || []).map((m: any) => ({ 
          ...m, 
          costUnit: m.cost_unit, 
          currentStock: m.current_stock, 
          hasColors: m.has_colors, 
          usageStage: m.usage_stage // Garante leitura
      })); 
  },
  
  saveMaterial: async (material: Partial<Material>) => {
    const orgId = await getOrgId();
    const payload = { 
        name: material.name, code: material.code, type: material.type, unit: material.unit,
        cost_unit: material.costUnit, current_stock: material.currentStock, supplier: material.supplier,
        status: material.status, has_colors: material.hasColors, variants: material.variants, properties: material.properties,
        usage_stage: material.usageStage, // Garante gravação
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
          date: p.date || p.created_at,
          dueDate: p.due_date // Map database column due_date to dueDate
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
