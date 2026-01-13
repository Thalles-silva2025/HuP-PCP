
# 🚑 Script de Reparo: Tabela de Facções (OSF)

Rode este script no **SQL Editor** do Supabase para corrigir o erro `column "op_id" does not exist`.

```sql
-- 1. Garante que a tabela existe (cria apenas o básico se não existir)
CREATE TABLE IF NOT EXISTS subcontractor_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Adiciona todas as colunas necessárias com verificação de segurança
DO $$
BEGIN
    -- Identificador da Organização (Multi-tenant)
    BEGIN 
        ALTER TABLE subcontractor_orders ADD COLUMN organization_id UUID REFERENCES organizations(id); 
    EXCEPTION WHEN duplicate_column THEN END;

    -- Vínculo com a OP (Aqui estava o erro)
    BEGIN 
        ALTER TABLE subcontractor_orders ADD COLUMN op_id UUID REFERENCES production_orders(id); 
    EXCEPTION WHEN duplicate_column THEN END;

    -- Vínculo com o Parceiro
    BEGIN 
        ALTER TABLE subcontractor_orders ADD COLUMN partner_id UUID REFERENCES partners(id); 
    EXCEPTION WHEN duplicate_column THEN END;

    -- Dados Textuais e Status
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN partner_name TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN type TEXT DEFAULT 'Externa'; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN status TEXT DEFAULT 'Enviado'; EXCEPTION WHEN duplicate_column THEN END;
    
    -- Datas e Quantidades
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN sent_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN return_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN quantity_sent INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN quantity_received INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN quantity_defect INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    
    -- Snapshots (Campos JSONB importantes para a Ficha de Produção)
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN items_snapshot JSONB DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN materials_snapshot JSONB DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN observations_snapshot TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN return_history JSONB DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- 3. Recria os Índices (Agora vai funcionar, pois garantimos que op_id existe acima)
DROP INDEX IF EXISTS idx_osf_op_id;
CREATE INDEX IF NOT EXISTS idx_osf_op_id ON subcontractor_orders(op_id);

DROP INDEX IF EXISTS idx_osf_status;
CREATE INDEX IF NOT EXISTS idx_osf_status ON subcontractor_orders(status);

-- 4. Habilita e Configura Segurança (RLS)
ALTER TABLE subcontractor_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their organization osfs" ON subcontractor_orders;

CREATE POLICY "Users can manage their organization osfs" ON subcontractor_orders
    USING (organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ));

-- 5. Confirmação
SELECT 'Sucesso! Tabela subcontractor_orders corrigida e colunas adicionadas.' as status;
```
