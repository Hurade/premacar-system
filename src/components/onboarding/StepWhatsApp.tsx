import React, { useState } from 'react';
import { MessageSquare, Key, Server, ExternalLink, Copy, Check, ChevronDown, Sparkles, Loader2, Wifi, WifiOff, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/Button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StepWhatsAppProps {
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstanceName: string;
  onEvolutionApiUrlChange: (value: string) => void;
  onEvolutionApiKeyChange: (value: string) => void;
  onEvolutionInstanceNameChange: (value: string) => void;
  webhookUrl: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 }
  },
};

export const StepWhatsApp: React.FC<StepWhatsAppProps> = ({
  evolutionApiUrl,
  evolutionApiKey,
  evolutionInstanceName,
  onEvolutionApiUrlChange,
  onEvolutionApiKeyChange,
  onEvolutionInstanceNameChange,
  webhookUrl,
}) => {
  const [showWebhook, setShowWebhook] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'disconnected'>('idle');

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    toast.success('Copiado para a área de transferência!');
    setTimeout(() => setCopied(null), 2000);
  };

  const testConnection = async () => {
    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstanceName) {
      toast.error('Preencha todos os campos antes de testar');
      return;
    }

    // Validate URL format
    if (!evolutionApiUrl.startsWith('http://') && !evolutionApiUrl.startsWith('https://')) {
      toast.error('URL deve começar com http:// ou https://');
      return;
    }

    // Validate API key length
    if (evolutionApiKey.length < 10) {
      toast.error('API Key deve ter no mínimo 10 caracteres');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const { data, error } = await supabase.functions.invoke('test-evolution-connection', {
        body: {
          api_url: evolutionApiUrl,
          api_key: evolutionApiKey,
          instance_name: evolutionInstanceName
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
      toast.error('Erro ao testar conexão', {
        description: error instanceof Error ? error.message : 'Verifique as credenciais'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Validation states
  const isUrlValid = !evolutionApiUrl || evolutionApiUrl.startsWith('http://') || evolutionApiUrl.startsWith('https://');
  const isApiKeyValid = !evolutionApiKey || evolutionApiKey.length >= 10;

  return (
    <TooltipProvider>
      <motion.div 
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.div 
            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <MessageSquare className="w-8 h-8 text-emerald-400" />
          </motion.div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Evolution API</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Conecte sua instância do WhatsApp via Evolution API para enviar e receber mensagens.
          </p>
        </motion.div>

        {/* Instructions Card */}
        <motion.div variants={itemVariants} className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 max-w-md mx-auto">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-400 mb-2">Como configurar a Evolution API:</p>
              <ol className="text-xs text-emerald-400/80 space-y-1 list-decimal list-inside">
                <li>Acesse o painel da sua Evolution API</li>
                <li>Crie ou selecione uma instância existente</li>
                <li>Conecte seu WhatsApp escaneando o QR Code</li>
                <li>Copie a API Key no painel de configurações</li>
                <li>Configure o webhook na Evolution apontando para a URL abaixo</li>
                <li>Cole as informações nos campos</li>
              </ol>
            </div>
          </div>
        </motion.div>

        <div className="space-y-6 max-w-md mx-auto">
          <motion.div variants={itemVariants} className="space-y-2">
            <Label htmlFor="evolutionApiUrl" className="flex items-center gap-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              URL da Evolution API
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>URL base da sua instância da Evolution API<br/>(ex: https://evolution.sua-api.com)</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Input
              id="evolutionApiUrl"
              type="text"
              value={evolutionApiUrl}
              onChange={(e) => onEvolutionApiUrlChange(e.target.value)}
              placeholder="https://evolution.sua-api.com"
              className={`font-mono text-sm focus:ring-emerald-500 ${!isUrlValid ? 'border-red-500 focus:ring-red-500' : ''}`}
            />
            {!isUrlValid && (
              <p className="text-xs text-red-400">URL deve começar com http:// ou https://</p>
            )}
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-2">
            <Label htmlFor="evolutionApiKey" className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              API Key
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Chave de autenticação da Evolution API<br/>(encontrada no painel de configurações)</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Input
              id="evolutionApiKey"
              type="password"
              value={evolutionApiKey}
              onChange={(e) => onEvolutionApiKeyChange(e.target.value)}
              placeholder="sua-api-key-aqui"
              className={`font-mono text-sm focus:ring-emerald-500 ${!isApiKeyValid ? 'border-red-500 focus:ring-red-500' : ''}`}
            />
            {!isApiKeyValid && (
              <p className="text-xs text-red-400">API Key deve ter no mínimo 10 caracteres</p>
            )}
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-2">
            <Label htmlFor="evolutionInstanceName" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Nome da Instância
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Nome/ID da instância do WhatsApp<br/>criada no painel da Evolution</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Input
              id="evolutionInstanceName"
              value={evolutionInstanceName}
              onChange={(e) => onEvolutionInstanceNameChange(e.target.value)}
              placeholder="minha-instancia"
              className="font-mono text-sm focus:ring-emerald-500"
            />
          </motion.div>

          {/* Test Connection Button */}
          <motion.div variants={itemVariants} className="pt-2">
            <Button
              variant="secondary"
              onClick={testConnection}
              disabled={testingConnection || !evolutionApiUrl || !evolutionApiKey || !evolutionInstanceName}
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
                  Conectado
                </>
              ) : connectionStatus === 'disconnected' ? (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  Tentar novamente
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  Testar Conexão
                </>
              )}
            </Button>
            {connectionStatus === 'connected' && (
              <p className="text-xs text-emerald-400 text-center mt-2 flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" />
                Instância conectada com sucesso!
              </p>
            )}
          </motion.div>

          {/* Webhook Configuration (Collapsible) */}
          <motion.div variants={itemVariants} className="pt-4 border-t border-border">
            <motion.button
              onClick={() => setShowWebhook(!showWebhook)}
              whileHover={{ x: 4 }}
              className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Webhook URL (configure na Evolution)
              </span>
              <motion.div
                animate={{ rotate: showWebhook ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showWebhook && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">Webhook URL (copie e cole na Evolution API)</Label>
                      <div className="flex gap-2">
                        <Input
                          value={webhookUrl}
                          readOnly
                          className="bg-background border-border font-mono text-xs flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(webhookUrl, 'url')}
                          className="px-3"
                        >
                          {copied === 'url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-primary font-medium mb-2">Como configurar na Evolution:</p>
                      <ol className="text-xs text-primary/80 space-y-1 list-decimal list-inside">
                        <li>Acesse o painel da Evolution API</li>
                        <li>Vá em Instâncias → Sua Instância → Webhooks</li>
                        <li>Cole a URL acima no campo de Webhook</li>
                        <li>Ative os eventos: MESSAGES_UPSERT, CONNECTION_UPDATE</li>
                      </ol>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Documentation Link */}
        <motion.div variants={itemVariants} className="text-center pt-4">
          <motion.a
            href="https://doc.evolution-api.com/"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Documentação da Evolution API
          </motion.a>
        </motion.div>
      </motion.div>
    </TooltipProvider>
  );
};
