
# 🚑 Script de Correção: Estoque (Inventory) - Versão Segura

Este script resolve o erro `Could not find the table 'public.finished_goods'`, tratando conflitos de nomes de tabelas antigas.

Rode no **SQL Editor** do Supabase:

```sql
-- 1. Habilita extensão necessária
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Renomeia tabelas antigas APENAS se o nome novo estiver livre
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finished_goods_stock') 
       AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finished_goods') THEN
        ALTER TABLE finished_goods_stock RENAME TO finished_goods;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finished_products_stock') 
       AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finished_goods') THEN
        ALTER TABLE finished_products_stock RENAME TO finished_goods;
    END IF;
END $$;

-- 3. Cria a tabela se ainda não existir
CREATE TABLE IF NOT EXISTS finished_goods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    product_id UUID REFERENCES products(id),
    op_id UUID,
    warehouse TEXT,
    quantity NUMERIC DEFAULT 0,
    color TEXT,
    size TEXT,
    cost NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Disponível',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Garante colunas
ALTER TABLE finished_goods ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE finished_goods ADD COLUMN IF NOT EXISTS op_id UUID;
ALTER TABLE finished_goods ADD COLUMN IF NOT EXISTS warehouse TEXT;
ALTER TABLE finished_goods ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;
ALTER TABLE finished_goods ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Disponível';

-- 5. RLS (Segurança)
ALTER TABLE finished_goods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access for own organization" ON finished_goods;

CREATE POLICY "Access for own organization" ON finished_goods
FOR ALL
USING (
    organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
)
WITH CHECK (
    organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
);

-- 6. Atualizar Cache
NOTIFY pgrst, 'reload schema';
```
