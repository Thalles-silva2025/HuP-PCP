
-- 🚑 Script de Correção: Cadastro de Materiais (Insumos/Tecidos)
-- Resolve o erro "column does not exist" ao salvar materiais

-- 1. Adiciona a coluna 'usage_stage' (Etapa de Uso)
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS usage_stage TEXT;

-- 2. Adiciona colunas para controle de cores e variantes
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS has_colors BOOLEAN DEFAULT false;

ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- 3. Atualiza registros antigos para evitar valores nulos
UPDATE materials SET has_colors = false WHERE has_colors IS NULL;
UPDATE materials SET variants = '[]'::jsonb WHERE variants IS NULL;

-- 4. Garante que a coluna properties (JSONB) exista
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT '{}'::jsonb;

-- 5. Atualiza o cache da API (Essencial)
NOTIFY pgrst, 'reload schema';
