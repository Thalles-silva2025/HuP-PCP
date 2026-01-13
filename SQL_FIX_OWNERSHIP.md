
# 👑 Script de Posse de Dados (Corrigido)

Este script:
1. Cria as colunas `organization_id` em todas as tabelas.
2. Vincula TODOS os dados existentes à organização do usuário que estiver rodando o comando.

```sql
-- 1. Garante que a tabela de Organizações existe
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Garante que o perfil do usuário tem a coluna organization_id
DO $$
BEGIN
    BEGIN
        ALTER TABLE user_profiles ADD COLUMN organization_id UUID REFERENCES organizations(id);
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- 3. Cria uma organização padrão para o usuário se ele não tiver
DO $$
DECLARE
    current_user_id UUID := auth.uid();
    new_org_id UUID;
BEGIN
    IF current_user_id IS NOT NULL THEN
        -- Verifica se já tem org
        IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = current_user_id AND organization_id IS NOT NULL) THEN
            -- Cria Org
            INSERT INTO organizations (name) VALUES ('Minha Organização') RETURNING id INTO new_org_id;
            -- Vincula User
            UPDATE user_profiles SET organization_id = new_org_id WHERE id = current_user_id;
        END IF;
    END IF;
END $$;

-- 4. Adiciona a coluna organization_id em TODAS as tabelas necessárias
DO $$
BEGIN
    -- Products
    BEGIN ALTER TABLE products ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    -- Materials
    BEGIN ALTER TABLE materials ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    -- Production Orders
    BEGIN ALTER TABLE production_orders ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    -- Partners
    BEGIN ALTER TABLE partners ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    -- Payments
    BEGIN ALTER TABLE payments ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    -- Subcontractor Orders
    BEGIN ALTER TABLE subcontractor_orders ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    -- Stock
    BEGIN ALTER TABLE finished_products_stock ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    -- Settings
    BEGIN ALTER TABLE standard_operations ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE standard_sizes ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE standard_units ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE colors ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE standard_observations ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE warehouses ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- 5. Atualiza os dados órfãos (que estão com organization_id NULL) para a organização do usuário atual
DO $$
DECLARE
    target_org_id UUID;
BEGIN
    SELECT organization_id INTO target_org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;

    IF target_org_id IS NOT NULL THEN
        UPDATE products SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE materials SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE production_orders SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE partners SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE payments SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE subcontractor_orders SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE finished_products_stock SET organization_id = target_org_id WHERE organization_id IS NULL;
        
        -- Settings
        UPDATE standard_operations SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE standard_sizes SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE standard_units SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE colors SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE standard_observations SET organization_id = target_org_id WHERE organization_id IS NULL;
        UPDATE warehouses SET organization_id = target_org_id WHERE organization_id IS NULL;
    END IF;
END $$;
```
