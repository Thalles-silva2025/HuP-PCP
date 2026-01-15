
-- 1. Cria a tabela de logs do sistema
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    type TEXT, -- 'success', 'error', 'warning', 'info'
    action TEXT,
    details TEXT,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Habilita Segurança (RLS)
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
-- Permitir inserir logs (qualquer usuário autenticado)
DROP POLICY IF EXISTS "Users can insert logs" ON system_logs;
CREATE POLICY "Users can insert logs" ON system_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Permitir ver logs da própria organização
DROP POLICY IF EXISTS "Users can view own org logs" ON system_logs;
CREATE POLICY "Users can view own org logs" ON system_logs FOR SELECT 
USING (
    organization_id IN (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
);

-- 4. Atualizar cache da API
NOTIFY pgrst, 'reload schema';
