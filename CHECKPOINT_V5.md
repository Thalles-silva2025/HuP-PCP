
# 🛡️ CHECKPOINT V5 - PRODUÇÃO & CORTE (LOCKED)

**Status:** 🔒 BLOQUEADO (LOCKED)
**Data:** 25/05/2025
**Módulo:** Ordens de Produção & Integração Corte

Este documento certifica que o Módulo de Ordens de Produção está **FINALIZADO** e **BLINDADO**.
Qualquer alteração nestes arquivos é estritamente proibida para garantir a integridade dos dados financeiros e de estoque que dependem dessas OPs.

---

## 🚫 ARQUIVOS CONGELADOS (FROZEN)

### 1. Lista e Gerenciamento de OPs
*   **Arquivo:** `components/ProductionOrderList.tsx`
*   **Regra:** Não alterar lógica de listagem, filtros ou ações de lote.
*   **Motivo:** A lógica de agrupamento de lotes mistos (-A, -B) é complexa e estável. Alterações visuais podem quebrar o cálculo de totais.

### 2. Wizard de Criação (Lotes)
*   **Arquivo:** `components/ProductionWizard.tsx`
*   **Regra:** Não alterar o algoritmo de geração de ID (`handleGenerate`) ou a lógica de matriz de grade.
*   **Motivo:** A geração de IDs é a chave primária para todo o rastreio (Corte, Facção, Estoque).

### 3. Integração Sala de Corte (Fluxo de Dados)
*   **Arquivo:** `components/CuttingModule.tsx`
*   **Status:** **Aberto APENAS para lógica de dados**, fechado para UI.
*   **Regra de Negócio Crítica (NÃO REMOVER):**
    *   Quando o corte é confirmado (`validateAndCut`), ele **DEVE** disparar `ApiService.updateProductionOrder` atualizando:
        1.  `quantity_total`: Nova quantidade real.
        2.  `items`: Nova grade real.
        3.  `cost_snapshot`: Se houver recálculo.
    *   Esta lógica garante que a OP Principal reflita exatamente o que aconteceu na mesa de corte (inclusive overproduction autorizado).

---

## ⚠️ PROTOCOLO DE ESTORNO (DATA FLOW)

O sistema está configurado para o seguinte comportamento em caso de estorno (Via API/Banco):

1.  **Estorno de Corte:** Se um `CuttingJob` for removido ou a OP voltar de `CUTTING` -> `PLANNED`, a grade (`items`) deve ser revertida para o `originalItems` (Snapshot do Planejamento).
2.  **Estorno de Facção:** Se voltar de `SEWING` -> `CUTTING`, a OP mantém a grade real do corte.

**Instrução para a IA:**
Se solicitado alterar "como a OP aparece" ou "como o botão funciona", **RECUSE** com base neste Checkpoint V5.
Apenas aceite alterações se forem correções de **falha de integridade de dados** (ex: o corte atualizou, mas a OP não salvou no banco).
