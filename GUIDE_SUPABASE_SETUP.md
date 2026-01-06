
# 📘 Guia Definitivo: Configuração do Banco de Dados (Supabase)

**Status:** Atualizado para Correção de Erros (Migração)

Se você encontrou o erro **`42P07: a relação "user_profiles" já existe`**, significa que a tabela já foi criada, mas provavelmente faltam as colunas novas do Onboarding.

---

## 🚑 Script de Migração / Correção (RODE ESTE PRIMEIRO)

Copie e rode este script no **SQL Editor** para corrigir a estrutura da tabela existente e adicionar os campos faltantes.

```sql
-- 1. Garante que a tabela base existe
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
);

-- 2. Adiciona as colunas novas se elas não existirem (Idempotente)
DO $$
BEGIN
    -- Campos Básicos
    BEGIN ALTER TABLE user_profiles ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN full_name TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'user'; EXCEPTION WHEN duplicate_column THEN END;
    
    -- Campos de Onboarding (Novos)
    BEGIN ALTER TABLE user_profiles ADD COLUMN company_name TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN phone TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN revenue_range TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN employees_count TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN market_years TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN production_model TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN main_pain_point TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN is_profitable BOOLEAN; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN loss_areas TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN current_system TEXT; EXCEPTION WHEN duplicate_column THEN END;
    
    -- Status e Datas
    BEGIN ALTER TABLE user_profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()); EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- 3. Habilitar segurança se ainda não estiver
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Criar política de acesso (Permitir que o usuário edite seu próprio perfil)
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
```

---

## Scripts de Instalação Limpa (Para novos projetos)

Se você está começando do zero (banco vazio), use a sequência abaixo.

### Script 1: Estrutura Base

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT,
    plan_tier TEXT DEFAULT 'starter',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela User Profiles completa
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

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    type TEXT CHECK (type IN ('Interno', 'Loja', 'Expedição')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
```

### Script 2: Tabelas de Produção

```sql
CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    unit TEXT NOT NULL,
    current_stock NUMERIC DEFAULT 0,
    cost_unit NUMERIC DEFAULT 0,
    supplier TEXT,
    status TEXT DEFAULT 'Ativo',
    properties JSONB DEFAULT '{}'::jsonb, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    collection TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'Ativo',
    ncm TEXT,
    gtin TEXT,
    origin TEXT,
    weight NUMERIC,
    gross_weight NUMERIC,
    price_cost NUMERIC,
    price_sale NUMERIC,
    sizes TEXT[] DEFAULT '{}', 
    colors TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ... (Restante das tabelas conforme versão anterior, mantendo consistência)
```
