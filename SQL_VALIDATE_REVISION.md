
# 🕵️ Script de Auditoria: Revisão e Qualidade

Rode este script no **SQL Editor** do Supabase para conferir se os dados de qualidade estão sendo salvos corretamente no banco de dados.

```sql
SELECT 
    lot_number as "Lote",
    status as "Status Atual",
    
    -- Extraindo dados do JSON de Revisão
    revision_details->>'inspectorName' as "Revisor",
    (revision_details->>'approvedQty')::numeric as "Aprovado (1ª)",
    (revision_details->>'reworkQty')::numeric as "Retrabalho (2ª)",
    (revision_details->>'rejectedQty')::numeric as "Perda/Defeito",
    (revision_details->>'missingQty')::numeric as "Faltante",
    
    -- Verifica a data de conclusão
    to_char((revision_details->>'endDate')::timestamp, 'DD/MM/YYYY HH24:MI') as "Data Revisão",

    -- Verifica se gerou automaticamente a ordem de envio para conserto (se houver retrabalho)
    CASE 
        WHEN (revision_details->>'reworkQty')::numeric > 0 THEN 
            (SELECT count(*) FROM subcontractor_orders WHERE op_id = production_orders.id AND type = 'Retrabalho') 
        ELSE 0 
    END as "Remessas Retrabalho Geradas"

FROM 
    production_orders 
WHERE 
    revision_details IS NOT NULL 
    AND (revision_details->>'isFinalized')::boolean = true
ORDER BY 
    created_at DESC;
```

### O que verificar:
1. **Soma:** Se `Aprovado` + `Retrabalho` + `Perda` + `Faltante` bate com o total do lote.
2. **Status:** O status deve estar como `Embalagem` (ou `Concluído` se já tiver passado dessa fase).
3. **Retrabalho:** Se a coluna `Retrabalho (2ª)` for maior que 0, a coluna `Remessas Retrabalho Geradas` deve ser **1**. Isso confirma que o sistema criou a remessa de conserto automaticamente.
