
import { supabase } from './supabase';
import { MaterialPurchase, Material } from '../types';

/**
 * PurchasingService
 * Responsável por gerenciar compras de matéria-prima, cálculo de preço médio
 * e integração com financeiro.
 */
export const PurchasingService = {
    
    // Lista todas as compras (Histórico)
    getPurchases: async (): Promise<MaterialPurchase[]> => {
        try {
            const { data, error } = await supabase
                .from('material_purchases')
                .select(`
                    *,
                    material:materials (name, code, unit)
                `)
                .order('purchase_date', { ascending: false });

            if (error) throw error;

            return data.map((p: any) => ({
                id: p.id,
                materialId: p.material_id,
                materialName: p.material?.name,
                materialCode: p.material?.code,
                supplier: p.supplier,
                purchaseDate: p.purchase_date,
                invoiceNumber: p.invoice_number,
                quantity: Number(p.quantity),
                unitPricePaid: Number(p.unit_price_paid),
                totalCost: Number(p.total_cost),
                unitPriceStandard: Number(p.unit_price_standard_at_time),
                colorBreakdown: p.color_breakdown,
                status: p.status || 'Concluido', // Fallback for old data
                verifiedAt: p.verified_at,
                verifiedBy: p.verified_by,
                paymentId: p.payment_id
            }));
        } catch (error) {
            console.error("Erro ao buscar compras:", error);
            return [];
        }
    },

    // Registra uma nova compra (AGORA SEMPRE PENDENTE DE CONFERÊNCIA)
    registerPurchase: async (
        purchaseData: Omit<MaterialPurchase, 'id'>, 
        options: { createPayment: boolean, organizationId: string }
    ) => {
        const { materialId, quantity, unitPricePaid, colorBreakdown } = purchaseData;

        // 1. Gera Pagamento (Provisionamento Financeiro)
        let paymentId = null;
        if (options.createPayment) {
            const { data: payment, error: payError } = await supabase.from('payments').insert([{
                organization_id: options.organizationId,
                partner_name: purchaseData.supplier,
                partner_type: 'Fornecedor',
                stage: 'Compra Material',
                total_amount: quantity * unitPricePaid,
                amount_paid: 0, // Inicia pendente
                status: 'Pendente',
                date: purchaseData.purchaseDate,
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 Dias padrão
                op_id: null // Não vinculado a OP
            }]).select('id').single();
            
            if (payError) throw payError;
            paymentId = payment.id;
        }

        // 2. Busca material para logar custo atual (Snapshot)
        const { data: material } = await supabase
            .from('materials')
            .select('cost_unit')
            .eq('id', materialId)
            .single();

        // 3. Insere a Compra com Status PENDENTE
        const { data: purchase, error: purchError } = await supabase
            .from('material_purchases')
            .insert([{
                organization_id: options.organizationId,
                material_id: materialId,
                supplier: purchaseData.supplier,
                purchase_date: purchaseData.purchaseDate,
                invoice_number: purchaseData.invoiceNumber,
                quantity: quantity,
                unit_price_paid: unitPricePaid,
                total_cost: quantity * unitPricePaid,
                unit_price_standard_at_time: material?.cost_unit || 0,
                color_breakdown: colorBreakdown || {},
                status: 'Pendente',
                payment_id: paymentId
            }])
            .select()
            .single();

        if (purchError) throw purchError;

        return purchase;
    },

    // Conferência e Entrada Oficial
    verifyPurchase: async (
        purchaseId: string, 
        verifiedQty: number,
        verifierName: string
    ) => {
        // 1. Busca dados originais da compra
        const { data: purchase, error: fetchError } = await supabase
            .from('material_purchases')
            .select('*')
            .eq('id', purchaseId)
            .single();
        
        if (fetchError || !purchase) throw new Error('Compra não encontrada.');
        if (purchase.status === 'Concluido') throw new Error('Esta compra já foi conferida.');

        const unitPrice = Number(purchase.unit_price_paid);
        const newTotalCost = verifiedQty * unitPrice;

        // 2. Atualiza Estoque Físico
        const { data: material, error: matError } = await supabase
            .from('materials')
            .select('*')
            .eq('id', purchase.material_id)
            .single();
        
        if (matError) throw matError;

        const currentStock = Number(material.current_stock) || 0;
        const currentCost = Number(material.cost_unit) || 0;
        
        let newStock = currentStock + verifiedQty;
        // Recálculo de Custo Médio
        let newCost = currentCost;
        if (newStock > 0) {
            const totalValueOld = currentStock * currentCost;
            const totalValueNew = newTotalCost;
            newCost = (totalValueOld + totalValueNew) / newStock;
        }

        // Lógica de Variantes (Cores) - Proporcional
        let updatedVariants = material.variants || [];
        const originalQty = Number(purchase.quantity);
        const breakdown = purchase.color_breakdown;

        if (breakdown && Object.keys(breakdown).length > 0 && verifiedQty > 0) {
            const ratio = verifiedQty / originalQty; // Ajusta cores proporcionalmente se a qtd total mudou
            
            updatedVariants = updatedVariants.map((v: any) => {
                const addedQty = Math.floor((breakdown[v.name] || 0) * ratio);
                if (addedQty > 0) {
                    return { ...v, stock: (v.stock || 0) + addedQty };
                }
                return v;
            });
        }

        await supabase.from('materials').update({
            current_stock: newStock,
            cost_unit: newCost,
            variants: updatedVariants
        }).eq('id', purchase.material_id);

        // 3. Atualiza Financeiro (Se houver divergência de quantidade)
        if (purchase.payment_id) {
            await supabase.from('payments').update({
                total_amount: newTotalCost, // Ajusta o valor a pagar para o real recebido
            }).eq('id', purchase.payment_id);
        }

        // 4. Finaliza a Compra
        await supabase.from('material_purchases').update({
            status: 'Concluido',
            quantity: verifiedQty, // Salva o real
            total_cost: newTotalCost,
            verified_at: new Date().toISOString(),
            verified_by: verifierName
        }).eq('id', purchaseId);

        return true;
    }
};
