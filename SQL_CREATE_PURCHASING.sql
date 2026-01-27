
-- 1. Cria a tabela de Compras de Materiais
CREATE TABLE IF NOT EXISTS material_purchases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    
    -- Dados da Compra
    material_id UUID REFERENCES materials(id),
    supplier TEXT NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE,
    invoice_number TEXT,
    
    -- Valores
    quantity NUMERIC NOT NULL, -- Quantidade total comprada
    unit_price_paid NUMERIC NOT NULL, -- Preço pago nesta compra
    total_cost NUMERIC NOT NULL, -- quantity * unit_price_paid
    
    -- Auditoria de Custo (Para saber quanto variou do padrão)
    unit_price_standard_at_time NUMERIC, 
    
    -- Breakdown por Cor (Se houver)
    color_breakdown JSONB DEFAULT '{}'::jsonb, -- Ex: {"Azul": 100, "Vermelho": 50}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Habilita Segurança (RLS)
ALTER TABLE material_purchases ENABLE ROW LEVEL SECURITY;

-- 3. Cria Políticas de Acesso
DROP POLICY IF EXISTS "Users can manage own purchases" ON material_purchases;

CREATE POLICY "Users can manage own purchases" ON material_purchases
    USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()));

-- 4. Cria índices para performance
CREATE INDEX IF NOT EXISTS idx_purchases_material ON material_purchases(material_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON material_purchases(purchase_date);

-- 5. Atualiza o Cache da API
NOTIFY pgrst, 'reload schema';
