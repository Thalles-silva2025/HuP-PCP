
# 🚑 Script de Correção: Tabelas Faltantes & RLS

Este script resolve o erro `relation "settings" does not exist`. Ele cria as tabelas de configuração e reinicia o processo de permissões.

Rode no **SQL Editor** do Supabase:

```sql
-- 1. Cria a tabela de Configurações (Tamanhos e Unidades) se não existir
CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    type TEXT NOT NULL, -- 'size' ou 'unit'
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Cria outras tabelas auxiliares que costumam faltar
CREATE TABLE IF NOT EXISTS colors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    hex TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS standard_observations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    text TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS production_goals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    month TEXT NOT NULL,
    target_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Garante colunas críticas em tech_packs
ALTER TABLE tech_packs 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 4. Agora aplica as Permissões (RLS) com segurança
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
        -- Verifica se a tabela existe antes de alterar
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            
            -- A. Habilita RLS
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);

            -- B. Remove políticas antigas
            EXECUTE format('DROP POLICY IF EXISTS "Access for own organization" ON %I;', tbl);
            
            -- C. Cria a POLÍTICA UNIFICADA
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
            
        END IF;
    END LOOP;
END $$;

-- 5. Inserir dados padrão (apenas se as tabelas estiverem vazias) para você não começar do zero
INSERT INTO settings (type, value)
SELECT 'size', s FROM unnest(ARRAY['P', 'M', 'G', 'GG']) as s
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE type = 'size');

INSERT INTO settings (type, value)
SELECT 'unit', u FROM unnest(ARRAY['kg', 'm', 'un', 'rolo']) as u
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE type = 'unit');

-- 6. Atualizar dados órfãos para a organização do usuário atual
DO $$
DECLARE
    target_org_id UUID;
BEGIN
    SELECT organization_id INTO target_org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;

    IF target_org_id IS NOT NULL THEN
        UPDATE settings SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE colors SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE standard_observations SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE production_goals SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE tech_packs SET organization_id = target_org_id WHERE organization_id IS NULL;
    END IF;
END $$;
```
