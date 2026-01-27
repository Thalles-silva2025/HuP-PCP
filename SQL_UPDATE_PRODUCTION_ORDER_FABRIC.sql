
-- Adiciona colunas para planejamento de tecido e risco (CAD)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS selected_fabric_id UUID, -- ID do tecido principal selecionado
ADD COLUMN IF NOT EXISTS fabric_purchased_total NUMERIC DEFAULT 0, -- Total comprado (geral)
ADD COLUMN IF NOT EXISTS fabric_purchased_breakdown JSONB DEFAULT '{}'::jsonb, -- Detalhe por cor { "Azul": 50, "Vermelho": 30 }
ADD COLUMN IF NOT EXISTS planned_marker_width NUMERIC DEFAULT 0, -- Largura do Risco
ADD COLUMN IF NOT EXISTS planned_marker_length NUMERIC DEFAULT 0; -- Comprimento do Risco

-- Comentários
COMMENT ON COLUMN production_orders.fabric_purchased_breakdown IS 'Quantidade de tecido comprado por cor (kg/m)';
COMMENT ON COLUMN production_orders.planned_marker_length IS 'Comprimento do risco planejado (CAD) em metros';
