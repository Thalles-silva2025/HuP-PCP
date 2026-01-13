
# 🛡️ Script de Correção de RLS (Ordem Correta)

Este script corrige o erro `column "organization_id" does not exist` garantindo que a coluna seja criada antes da aplicação das regras.

Rode no **SQL Editor** do Supabase:

```sql
-- 1. CORREÇÃO IMEDIATA: Adiciona a coluna organization_id em tech_packs ANTES de tudo
ALTER TABLE tech_packs 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 2. Garante a existência da tabela de Estoque (caso ainda não exista)
CREATE TABLE IF NOT EXISTS finished_goods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    product_id UUID REFERENCES products(id),
    op_id TEXT, 
    warehouse TEXT,
    quantity NUMERIC DEFAULT 0,
    color TEXT,
    size TEXT,
    cost NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Disponível',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Agora que as colunas existem, aplica as políticas de segurança (RLS)
DO $$
DECLARE
    tables text[] := ARRAY[
        'products', 'materials', 'production_orders', 'partners', 
        'subcontractor_orders', 'payments', 'finished_goods', 
        'tech_packs', 'production_goals', 'warehouses',
        'standard_operations', 'standard_observations', 'colors', 'settings'
    ];
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- A. Habilita RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);

        -- B. Remove políticas antigas
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Access for own organization" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Users can view own organization data" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Users can insert own organization data" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Users can update own organization data" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Users can delete own organization data" ON %I;', tbl);
        EXCEPTION WHEN undefined_table THEN
            RAISE NOTICE 'Tabela % não existe, pulando.', tbl;
        END;

        -- C. Cria a POLÍTICA UNIFICADA
        -- Agora não dará erro pois garantimos que tech_packs tem organization_id no passo 1
        EXECUTE format('
            CREATE POLICY "Access for own organization" ON %I
            FOR ALL
            USING (
                organization_id IN (
                    SELECT organization_id FROM user_profiles WHERE id = auth.uid()
                )
            )
            WITH CHECK (
                organization_id IN (
                    SELECT organization_id FROM user_profiles WHERE id = auth.uid()
                )
            );
        ', tbl);
    END LOOP;
END $$;

-- 4. Garantir que os dados existentes tenham organization_id (Correção de Órfãos)
DO $$
DECLARE
    target_org_id UUID;
BEGIN
    SELECT organization_id INTO target_org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;

    IF target_org_id IS NOT NULL THEN
        UPDATE products SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE materials SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE production_orders SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE subcontractor_orders SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE payments SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE finished_goods SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE tech_packs SET organization_id = target_org_id WHERE organization_id IS NULL;
    END IF;
END $$;
```
