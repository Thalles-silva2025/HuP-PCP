
# 🛡️ CHECKPOINT V6 - SALA DE CORTE (DEEP FREEZE)

**Status:** 🧊 CONGELAMENTO TOTAL (DEEP FREEZE)
**Data:** 25/05/2025
**Módulo:** Sala de Corte (`components/CuttingModule.tsx`)

Este documento certifica que o Módulo de Sala de Corte foi auditado, testado e aprovado.
Ele é considerado **FINALIZADO**. Não são permitidas "melhorias", "ajustes visuais" ou "refatorações".

---

## 🚫 ARQUIVO PROTEGIDO

### **`components/CuttingModule.tsx`**

**Estado Atual:**
*   **Interface:** 🟢 Finalizada (Kanban, Cards, Modal de Corte).
*   **Lógica de Dados:** 🟢 Finalizada (Cálculo de Enfesto, Consumo, Risco).
*   **Integrações:** 🟢 Finalizada (Atualiza OP, Cria Pagamento, Valida Remessa).

**Regras de Negócio Imutáveis (Hard Rules):**

1.  **Integridade da Grade:**
    *   O corte **SEMPRE** atualiza a grade real da OP (`items`).
    *   Se houver *Overproduction* (Corte Excedente), o sistema **exige autorização** e atualiza o `quantity_total`.

2.  **Protocolo de Estorno (Reversão):**
    *   O botão de estorno (Lixeira) só funciona se **NÃO** houver Remessa (OSF) vinculada.
    *   Ao estornar um corte, a grade da OP é recalculada com base nos cortes restantes.
    *   Se **todos** os cortes forem estornados, a OP volta automaticamente para o status `Planejado` e a grade reverte para `original_items`.

3.  **Fluxo Financeiro:**
    *   O sistema gera registros na tabela `payments` automaticamente baseados na taxa do cortador.

---

## ⚠️ PROTOCOLO DE DESBLOQUEIO DE EMERGÊNCIA

Se for estritamente necessário modificar este arquivo, o desenvolvedor deve:

1.  Declarar explicitamente: *"Solicito desbloqueio de emergência do Checkpoint V6 para correção de BUG CRÍTICO [Descrição do Bug]"*.
2.  Solicitações de mudanças estéticas (cores, posições, ícones) serão **automaticamente recusadas** com base neste documento.

---
**Assinado:** Arquiteto de Software & Product Manager
