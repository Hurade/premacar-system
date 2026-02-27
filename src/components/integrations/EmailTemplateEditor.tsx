import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Textarea } from '../ui/textarea';

interface EmailTemplateEditorProps {
  template: any;
  onSave: () => void;
  onClose: () => void;
}

const DEFAULT_HTML = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
  <div style="background:#1e293b;padding:20px;text-align:center;">
    <h1 style="color:#22d3ee;margin:0;font-size:24px;">PremaCar</h1>
  </div>
  <div style="padding:30px;background:#ffffff;">
    <p>Olá <strong>{{contact_name}}</strong>,</p>
    <p>Seu conteúdo aqui...</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="#" style="background:#22d3ee;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Botão de Ação</a>
    </div>
  </div>
  <div style="background:#0f172a;padding:15px;text-align:center;">
    <p style="color:#64748b;font-size:12px;margin:0;">PremaCar - Automação Inteligente</p>
  </div>
</div>`;

const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({ template, onSave, onClose }) => {
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    name: template.name || '',
    subject: template.subject || '',
    html_body: template.html_body || '',
    text_body: template.text_body || '',
  });

  const handleSave = async () => {
    if (!data.name || !data.subject || !data.html_body) {
      toast.error('Preencha nome, assunto e corpo do email');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (template.id) {
        await (supabase.from('email_templates' as any).update(data).eq('id', template.id) as any);
      } else {
        await (supabase.from('email_templates' as any).insert({ ...data, user_id: user?.id }) as any);
      }
      toast.success(template.id ? 'Template atualizado!' : 'Template criado!');
      onSave();
    } catch {
      toast.error('Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.id ? 'Editar Template' : 'Novo Template'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="editor" className="mt-2">
          <TabsList className="bg-slate-800">
            <TabsTrigger value="editor">✏️ Editor</TabsTrigger>
            <TabsTrigger value="preview">👁️ Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4 mt-4">
            <div>
              <Label className="text-slate-300">Nome do Template *</Label>
              <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="Ex: Follow-up Dia 3" className="bg-slate-800 border-slate-700 mt-1" />
            </div>

            <div>
              <Label className="text-slate-300">Assunto do Email *</Label>
              <Input value={data.subject} onChange={(e) => setData({ ...data, subject: e.target.value })} placeholder="Ex: PremaCar - Ainda tem interesse?" className="bg-slate-800 border-slate-700 mt-1" />
              <p className="text-xs text-slate-500 mt-1">Variáveis: {`{{contact_name}}`}, {`{{company_name}}`}, {`{{campaign_id}}`}</p>
            </div>

            <div>
              <Label className="text-slate-300">Corpo do Email (HTML) *</Label>
              <Textarea
                value={data.html_body}
                onChange={(e) => setData({ ...data, html_body: e.target.value })}
                placeholder="Cole aqui o HTML do seu email..."
                rows={12}
                className="bg-slate-800 border-slate-700 mt-1 font-mono text-xs"
              />
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-slate-500">💡 Use {`{{contact_name}}`} para personalizar</p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-cyan-400 p-0 h-auto"
                  onClick={() => setData({ ...data, html_body: DEFAULT_HTML })}
                >
                  Inserir template base
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Versão Texto (opcional)</Label>
              <Textarea
                value={data.text_body}
                onChange={(e) => setData({ ...data, text_body: e.target.value })}
                placeholder="Versão texto para clientes que não aceitam HTML..."
                rows={4}
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div className="p-3 bg-slate-800 border-b border-slate-700 text-xs text-slate-400">
                <p>De: PremaCar &lt;contato@empresa.com.br&gt;</p>
                <p>Assunto: {data.subject || '(sem assunto)'}</p>
              </div>
              <div className="bg-white p-4" dangerouslySetInnerHTML={{ __html: data.html_body || '<p style="color:#999">Nenhum conteúdo</p>' }} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {template.id ? 'Atualizar' : 'Criar'} Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailTemplateEditor;
