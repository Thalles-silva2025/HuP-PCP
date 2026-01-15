
# 🚀 Script: Prioridade de Venda (Ficha Técnica)

Este script adiciona a coluna de prioridade de venda na tabela de fichas técnicas, permitindo classificar produtos como "Hype", "Vende Tudo", etc.

Rode no **SQL Editor** do Supabase:

```sql
-- 1. Adiciona a coluna sales_type se não existir
ALTER TABLE tech_packs 
ADD COLUMN IF NOT EXISTS sales_type TEXT DEFAULT 'Normal';

-- 2. Adiciona validação para garantir apenas os tipos permitidos pelo sistema
-- (Remove constraint antiga se existir para atualizar)
ALTER TABLE tech_packs DROP CONSTRAINT IF EXISTS tech_packs_sales_type_check;

ALTER TABLE tech_packs 
ADD CONSTRAINT tech_packs_sales_type_check 
CHECK (sales_type IN ('Normal', 'Vende Bem', 'Vende Tudo', 'Hype'));

-- 3. Atualiza cache da API
NOTIFY pgrst, 'reload schema';
```
