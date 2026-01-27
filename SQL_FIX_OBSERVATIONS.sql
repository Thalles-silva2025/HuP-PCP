
-- 1. Adiciona a coluna observations se ela não existir
ALTER TABLE subcontractor_orders 
ADD COLUMN IF NOT EXISTS observations TEXT;

-- 2. Atualiza cache da API
NOTIFY pgrst, 'reload schema';
