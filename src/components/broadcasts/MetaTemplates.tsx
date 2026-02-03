import React, { useState } from 'react';
import { 
  useMetaTemplates, 
  useCreateMetaTemplate, 
  useUpdateMetaTemplate, 
  useDeleteMetaTemplate,
  useApproveMetaTemplate,
  MetaTemplate 
} from '@/hooks/useMetaTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Trash2, Loader2, Save, X, ChevronDown, ChevronUp, 
  MessageSquare, CheckCircle, Clock, XCircle, Send, Info, AlertTriangle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const categoryLabels = {
  MARKETING: { label: 'Marketing', color: 'bg-purple-500/20 text-purple-400' },
  UTILITY: { label: 'Utilidade', color: 'bg-blue-500/20 text-blue-400' },
  AUTHENTICATION: { label: 'Autenticação', color: 'bg-orange-500/20 text-orange-400' },
};

const statusConfig = {
  pending: { label: 'Pendente', icon: <Clock className="w-3 h-3" />, color: 'bg-yellow-500/20 text-yellow-400' },
  approved: { label: 'Aprovado', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-500/20 text-green-400' },
  rejected: { label: 'Rejeitado', icon: <XCircle className="w-3 h-3" />, color: 'bg-red-500/20 text-red-400' },
};

interface TemplateFormData {
  name: string;
  display_name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language_code: string;
  body_text: string;
  header_text: string;
  footer_text: string;
  parameters_mapping: Array<{ index: number; field: string }>;
}

const defaultFormData: TemplateFormData = {
  name: '',
  display_name: '',
  category: 'MARKETING',
  language_code: 'pt_BR',
  body_text: '',
  header_text: '',
  footer_text: '',
  parameters_mapping: [],
};

const fieldOptions = [
  { value: 'name', label: 'Nome do Lead' },
  { value: 'company', label: 'Empresa' },
  { value: 'city', label: 'Cidade' },
  { value: 'product', label: 'Produto' },
  { value: 'custom1', label: 'Custom 1' },
  { value: 'custom2', label: 'Custom 2' },
  { value: 'custom3', label: 'Custom 3' },
];

export const MetaTemplatesManager: React.FC = () => {
  const { data: templates, isLoading } = useMetaTemplates();
  const createTemplate = useCreateMetaTemplate();
  const updateTemplate = useUpdateMetaTemplate();
  const deleteTemplate = useDeleteMetaTemplate();
  const approveTemplate = useApproveMetaTemplate();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MetaTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const openNewDialog = () => {
    setEditingTemplate(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: MetaTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      display_name: template.display_name,
      category: template.category,
      language_code: template.language_code,
      body_text: template.body_text,
      header_text: template.header_text || '',
      footer_text: template.footer_text || '',
      parameters_mapping: template.parameters_mapping || [],
    });
    setIsDialogOpen(true);
  };

  // Count parameters in body text
  const getParametersFromText = (text: string): number[] => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ''))))].sort((a, b) => a - b);
  };

  const updateParameterMapping = (index: number, field: string) => {
    setFormData(prev => {
      const newMapping = prev.parameters_mapping.filter(p => p.index !== index);
      if (field) {
        newMapping.push({ index, field });
      }
      return { ...prev, parameters_mapping: newMapping.sort((a, b) => a.index - b.index) };
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome técnico do template é obrigatório');
      return;
    }
    if (!formData.display_name.trim()) {
      toast.error('Nome de exibição é obrigatório');
      return;
    }
    if (!formData.body_text.trim()) {
      toast.error('Texto do corpo é obrigatório');
      return;
    }

    const templateData = {
      name: formData.name.trim().toLowerCase().replace(/\s+/g, '_'),
      display_name: formData.display_name.trim(),
      category: formData.category,
      language_code: formData.language_code,
      body_text: formData.body_text.trim(),
      header_text: formData.header_text.trim() || null,
      footer_text: formData.footer_text.trim() || null,
      parameters_mapping: formData.parameters_mapping,
    };

    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, ...templateData });
    } else {
      await createTemplate.mutateAsync(templateData);
    }

    setIsDialogOpen(false);
    setFormData(defaultFormData);
  };

  const handleDelete = (id: string) => {
    deleteTemplate.mutate(id);
  };

  const handleApprove = (id: string) => {
    approveTemplate.mutate(id);
  };

  const parameters = getParametersFromText(formData.body_text);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Templates Meta API</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie templates pré-aprovados para disparo via API oficial
          </p>
        </div>
        <Button onClick={openNewDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Template
        </Button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <p className="font-medium mb-1">Importante sobre Templates da Meta</p>
          <ul className="list-disc list-inside space-y-1 text-blue-300/80">
            <li>Templates devem ser criados e aprovados no <strong>Meta Business Suite</strong> antes de usar aqui</li>
            <li>O nome técnico deve ser <strong>exatamente igual</strong> ao cadastrado no Meta</li>
            <li>Use variáveis como <code className="bg-blue-500/20 px-1 rounded">{"{{1}}"}</code>, <code className="bg-blue-500/20 px-1 rounded">{"{{2}}"}</code> no texto</li>
            <li>Após cadastrar, marque como "Aprovado" quando o template for aprovado pela Meta</li>
          </ul>
        </div>
      </div>

      {/* Templates List */}
      {!templates || templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center border border-dashed border-border rounded-xl">
          <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum template cadastrado</h3>
          <p className="text-muted-foreground mb-4">Cadastre templates aprovados no Meta Business</p>
          <Button onClick={openNewDialog} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-card/50 border border-border/50 rounded-xl overflow-hidden"
            >
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{template.display_name}</h3>
                      <Badge className={statusConfig[template.status].color}>
                        {statusConfig[template.status].icon}
                        <span className="ml-1">{statusConfig[template.status].label}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <code className="bg-secondary/50 px-1 rounded">{template.name}</code>
                      {' • '}
                      <span className={categoryLabels[template.category].color.replace('bg-', 'text-').replace('/20', '')}>
                        {categoryLabels[template.category].label}
                      </span>
                      {' • '}
                      {template.parameters_count} parâmetros
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {template.status === 'pending' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-green-400"
                      onClick={(e) => { e.stopPropagation(); handleApprove(template.id); }}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(template); }}>
                    Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Campanhas que usam este template não poderão mais enviar mensagens.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(template.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {expandedTemplate === template.id ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {expandedTemplate === template.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                  {template.header_text && (
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <span className="text-xs text-muted-foreground mb-1 block">Cabeçalho</span>
                      <p className="text-sm text-foreground">{template.header_text}</p>
                    </div>
                  )}
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <span className="text-xs text-muted-foreground mb-1 block">Corpo da Mensagem</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{template.body_text}</p>
                  </div>
                  {template.footer_text && (
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <span className="text-xs text-muted-foreground mb-1 block">Rodapé</span>
                      <p className="text-sm text-foreground">{template.footer_text}</p>
                    </div>
                  )}
                  {template.parameters_mapping && template.parameters_mapping.length > 0 && (
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <span className="text-xs text-muted-foreground mb-2 block">Mapeamento de Variáveis</span>
                      <div className="flex flex-wrap gap-2">
                        {template.parameters_mapping.map((mapping) => (
                          <Badge key={mapping.index} variant="outline" className="text-xs">
                            {`{{${mapping.index}}}`} → {fieldOptions.find(f => f.value === mapping.field)?.label || mapping.field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template Meta' : 'Novo Template Meta'}
            </DialogTitle>
            <DialogDescription>
              Cadastre o template exatamente como foi criado no Meta Business Suite
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Técnico *</Label>
                <Input
                  id="name"
                  placeholder="Ex: prospeccao_premacar_v1"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Deve ser exatamente igual ao cadastrado no Meta
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Nome de Exibição *</Label>
                <Input
                  id="display_name"
                  placeholder="Ex: Prospecção PremaCar"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION') => 
                    setFormData(prev => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utilidade</SelectItem>
                    <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select
                  value={formData.language_code}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, language_code: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en_US">English (US)</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="header_text">Cabeçalho (opcional)</Label>
              <Input
                id="header_text"
                placeholder="Ex: Olá!"
                value={formData.header_text}
                onChange={(e) => setFormData(prev => ({ ...prev, header_text: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body_text">Corpo da Mensagem *</Label>
              <Textarea
                id="body_text"
                placeholder="Ex: Olá {{1}}, aqui é da empresa. Recebemos seu contato sobre {{2}}..."
                value={formData.body_text}
                onChange={(e) => setFormData(prev => ({ ...prev, body_text: e.target.value }))}
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{1}}"}, {"{{2}}"}, etc. para variáveis que serão substituídas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer_text">Rodapé (opcional)</Label>
              <Input
                id="footer_text"
                placeholder="Ex: Atendimento de Seg a Sex"
                value={formData.footer_text}
                onChange={(e) => setFormData(prev => ({ ...prev, footer_text: e.target.value }))}
              />
            </div>

            {/* Parameters Mapping */}
            {parameters.length > 0 && (
              <div className="space-y-3 p-4 bg-secondary/30 rounded-lg">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Mapeamento de Variáveis
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Defina qual campo do lead será usado em cada variável do template
                </p>
                <div className="grid gap-3">
                  {parameters.map((paramIndex) => (
                    <div key={paramIndex} className="flex items-center gap-3">
                      <code className="bg-primary/20 px-2 py-1 rounded text-sm text-primary min-w-[50px] text-center">
                        {`{{${paramIndex}}}`}
                      </code>
                      <span className="text-muted-foreground">→</span>
                      <Select
                        value={formData.parameters_mapping.find(p => p.index === paramIndex)?.field || ''}
                        onValueChange={(value) => updateParameterMapping(paramIndex, value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione o campo" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={createTemplate.isPending || updateTemplate.isPending}
              className="gap-2"
            >
              {(createTemplate.isPending || updateTemplate.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              <Save className="w-4 h-4" />
              Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};