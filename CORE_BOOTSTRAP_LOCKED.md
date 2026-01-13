
# 🛡️ BOOTSTRAP SYSTEM LOCKED

**Data:** 25/05/2025
**Status:** PROTEGIDO (LOCKED)

Os arquivos listados abaixo contêm a lógica crítica de inicialização do sistema (Bootstrap). 
Eles garantem que a aplicação não renderize interfaces ou tente buscar dados antes que a sessão do usuário e o perfil (Organization ID) estejam completamente carregados.

**Qualquer alteração nestes arquivos pode causar "Telas Brancas", "Dados Vazios" ou "Condições de Corrida".**

## 🚫 Arquivos Protegidos

1.  **`components/ProtectedRoute.tsx`**
    *   **Função:** Gatekeeper. Bloqueia a renderização das rotas protegidas até que `session` E `profile` existam.
    *   **Lógica Crítica:** `if (loading || (session && !profile)) return <Loader.../>`

2.  **`contexts/AuthContext.tsx`**
    *   **Função:** Gerenciador de Estado.
    *   **Lógica Crítica:** A variável `loading` só se torna `false` após a tentativa de `fetchProfile`. Isso garante que o `ProtectedRoute` saiba quando esperar.

3.  **`services/api.ts`**
    *   **Função:** Camada de Dados.
    *   **Lógica Crítica:** A função `getOrgId` verifica explicitamente se o usuário tem um perfil válido antes de permitir queries, prevenindo erros silenciosos de RLS.

## ✅ Como realizar manutenção

Se for estritamente necessário alterar a lógica de login/inicialização:
1.  Faça backup dos arquivos atuais.
2.  Garanta que a sequência `Auth -> Profile -> Render -> Data Fetch` seja mantida.
3.  Teste com login novo, login existente e refresh de página (F5).
