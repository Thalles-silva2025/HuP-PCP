
# 🕵️ Script de Diagnóstico de Ordens de Produção

Rode este script no **SQL Editor** do Supabase para verificar a saúde da tabela `production_orders` e garantir que o schema está profissional.

```sql
-- 1. Verificar Estrutura da Tabela (Colunas Essenciais)
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'production_orders'
ORDER BY 
    ordinal_position;

-- 2. Verificar Totais e Status
SELECT 
    status, 
    count(*) as total_ops,
    sum(quantity_total) as total_pecas
FROM 
    production_orders
GROUP BY 
    status;

-- 3. Verificar OPs Órfãs ou com IDs Estranhos (O problema do "-C")
SELECT 
    id, 
    lot_number, 
    created_at 
FROM 
    production_orders 
WHERE 
    lot_number LIKE '%-C' 
    OR lot_number LIKE '-%';

-- 4. Verificar se colunas JSONB críticas estão nulas
SELECT 
    count(*) as ops_sem_corte
FROM 
    production_orders
WHERE 
    cutting_details IS NULL;

-- 5. Verificar Últimas 10 OPs Criadas
SELECT * FROM production_orders ORDER BY created_at DESC LIMIT 10;
```
