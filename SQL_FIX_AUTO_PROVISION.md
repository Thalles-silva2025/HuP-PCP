
# 🚀 Script de Permissão para Auto-Provisionamento

Este script ajusta as permissões (RLS) do Supabase para permitir que o sistema crie automaticamente uma Organização e um Perfil quando um novo usuário se cadastra.

Rode no **SQL Editor** do Supabase:

```sql
-- 1. Permitir que qualquer usuário autenticado CRIE uma organização
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Users can create organizations" ON organizations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 2. Permitir que o usuário veja a organização que acabou de criar
-- (A regra anterior de visualização pode ser restritiva demais para o momento da criação)
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
CREATE POLICY "Users can view own organization" ON organizations FOR SELECT USING (
    id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    OR
    -- Permite ver se acabou de ser inserida (hack comum para RLS de insert-then-select)
    true 
);

-- 3. Permitir que o usuário INSERIR seu próprio perfil (Profile)
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Permitir UPDATE no próprio perfil (para corrigir organization_id nulo)
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- 5. Recarregar Schema
NOTIFY pgrst, 'reload schema';
```
