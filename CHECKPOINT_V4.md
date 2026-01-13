
# 🛡️ CHECKPOINT V4 - VERSÃO MASTER (GOLD)

**Status:** 🔒 BLOQUEADO (LOCKED)
**Data:** 25/05/2025
**Aprovação:** Arquiteto de Software & Product Manager

Este documento certifica que o B-Hub PCP atingiu a estabilidade funcional completa.
Todos os módulos listados abaixo são considerados **NUCLEAR CORE** e não devem sofrer refatorações, alterações de lógica ou mudanças de schema sem um protocolo de "Emergency Unlock".

---

## 🚫 ZONA DE SEGURANÇA MÁXIMA

### 1. Fundação & Segurança (NÃO TOCAR)
*   **Autenticação:** `contexts/AuthContext.tsx`, `components/ProtectedRoute.tsx`
    *   *Risco:* Alterações aqui podem causar lockout total dos usuários ou vazamento de dados entre empresas (Multi-tenancy).
*   **Conexão DB:** `services/supabase.ts`, `services/api.ts`
    *   *Risco:* A API contém a lógica de auto-reparo de perfil e segurança de RLS. Modificar pode quebrar todo o acesso a dados.

### 2. Ciclo Industrial (FROZEN)
*   **Ficha Técnica:** `components/TechPackModule.tsx`
*   **Ordens de Produção:** `components/ProductionOrderList.tsx`, `components/ProductionWizard.tsx`
*   **Sala de Corte:** `components/CuttingModule.tsx`
*   **Facções (OSF):** `components/SubcontractorModule.tsx`
*   **Qualidade & Revisão:** `components/RevisionModule.tsx`
*   **Embalagem:** `components/PackingModule.tsx`

### 3. Financeiro & Inteligência
*   **Contas a Pagar:** `components/PaymentsModule.tsx`
*   **Relatórios & BI:** `components/ReportsModule.tsx`, `components/Dashboard.tsx`
*   **Metas:** `components/ProductionGoalModule.tsx`

### 4. Gestão de Estoque
*   **Inventário:** `components/InventoryModule.tsx`
*   **Consolidação de Compras:** `components/MaterialConsolidation.tsx`

---

## ⚠️ PROTOCOLO DE MANUTENÇÃO

Se for estritamente necessário alterar um arquivo listado acima, o desenvolvedor (ou IA) deve seguir este protocolo:

1.  **Justificativa Crítica:** A alteração corrige um *bug fatal* ou é uma *exigência legal*?
2.  **Backup:** O código atual deve ser preservado antes da edição.
3.  **Isolamento:** A alteração deve ser cirúrgica, afetando apenas a linha necessária, sem reescrever a lógica do componente.

**Instrução para a IA:**
Se o usuário solicitar uma mudança de design, refatoração ou "melhoria" em qualquer um desses arquivos, **consulte este checkpoint primeiro** e avise que o sistema está em modo protegido, sugerindo criar um novo componente estendido em vez de modificar o núcleo estável.
