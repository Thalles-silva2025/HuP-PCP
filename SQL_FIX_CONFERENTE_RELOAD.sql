
-- 1. Garante que a coluna existe
ALTER TABLE subcontractor_orders 
ADD COLUMN IF NOT EXISTS conferente TEXT;

-- 2. Comando CRÍTICO: Força o PostgREST a recarregar o esquema do banco
-- Isso resolve o erro "Could not find the 'conferente' column... in the schema cache"
NOTIFY pgrst, 'reload schema';
