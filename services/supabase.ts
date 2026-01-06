
import { createClient } from '@supabase/supabase-js';

// Acesso seguro às variáveis de ambiente para evitar erro de 'undefined'
const meta = import.meta as any;
const env = meta && meta.env ? meta.env : {};

// Configuração com as credenciais fornecidas
// Prioriza variáveis de ambiente (.env), mas usa as chaves hardcoded como fallback imediato
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://hbxhnidxiqklopruycje.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieGhuaWR4aXFrbG9wcnV5Y2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNTc3NjMsImV4cCI6MjA4MjczMzc2M30.XCQXo9VCt9DjVTwURVaxrkgDAvpM3M7kpH1pOZkbN8g';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltam credenciais do Supabase. Verifique services/supabase.ts');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
