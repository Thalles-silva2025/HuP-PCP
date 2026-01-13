
# 🛡️ Script Mestre de Permissões (RLS)

Este script resolve o problema de "não busca dados". Ele cria as regras que permitem ao seu usuário ver os dados vinculados à sua organização.

Rode no **SQL Editor** do Supabase:

```sql
-- 1. Garante a existência da tabela de Estoque com o nome correto (api.ts usa 'finished_goods')
CREATE TABLE IF NOT EXISTS finished_goods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    product_id UUID REFERENCES products(id),
    op_id UUID, -- Texto ou UUID dependendo da implementação, idealmente UUID se production_orders for UUID
    warehouse TEXT,
    quantity NUMERIC DEFAULT 0,
    color TEXT,
    size TEXT,
    cost NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Disponível',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Lista de todas as tabelas do sistema
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
        -- A. Habilita RLS em todas as tabelas
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);

        -- B. Remove políticas antigas para evitar duplicidade/conflito
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Access for own organization" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Users can view own organization data" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Users can insert own organization data" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Users can update own organization data" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Users can delete own organization data" ON %I;', tbl);
        EXCEPTION WHEN undefined_table THEN
            RAISE NOTICE 'Tabela % não existe ainda, pulando.', tbl;
        END;

        -- C. Cria uma POLÍTICA UNIFICADA (ALL = Select, Insert, Update, Delete)
        -- Esta regra diz: "O usuário pode fazer TUDO se o organization_id da linha for igual ao do perfil dele"
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

-- 3. Correção específica para tech_packs (pode não ter organization_id direto se for dependente de product)
-- Se tech_packs tiver organization_id, a regra acima funciona. Se não, rodar este comando:
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 4. Garantir que os dados existentes tenham organization_id
-- (Associa tudo à organização do usuário atual para corrigir dados órfãos)
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
