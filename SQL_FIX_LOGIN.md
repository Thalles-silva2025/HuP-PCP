
# 🚑 Script de Resgate: Login e Perfil

Rode este script no **SQL Editor** do Supabase para corrigir as tabelas que impedem o login.

```sql
-- 1. Garante tabela de Organizações
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Garante tabela de Perfis com TODAS as colunas necessárias
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    email TEXT,
    role TEXT DEFAULT 'admin',
    full_name TEXT,
    company_name TEXT,
    phone TEXT,
    employees_count TEXT,
    revenue_range TEXT,
    production_model TEXT,
    main_pain_point TEXT,
    is_profitable BOOLEAN,
    loss_areas TEXT,
    current_system TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Garante colunas individuais (caso a tabela já exista mas incompleta)
DO $$
BEGIN
    BEGIN ALTER TABLE user_profiles ADD COLUMN organization_id UUID REFERENCES organizations(id); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE user_profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- 4. Habilita RLS (Segurança)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Permite que o usuário crie/edite seu próprio perfil (Essencial para o Auto-Reparo funcionar)
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can select own profile" ON user_profiles;
CREATE POLICY "Users can select own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);

-- 6. Permite criar organização (para novos usuários)
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Users can create organizations" ON organizations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
CREATE POLICY "Users can view own organization" ON organizations FOR SELECT USING (
    id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()) OR true
);

NOTIFY pgrst, 'reload schema';
```
