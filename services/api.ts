
import { supabase } from './supabase';
import { Material, Product, ProductionOrder, UserProfile, Partner } from '../types';

/**
 * B-HUB API SERVICE (REAL DATA)
 * Este serviço substitui o mockDb.ts para conectar com o banco de dados Supabase.
 * Use este arquivo para implementar as chamadas reais de API.
 */

export const ApiService = {
  
  // --- USER PROFILES ---
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data as UserProfile;
  },

  updateProfile: async (userId: string, updates: Partial<UserProfile>) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- MATERIALS ---
  getMaterials: async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('status', 'Ativo'); // Exemplo de filtro básico
      
    if (error) throw error;
    
    // Mapeamento para garantir compatibilidade com a interface Typescript
    return data.map((m: any) => ({
        ...m,
        currentStock: Number(m.current_stock),
        costUnit: Number(m.cost_unit),
        properties: m.properties || {}
    })) as Material[];
  },

  saveMaterial: async (material: Partial<Material>) => {
    // Converter camelCase (Front) para snake_case (DB)
    const dbPayload = {
        code: material.code,
        name: material.name,
        type: material.type,
        unit: material.unit,
        current_stock: material.currentStock,
        cost_unit: material.costUnit,
        supplier: material.supplier,
        status: material.status,
        properties: material.properties
    };

    if (material.id) {
        const { error } = await supabase.from('materials').update(dbPayload).eq('id', material.id);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('materials').insert([dbPayload]);
        if (error) throw error;
    }
  },

  // --- PRODUCTS ---
  getProducts: async () => {
    // Busca produtos e suas fichas técnicas (join)
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        tech_packs (*)
      `);

    if (error) throw error;

    return data.map((p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        collection: p.collection,
        imageUrl: p.image_url,
        status: p.status,
        sizes: p.sizes || [],
        colors: p.colors || [],
        techPacks: p.tech_packs.map((tp: any) => ({
            id: tp.id,
            version: tp.version,
            status: tp.status,
            totalCost: tp.total_cost,
            materials: [], // Precisaria de outra query ou JSONB para popular
            operations: []
        }))
    })) as Product[];
  },

  // --- PARTNERS ---
  getPartners: async () => {
      const { data, error } = await supabase.from('partners').select('*');
      if (error) throw error;
      return data.map((p: any) => ({
          ...p,
          contractType: p.contract_type,
          defaultRate: p.default_rate
      })) as Partner[];
  }

  // TODO: Implementar Production Orders, Inventory e outros módulos
};
