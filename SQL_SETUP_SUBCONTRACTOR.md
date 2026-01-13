
# 🚀 Script: Configuração do Módulo de Facção (OSF)

Rode este script para criar a estrutura que suporta remessas, fichas de produção e histórico de retornos.

```sql
-- 1. Tabela de Ordens de Serviço de Facção (OSF)
CREATE TABLE IF NOT EXISTS subcontractor_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    op_id UUID REFERENCES production_orders(id),
    partner_id UUID REFERENCES partners(id), -- Pode ser nulo se for Interno
    partner_name TEXT NOT NULL,
    type TEXT DEFAULT 'Externa', -- 'Externa' ou 'Interna'
    status TEXT DEFAULT 'Enviado', -- 'Enviado', 'Parcial', 'Concluido'
    
    sent_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    return_date TIMESTAMP WITH TIME ZONE,
    
    -- Quantidades Totais
    quantity_sent INTEGER DEFAULT 0,
    quantity_received INTEGER DEFAULT 0,
    quantity_defect INTEGER DEFAULT 0,
    
    -- Snapshots (A "Foto" da Ficha Técnica no momento do envio)
    items_snapshot JSONB DEFAULT '[]'::jsonb, -- A grade enviada (Cor/Tam/Qtd)
    materials_snapshot JSONB DEFAULT '[]'::jsonb, -- Matéria prima calculada e enviada
    observations_snapshot TEXT, -- Texto consolidado das observações da Ficha Técnica
    
    -- Histórico de Retornos (Array de objetos)
    return_history JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Segurança (RLS)
ALTER TABLE subcontractor_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their organization osfs" ON subcontractor_orders;

CREATE POLICY "Users can manage their organization osfs" ON subcontractor_orders
    USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()));

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_osf_op_id ON subcontractor_orders(op_id);
CREATE INDEX IF NOT EXISTS idx_osf_status ON subcontractor_orders(status);
```
