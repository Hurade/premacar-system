import React, { useState } from 'react';
import { useMessageTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, MessageTemplate } from '@/hooks/useMessageTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Trash2, FileText, Image, Video, FileAudio, File, Loader2, 
  Save, X, ChevronDown, ChevronUp, MessageSquare
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const mediaTypeConfig = {
  none: { label: 'Nenhuma', icon: <FileText className="w-4 h-4" /> },
  image: { label: 'Imagem', icon: <Image className="w-4 h-4" /> },
  video: { label: 'Vídeo', icon: <Video className="w-4 h-4" /> },
  audio: { label: 'Áudio', icon: <FileAudio className="w-4 h-4" /> },
  document: { label: 'Documento', icon: <File className="w-4 h-4" /> },
};

interface TemplateFormData {
  name: string;
  variations: string[];
  media_type: 'none' | 'image' | 'video' | 'document' | 'audio';
  media_urls: string[];
}

const defaultFormData: TemplateFormData = {
  name: '',
  variations: ['', '', ''],
  media_type: 'none',
  media_urls: [],
};

export const BroadcastTemplates: React.FC = () => {
  const { data: templates, isLoading } = useMessageTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const openNewDialog = () => {
    setEditingTemplate(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      variations: template.variations.length >= 3 ? template.variations : [...template.variations, '', '', ''].slice(0, Math.max(3, template.variations.length)),
      media_type: template.media_type,
      media_urls: template.media_urls,
    });
    setIsDialogOpen(true);
  };

  const addVariation = () => {
    if (formData.variations.length >= 10) {
      toast.error('Máximo de 10 variações permitido');
      return;
    }
    setFormData(prev => ({
      ...prev,
      variations: [...prev.variations, ''],
    }));
  };

  const removeVariation = (index: number) => {
    if (formData.variations.length <= 3) {
      toast.error('Mínimo de 3 variações obrigatório');
      return;
    }
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.filter((_, i) => i !== index),
    }));
  };

  const updateVariation = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.map((v, i) => i === index ? value : v),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome do modelo é obrigatório');
      return;
    }

    const validVariations = formData.variations.filter(v => v.trim());
    if (validVariations.length < 3) {
      toast.error('Mínimo de 3 variações de mensagem obrigatório');
      return;
    }

    const templateData = {
      name: formData.name.trim(),
      variations: validVariations,
      media_type: formData.media_type,
      media_urls: formData.media_urls,
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
          <h2 className="text-xl font-semibold text-foreground">Modelos de Mensagem</h2>
          <p className="text-sm text-muted-foreground">
            Crie modelos com variações para envios mais naturais
          </p>
        </div>
        <Button onClick={openNewDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Modelo
        </Button>
      </div>

      {/* Variables Help */}
      <div className="bg-secondary/30 border border-border/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Variáveis disponíveis:</h4>
        <div className="flex flex-wrap gap-2">
          {['{nome}', '{empresa}', '{cidade}', '{produto}', '{custom1}', '{custom2}', '{custom3}'].map(variable => (
            <code key={variable} className="px-2 py-1 bg-secondary rounded text-xs text-primary">
              {variable}
            </code>
          ))}
        </div>
      </div>

      {/* Templates List */}
      {!templates || templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center border border-dashed border-border rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum modelo criado</h3>
          <p className="text-muted-foreground mb-4">Crie seu primeiro modelo de mensagem</p>
          <Button onClick={openNewDialog} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Modelo
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
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{template.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {template.variations.length} variações • {mediaTypeConfig[template.media_type].label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                        <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Campanhas que usam este modelo não serão afetadas.
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
                <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
                  {template.variations.map((variation, index) => (
                    <div key={index} className="bg-secondary/30 rounded-lg p-3">
                      <span className="text-xs text-muted-foreground mb-1 block">Variação {index + 1}</span>
                      <p className="text-sm text-foreground">{variation}</p>
                    </div>
                  ))}
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
              {editingTemplate ? 'Editar Modelo' : 'Novo Modelo de Mensagem'}
            </DialogTitle>
            <DialogDescription>
              Crie variações da mensagem para envios mais naturais
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Modelo</Label>
              <Input
                id="name"
                placeholder="Ex: Primeiro Contato Imóveis"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Variações da Mensagem (mínimo 3)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariation}
                  disabled={formData.variations.length >= 10}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Adicionar
                </Button>
              </div>

              {formData.variations.map((variation, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Textarea
                            placeholder={`Variação ${index + 1}: Ex: "Oi {nome}! Vi seu interesse em {produto}..."`}
                            value={variation}
                            onChange={(e) => updateVariation(index, e.target.value)}
                            className="min-h-[80px]"
                          />
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p>Use variáveis como {'{nome}'}, {'{empresa}'}, etc.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {formData.variations.length > 3 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariation(index)}
                      className="text-destructive flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Tipo de Mídia (opcional)</Label>
              <Select
                value={formData.media_type}
                onValueChange={(value: TemplateFormData['media_type']) => 
                  setFormData(prev => ({ ...prev, media_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(mediaTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              Salvar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
