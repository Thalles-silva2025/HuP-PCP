
import { supabase } from './supabase';

export interface SystemLog {
    id: string;
    timestamp: string; // Mapeado de created_at
    type: 'success' | 'error' | 'warning' | 'info';
    action: string;
    details: string;
    resolved: boolean;
}

export const SystemLogService = {
    // Recupera logs do Banco de Dados
    getLogs: async (): Promise<SystemLog[]> => {
        try {
            const { data, error } = await supabase
                .from('system_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            return (data || []).map((log: any) => ({
                id: log.id,
                timestamp: log.created_at,
                type: log.type as any,
                action: log.action,
                details: log.details,
                resolved: log.resolved
            }));
        } catch (e) {
            console.error("Erro ao buscar logs:", e);
            return [];
        }
    },

    // Adiciona um novo log no Banco de Dados
    addLog: async (type: 'success' | 'error' | 'warning' | 'info', action: string, details: string) => {
        try {
            // Tenta obter o organization_id do usuário atual
            const { data: { user } } = await supabase.auth.getUser();
            let orgId = null;
            
            if (user) {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single();
                orgId = profile?.organization_id;
            }

            const newLog = {
                organization_id: orgId,
                type,
                action,
                details: typeof details === 'object' ? JSON.stringify(details) : String(details),
                resolved: type === 'success'
            };

            await supabase.from('system_logs').insert([newLog]);
            
            // Retorna formato compatível com UI local, embora seja async agora
            return {
                id: 'temp-id',
                timestamp: new Date().toISOString(),
                ...newLog
            } as SystemLog;

        } catch (e) {
            console.error("Falha ao salvar log no banco:", e);
            return null;
        }
    },

    // Limpa os logs (Remove do banco)
    clearLogs: async () => {
        try {
            // Remove apenas logs da organização do usuário (via RLS)
            const { data: { user } } = await supabase.auth.getUser();
            if(!user) return;
            
            // Logica simplificada: Delete all rows visible to user
            // Como RLS filtra por org, isso deleta apenas logs da org
            await supabase.from('system_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
        } catch (e) {
            console.error("Erro ao limpar logs:", e);
        }
    },

    // Conta erros (versão simplificada local não é viável sem query, retorna 0 ou implementa count se necessário)
    getErrorCount: async () => {
        const { count } = await supabase
            .from('system_logs')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'error');
        return count || 0;
    }
};
