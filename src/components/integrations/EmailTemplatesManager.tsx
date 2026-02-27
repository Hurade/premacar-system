import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import EmailTemplateEditor from './EmailTemplateEditor';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body?: string;
  variables: string[];
  category: string;
  is_active: boolean;
}

const EmailTemplatesManager: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const fetchTemplates = async () => {
    const { data } = await (supabase
      .from('email_templates' as any)
      .select('*')
      .order('created_at', { ascending: false }) as any);
    setTemplates((data as EmailTemplate[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este template?')) return;
    await (supabase.from('email_templates' as any).delete().eq('id', id) as any);
    toast.success('Template excluído');
    fetchTemplates();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Templates de Email</h3>
        <Button size="sm" onClick={() => setEditingTemplate({ name: '', subject: '', html_body: '' })} className="gap-1">
          <Plus className="w-3 h-3" /> Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          Nenhum template criado ainda
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">{t.name}</p>
                <p className="text-xs text-slate-400">Assunto: {t.subject}</p>
                <div className="flex gap-1 mt-1">
                  {(t.variables || []).map((v) => (
                    <Badge key={v} variant="outline" className="text-[10px] px-1 py-0 border-slate-600 text-slate-400">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400" onClick={() => setPreviewHtml(t.html_body)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400" onClick={() => setEditingTemplate(t)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingTemplate && (
        <EmailTemplateEditor
          template={editingTemplate}
          onSave={() => { fetchTemplates(); setEditingTemplate(null); }}
          onClose={() => setEditingTemplate(null)}
        />
      )}

      {previewHtml && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewHtml(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTemplatesManager;
