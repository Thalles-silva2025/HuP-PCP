
-- 1. Cria a tabela de Exportações/Saídas de Estoque
CREATE TABLE IF NOT EXISTS inventory_exports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    product_id UUID REFERENCES products(id),
    
    -- Dados da Variante
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    
    -- Dados da Movimentação
    quantity NUMERIC NOT NULL,
    destination TEXT NOT NULL, -- Para onde foi (Loja X, Cliente Y)
    responsible TEXT NOT NULL, -- Quem autorizou/realizou
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Habilita Segurança (RLS)
ALTER TABLE inventory_exports ENABLE ROW LEVEL SECURITY;

-- 3. Cria Políticas de Acesso
DROP POLICY IF EXISTS "Users can manage own exports" ON inventory_exports;

CREATE POLICY "Users can manage own exports" ON inventory_exports
    USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()));

-- 4. Cria índices para performance do Cache Inteligente
CREATE INDEX IF NOT EXISTS idx_exports_product ON inventory_exports(product_id);
CREATE INDEX IF NOT EXISTS idx_exports_org ON inventory_exports(organization_id);

-- 5. Atualiza o Cache da API
NOTIFY pgrst, 'reload schema';
