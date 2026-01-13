
# 🚑 Script de Correção: Tabela de Pagamentos

Rode este script no **SQL Editor** do Supabase para corrigir o erro "Could not find the 'organization_id' column".

```sql
-- 1. Se a tabela não existir, cria ela do zero
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Adiciona a coluna organization_id (Causa Principal do Erro)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 3. Garante que todas as colunas usadas pelo Módulo de Corte existam
ALTER TABLE payments ADD COLUMN IF NOT EXISTS op_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS partner_type TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS quantity_delivered NUMERIC DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rate_per_piece NUMERIC DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pendente';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- 4. Habilitar Segurança (RLS)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 5. Criar Política de Acesso (Para que o usuário possa salvar o pagamento)
DROP POLICY IF EXISTS "Users can manage their organization payments" ON payments;

CREATE POLICY "Users can manage their organization payments" ON payments
    USING (organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ));
```
