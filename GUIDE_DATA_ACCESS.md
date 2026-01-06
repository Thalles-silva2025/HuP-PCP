
# 🔎 Como Acessar seus Dados (Supabase)

Atualmente, o sistema salva os dados reais no **Supabase**. Aqui está como você pode visualizá-los e gerenciá-los.

## 1. Via Painel do Supabase (Visual)

1.  Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard).
2.  Selecione seu projeto.
3.  No menu lateral, clique em **Table Editor** (ícone de Tabela).
4.  Selecione a tabela desejada:
    *   `user_profiles`: Dados da empresa, telefone, faturamento (Onboarding).
    *   `materials` / `products`: Cadastros de produção (quando migrarmos do Mock).

## 2. Via SQL Editor (Consultas Rápidas)

No menu lateral do Supabase, clique em **SQL Editor** e rode estas consultas para verificar seus dados:

### Ver todos os usuários e suas empresas
```sql
SELECT 
    auth.users.email, 
    public.user_profiles.company_name, 
    public.user_profiles.phone,
    public.user_profiles.onboarding_completed
FROM auth.users
JOIN public.user_profiles ON auth.users.id = public.user_profiles.id;
```

### Ver estatísticas de cadastro
```sql
SELECT 
    count(*) as total_usuarios,
    sum(case when onboarding_completed = true then 1 else 0 end) as onboards_completos
FROM user_profiles;
```

---

## 3. No Código (React)

Para acessar os dados dentro da aplicação, utilizamos o cliente em `services/supabase.ts`.

**Exemplo de leitura (já implementado no AuthContext):**
```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', user.id)
  .single();
```

**Para migrar o restante do app (Produtos, OPs) para o banco real:**
Utilize o novo arquivo `services/api.ts`. Ele é a versão "Real" do `services/mockDb.ts`.
