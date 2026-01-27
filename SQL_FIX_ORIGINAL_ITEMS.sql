
-- 1. Adiciona a coluna original_items (JSONB) para salvar o histórico da grade
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS original_items JSONB DEFAULT '[]'::jsonb;

-- 2. Comentário para documentação
COMMENT ON COLUMN production_orders.original_items IS 'Snapshot da grade original planejada (items) antes de alterações de corte excedente';

-- 3. Força a atualização do Cache de Esquema da API (Essencial para corrigir o erro Could not find...)
NOTIFY pgrst, 'reload schema';
