
# 🔧 Script de Configuração: Retrabalho e Métricas de Qualidade

Este script atualiza a tabela de Ordens de Facção para aceitar o tipo 'Retrabalho' e garante índices para relatórios futuros de defeitos.

Rode no **SQL Editor** do Supabase:

```sql
-- 1. Atualizar a validação da coluna 'type' para aceitar 'Retrabalho' e 'Conserto'
ALTER TABLE subcontractor_orders 
DROP CONSTRAINT IF EXISTS subcontractor_orders_type_check;

ALTER TABLE subcontractor_orders 
ADD CONSTRAINT subcontractor_orders_type_check 
CHECK (type IN ('Interna', 'Externa', 'Retrabalho', 'Conserto'));

-- 2. Adicionar coluna para rastrear a Origem do Defeito (se foi costura, corte, etc)
ALTER TABLE subcontractor_orders 
ADD COLUMN IF NOT EXISTS defect_origin TEXT DEFAULT 'Costura';

-- 3. Índices para Relatórios de Performance (Para o Dashboard de Qualidade)
-- Permite buscar rapidamente "Quem são as facções com mais retrabalho?"
CREATE INDEX IF NOT EXISTS idx_osf_partner_type ON subcontractor_orders(partner_id, type);
CREATE INDEX IF NOT EXISTS idx_osf_defect_qty ON subcontractor_orders(quantity_defect);

-- 4. View de Relatório de Qualidade (Opcional, para facilitar Analytics futuro)
CREATE OR REPLACE VIEW view_partner_quality_metrics AS
SELECT 
    partner_name,
    COUNT(*) as total_orders,
    SUM(quantity_sent) as total_pieces,
    SUM(quantity_defect) as total_defects,
    SUM(CASE WHEN type = 'Retrabalho' THEN 1 ELSE 0 END) as rework_orders_count
FROM 
    subcontractor_orders
GROUP BY 
    partner_name;

-- 5. Atualizar cache
NOTIFY pgrst, 'reload schema';
```
