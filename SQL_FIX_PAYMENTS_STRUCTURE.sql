
-- 1. Garante a tabela de pagamentos
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    
    -- Vínculos
    op_id UUID REFERENCES production_orders(id), -- Alterado para UUID para join correto
    partner_name TEXT NOT NULL,
    partner_type TEXT, -- 'Cortador', 'Facção', 'Revisão', 'Embalagem'
    
    -- Detalhes do Serviço
    stage TEXT, -- 'Corte', 'Costura', etc.
    quantity_delivered NUMERIC DEFAULT 0,
    rate_per_piece NUMERIC DEFAULT 0,
    
    -- Financeiro
    total_amount NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pendente', -- 'Pendente', 'Parcial', 'Pago'
    
    -- Datas
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()), -- Data da Execução
    due_date TIMESTAMP WITH TIME ZONE, -- Data de Vencimento
    
    -- Bancário
    bank_account_name TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Correção de Colunas (Caso a tabela já exista mas esteja incompleta)
DO $$
BEGIN
    BEGIN ALTER TABLE payments ADD COLUMN op_id UUID REFERENCES production_orders(id); EXCEPTION WHEN OTHERS THEN END;
    BEGIN ALTER TABLE payments ADD COLUMN due_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE payments ADD COLUMN bank_account_name TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE payments ADD COLUMN quantity_delivered NUMERIC DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- 3. Habilitar Segurança (RLS)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acesso
DROP POLICY IF EXISTS "Access own payments" ON payments;
CREATE POLICY "Access own payments" ON payments
    USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()));

-- 5. Índices para Performance (Listagem Rica)
CREATE INDEX IF NOT EXISTS idx_payments_op_id ON payments(op_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_partner ON payments(partner_name);

-- 6. Atualizar Cache
NOTIFY pgrst, 'reload schema';
