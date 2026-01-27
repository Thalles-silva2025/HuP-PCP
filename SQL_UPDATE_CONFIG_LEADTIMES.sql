
-- 1. Adiciona colunas de Lead Time na tabela de configurações
ALTER TABLE organization_configs 
ADD COLUMN IF NOT EXISTS lead_time_cutting INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS lead_time_sewing INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS lead_time_revision INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS lead_time_packing INTEGER DEFAULT 1;

-- 2. Atualiza cache do PostgREST
NOTIFY pgrst, 'reload schema';
