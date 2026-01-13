
# 🚑 Script de Correção: Coluna de Eventos

Rode este script no **SQL Editor** do Supabase para corrigir o erro:
`"Could not find the 'events' column of 'production_orders' in the schema cache"`

```sql
-- 1. Adiciona a coluna events (JSONB) se ela não existir
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]'::jsonb;

-- 2. Atualiza registros antigos que possam estar com events NULO
UPDATE production_orders 
SET events = '[]'::jsonb 
WHERE events IS NULL;

-- 3. Comentário para documentação
COMMENT ON COLUMN production_orders.events IS 'Histórico de eventos e logs da ordem de produção';
```
