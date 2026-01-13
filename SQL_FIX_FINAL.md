
# 🚑 Script de Correção Definitiva (Final)

Rode este comando no **SQL Editor** do Supabase para corrigir o erro "Could not find the 'subcontractor' column".

```sql
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS subcontractor TEXT;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS cutting_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS revision_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS packing_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS phase_dates JSONB DEFAULT '{}'::jsonb;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS cost_snapshot NUMERIC DEFAULT 0;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS subcontractor_details JSONB DEFAULT '{}'::jsonb;
```
