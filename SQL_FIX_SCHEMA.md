
# 🚑 Script de Correção de Schema

Rode este script no **SQL Editor** do Supabase para adicionar as colunas necessárias para o novo Módulo de Produção.

```sql
-- Adiciona colunas JSONB para armazenar detalhes complexos das etapas
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS cutting_details JSONB DEFAULT '{}'::jsonb;

ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS revision_details JSONB DEFAULT '{}'::jsonb;

ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS packing_details JSONB DEFAULT '{}'::jsonb;

-- Novo campo para o Planejamento de Datas (Wizard Passo 3)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS phase_dates JSONB DEFAULT '{}'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN production_orders.cutting_details IS 'Armazena matriz de corte, camadas e histórico de enfestos';
COMMENT ON COLUMN production_orders.phase_dates IS 'Datas planejadas para cada fase (Corte, Costura, Revisão, Embalagem)';
```
