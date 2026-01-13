
# 🚑 Script de Emergência: Colunas Críticas (Items & Events)

Este erro (`PGRST204`) acontece quando o Banco de Dados não tem uma coluna que o Site está tentando ler.

Rode este script no **SQL Editor** do Supabase para criar as colunas que faltam e **forçar a atualização** da API.

```sql
-- 1. Adiciona a coluna 'items' (Grade de Tamanho/Cor) na tabela production_orders
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2. Adiciona a coluna 'events' (Histórico de Logs)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]'::jsonb;

-- 3. Adiciona outras colunas JSONB complexas que costumam dar esse erro se faltarem
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS cutting_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS revision_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS packing_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS phase_dates JSONB DEFAULT '{}'::jsonb;

-- 4. Garante que subcontractor exista
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS subcontractor TEXT;

-- 5. COMANDO CRÍTICO: Recarrega o cache do Supabase para ele "enxergar" as novas colunas imediatamente
NOTIFY pgrst, 'reload schema';
```
