import React, { useEffect, useState, useCallback } from 'react';
import { Search, Upload, MessageSquare, Loader2, Phone, Users, Folder, UserPlus, UserX, Tag as TagIcon, ChevronLeft, ChevronRight, Pencil, Mail, History, Ban, ShieldCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { api } from '@/services/api';
import FolderManager, { ContactFolder } from './contacts/FolderManager';
import ImportContactsModal from './contacts/ImportContactsModal';
import BulkActionsBar from './contacts/BulkActionsBar';
import AddContactModal from './contacts/AddContactModal';
import EditContactModal from './contacts/EditContactModal';
import { ContactHistoryModal } from './contacts/ContactHistoryModal';
import TagManager, { TagDefinition } from './contacts/TagManager';

interface ContactRow {
  id: string;
  name: string | null;
  phone_number: string;
  oficina: string | null;
  email: string | null;
  tags: string[] | null;
  folder_id: string | null;
  folder?: ContactFolder;
  last_activity: string;
  is_blocked: boolean;
  blocked_reason: string | null;
}

type PageSize = 10 | 50 | 100 | 'all';

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [folders, setFolders] = useState<ContactFolder[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);
  const [historyContact, setHistoryContact] = useState<ContactRow | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showMobileFolders, setShowMobileFolders] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, isManager } = useUserRole();

  // Debounce da busca — evita 1 request por tecla digitada, já que agora a
  // busca roda no servidor (antes filtrava só os contatos já carregados).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadTagDefinitions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tag_definitions')
        .select('*')
        .eq('is_active', true)
        .order('label');

      if (error) throw error;
      setTagDefinitions(data || []);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('contact_folders')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      // Get contact count per folder using HEAD requests (no row limit)
      const counts: Record<string, number> = {};
      const folderIds = (data || []).map(f => f.id);
      
      await Promise.all(
        folderIds.map(async (folderId) => {
          const { count } = await supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('folder_id', folderId);
          counts[folderId] = count || 0;
        })
      );

      setFolders((data || []).map(f => ({
        ...f,
        contact_count: counts[f.id] || 0
      })));
    } catch (error) {
      console.error('Erro ao carregar pastas:', error);
    }
  }, []);

  const CONTACTS_SELECT = `
    id,
    name,
    phone_number,
    oficina,
    email,
    tags,
    folder_id,
    last_activity,
    is_blocked,
    blocked_reason
  `;

  const buildContactsQuery = useCallback(() => {
    let query = supabase
      .from('contacts')
      .select(CONTACTS_SELECT, { count: 'exact' })
      .order('last_activity', { ascending: false });

    if (selectedFolderId) {
      query = query.eq('folder_id', selectedFolderId);
    }
    if (debouncedSearchTerm) {
      const term = `%${debouncedSearchTerm}%`;
      query = query.or(`name.ilike.${term},phone_number.ilike.${term},oficina.ilike.${term},email.ilike.${term}`);
    }
    return query;
  }, [selectedFolderId, debouncedSearchTerm]);

  // Busca e contagem no servidor — o Supabase (PostgREST) limita qualquer
  // resposta a no máximo db.max_rows (padrão 1000) por request, então sem
  // paginação de verdade a página só via os primeiros 1000 contatos e
  // tratava esse recorte como se fosse o total (e a busca só filtrava
  // dentro dele). Pra "Todos" precisamos paginar internamente em blocos
  // pra mostrar de fato tudo, mesmo com mais de 1000 contatos.
  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      if (pageSize === 'all') {
        const BATCH = 1000;
        let rows: any[] = [];
        let offset = 0;
        let total = 0;
        while (true) {
          const { data, error, count } = await buildContactsQuery().range(offset, offset + BATCH - 1);
          if (error) throw error;
          rows = rows.concat(data || []);
          total = count ?? rows.length;
          if (!data || data.length < BATCH || rows.length >= total) break;
          offset += BATCH;
        }
        setContacts(rows.map(c => ({ ...c, is_blocked: c.is_blocked ?? false })) as ContactRow[]);
        setTotalContacts(total);
      } else {
        const from = (currentPage - 1) * pageSize;
        const { data, error, count } = await buildContactsQuery().range(from, from + pageSize - 1);
        if (error) throw error;
        setContacts((data || []).map(c => ({
          ...c,
          is_blocked: c.is_blocked ?? false,
        })) as ContactRow[]);
        setTotalContacts(count ?? 0);
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  }, [buildContactsQuery, currentPage, pageSize]);

  useEffect(() => {
    loadFolders();
    loadTagDefinitions();
  }, [loadFolders, loadTagDefinitions]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // contacts já vem paginado/filtrado do servidor (ver loadContacts) — não
  // precisa filtrar/paginar de novo no cliente.
  const paginatedContacts = contacts;
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalContacts / pageSize);

  // Reset to page 1 when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedFolderId, pageSize]);

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedContacts.map(c => c.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ folder_id: folderId })
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`${selectedIds.size} contato(s) movido(s)!`);
      setSelectedIds(new Set());
      loadContacts();
      loadFolders();
    } catch (error) {
      console.error('Erro ao mover contatos:', error);
      toast.error('Erro ao mover contatos');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleAddTagToSelected = async (tagKey: string) => {
    setBulkLoading(true);
    try {
      // Buscar contatos selecionados com suas tags atuais
      const { data: currentContacts, error: fetchError } = await supabase
        .from('contacts')
        .select('id, tags')
        .in('id', Array.from(selectedIds));

      if (fetchError) throw fetchError;

      // Atualizar cada contato adicionando a tag
      for (const contact of currentContacts || []) {
        const currentTags = contact.tags || [];
        if (!currentTags.includes(tagKey)) {
          const { error } = await supabase
            .from('contacts')
            .update({ tags: [...currentTags, tagKey] })
            .eq('id', contact.id);
          if (error) throw error;

          supabase.functions.invoke('automation-executor', {
            body: { event_type: 'tag_applied', contact_id: contact.id, tags: [tagKey] },
          }).catch((err) => console.error('[Contacts] Error triggering automation-executor:', err));
        }
      }

      toast.success(`Tag adicionada a ${selectedIds.size} contato(s)!`);
      setSelectedIds(new Set());
      loadContacts();
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
      toast.error('Erro ao adicionar tag');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} contato(s)?`)) return;
    
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`${selectedIds.size} contato(s) excluído(s)!`);
      setSelectedIds(new Set());
      loadContacts();
      loadFolders();
    } catch (error) {
      console.error('Erro ao excluir contatos:', error);
      toast.error('Erro ao excluir contatos');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleStartConversation = async (contactId: string, phone: string) => {
    // Primeiro verifica se já existe uma conversa ativa para esse contato
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('is_active', true)
      .maybeSingle();

    if (existingConv) {
      // Se existe, navega diretamente para a conversa
      navigate(`/chat?conversation=${existingConv.id}`);
    } else {
      // Se não existe, navega com parâmetro para criar nova conversa
      navigate(`/chat?newContact=${contactId}&phone=${encodeURIComponent(phone)}`);
    }
  };

  const handleToggleBlock = async (contact: ContactRow) => {
    const willBlock = !contact.is_blocked;
    const label = contact.name || contact.phone_number;

    if (willBlock) {
      if (!confirm(`Bloquear ${label}?\n\nMensagens recebidas desse número serão ignoradas e ele deixará de receber campanhas/disparos automáticos.`)) return;
      const reason = window.prompt('Motivo do bloqueio (opcional):') || undefined;
      try {
        await api.toggleContactBlock(contact.id, true, reason);
        toast.success('Contato bloqueado');
        loadContacts();
      } catch (error) {
        console.error('Erro ao bloquear contato:', error);
        toast.error('Erro ao bloquear contato');
      }
    } else {
      if (!confirm(`Desbloquear ${label}?`)) return;
      try {
        await api.toggleContactBlock(contact.id, false);
        toast.success('Contato desbloqueado');
        loadContacts();
      } catch (error) {
        console.error('Erro ao desbloquear contato:', error);
        toast.error('Erro ao desbloquear contato');
      }
    }
  };

  const getFolderById = (folderId: string | null) => {
    return folders.find(f => f.id === folderId);
  };

  const getTagDefinition = (tagKey: string) => {
    return tagDefinitions.find(t => t.key === tagKey);
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-50 relative">
      {/* Sidebar with folders and tags — sempre visível a partir de md;
          em telas menores fica escondida e abre como painel sobre a tela
          (senão os w-64 fixos espremem a lista de contatos num celular) */}
      <div
        className={`w-64 p-4 border-slate-800 flex-shrink-0 overflow-y-auto space-y-6 bg-slate-950 md:relative md:block md:border-r ${
          showMobileFolders ? 'fixed inset-0 z-40 block' : 'hidden'
        }`}
      >
        <div className="flex items-center justify-between md:hidden mb-2">
          <h3 className="text-sm font-semibold text-slate-300">Pastas e Tags</h3>
          <button onClick={() => setShowMobileFolders(false)} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <FolderManager
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(id) => {
            setSelectedFolderId(id);
            setShowMobileFolders(false);
          }}
          onFoldersChange={loadFolders}
        />

        <div className="border-t border-slate-800 pt-4">
          <TagManager
            tags={tagDefinitions}
            onTagsChange={loadTagDefinitions}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto min-w-0">
        <button
          onClick={() => setShowMobileFolders(true)}
          className="md:hidden mb-4 flex items-center gap-2 text-sm text-slate-300 border border-slate-700 rounded-lg px-3 py-2"
        >
          <Folder className="w-4 h-4" />
          Pastas e Tags
        </button>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Contatos</h2>
            <p className="text-sm text-slate-400 mt-1">
              {selectedFolderId 
                ? `Pasta: ${getFolderById(selectedFolderId)?.name || 'Desconhecida'}`
                : 'Todos os contatos'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(isAdmin || isManager) && (
              <Button
                variant="outline"
                onClick={() => navigate('/contatos-duplicados')}
                className="border-slate-700 hover:border-cyan-500/50"
                title="Encontrar e mesclar contatos com o mesmo telefone"
              >
                <UserX className="w-4 h-4 mr-2" />
                Contatos Duplicados
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowAddModal(true)}
              className="border-slate-700 hover:border-cyan-500/50"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Contato
            </Button>
            <Button onClick={() => setShowImportModal(true)} className="shadow-lg shadow-cyan-500/20">
              <Upload className="w-4 h-4 mr-2" />
              Importar Planilha
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-4 mb-6 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar por nome, telefone ou oficina"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder:text-slate-600 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-xl overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-80">
              <Loader2 className="h-10 w-10 animate-spin text-cyan-500 mb-3" />
              <span className="text-sm text-slate-400 animate-pulse">Carregando contatos...</span>
            </div>
          ) : paginatedContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-slate-400">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum contato encontrado</p>
              <p className="text-sm text-slate-500 mt-1">
                {searchTerm ? 'Tente buscar por outro termo' : 'Importe uma planilha para começar'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-4 w-10">
                      <Checkbox
                        checked={selectedIds.size === paginatedContacts.length && paginatedContacts.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-4">Nome</th>
                    <th className="px-4 py-4">Oficina</th>
                    <th className="px-4 py-4">Telefone</th>
                    <th className="px-4 py-4">Email</th>
                    <th className="px-4 py-4">Tags</th>
                    <th className="px-4 py-4">Pasta</th>
                    <th className="px-4 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {paginatedContacts.map((contact) => {
                    const folder = getFolderById(contact.folder_id);
                    return (
                      <tr 
                        key={contact.id} 
                        className={`hover:bg-slate-800/40 transition-colors group ${
                          selectedIds.has(contact.id) ? 'bg-cyan-500/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={() => handleSelect(contact.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400">
                              {(contact.name || contact.phone_number || '?').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">
                              {contact.name || 'Sem nome'}
                            </span>
                            {contact.is_blocked && (
                              <Badge
                                className="px-1.5 py-0 text-[10px] font-medium bg-red-500/10 border-red-500/30 text-red-400"
                                title={contact.blocked_reason || undefined}
                              >
                                Bloqueado
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {contact.oficina || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Phone className="w-3.5 h-3.5" />
                            <span className="font-mono text-xs">{contact.phone_number}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {contact.email ? (
                            <div className="flex items-center gap-2 text-slate-400">
                              <Mail className="w-3.5 h-3.5" />
                              <span className="text-xs truncate max-w-[160px]">{contact.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {contact.tags && contact.tags.length > 0 ? (
                              contact.tags.slice(0, 3).map(tagKey => {
                                const tagDef = getTagDefinition(tagKey);
                                if (!tagDef) return null;
                                return (
                                  <Badge
                                    key={tagKey}
                                    className="px-1.5 py-0 text-[10px] font-medium"
                                    style={{ 
                                      backgroundColor: `${tagDef.color}20`,
                                      borderColor: `${tagDef.color}40`,
                                      color: tagDef.color 
                                    }}
                                  >
                                    {tagDef.label}
                                  </Badge>
                                );
                              })
                            ) : (
                              <span className="text-slate-600 text-xs">-</span>
                            )}
                            {contact.tags && contact.tags.length > 3 && (
                              <Badge className="px-1.5 py-0 text-[10px] bg-slate-800 text-slate-400 border-slate-700">
                                +{contact.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {folder ? (
                            <span 
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                              style={{ 
                                backgroundColor: `${folder.color || '#3b82f6'}15`,
                                borderColor: `${folder.color || '#3b82f6'}30`,
                                color: folder.color || '#3b82f6' 
                              }}
                            >
                              <Folder className="w-3 h-3" />
                              {folder.name}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" 
                              title="Editar Contato"
                              onClick={() => setEditingContact(contact)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Iniciar Conversa"
                              onClick={() => handleStartConversation(contact.id, contact.phone_number)}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Histórico"
                              onClick={() => setHistoryContact(contact)}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${contact.is_blocked ? 'text-emerald-400 hover:text-emerald-300' : 'text-red-400 hover:text-red-300'}`}
                              title={contact.is_blocked ? 'Desbloquear' : 'Bloquear'}
                              onClick={() => handleToggleBlock(contact)}
                            >
                              {contact.is_blocked ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination and stats footer */}
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-4">
            <span>{totalContacts} contato(s) no total</span>
            {pageSize !== 'all' && totalPages > 1 && (
              <span className="text-slate-400">
                Página {currentPage} de {totalPages}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Page size selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Exibir:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value) as PageSize)}
                className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">Todos</option>
              </select>
            </div>

            {/* Pagination controls */}
            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {/* Page numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        size="sm"
                        variant={currentPage === pageNum ? "default" : "ghost"}
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            <span className="flex items-center gap-1">
              <TagIcon className="w-3 h-3" />
              {tagDefinitions.length} tag(s)
            </span>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        folders={folders}
        tags={tagDefinitions}
        onClearSelection={() => setSelectedIds(new Set())}
        onMoveToFolder={handleMoveToFolder}
        onAddTag={handleAddTagToSelected}
        onDelete={handleBulkDelete}
        loading={bulkLoading}
      />

      {/* Import modal */}
      <ImportContactsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        folders={folders}
        onImportComplete={() => {
          loadContacts();
          loadFolders();
        }}
      />

      {/* Add contact modal */}
      <AddContactModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        folders={folders}
        tags={tagDefinitions}
        onContactAdded={() => {
          loadContacts();
          loadFolders();
        }}
      />

      {/* Edit contact modal */}
      <EditContactModal
        isOpen={!!editingContact}
        onClose={() => setEditingContact(null)}
        folders={folders}
        tags={tagDefinitions}
        contact={editingContact}
        onContactUpdated={() => {
          loadContacts();
          loadFolders();
        }}
      />

      {/* Contact history modal */}
      <ContactHistoryModal
        isOpen={!!historyContact}
        onClose={() => setHistoryContact(null)}
        contactId={historyContact?.id ?? null}
        contactName={historyContact?.name ?? null}
      />
    </div>
  );
};

export default Contacts;
