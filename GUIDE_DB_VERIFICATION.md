
# 🛡️ HubTex: Verificação de Integridade do Banco de Dados

Rode este script no **SQL Editor** do Supabase para garantir que todas as tabelas e colunas necessárias para o aplicativo existam. Este script é "Idempotente" (seguro para rodar várias vezes sem duplicar dados ou dar erro).

### Copie e cole no SQL Editor:

```sql
-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Organizações (Multi-tenancy)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT,
    plan_tier TEXT DEFAULT 'starter',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Perfis de Usuário (HubTex Profile)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    full_name TEXT,
    role TEXT DEFAULT 'user',
    company_name TEXT,
    phone TEXT,
    revenue_range TEXT,
    employees_count TEXT,
    market_years TEXT,
    production_model TEXT,
    main_pain_point TEXT,
    is_profitable BOOLEAN,
    loss_areas TEXT,
    current_system TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Materiais
CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    type TEXT,
    unit TEXT,
    current_stock NUMERIC DEFAULT 0,
    cost_unit NUMERIC DEFAULT 0,
    supplier TEXT,
    status TEXT DEFAULT 'Ativo',
    has_colors BOOLEAN DEFAULT false,
    variants JSONB DEFAULT '[]'::jsonb, -- Armazena array de cores [{id, name, stock}]
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Produtos
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sku TEXT,
    name TEXT NOT NULL,
    collection TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'Ativo',
    sizes TEXT[] DEFAULT '{}', 
    colors TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Fichas Técnicas (Tech Packs)
CREATE TABLE IF NOT EXISTS tech_packs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'rascunho',
    is_frozen BOOLEAN DEFAULT false,
    materials JSONB DEFAULT '[]'::jsonb, -- BOM Items
    operations JSONB DEFAULT '[]'::jsonb, -- Sequence
    measurements JSONB DEFAULT '[]'::jsonb,
    secondary_cuts JSONB DEFAULT '[]'::jsonb,
    active_sizes TEXT[] DEFAULT '{}',
    material_cost NUMERIC DEFAULT 0,
    labor_cost NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    suggested_price NUMERIC DEFAULT 0,
    current_price NUMERIC DEFAULT 0,
    sales_type TEXT DEFAULT 'Normal',
    approved_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Parceiros (Facções)
CREATE TABLE IF NOT EXISTS partners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'Facção',
    contract_type TEXT DEFAULT 'PJ',
    address TEXT,
    phone TEXT,
    cnpj TEXT,
    default_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 8. Ordens de Produção (OPs)
CREATE TABLE IF NOT EXISTS production_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lot_number TEXT NOT NULL,
    product_id UUID REFERENCES products(id),
    tech_pack_version INTEGER,
    quantity_total INTEGER DEFAULT 0,
    items JSONB DEFAULT '[]'::jsonb, -- Grade [{color, size, qty}]
    status TEXT DEFAULT 'Planejado',
    start_date DATE,
    due_date DATE,
    subcontractor TEXT,
    cost_snapshot NUMERIC DEFAULT 0,
    cutting_details JSONB DEFAULT '{}'::jsonb,
    revision_details JSONB DEFAULT '{}'::jsonb,
    packing_details JSONB DEFAULT '{}'::jsonb,
    events JSONB DEFAULT '[]'::jsonb,
    active_link JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 9. OSF (Ordem Serviço Facção / Remessa)
CREATE TABLE IF NOT EXISTS subcontractor_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    op_id UUID REFERENCES production_orders(id),
    subcontractor_name TEXT,
    sent_date DATE,
    sent_quantity INTEGER DEFAULT 0,
    received_quantity INTEGER DEFAULT 0,
    defective_quantity INTEGER DEFAULT 0,
    return_date DATE,
    status TEXT DEFAULT 'Enviado',
    items_returned JSONB DEFAULT '[]'::jsonb,
    observations TEXT,
    external_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 10. Depósitos
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 11. Habilitar Segurança (RLS) - Essencial para Proteção de Dados
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- 12. Políticas de Acesso Genéricas (Apenas Usuários Autenticados)
-- (Para multi-tenant real, precisaríamos filtrar por organization_id)

CREATE POLICY "Enable read access for authenticated users" ON user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable update for users based on id" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Enable insert for authenticated users" ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Para outras tabelas, permitimos tudo para usuários logados por enquanto (MVP)
CREATE POLICY "Auth Users All Access" ON materials FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth Users All Access" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth Users All Access" ON tech_packs FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth Users All Access" ON partners FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth Users All Access" ON production_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth Users All Access" ON subcontractor_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth Users All Access" ON warehouses FOR ALL TO authenticated USING (true);

```
