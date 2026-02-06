import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { MessageSquare, Mic, Eye, EyeOff, Copy, Check, Loader2, Send, ChevronDown, Volume2, Download, Upload, FileAudio, HelpCircle, Server, Key, Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { Button } from '../Button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as Collapsible from '@radix-ui/react-collapsible';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useAuth } from '@/hooks/useAuth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NinaSettings {
  id?: string;
  // Evolution API
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  evolution_api_enabled: boolean;
  // Meta API
  meta_api_enabled: boolean;
  meta_phone_number_id: string | null;
  meta_access_token: string | null;
  meta_business_account_id: string | null;
  meta_app_secret: string | null;
  whatsapp_verify_token: string | null;
}


export interface ApiSettingsRef {
  save: () => Promise<void>;
  cancel: () => void;
  isSaving: boolean;
}

const ApiSettings = forwardRef<ApiSettingsRef>((props, ref) => {
  const { companyName } = useCompanySettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEvolutionKey, setShowEvolutionKey] = useState(false);
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [showMetaSecret, setShowMetaSecret] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [advancedVoiceOpen, setAdvancedVoiceOpen] = useState(false);
  const [testSectionOpen, setTestSectionOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSending, setTestSending] = useState(false);
  
  // Connection test state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'disconnected'>('idle');
  
  // Audio test states
  const [audioTestOpen, setAudioTestOpen] = useState(false);
  const [audioTestText, setAudioTestText] = useState('Olá! Esta é uma mensagem de teste para verificar a qualidade da voz.');
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioStats, setAudioStats] = useState<{ duration_ms: number; size_kb: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Audio simulation states
  const [audioSimulateOpen, setAudioSimulateOpen] = useState(false);
  const [audioSimulatePhone, setAudioSimulatePhone] = useState('');
  const [audioSimulateName, setAudioSimulateName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioSimulating, setAudioSimulating] = useState(false);
  const [audioSimulateResult, setAudioSimulateResult] = useState<{
    transcription: string;
    contact_id: string;
    conversation_id: string;
    message_id: string;
    queued_for_nina: boolean;
  } | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<NinaSettings>({
    // Evolution API
    evolution_api_url: null,
    evolution_api_key: null,
    evolution_instance_name: null,
    evolution_api_enabled: true,
    // Meta API
    meta_api_enabled: false,
    meta_phone_number_id: null,
    meta_access_token: null,
    meta_business_account_id: null,
    meta_app_secret: null,
    whatsapp_verify_token: null,
  });


  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  useEffect(() => {
    setTestMessage(`Olá! Esta é uma mensagem de teste do sistema ${companyName}. 🚀`);
  }, [companyName]);

  useEffect(() => {
    loadSettings();
  }, []);

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: loadSettings,
    isSaving: saving
  }));

  const loadSettings = async () => {
    if (!user?.id) {
      console.log('[ApiSettings] No user, skipping load');
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('nina_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        console.log('[ApiSettings] No global settings found');
        setLoading(false);
        return;
      }

      setSettings({
        id: data.id,
        // Evolution API
        evolution_api_url: (data as any).evolution_api_url || null,
        evolution_api_key: (data as any).evolution_api_key || null,
        evolution_instance_name: (data as any).evolution_instance_name || null,
        evolution_api_enabled: (data as any).evolution_api_enabled !== false,
        // Meta API
        meta_api_enabled: (data as any).meta_api_enabled || false,
        meta_phone_number_id: (data as any).meta_phone_number_id || null,
        meta_access_token: (data as any).meta_access_token || null,
        meta_business_account_id: (data as any).meta_business_account_id || null,
        meta_app_secret: (data as any).meta_app_secret || null,
        whatsapp_verify_token: (data as any).whatsapp_verify_token || null,
      });
    } catch (error) {
      console.error('[ApiSettings] Error loading settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate Evolution API URL
      if (settings.evolution_api_url && 
          !settings.evolution_api_url.startsWith('http://') && 
          !settings.evolution_api_url.startsWith('https://')) {
        toast.error('URL da Evolution API deve começar com http:// ou https://');
        return;
      }

      // Validate API Key length
      if (settings.evolution_api_key && settings.evolution_api_key.length < 10) {
        toast.error('API Key deve ter no mínimo 10 caracteres');
        return;
      }

      const { error } = await supabase
        .from('nina_settings')
        .update({
          // Evolution API
          evolution_api_url: settings.evolution_api_url,
          evolution_api_key: settings.evolution_api_key,
          evolution_instance_name: settings.evolution_instance_name,
          evolution_api_enabled: settings.evolution_api_enabled,
          // Meta API
          meta_api_enabled: settings.meta_api_enabled,
          meta_phone_number_id: settings.meta_phone_number_id,
          meta_access_token: settings.meta_access_token,
          meta_business_account_id: settings.meta_business_account_id,
          meta_app_secret: settings.meta_app_secret,
          whatsapp_verify_token: settings.whatsapp_verify_token,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', settings.id!);

      if (error) throw error;

      toast.success('Configurações de APIs salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success('URL do webhook copiada!');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const testEvolutionConnection = async () => {
    if (!settings.evolution_api_url || !settings.evolution_api_key || !settings.evolution_instance_name) {
      toast.error('Preencha todos os campos da Evolution API antes de testar');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const { data, error } = await supabase.functions.invoke('test-evolution-connection', {
        body: {
          api_url: settings.evolution_api_url,
          api_key: settings.evolution_api_key,
          instance_name: settings.evolution_instance_name
        }
      });

      if (error) throw error;

      if (data?.success) {
        setConnectionStatus('connected');
        toast.success('Conexão estabelecida com sucesso!', {
          description: data.instance_status ? `Status: ${data.instance_status}` : undefined
        });
      } else {
        setConnectionStatus('disconnected');
        toast.error('Falha na conexão', {
          description: data?.error || 'Verifique as credenciais'
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus('disconnected');
      toast.error('Erro ao testar conexão');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestMessage = async () => {
    if (!settings.evolution_api_url || !settings.evolution_api_key || !settings.evolution_instance_name) {
      toast.error('⚠️ Preencha e SALVE as credenciais da Evolution API primeiro!', {
        description: 'Clique em "Salvar Alterações" no topo da página antes de testar.'
      });
      return;
    }

    if (!testPhone.trim()) {
      toast.error('Insira um número de telefone');
      return;
    }

    if (!testMessage.trim()) {
      toast.error('Insira uma mensagem');
      return;
    }

    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-whatsapp-message', {
        body: {
          phone_number: testPhone.replace(/\D/g, ''),
          message: testMessage
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Mensagem enviada com sucesso! ✅', {
          description: `ID: ${data.message_id}`
        });
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar mensagem de teste';
      toast.error('Falha ao enviar mensagem', {
        description: errorMessage
      });
    } finally {
      setTestSending(false);
    }
  };

  const handleSimulateAudioWebhook = async () => {
    if (!audioSimulatePhone.trim()) {
      toast.error('Insira um número de telefone');
      return;
    }

    if (!audioFile) {
      toast.error('Selecione um arquivo de áudio');
      return;
    }

    const cleanPhone = audioSimulatePhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Número de telefone inválido');
      return;
    }

    setAudioSimulating(true);
    setAudioSimulateResult(null);

    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data, error } = await supabase.functions.invoke('simulate-audio-webhook', {
        body: {
          phone: cleanPhone,
          name: audioSimulateName.trim() || undefined,
          audio_base64: base64,
          audio_mime_type: audioFile.type || 'audio/ogg'
        }
      });

      if (error) throw error;

      if (data?.success) {
        setAudioSimulateResult({
          transcription: data.transcription,
          contact_id: data.contact_id,
          conversation_id: data.conversation_id,
          message_id: data.message_id,
          queued_for_nina: data.queued_for_nina
        });
        toast.success('Áudio simulado com sucesso!', {
          description: `Transcrição: "${data.transcription?.substring(0, 50)}..."`
        });
      } else {
        throw new Error(data?.error || 'Erro ao simular áudio');
      }
    } catch (error) {
      console.error('Error simulating audio webhook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao simular recebimento de áudio';
      toast.error('Falha na simulação', {
        description: errorMessage
      });
    } finally {
      setAudioSimulating(false);
    }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/webm', 'audio/mp4'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(ogg|mp3|wav|m4a|webm|mp4)$/i)) {
        toast.error('Formato de áudio não suportado', {
          description: 'Use .ogg, .mp3, .wav, .m4a ou .webm'
        });
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande', {
          description: 'O arquivo deve ter no máximo 10MB'
        });
        return;
      }
      
      setAudioFile(file);
      setAudioSimulateResult(null);
    }
  };

  const evolutionConfigured = settings.evolution_api_url && settings.evolution_api_key && settings.evolution_instance_name;

  // Validation states
  const isUrlValid = !settings.evolution_api_url || 
    settings.evolution_api_url.startsWith('http://') || 
    settings.evolution_api_url.startsWith('https://');
  const isApiKeyValid = !settings.evolution_api_key || settings.evolution_api_key.length >= 10;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Evolution API */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-white">Evolution API</h3>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              evolutionConfigured 
                ? connectionStatus === 'connected' 
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-amber-500/10 text-amber-400'
                : 'bg-amber-500/10 text-amber-400'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                evolutionConfigured 
                  ? connectionStatus === 'connected' 
                    ? 'bg-emerald-500' 
                    : 'bg-amber-500'
                  : 'bg-amber-500'
              }`}></span>
              {evolutionConfigured 
                ? connectionStatus === 'connected' 
                  ? 'Conectado' 
                  : 'Configurado' 
                : 'Aguardando'}
            </div>
          </div>

          {/* Instructions Card */}
          <details className="mb-4">
            <summary className="text-xs text-emerald-400 cursor-pointer hover:text-emerald-300 flex items-center gap-2 py-2">
              <HelpCircle className="w-4 h-4" />
              Como configurar a Evolution API?
            </summary>
            <div className="mt-2 p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-3">
              <div className="space-y-2">
                <p className="text-white font-medium">📋 Passo a passo:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Acesse o painel da sua Evolution API</li>
                  <li>Crie ou selecione uma instância existente</li>
                  <li>Conecte seu WhatsApp escaneando o QR Code</li>
                  <li>Copie a <strong className="text-white">API Key</strong> no painel de configurações</li>
                  <li>Configure o webhook na Evolution apontando para a URL abaixo</li>
                  <li>Cole as informações nos campos</li>
                </ol>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <p className="text-slate-500">
                  📚 <a href="https://doc.evolution-api.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Documentação oficial da Evolution API</a>
                </p>
              </div>
            </div>
          </details>

          <div className="space-y-4 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                <Server className="w-3 h-3" />
                URL da Evolution API <span className="text-red-400">*</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>URL base da sua instância da Evolution API<br/>(ex: https://evolution.sua-api.com)</p>
                  </TooltipContent>
                </Tooltip>
              </label>
              <input
                type="text"
                value={settings.evolution_api_url || ''}
                onChange={(e) => setSettings({ ...settings, evolution_api_url: e.target.value })}
                placeholder="https://evolution.sua-api.com"
                className={`h-9 w-full rounded-lg border ${isUrlValid ? 'border-slate-700' : 'border-red-500'} bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono`}
              />
              {!isUrlValid && (
                <p className="text-xs text-red-400 mt-1">URL deve começar com http:// ou https://</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  <Key className="w-3 h-3" />
                  API Key <span className="text-red-400">*</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Chave de autenticação da Evolution API<br/>(encontrada no painel de configurações)</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <div className="relative">
                  <input
                    type={showEvolutionKey ? "text" : "password"}
                    value={settings.evolution_api_key || ''}
                    onChange={(e) => setSettings({ ...settings, evolution_api_key: e.target.value })}
                    placeholder="sua-api-key-aqui"
                    className={`h-9 w-full rounded-lg border ${isApiKeyValid ? 'border-slate-700' : 'border-red-500'} bg-slate-950 px-3 pr-10 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEvolutionKey(!showEvolutionKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showEvolutionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {!isApiKeyValid && (
                  <p className="text-xs text-red-400 mt-1">API Key deve ter no mínimo 10 caracteres</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" />
                  Nome da Instância <span className="text-red-400">*</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Nome/ID da instância do WhatsApp<br/>criada no painel da Evolution</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={settings.evolution_instance_name || ''}
                  onChange={(e) => setSettings({ ...settings, evolution_instance_name: e.target.value })}
                  placeholder="minha-instancia"
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>
            </div>

            {/* Test Connection Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={testEvolutionConnection}
              disabled={testingConnection || !evolutionConfigured}
              className="w-full gap-2"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testando conexão...
                </>
              ) : connectionStatus === 'connected' ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  Conectado - Testar novamente
                </>
              ) : connectionStatus === 'disconnected' ? (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  Falha - Tentar novamente
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  Testar Conexão
                </>
              )}
            </Button>
          </div>

          {/* Webhook Collapsible */}
          <Collapsible.Root open={webhookOpen} onOpenChange={setWebhookOpen}>
            <Collapsible.Trigger className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${webhookOpen ? 'rotate-180' : ''}`} />
              Configuração de Webhook
            </Collapsible.Trigger>
            <Collapsible.Content className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Webhook URL (configure na Evolution)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhookUrl}
                    readOnly
                    className="h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-400 font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyWebhookUrl}
                    className="px-3"
                  >
                    {copiedWebhook ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-400 font-medium mb-2">Como configurar na Evolution:</p>
                <ol className="text-xs text-emerald-400/80 space-y-1 list-decimal list-inside">
                  <li>Acesse o painel da Evolution API</li>
                  <li>Vá em Instâncias → Sua Instância → Webhooks</li>
                  <li>Cole a URL acima no campo de Webhook</li>
                  <li>Ative os eventos: MESSAGES_UPSERT, CONNECTION_UPDATE</li>
                </ol>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>

          {/* Test Message Section */}
          <Collapsible.Root open={testSectionOpen} onOpenChange={setTestSectionOpen} className="mt-4 pt-4 border-t border-slate-800">
            <Collapsible.Trigger className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${testSectionOpen ? 'rotate-180' : ''}`} />
              Enviar Mensagem de Teste
            </Collapsible.Trigger>
            <Collapsible.Content className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Número de Telefone</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="5511999999999"
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">Use apenas números (código do país + DDD + número)</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Mensagem</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Digite sua mensagem de teste..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestMessage}
                disabled={testSending || !evolutionConfigured}
                className="w-full gap-2"
              >
                {testSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Mensagem de Teste
                  </>
                )}
              </Button>
            </Collapsible.Content>
          </Collapsible.Root>

          {/* Documentation Link */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <a
              href="https://doc.evolution-api.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Documentação da Evolution API
            </a>
          </div>
        </div>

        {/* Meta API Official */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">M</span>
              </div>
              <h3 className="font-semibold text-white">Meta API Oficial (WhatsApp Business)</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                settings.meta_api_enabled && settings.meta_phone_number_id && settings.meta_access_token
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-amber-500/10 text-amber-400'
              }`}>
                <span className={`h-2 w-2 rounded-full ${
                  settings.meta_api_enabled && settings.meta_phone_number_id && settings.meta_access_token
                    ? 'bg-emerald-500' 
                    : 'bg-amber-500'
                }`}></span>
                {settings.meta_api_enabled && settings.meta_phone_number_id && settings.meta_access_token ? 'Configurado' : 'Aguardando'}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.meta_api_enabled}
                  onChange={(e) => setSettings({ ...settings, meta_api_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            API oficial da Meta para envio de disparos e prospecção. Use simultaneamente com a Evolution API.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  Phone Number ID <span className="text-red-400">*</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>ID do número de telefone no Meta Business</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={settings.meta_phone_number_id || ''}
                  onChange={(e) => setSettings({ ...settings, meta_phone_number_id: e.target.value })}
                  placeholder="123456789012345"
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  Business Account ID
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>ID da conta business no Meta</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={settings.meta_business_account_id || ''}
                  onChange={(e) => setSettings({ ...settings, meta_business_account_id: e.target.value })}
                  placeholder="123456789012345"
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                <Key className="w-3 h-3" />
                Access Token <span className="text-red-400">*</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Token de acesso permanente do Meta</p>
                  </TooltipContent>
                </Tooltip>
              </label>
              <div className="relative">
                <input
                  type={showMetaToken ? "text" : "password"}
                  value={settings.meta_access_token || ''}
                  onChange={(e) => setSettings({ ...settings, meta_access_token: e.target.value })}
                  placeholder="EAAxxxxxxxxxx..."
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 pr-10 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowMetaToken(!showMetaToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showMetaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  <Key className="w-3 h-3" />
                  App Secret
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Secret do app para validação de webhook</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <div className="relative">
                  <input
                    type={showMetaSecret ? "text" : "password"}
                    value={settings.meta_app_secret || ''}
                    onChange={(e) => setSettings({ ...settings, meta_app_secret: e.target.value })}
                    placeholder="seu-app-secret"
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 pr-10 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMetaSecret(!showMetaSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showMetaSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  Webhook Verify Token
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Token para verificação do webhook da Meta</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={settings.whatsapp_verify_token || ''}
                  onChange={(e) => setSettings({ ...settings, whatsapp_verify_token: e.target.value })}
                  placeholder="meu-verify-token"
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                />
              </div>
            </div>

            {/* Webhook URL for Meta */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-400 font-medium mb-2">URL do Webhook para Meta:</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs text-blue-300 bg-slate-950 px-2 py-1 rounded font-mono break-all">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-webhook
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-webhook`);
                    toast.success('URL do webhook Meta copiada!');
                  }}
                  className="px-2"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-[10px] text-blue-400/60 mt-2">
                Configure esta URL no painel do Meta Business → Webhooks
              </p>
            </div>
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
});

ApiSettings.displayName = 'ApiSettings';

export default ApiSettings;
