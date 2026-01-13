
# 🚑 Script de Correção: Retorno de Facção e Status

Este script corrige o erro onde a devolução não salva e o status não muda. Ele adiciona as colunas onde os dados do retorno (peças prontas) são gravados.

Rode no **SQL Editor** do Supabase:

```sql
-- 1. Adiciona a coluna para salvar a grade devolvida (itens por cor/tamanho)
ALTER TABLE subcontractor_orders 
ADD COLUMN IF NOT EXISTS items_returned JSONB DEFAULT '[]'::jsonb;

-- 2. Adiciona a coluna de detalhes da facção na OP principal (para sincronia)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS subcontractor_details JSONB DEFAULT '{}'::jsonb;

-- 3. Garante que as colunas de status e datas existam e tenham valores padrão
ALTER TABLE subcontractor_orders 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Enviado';

ALTER TABLE subcontractor_orders 
ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE;

-- 4. Garante que a coluna de histórico de retornos (logs) exista
ALTER TABLE subcontractor_orders 
ADD COLUMN IF NOT EXISTS return_history JSONB DEFAULT '[]'::jsonb;

-- 5. Atualiza OPs antigas para evitar erros de leitura (Nulo -> Objeto Vazio)
UPDATE subcontractor_orders SET items_returned = '[]'::jsonb WHERE items_returned IS NULL;
UPDATE production_orders SET subcontractor_details = '{}'::jsonb WHERE subcontractor_details IS NULL;

-- 6. Recarrega a estrutura da API
NOTIFY pgrst, 'reload schema';
```
