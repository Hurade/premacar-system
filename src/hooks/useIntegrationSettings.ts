import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IntegrationSettingsData {
  id?: string;
  user_id?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  twilio_webhook_url?: string;
  twilio_enabled?: boolean;
  elevenlabs_api_key_integration?: string;
  elevenlabs_voice_id_integration?: string;
  elevenlabs_enabled?: boolean;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_region?: string;
  aws_ses_email_from?: string;
  aws_ses_email_from_name?: string;
  aws_ses_webhook_url?: string;
  aws_ses_enabled?: boolean;
  whatsapp_enabled?: boolean;
  call_script_prompt?: string;
  call_max_duration?: number;
  call_hours_start?: string;
  call_hours_end?: string;
  google_calendar_service_account_json?: Record<string, string> | null;
  google_calendar_id?: string;
  google_calendar_slot_duration?: number;
  google_calendar_buffer?: number;
  google_calendar_work_start?: number;
  google_calendar_work_end?: number;
  google_calendar_timezone?: string;
  google_calendar_days_ahead?: number;
}

export function useIntegrationSettings() {
  const [settings, setSettings] = useState<IntegrationSettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase
        .from('integration_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle() as any);

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Erro ao buscar configurações de integração:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (updates: Partial<IntegrationSettingsData>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');

    const payload = { ...updates, user_id: user.id };

    if (settings?.id) {
      const { error } = await (supabase
        .from('integration_settings' as any)
        .update(payload)
        .eq('id', settings.id) as any);
      if (error) throw error;
    } else {
      const { error } = await (supabase
        .from('integration_settings' as any)
        .insert(payload) as any);
      if (error) throw error;
    }

    await fetchSettings();
  };

  return { settings, loading, refetch: fetchSettings, saveSettings };
}
