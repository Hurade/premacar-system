import { useState } from 'react';
import { Clock, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useApprovedMetaTemplates } from '@/hooks/useMetaTemplates';

interface WindowExpiredAlertProps {
  conversationId: string;
  contactId: string;
  expiredAt: Date | null;
  hoursSinceExpired: number;
  onTemplateSent: () => void;
}

export function WindowExpiredAlert({
  conversationId,
  contactId,
  expiredAt,
  hoursSinceExpired,
  onTemplateSent,
}: WindowExpiredAlertProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sending, setSending] = useState(false);
  const { data: templates = [] } = useApprovedMetaTemplates();

  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;

    setSending(true);
    try {
      const template = templates.find(t => t.id === selectedTemplate);
      if (!template) throw new Error('Template não encontrado');

      // Get contact phone
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone_number, name')
        .eq('id', contactId)
        .single();

      if (!contact) throw new Error('Contato não encontrado');

      // Get Meta settings
      const { data: settings } = await supabase
        .from('nina_settings')
        .select('meta_phone_number_id, meta_access_token')
        .limit(1)
        .single();

      if (!settings?.meta_phone_number_id || !settings?.meta_access_token) {
        throw new Error('Credenciais Meta não configuradas');
      }

      // Send template via Meta API
      const phone = contact.phone_number.replace(/\D/g, '');
      const metaResponse = await fetch(
        `https://graph.facebook.com/v21.0/${settings.meta_phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.meta_access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
              name: template.name,
              language: { code: 'pt_BR' },
              components: template.parameters_count > 0 ? [
                {
                  type: 'body',
                  parameters: template.parameters_mapping.map((mapping) => ({
                    type: 'text',
                    text: mapping.field === 'name' ? (contact.name || 'Cliente') : '',
                  })),
                },
              ] : undefined,
            },
          }),
        }
      );

      if (!metaResponse.ok) {
        const errData = await metaResponse.json();
        throw new Error(errData?.error?.message || 'Erro ao enviar template');
      }

      // Save message record
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        content: `[Template: ${template.display_name}] ${template.body_text}`,
        type: 'text',
        from_type: 'human',
        status: 'sent',
        api_source: 'meta',
        metadata: { is_template: true, template_name: template.name },
      });

      toast.success('Template enviado! Aguarde resposta para reabrir janela.');
      onTemplateSent();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar template');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 bg-slate-900/90 border-t border-red-500/30 backdrop-blur-sm z-10">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Alert Header */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <Clock className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">
              ⏰ Janela de 24 horas expirada
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hoursSinceExpired > 0
                ? `Última mensagem do cliente: ${Math.floor(hoursSinceExpired)}h atrás`
                : 'Cliente nunca respondeu nesta conversa'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Para retomar a conversa, envie um template aprovado pela Meta.
              Quando o cliente responder, uma nova janela de 24h será aberta.
            </p>
          </div>
        </div>

        {/* Template Selector */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-400 mb-1 block">
              Selecione um template para retomar contato:
            </label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                <SelectValue placeholder="Escolher template..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {templates.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum template aprovado
                  </SelectItem>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      📨 {t.display_name} - {t.category}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSendTemplate}
            disabled={!selectedTemplate || sending}
            className="h-10 gap-2"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? 'Enviando...' : 'Enviar Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}
