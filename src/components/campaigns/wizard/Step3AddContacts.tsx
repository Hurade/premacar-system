import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Users, Filter, CheckSquare, Square, FolderOpen, ChevronLeft, ChevronRight, FileSpreadsheet, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { CampaignFormData } from '@/pages/CreateCampaign';

interface TagDefinition {
  key: string;
  label: string;
  color: string | null;
}

function validatePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

interface Step3Props {
  data: CampaignFormData;
  onChange: (data: CampaignFormData) => void;
}

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  tags: string[] | null;
  folder_id: string | null;
}

interface Folder {
  id: string;
  name: string;
  color: string | null;
  contact_count: number;
}

const PAGE_SIZE = 50;

export function Step3AddContacts({ data, onChange }: Step3Props) {
  const [method, setMethod] = useState<'manual' | 'folder' | 'csv'>('manual');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<TagDefinition[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; invalid: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch tags
  useEffect(() => {
    async function fetchTags() {
      const { data: tagsData } = await supabase
        .from('tag_definitions')
        .select('key, label, color')
        .eq('is_active', true)
        .order('label');
      if (tagsData) setTags(tagsData as TagDefinition[]);
    }
    fetchTags();
  }, []);

  // Fetch folders
  useEffect(() => {
    async function fetchFolders() {
      const { data: foldersData } = await supabase
        .from('contact_folders')
        .select('id, name, color')
        .eq('is_active', true)
        .order('name');

      if (foldersData) {
        // Get counts for each folder
        const foldersWithCounts = await Promise.all(
          foldersData.map(async (f) => {
            const { count } = await supabase
              .from('contacts')
              .select('id', { count: 'exact', head: true })
              .eq('folder_id', f.id);
            return { ...f, contact_count: count || 0 };
          })
        );
        setFolders(foldersWithCounts);
      }
    }
    fetchFolders();
  }, []);

  // Fetch contacts with pagination
  useEffect(() => {
    async function fetchContacts() {
      setLoading(true);
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('contacts')
        .select('id, name, phone_number, email, tags, folder_id', { count: 'exact' });

      // Apply folder filter
      if (folderFilter && folderFilter !== 'all') {
        query = query.eq('folder_id', folderFilter);
      }

      // Apply search
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`);
      }

      // Apply tag filter
      if (tagFilter) {
        query = query.contains('tags', [tagFilter]);
      }

      const { data: contactsData, count, error } = await query
        .order('name')
        .range(from, to);

      if (!error) {
        setContacts((contactsData as Contact[]) || []);
        setTotalCount(count || 0);
      }
      setLoading(false);
    }
    fetchContacts();
  }, [currentPage, search, tagFilter, folderFilter]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, tagFilter, folderFilter]);

  const selectedSet = new Set(data.contacts);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const toggleContact = (id: string) => {
    const newSet = new Set(selectedSet);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    onChange({ ...data, contacts: Array.from(newSet) });
  };

  const selectAllPage = () => {
    const allIds = contacts.map((c) => c.id);
    onChange({ ...data, contacts: Array.from(new Set([...data.contacts, ...allIds])) });
  };

  const deselectAllPage = () => {
    const pageIds = new Set(contacts.map((c) => c.id));
    onChange({ ...data, contacts: data.contacts.filter((id) => !pageIds.has(id)) });
  };

  // Select ALL contacts from a folder (bypasses pagination)
  const selectAllFromFolder = async (folderId: string) => {
    setSelectingFolder(true);
    try {
      let query = supabase.from('contacts').select('id');
      if (folderId !== 'all') {
        query = query.eq('folder_id', folderId);
      }
      // Fetch all IDs in batches to avoid 1000 limit
      let allIds: string[] = [];
      let page = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch } = await query.range(page * batchSize, (page + 1) * batchSize - 1);
        if (!batch || batch.length === 0) break;
        allIds = [...allIds, ...batch.map((c: any) => c.id)];
        if (batch.length < batchSize) break;
        page++;
      }
      onChange({ ...data, contacts: Array.from(new Set([...data.contacts, ...allIds])) });
    } finally {
      setSelectingFolder(false);
    }
  };

  // Importa CSV/XLSX (mesmo formato de colunas do Disparos): telefone,
  // nome, empresa, cidade, produto, custom1-3. Diferença: em vez de criar
  // "leads" soltos, faz upsert em `contacts` por telefone e adiciona os
  // IDs à seleção da campanha.
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportSummary(null);

    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (rows.length === 0) {
        toast.error('Planilha vazia');
        return;
      }
      if (!('telefone' in rows[0]) && !('phone' in rows[0])) {
        toast.error('Coluna "telefone" não encontrada na planilha');
        return;
      }

      const phoneSet = new Set<string>();
      let invalid = 0;
      const parsed: { phone: string; name?: string; company?: string }[] = [];
      for (const row of rows) {
        const phone = validatePhone(String(row.telefone || row.phone || ''));
        if (!phone || phoneSet.has(phone)) {
          if (!phone) invalid++;
          continue;
        }
        phoneSet.add(phone);
        parsed.push({ phone, name: row.nome || row.name, company: row.empresa || row.company });
      }

      if (parsed.length === 0) {
        toast.error('Nenhum telefone válido encontrado');
        return;
      }

      // Contatos já existentes com esses telefones
      const { data: existing } = await supabase
        .from('contacts')
        .select('id, phone_number')
        .in('phone_number', parsed.map((p) => p.phone));
      const existingByPhone = new Map((existing || []).map((c: any) => [c.phone_number, c.id]));

      const toCreate = parsed.filter((p) => !existingByPhone.has(p.phone));
      let createdIds: string[] = [];
      if (toCreate.length > 0) {
        const { data: created, error: createError } = await supabase
          .from('contacts')
          .insert(
            toCreate.map((p) => ({
              phone_number: p.phone,
              name: p.name || null,
              oficina: p.company || null,
              last_activity: new Date().toISOString(),
            }))
          )
          .select('id');
        if (createError) throw createError;
        createdIds = (created || []).map((c: any) => c.id);
      }

      const allIds = [...Array.from(existingByPhone.values()), ...createdIds];
      onChange({ ...data, contacts: Array.from(new Set([...data.contacts, ...allIds])) });
      setImportSummary({ imported: allIds.length, invalid });
      toast.success(`${allIds.length} contatos importados (${createdIds.length} novos)`);
    } catch (err) {
      console.error('Erro ao importar planilha:', err);
      toast.error('Erro ao processar planilha');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [data, onChange]);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['telefone', 'nome', 'empresa'],
      ['5511999999999', 'João Silva', 'Oficina do João'],
      ['5521988888888', 'Maria Santos', 'Auto Center Maria'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
    XLSX.writeFile(wb, 'modelo_contatos.xlsx');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">👥 Adicionar Contatos</h2>

      {/* Method tabs */}
      <div className="flex gap-2">
        <Button
          variant={method === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('manual')}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          Selecionar Manualmente
        </Button>
        <Button
          variant={method === 'folder' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('folder')}
          className="gap-2"
        >
          <FolderOpen className="w-4 h-4" />
          Selecionar por Pasta
        </Button>
        <Button
          variant={method === 'csv' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('csv')}
          className="gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Importar CSV/XLSX
        </Button>
      </div>

      {/* === CSV/XLSX MODE === */}
      {method === 'csv' && (
        <div className="space-y-4">
          <div className="bg-secondary/30 border border-border/50 rounded-xl p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Colunas aceitas: <code>telefone</code> (obrigatório), <code>nome</code>, <code>empresa</code>.
              Telefones já cadastrados são reaproveitados; os demais criam contatos novos.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                <Download className="w-3.5 h-3.5" />
                Baixar modelo
              </Button>
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                {importing ? 'Importando...' : 'Escolher planilha'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            {importSummary && (
              <p className="text-xs text-muted-foreground">
                ✅ {importSummary.imported} contatos importados
                {importSummary.invalid > 0 && ` • ${importSummary.invalid} telefones inválidos ignorados`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* === FOLDER MODE === */}
      {method === 'folder' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Select value={selectedFolderId || 'all'} onValueChange={(v) => setSelectedFolderId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma pasta..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📂 Todos os Contatos</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    📁 {f.name} ({f.contact_count} contatos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFolderId && (
            <div className="bg-secondary/30 border border-border/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {selectedFolderId === 'all'
                      ? '📂 Todos os Contatos'
                      : `📁 ${folders.find((f) => f.id === selectedFolderId)?.name}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFolderId === 'all'
                      ? `${totalCount} contatos no total`
                      : `${folders.find((f) => f.id === selectedFolderId)?.contact_count || 0} contatos`}
                  </p>
                </div>
                <Button
                  onClick={() => selectAllFromFolder(selectedFolderId)}
                  disabled={selectingFolder}
                  size="sm"
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  {selectingFolder ? 'Selecionando...' : 'Selecionar Todos'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === MANUAL MODE === */}
      {method === 'manual' && (
        <>
          {/* Search & Filter */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Pasta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Pastas</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tagFilter || 'all'} onValueChange={(v) => setTagFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-48">
                <Filter className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.key} value={t.label}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllPage} className="gap-1.5 text-xs">
                <CheckSquare className="w-3.5 h-3.5" />
                Selecionar Página ({contacts.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAllPage} className="gap-1.5 text-xs">
                <Square className="w-3.5 h-3.5" />
                Desmarcar Página
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ...data, contacts: [] })}
                className="gap-1.5 text-xs text-destructive"
              >
                Limpar Todos
              </Button>
            </div>
            <Badge variant="secondary">{data.contacts.length} selecionados</Badge>
          </div>

          {/* Contact list */}
          <div className="border border-border/50 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando contatos...</div>
            ) : contacts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum contato encontrado</div>
            ) : (
              contacts.map((contact) => (
                <label
                  key={contact.id}
                  className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors cursor-pointer border-b border-border/30 last:border-b-0"
                >
                  <Checkbox
                    checked={selectedSet.has(contact.id)}
                    onCheckedChange={() => toggleContact(contact.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {contact.name || 'Sem nome'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.phone_number}
                      {contact.email && ` • ${contact.email}`}
                    </p>
                  </div>
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex gap-1 shrink-0">
                      {contact.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                      ))}
                      {contact.tags.length > 2 && (
                        <Badge variant="outline" className="text-[10px]">+{contact.tags.length - 2}</Badge>
                      )}
                    </div>
                  )}
                </label>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Summary */}
      {data.contacts.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <h3 className="font-semibold text-foreground text-sm mb-2">📊 Resumo</h3>
          <p className="text-sm text-foreground">✅ {data.contacts.length} contatos selecionados</p>
          <p className="text-xs text-muted-foreground mt-1">Prontos para adicionar à campanha</p>
        </div>
      )}
    </div>
  );
}
