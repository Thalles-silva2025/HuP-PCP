
# 🚑 Script de Correção: Coluna 'items' (Grade da OP)

Rode este script no **SQL Editor** do Supabase para corrigir o erro:
`"Could not find the 'items' column of 'production_orders' in the schema cache"`

```sql
-- 1. Adiciona a coluna items (JSONB) se ela não existir
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2. Garante que registros antigos não fiquem com valor NULO (evita erro no frontend)
UPDATE production_orders 
SET items = '[]'::jsonb 
WHERE items IS NULL;

-- 3. Comentário para documentação
COMMENT ON COLUMN production_orders.items IS 'Grade de produção (Array de {color, size, quantity})';

-- 4. Força a atualização do Cache de Esquema da API (Essencial para erros PGRST)
NOTIFY pgrst, 'reload schema';
```
