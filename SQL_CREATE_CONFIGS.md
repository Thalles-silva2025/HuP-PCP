
# ⚙️ Script: Configurações do Sistema

Este script cria uma tabela para armazenar preferências globais da empresa (Logo, Cores, Regras de Negócio).

Rode no **SQL Editor** do Supabase:

```sql
-- 1. Cria a tabela de configurações vinculada à organização
CREATE TABLE IF NOT EXISTS organization_configs (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identidade Visual
    company_logo_url TEXT,
    primary_color TEXT DEFAULT '#3b82f6', -- Azul padrão
    
    -- Preferências de Sistema
    enable_notifications BOOLEAN DEFAULT true,
    days_to_alert_overdue INTEGER DEFAULT 3, -- Dias antes para alertar vencimento
    
    -- Financeiro
    default_payment_terms TEXT DEFAULT '30 dias',
    
    -- Dados Fiscais / Rodapé de Relatórios
    invoice_footer_text TEXT,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Habilita Segurança (RLS)
ALTER TABLE organization_configs ENABLE ROW LEVEL SECURITY;

-- 3. Cria Políticas de Acesso
-- (Usuário vê/edita apenas a config da sua organização)

CREATE POLICY "Users can view own org config" ON organization_configs
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update own org config" ON organization_configs
    FOR UPDATE
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

CREATE POLICY "Users can insert own org config" ON organization_configs
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- 4. Atualizar Cache
NOTIFY pgrst, 'reload schema';
```
