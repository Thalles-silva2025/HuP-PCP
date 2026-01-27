
-- Adiciona a coluna conferente na tabela subcontractor_orders
ALTER TABLE subcontractor_orders 
ADD COLUMN IF NOT EXISTS conferente TEXT;

-- Atualiza o cache do esquema
NOTIFY pgrst, 'reload schema';
