
-- Garante que a coluna status existe e define o padrão como 'Ativo'
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativo';

-- Garante que produtos antigos sem status fiquem ativos
UPDATE products SET status = 'Ativo' WHERE status IS NULL;

-- Atualiza cache
NOTIFY pgrst, 'reload schema';
