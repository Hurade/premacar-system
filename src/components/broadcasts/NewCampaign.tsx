import React, { useState, useCallback, useEffect } from 'react';
import { useCreateCampaign, useImportLeads, CampaignLead } from '@/hooks/useCampaigns';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle, 
  Loader2, Send, Clock, Shield, Calendar, Play, Info, X, Folder, Users
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface ContactFolder {
  id: string;
  name: string;
  color: string;
  contact_count?: number;
}

interface NewCampaignProps {
  onSuccess: () => void;
}

interface ParsedLead {
  phone: string;
  name?: string;
  company?: string;
  city?: string;
  product?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
}

interface ValidationResult {
  valid: ParsedLead[];
  duplicates: number;
  invalid: number;
}

const weekDays = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
];

export const BroadcastNewCampaign: React.FC<NewCampaignProps> = ({ onSuccess }) => {
  const { data: templates } = useMessageTemplates();
  const createCampaign = useCreateCampaign();
  const importLeads = useImportLeads();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [dailyLimit, setDailyLimit] = useState(100);
  const [intervalType, setIntervalType] = useState<'fixed' | 'random'>('random');
  const [intervalMin, setIntervalMin] = useState(60);
  const [intervalMax, setIntervalMax] = useState(180);
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(true);
  const [businessHoursStart, setBusinessHoursStart] = useState('09:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00');
  const [businessDays, setBusinessDays] = useState([1, 2, 3, 4, 5]);
  const [antiBanEnabled, setAntiBanEnabled] = useState(true);
  const [pauseAfterCount, setPauseAfterCount] = useState(50);
  const [pauseDurationMinutes, setPauseDurationMinutes] = useState(15);
  const [startType, setStartType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledStart, setScheduledStart] = useState('');

  // Leads state
  const [leads, setLeads] = useState<ParsedLead[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Folder selection
  const [leadSource, setLeadSource] = useState<'file' | 'folder'>('file');
  const [folders, setFolders] = useState<ContactFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Load folders with disparo-enabled contact count
  useEffect(() => {
    const loadFolders = async () => {
      setLoadingFolders(true);
      try {
        const { data: foldersData } = await supabase
          .from('contact_folders')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        // Get disparo-enabled contact count per folder
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('folder_id')
          .eq('disparo_enabled', true);
        
        const counts: Record<string, number> = {};
        contactsData?.forEach(c => {
          const key = c.folder_id || 'no_folder';
          counts[key] = (counts[key] || 0) + 1;
        });

        setFolders((foldersData || []).map(f => ({
          ...f,
          contact_count: counts[f.id] || 0
        })));
      } catch (error) {
        console.error('Erro ao carregar pastas:', error);
      } finally {
        setLoadingFolders(false);
      }
    };
    loadFolders();
  }, []);

  // Load contacts from selected folder
  const loadContactsFromFolder = async (folderId: string) => {
    setIsUploading(true);
    try {
      let query = supabase
        .from('contacts')
        .select('phone_number, name, oficina')
        .eq('disparo_enabled', true);
      
      if (folderId !== 'all') {
        query = query.eq('folder_id', folderId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const phoneSet = new Set<string>();
      const validLeads: ParsedLead[] = [];

      for (const contact of data || []) {
        if (!contact.phone_number || phoneSet.has(contact.phone_number)) continue;
        phoneSet.add(contact.phone_number);
        validLeads.push({
          phone: contact.phone_number,
          name: contact.name || undefined,
          company: contact.oficina || undefined,
        });
      }

      setLeads(validLeads);
      setValidation({ valid: validLeads, duplicates: 0, invalid: 0 });
      toast.success(`${validLeads.length} contatos carregados da pasta`);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast.error('Erro ao carregar contatos da pasta');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFolderSelect = (folderId: string) => {
    setSelectedFolderId(folderId);
    if (folderId) {
      loadContactsFromFolder(folderId);
    }
  };

  // Calculate estimated duration
  const estimatedDays = leads.length > 0 ? Math.ceil(leads.length / dailyLimit) : 0;

  // Validate phone number
  const validatePhone = (phone: string): string | null => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10 && cleaned.length <= 15) {
      return cleaned;
    }
    return null;
  };

  // Parse spreadsheet file
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (rows.length === 0) {
        toast.error('Planilha vazia');
        return;
      }

      // Check for phone column
      const firstRow = rows[0];
      const hasPhone = 'telefone' in firstRow || 'phone' in firstRow;
      if (!hasPhone) {
        toast.error('Coluna "telefone" não encontrada na planilha');
        return;
      }

      const phoneSet = new Set<string>();
      const validLeads: ParsedLead[] = [];
      let duplicates = 0;
      let invalid = 0;

      for (const row of rows) {
        const rawPhone = String(row.telefone || row.phone || '');
        const phone = validatePhone(rawPhone);

        if (!phone) {
          invalid++;
          continue;
        }

        if (phoneSet.has(phone)) {
          duplicates++;
          continue;
        }

        phoneSet.add(phone);
        validLeads.push({
          phone,
          name: row.nome || row.name || undefined,
          company: row.empresa || row.company || undefined,
          city: row.cidade || row.city || undefined,
          product: row.produto || row.product || undefined,
          custom1: row.custom1 || undefined,
          custom2: row.custom2 || undefined,
          custom3: row.custom3 || undefined,
        });
      }

      setLeads(validLeads);
      setValidation({ valid: validLeads, duplicates, invalid });
      toast.success(`${validLeads.length} leads importados`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao processar planilha');
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Download template spreadsheet
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['telefone', 'nome', 'empresa', 'cidade', 'produto', 'custom1', 'custom2', 'custom3'],
      ['5511999999999', 'João Silva', 'Tech Corp', 'São Paulo', 'Software CRM', 'Premium', 'Urgente', 'Reunião'],
      ['5521988888888', 'Maria Santos', 'Consultoria', 'Rio de Janeiro', 'Consultoria', 'Básico', '', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'modelo_leads.xlsx');
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Nome da campanha é obrigatório');
      return;
    }
    if (!templateId) {
      toast.error('Selecione um modelo de mensagem');
      return;
    }
    if (leads.length === 0) {
      toast.error('Importe pelo menos um lead');
      return;
    }
    if (intervalMin < 30) {
      toast.error('Intervalo mínimo deve ser de 30 segundos');
      return;
    }
    if (dailyLimit > 500) {
      toast.error('Limite máximo de 500 mensagens por dia');
      return;
    }

    try {
      // Create campaign
      const campaign = await createCampaign.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        template_id: templateId,
        status: startType === 'immediate' ? 'active' : 'scheduled',
        daily_limit: dailyLimit,
        interval_type: intervalType,
        interval_min: intervalMin,
        interval_max: intervalType === 'random' ? intervalMax : intervalMin,
        business_hours_enabled: businessHoursEnabled,
        business_hours_start: businessHoursStart,
        business_hours_end: businessHoursEnd,
        business_days: businessDays,
        anti_ban_enabled: antiBanEnabled,
        pause_after_count: pauseAfterCount,
        pause_duration_minutes: pauseDurationMinutes,
        scheduled_start: startType === 'scheduled' ? scheduledStart : null,
        total_leads: leads.length,
      });

      // Import leads
      await importLeads.mutateAsync({
        campaignId: campaign.id,
        leads: leads.map(lead => ({
          phone: lead.phone,
          name: lead.name,
          company: lead.company,
          city: lead.city,
          product: lead.product,
          custom1: lead.custom1,
          custom2: lead.custom2,
          custom3: lead.custom3,
        })),
      });

      toast.success('Campanha criada com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  const selectedTemplate = templates?.find(t => t.id === templateId);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Section 1: Basic Info */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          Informações Básicas
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Campanha *</Label>
            <Input
              id="name"
              placeholder="Ex: Promoção Janeiro"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template">Modelo de Mensagem *</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.variations.length} variações)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Textarea
            id="description"
            placeholder="Descreva o objetivo desta campanha..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {selectedTemplate && (
          <div className="bg-secondary/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Preview do modelo:</h4>
            <p className="text-sm text-foreground">{selectedTemplate.variations[0]}</p>
          </div>
        )}
      </div>

      {/* Section 2: Import Leads */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Origem dos Leads
        </h3>

        {/* Source selector */}
        <div className="flex items-center gap-4 p-4 bg-secondary/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox
              id="source-file"
              checked={leadSource === 'file'}
              onCheckedChange={() => { setLeadSource('file'); setLeads([]); setValidation(null); }}
            />
            <label htmlFor="source-file" className="text-sm flex items-center gap-2 cursor-pointer">
              <FileSpreadsheet className="w-4 h-4" />
              Importar Planilha
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="source-folder"
              checked={leadSource === 'folder'}
              onCheckedChange={() => { setLeadSource('folder'); setLeads([]); setValidation(null); }}
            />
            <label htmlFor="source-folder" className="text-sm flex items-center gap-2 cursor-pointer">
              <Folder className="w-4 h-4" />
              Pasta de Contatos
            </label>
          </div>
        </div>

        {leadSource === 'file' ? (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="relative cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg hover:border-primary/50 transition-colors">
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground">
                    {isUploading ? 'Processando...' : 'Clique para fazer upload (.xlsx, .csv)'}
                  </span>
                </div>
              </label>
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="w-4 h-4" />
              Baixar Modelo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Selecione a pasta com contatos habilitados para disparo</Label>
            <Select value={selectedFolderId} onValueChange={handleFolderSelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma pasta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Todos com disparo ativado
                </SelectItem>
                {folders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name} ({folder.contact_count || 0} contatos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {folders.length === 0 && !loadingFolders && (
              <p className="text-sm text-muted-foreground">
                Nenhuma pasta encontrada. Crie pastas na aba de Contatos.
              </p>
            )}
          </div>
        )}

        {validation && (
          <div className="flex items-center gap-6 p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle className="w-4 h-4" />
              <span>{validation.valid.length} contatos prontos para disparo</span>
            </div>
            {validation.duplicates > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4" />
                <span>{validation.duplicates} duplicados removidos</span>
              </div>
            )}
            {validation.invalid > 0 && (
              <div className="flex items-center gap-2 text-destructive">
                <X className="w-4 h-4" />
                <span>{validation.invalid} inválidos</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Send Settings */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-6 space-y-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Configurações de Envio
        </h3>

        {/* Daily Limit */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Limite Diário: {dailyLimit} mensagens/dia</Label>
            {leads.length > 0 && (
              <span className="text-sm text-muted-foreground">
                Duração estimada: {estimatedDays} dias
              </span>
            )}
          </div>
          <Slider
            value={[dailyLimit]}
            onValueChange={([value]) => setDailyLimit(value)}
            min={1}
            max={500}
            step={10}
          />
        </div>

        {/* Interval */}
        <div className="space-y-3">
          <Label>Intervalo entre Mensagens</Label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="fixed"
                checked={intervalType === 'fixed'}
                onCheckedChange={() => setIntervalType('fixed')}
              />
              <label htmlFor="fixed" className="text-sm">Fixo</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="random"
                checked={intervalType === 'random'}
                onCheckedChange={() => setIntervalType('random')}
              />
              <label htmlFor="random" className="text-sm">Aleatório</label>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={intervalMin}
                onChange={(e) => setIntervalMin(Number(e.target.value))}
                className="w-24"
                min={30}
              />
              <span className="text-sm text-muted-foreground">seg</span>
            </div>
            {intervalType === 'random' && (
              <>
                <span className="text-muted-foreground">até</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={intervalMax}
                    onChange={(e) => setIntervalMax(Number(e.target.value))}
                    className="w-24"
                    min={intervalMin}
                  />
                  <span className="text-sm text-muted-foreground">seg</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Business Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Horário Comercial
            </Label>
            <Switch
              checked={businessHoursEnabled}
              onCheckedChange={setBusinessHoursEnabled}
            />
          </div>

          {businessHoursEnabled && (
            <div className="space-y-4 pl-6 border-l-2 border-border">
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="time"
                    value={businessHoursStart}
                    onChange={(e) => setBusinessHoursStart(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Input
                    type="time"
                    value={businessHoursEnd}
                    onChange={(e) => setBusinessHoursEnd(e.target.value)}
                    className="w-32"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {weekDays.map(day => (
                  <div key={day.id} className="flex items-center gap-1">
                    <Checkbox
                      id={`day-${day.id}`}
                      checked={businessDays.includes(day.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setBusinessDays([...businessDays, day.id].sort());
                        } else {
                          setBusinessDays(businessDays.filter(d => d !== day.id));
                        }
                      }}
                    />
                    <label htmlFor={`day-${day.id}`} className="text-sm">{day.label}</label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Anti-ban */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="flex items-center gap-2 cursor-help">
                    <Shield className="w-4 h-4" />
                    Proteção Anti-Ban
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ajuda a evitar bloqueios no WhatsApp</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Switch
              checked={antiBanEnabled}
              onCheckedChange={setAntiBanEnabled}
            />
          </div>

          {antiBanEnabled && (
            <div className="space-y-2 pl-6 border-l-2 border-border text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-primary" />
                Rotação automática de mensagens
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-primary" />
                Intervalo randomizado entre envios
              </p>
              <div className="flex items-center gap-2 text-foreground">
                <span>Pausar a cada</span>
                <Input
                  type="number"
                  value={pauseAfterCount}
                  onChange={(e) => setPauseAfterCount(Number(e.target.value))}
                  className="w-16 h-8"
                  min={10}
                />
                <span>mensagens por</span>
                <Input
                  type="number"
                  value={pauseDurationMinutes}
                  onChange={(e) => setPauseDurationMinutes(Number(e.target.value))}
                  className="w-16 h-8"
                  min={1}
                />
                <span>minutos</span>
              </div>
            </div>
          )}
        </div>

        {/* Start Time */}
        <div className="space-y-3">
          <Label>Início da Campanha</Label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="immediate"
                checked={startType === 'immediate'}
                onCheckedChange={() => setStartType('immediate')}
              />
              <label htmlFor="immediate" className="text-sm">Iniciar imediatamente</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="scheduled"
                checked={startType === 'scheduled'}
                onCheckedChange={() => setStartType('scheduled')}
              />
              <label htmlFor="scheduled" className="text-sm">Agendar para:</label>
              {startType === 'scheduled' && (
                <Input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="w-auto"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary & Actions */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">📊 Resumo da Campanha</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
          <div>
            <span className="text-muted-foreground block">Total de leads:</span>
            <span className="font-semibold text-foreground">{leads.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Mensagens/dia:</span>
            <span className="font-semibold text-foreground">{dailyLimit}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Duração estimada:</span>
            <span className="font-semibold text-foreground">{estimatedDays} dias</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Modelo:</span>
            <span className="font-semibold text-foreground">{selectedTemplate?.name ?? 'Não selecionado'}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Intervalo:</span>
            <span className="font-semibold text-foreground">
              {intervalType === 'random' ? `${intervalMin}-${intervalMax}s` : `${intervalMin}s`}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Horário:</span>
            <span className="font-semibold text-foreground">
              {businessHoursEnabled ? `${businessHoursStart} - ${businessHoursEnd}` : '24h'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Início:</span>
            <span className="font-semibold text-foreground">
              {startType === 'immediate' ? 'Imediato' : scheduledStart || 'Agendado'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Anti-ban:</span>
            <span className="font-semibold text-foreground">
              {antiBanEnabled ? 'Ativado' : 'Desativado'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onSuccess}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createCampaign.isPending || importLeads.isPending}
            className="gap-2"
          >
            {(createCampaign.isPending || importLeads.isPending) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {startType === 'immediate' ? 'Criar e Iniciar' : 'Agendar Campanha'}
          </Button>
        </div>
      </div>
    </div>
  );
};
