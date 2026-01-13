
# 🛡️ Script de Blindagem: Sala de Corte

Rode este script para garantir que todas as colunas necessárias para o fluxo de corte e pagamento existam.

```sql
-- 1. TABELA DE ORDENS DE PRODUÇÃO (Garante JSONB para guardar os enfestos)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS cutting_details JSONB DEFAULT '{}'::jsonb;

ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS cost_snapshot NUMERIC DEFAULT 0;

-- 2. TABELA DE PARCEIROS (Necessário para calcular o valor do corte)
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS default_rate NUMERIC DEFAULT 0;

-- 3. TABELA DE PAGAMENTOS (Garante todos os campos do financeiro gerado)
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Colunas Essenciais
ALTER TABLE payments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS op_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS partner_type TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stage TEXT; -- Ex: 'Corte', 'Costura'
ALTER TABLE payments ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS quantity_delivered NUMERIC DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rate_per_piece NUMERIC DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pendente';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- 4. PERMISSÕES (RLS) - Evita erro de "Permission Denied"
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Garante política de acesso para Pagamentos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Users can manage their organization payments'
    ) THEN
        CREATE POLICY "Users can manage their organization payments" ON payments
        USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()))
        WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 5. RELATÓRIO FINAL
SELECT 'Verificação Concluída' as status, 
       (SELECT count(*) FROM production_orders WHERE status = 'Em Corte') as ops_em_corte,
       (SELECT count(*) FROM payments) as total_pagamentos_gerados;
```
