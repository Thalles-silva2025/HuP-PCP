
-- ⚡ SCRIPT DE PERFORMANCE E OTIMIZAÇÃO (TURBO) ⚡
-- Este script cria índices para acelerar drasticamente o Login e as consultas com RLS.

-- 1. Índices para a Tabela de Perfis (Crítico para Login)
CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_id ON user_profiles(id);

-- 2. Índices para Tabelas Principais (Crítico para RLS)
-- Como o RLS verifica "organization_id" em tudo, precisamos indexar essa coluna em tudo.

CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_materials_org ON materials(organization_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_org ON production_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_partners_org ON partners(organization_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_orders_org ON subcontractor_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_org ON finished_goods(organization_id);
CREATE INDEX IF NOT EXISTS idx_tech_packs_org ON tech_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);

-- 3. Índices para Relacionamentos (Foreign Keys)
-- Acelera joins e buscas de detalhes (ex: ver itens de uma OP)

-- Production Orders
CREATE INDEX IF NOT EXISTS idx_po_product_id ON production_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_lot_number ON production_orders(lot_number);

-- Tech Packs
CREATE INDEX IF NOT EXISTS idx_tp_product_id ON tech_packs(product_id);

-- Subcontractor Orders
CREATE INDEX IF NOT EXISTS idx_osf_op_id ON subcontractor_orders(op_id);
CREATE INDEX IF NOT EXISTS idx_osf_partner_id ON subcontractor_orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_osf_status ON subcontractor_orders(status);

-- Finished Goods (Estoque)
CREATE INDEX IF NOT EXISTS idx_stock_product_id ON finished_goods(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_op_id ON finished_goods(op_id);

-- 4. Otimização do Planejador de Consultas
ANALYZE user_profiles;
ANALYZE organizations;
ANALYZE production_orders;

-- 5. Mensagem de Sucesso
SELECT 'Índices criados e banco otimizado com sucesso. O Login deve estar mais rápido.' as status;
