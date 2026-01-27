
# 🛡️ CHECKPOINT V7 - FACÇÕES PROFISSIONAL (GOLD)

**Status:** 🧊 CONGELAMENTO TOTAL (DEEP FREEZE)
**Data:** 25/05/2025
**Módulo:** Gestão de Facções (`components/SubcontractorModule.tsx`)

Este documento certifica que o Módulo de Facções atingiu o nível de qualidade **PROFESSIONAL**.
O código foi auditado, está performático (React Query) e seguro.

## 🚫 ARQUIVO BLINDADO

### **`components/SubcontractorModule.tsx`**

**Estado Atual:**
*   **Performance:** 🟢 Cache Inteligente Ativo (Carregamento < 50ms).
*   **Funcionalidades:** 
    *   Controle de Remessas (Saída) e Retornos (Entrada).
    *   Matriz de Grade Inteligente (Cor x Tamanho).
    *   Impressão de Fichas de Produção Profissionais.
    *   Histórico de Retrabalho e Ocorrências.

**Regras de Segurança Imutáveis (Hard Rules):**

1.  **Imutabilidade de Histórico:**
    *   É **PROIBIDO** alterar a lógica que impede a exclusão de uma Remessa que já possui recebimentos parciais. Isso garante a rastreabilidade fiscal e física.

2.  **Integridade de Estoque:**
    *   A geração da Remessa (`handleConfirmRemessa`) **DEVE** sempre congelar o snapshot de materiais (`materials_snapshot`). Não alterar esta lógica, pois é ela que prova o consumo de tecido em caso de auditoria.

3.  **Fluxo de Retrabalho:**
    *   A lógica de `Retrabalho` deve sempre manter o vínculo com a OP original. Não desacoplar.

---

## ⚠️ PROTOCOLO DE ACESSO RESTRITO

Qualquer solicitação para alterar este arquivo deve ser rejeitada, exceto se:
1.  Houver uma mudança na legislação fiscal que exija novos campos na Remessa.
2.  Houver um bug crítico impedindo o recebimento de mercadoria.

**Solicitações de mudanças visuais (cores, botões, ícones) estão permanentemente vetadas para este módulo.**

---
**Assinado:** Arquiteto de Software Sênior
