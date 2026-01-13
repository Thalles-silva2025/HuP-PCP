
# 🚑 Script de Correção Definitiva de Schema (V2)

Rode este script no **SQL Editor** do Supabase. Ele é seguro (usa `IF NOT EXISTS`), então não apagará dados, apenas adicionará o que falta.

```sql
-- 1. Adiciona a coluna de Facção/Subcontratado (Causa do erro atual)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS subcontractor TEXT;

-- 2. Garante as colunas de detalhes técnicos (JSONB)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS cutting_details JSONB DEFAULT '{}'::jsonb;

ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS revision_details JSONB DEFAULT '{}'::jsonb;

ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS packing_details JSONB DEFAULT '{}'::jsonb;

-- 3. Garante a coluna de Datas de Planejamento (Wizard Passo 3)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS phase_dates JSONB DEFAULT '{}'::jsonb;

-- 4. Garante snapshot de custo (caso falte)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS cost_snapshot NUMERIC DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN production_orders.subcontractor IS 'Nome do parceiro (Facção/Cortador) responsável ou status Interno';
COMMENT ON COLUMN production_orders.cutting_details IS 'Armazena matriz de corte, camadas e histórico de enfestos';
COMMENT ON COLUMN production_orders.phase_dates IS 'Datas planejadas para cada fase (Corte, Costura, Revisão, Embalagem)';
```
