import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useIntegrationSettings } from '@/hooks/useIntegrationSettings';
import IntegrationCard from './IntegrationCard';
import TwilioConfigModal from './TwilioConfigModal';
import ElevenLabsConfigModal from './ElevenLabsConfigModal';
import AWSConfigModal from './AWSConfigModal';
import GoogleCalendarConfigModal from './GoogleCalendarConfigModal';

const IntegrationSettings: React.FC = () => {
  const { settings, loading, saveSettings } = useIntegrationSettings();
  const [activeModal, setActiveModal] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const integrations = [
    {
      id: 'twilio',
      icon: '📞',
      name: 'Twilio - Ligações',
      description: 'Faça ligações automatizadas com voz AI',
      configured: !!settings?.twilio_account_sid,
      enabled: !!settings?.twilio_enabled,
    },
    {
      id: 'elevenlabs',
      icon: '🎙️',
      name: 'ElevenLabs - Voz AI',
      description: 'Gere áudio com voz ultra-realista para ligações',
      configured: !!settings?.elevenlabs_api_key_integration,
      enabled: !!settings?.elevenlabs_enabled,
    },
    {
      id: 'aws_ses',
      icon: '📧',
      name: 'AWS SES - Email',
      description: 'Envie emails transacionais e de marketing',
      configured: !!settings?.aws_access_key_id,
      enabled: !!settings?.aws_ses_enabled,
    },
    {
      id: 'whatsapp',
      icon: '💬',
      name: 'WhatsApp - Mensagens',
      description: 'Envie mensagens pelo WhatsApp Business API',
      configured: true,
      enabled: !!settings?.whatsapp_enabled,
    },
    {
      id: 'google_calendar',
      icon: '📅',
      name: 'Google Calendar - Agendamento',
      description: 'Cris agenda demos automaticamente com horários do Google Calendar',
      configured: !!(settings as any)?.google_calendar_service_account_json,
      enabled: !!(settings as any)?.google_calendar_service_account_json,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">🔌 Integrações</h3>
        <p className="text-sm text-slate-400 mt-1">
          Configure as integrações necessárias para campanhas multi-canal funcionarem corretamente.
        </p>
      </div>

      <div className="space-y-3">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            icon={integration.icon}
            name={integration.name}
            description={integration.description}
            configured={integration.configured}
            enabled={integration.enabled}
            onConfigure={() => setActiveModal(integration.id)}
          />
        ))}
      </div>

      <TwilioConfigModal
        open={activeModal === 'twilio'}
        onClose={() => setActiveModal(null)}
        currentConfig={settings}
        onSave={saveSettings}
      />

      <ElevenLabsConfigModal
        open={activeModal === 'elevenlabs'}
        onClose={() => setActiveModal(null)}
        currentConfig={settings}
        onSave={saveSettings}
      />

      <AWSConfigModal
        open={activeModal === 'aws_ses'}
        onClose={() => setActiveModal(null)}
        currentConfig={settings}
        onSave={saveSettings}
      />

      <GoogleCalendarConfigModal
        open={activeModal === 'google_calendar'}
        onClose={() => setActiveModal(null)}
        currentConfig={settings as any}
        onSave={saveSettings}
      />
    </div>
  );
};

export default IntegrationSettings;
