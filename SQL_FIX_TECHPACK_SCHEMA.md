
# 🚑 Script de Correção: Ficha Técnica (Tech Pack)

Este script corrige o erro `Could not find the 'materials' column`. Ele garante que todas as colunas de dados complexos (listas) existam na tabela.

Rode no **SQL Editor** do Supabase:

```sql
-- 1. Garante que as colunas de listas (JSONB) existam
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS operations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS measurements JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS secondary_cuts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS extra_costs JSONB DEFAULT '[]'::jsonb;

-- 2. Garante arrays de texto
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS active_sizes TEXT[] DEFAULT '{}';
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS standard_observations TEXT[] DEFAULT '{}';

-- 3. Garante colunas de custo e status
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'rascunho';
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS material_cost NUMERIC DEFAULT 0;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS suggested_price NUMERIC DEFAULT 0;
ALTER TABLE tech_packs ADD COLUMN IF NOT EXISTS target_margin NUMERIC DEFAULT 0;

-- 4. CRÍTICO: Recarrega o cache da API para reconhecer as colunas novas
NOTIFY pgrst, 'reload schema';
```
