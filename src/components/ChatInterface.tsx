import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, MoreVertical, Phone, Paperclip, Send, Check, CheckCheck, 
  Smile, Play, Loader2, MessageSquare, Info, X, Mail, 
  Tag, Bot, User, Pause, Brain, Plus, Filter, Inbox, CheckCircle, Trash2, UserPlus
} from 'lucide-react';
import { MessageDirection, MessageType, UIConversation, UIMessage, ConversationStatus, TagDefinition, ApiSource } from '../types';
import { Badge } from './ui/badge';
import { Button } from './Button';
import { useConversations } from '../hooks/useConversations';
import { toast } from 'sonner';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { api } from '@/services/api';
import { TagSelector } from './TagSelector';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';

type FilterType = 'all' | 'unread';
type StatusFilter = 'all' | 'nina' | 'human' | 'paused';

interface ContactOption {
  id: string;
  name: string | null;
  phone_number: string;
}

const ChatInterface: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { conversations, loading, sendMessage, updateStatus, markAsRead, assignConversation, finalizeConversation, deleteConversation, createConversation } = useConversations();
  const { sdrName, companyName } = useCompanySettings();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [showProfileInfo, setShowProfileInfo] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTags, setAvailableTags] = useState<TagDefinition[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [notesValue, setNotesValue] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  // Novos estados de filtro
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [filterAssignedUser, setFilterAssignedUser] = useState<string | null>(null);
  
  // Estados para modais de confirmação
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  // Estados para modal de nova conversa
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [contactsList, setContactsList] = useState<ContactOption[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [selectedContactForConv, setSelectedContactForConv] = useState<ContactOption | null>(null);
  const [selectedTagsForConv, setSelectedTagsForConv] = useState<string[]>([]);
  const [selectedApiSource, setSelectedApiSource] = useState<'meta' | 'evolution'>('evolution');
  
  // Audio player state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  
  const activeChat = conversations.find(c => c.id === selectedChatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Format audio time helper
  const formatAudioTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Load tag definitions and team members
  useEffect(() => {
    api.fetchTagDefinitions().then(setAvailableTags).catch(err => {
      console.error('Error loading tags:', err);
      toast.error('Erro ao carregar tags');
    });

    api.fetchTeam().then(setTeamMembers).catch(err => {
      console.error('Error loading team members:', err);
    });
  }, []);

  // Handle URL params for conversation selection and new contact
  useEffect(() => {
    const conversationParam = searchParams.get('conversation');
    const newContactParam = searchParams.get('newContact');
    
    if (conversationParam && conversations.some(c => c.id === conversationParam)) {
      setSelectedChatId(conversationParam);
      // Limpar o parâmetro da URL após selecionar
      searchParams.delete('conversation');
      setSearchParams(searchParams, { replace: true });
    } else if (newContactParam && !isCreatingConversation) {
      // Criar nova conversa para o contato
      setIsCreatingConversation(true);
      createConversation(newContactParam).then(newConvId => {
        setSelectedChatId(newConvId);
        // Limpar parâmetros da URL
        searchParams.delete('newContact');
        searchParams.delete('phone');
        setSearchParams(searchParams, { replace: true });
        toast.success('Conversa iniciada!');
      }).catch(err => {
        console.error('Error creating conversation:', err);
        toast.error('Erro ao iniciar conversa');
      }).finally(() => {
        setIsCreatingConversation(false);
      });
    }
    // Removido: auto-seleção do primeiro chat ao entrar na página
  }, [conversations, selectedChatId, searchParams, createConversation, setSearchParams, isCreatingConversation]);

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedChatId && activeChat?.unreadCount > 0) {
      markAsRead(selectedChatId);
    }
  }, [selectedChatId, activeChat?.unreadCount, markAsRead]);

  // Sync notes value with active chat
  useEffect(() => {
    if (activeChat) {
      setNotesValue(activeChat.notes || '');
    }
  }, [activeChat?.id]);

  // Handle notes save on blur
  const handleNotesBlur = async () => {
    if (!activeChat || notesValue === (activeChat.notes || '')) return;
    
    setIsSavingNotes(true);
    try {
      await api.updateContactNotes(activeChat.contactId, notesValue);
      toast.success('Notas salvas');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Erro ao salvar notas');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeChat) {
      scrollToBottom();
    }
  }, [activeChat?.id, selectedChatId]); 

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages]);

  const handleToggleTag = async (tagKey: string) => {
    if (!activeChat) return;
    
    const currentTags = activeChat.tags || [];
    const newTags = currentTags.includes(tagKey)
      ? currentTags.filter(t => t !== tagKey)
      : [...currentTags, tagKey];
    
    try {
      await api.updateContactTags(activeChat.contactId, newTags);
      toast.success('Tag atualizada');
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error('Erro ao atualizar tag');
    }
  };

  const handleCreateTag = async (tag: { key: string; label: string; color: string; category: string }) => {
    try {
      const newTag = await api.createTagDefinition(tag);
      setAvailableTags(prev => [...prev, newTag]);
      toast.success('Tag criada com sucesso');
      
      // Adicionar a tag ao contato automaticamente
      if (activeChat) {
        await handleToggleTag(tag.key);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Erro ao criar tag');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const content = inputText.trim();
    setInputText('');
    
    await sendMessage(activeChat.id, content);
  };

  const handleStatusChange = async (status: ConversationStatus) => {
    if (!activeChat) return;
    await updateStatus(activeChat.id, status);
  };

  const handleFinalizeConversation = async () => {
    if (!activeChat) return;
    setIsProcessingAction(true);
    try {
      await finalizeConversation(activeChat.id);
      setShowFinalizeDialog(false);
      setSelectedChatId(null);
      toast.success('Atendimento finalizado com sucesso');
    } catch (error) {
      console.error('Error finalizing conversation:', error);
      toast.error('Erro ao finalizar atendimento');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!activeChat) return;
    setIsProcessingAction(true);
    try {
      await deleteConversation(activeChat.id);
      setShowDeleteDialog(false);
      setSelectedChatId(null);
      toast.success('Conversa excluída com sucesso');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Erro ao excluir conversa');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Carregar lista de contatos para modal de nova conversa
  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone_number')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setContactsList(data || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
      toast.error('Erro ao carregar contatos');
    }
  };

  const handleOpenNewConversationModal = () => {
    loadContacts();
    setContactSearchQuery('');
    setSelectedContactForConv(null);
    setSelectedTagsForConv([]);
    setSelectedApiSource('evolution');
    setShowNewConversationModal(true);
  };

  const handleSelectContactForConv = (contact: ContactOption) => {
    setSelectedContactForConv(contact);
  };

  const handleToggleTagForConv = (tagKey: string) => {
    setSelectedTagsForConv(prev => 
      prev.includes(tagKey) 
        ? prev.filter(t => t !== tagKey)
        : [...prev, tagKey]
    );
  };

  const handleStartNewConversation = async () => {
    if (!selectedContactForConv) return;
    
    setIsCreatingConversation(true);
    try {
      // Atualizar tags do contato se selecionadas
      if (selectedTagsForConv.length > 0) {
        await api.updateContactTags(selectedContactForConv.id, selectedTagsForConv);
      }
      
      const newConvId = await createConversation(selectedContactForConv.id, selectedApiSource);
      setSelectedChatId(newConvId);
      setShowNewConversationModal(false);
      toast.success(`Conversa iniciada via ${selectedApiSource === 'meta' ? 'Meta API' : 'Evolution API'}!`);
    } catch (err) {
      console.error('Error starting conversation:', err);
      toast.error('Erro ao iniciar conversa');
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const filteredContactsList = contactsList.filter(contact => {
    const query = contactSearchQuery.toLowerCase();
    return (
      (contact.name?.toLowerCase() || '').includes(query) ||
      contact.phone_number.includes(query)
    );
  });

  const filteredConversations = conversations.filter(chat => {
    // Filtro por não lidas
    if (filterType === 'unread' && chat.unreadCount === 0) {
      return false;
    }
    
    // Filtro por status da conversa
    if (statusFilter !== 'all' && chat.status !== statusFilter) {
      return false;
    }
    
    // Filtro por membro da equipe atribuído
    if (filterAssignedUser && chat.assignedUserId !== filterAssignedUser) {
      return false;
    }
    
    // Filtro por tag (incluir apenas conversas com esta tag)
    if (filterTag && !chat.tags.includes(filterTag)) {
      return false;
    }
    
    // Excluir conversas que tenham alguma das tags excluídas
    if (excludedTags.length > 0 && excludedTags.some(tag => chat.tags.includes(tag))) {
      return false;
    }
    
    // Filtro por busca
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      chat.contactName.toLowerCase().includes(query) ||
      chat.contactPhone.includes(query) ||
      chat.lastMessage.toLowerCase().includes(query)
    );
  });

  const renderStatusBadge = (status: ConversationStatus) => {
    const config = {
      nina: { label: sdrName, icon: Bot, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
      human: { label: 'Humano', icon: User, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      paused: { label: 'Pausado', icon: Pause, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
    };
    const { label, icon: Icon, color } = config[status];
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const renderApiSourceBadge = (apiSource: ApiSource) => {
    if (apiSource === 'meta') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          Meta
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        Evolution
      </span>
    );
  };

  const renderMessageContent = (msg: UIMessage) => {
    if (msg.type === MessageType.IMAGE) {
      return (
        <div className="mb-1 group relative">
          <img 
            src={msg.mediaUrl || msg.content} 
            alt="Anexo" 
            className="rounded-lg max-w-full h-auto max-h-72 object-cover border border-slate-700/50 shadow-lg"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/300x200/1e293b/cbd5e1?text=Erro+Imagem';
            }}
          />
        </div>
      );
    }

    if (msg.type === MessageType.AUDIO) {
      const isPlaying = playingAudioId === msg.id;
      const duration = audioDurations[msg.id] || 0;
      const progress = audioProgress[msg.id] || 0;
      
      const togglePlay = () => {
        const audio = audioRefs.current[msg.id];
        if (!audio) return;
        
        if (isPlaying) {
          audio.pause();
          setPlayingAudioId(null);
        } else {
          // Pause all other audios
          Object.values(audioRefs.current).forEach(a => a.pause());
          audio.play();
          setPlayingAudioId(msg.id);
        }
      };

      return (
        <div className="flex items-center gap-3 min-w-[220px] py-1">
          {/* Hidden audio element */}
          {msg.mediaUrl && (
            <audio
              ref={el => { if (el) audioRefs.current[msg.id] = el; }}
              src={msg.mediaUrl}
              onLoadedMetadata={(e) => {
                const audio = e.currentTarget;
                setAudioDurations(prev => ({ ...prev, [msg.id]: audio.duration }));
              }}
              onTimeUpdate={(e) => {
                const audio = e.currentTarget;
                setAudioProgress(prev => ({ ...prev, [msg.id]: audio.currentTime }));
              }}
              onEnded={() => setPlayingAudioId(null)}
            />
          )}
          
          {/* Play/Pause button */}
          <button 
            onClick={togglePlay}
            disabled={!msg.mediaUrl}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all shadow-md ${
              msg.direction === MessageDirection.OUTGOING 
                ? 'bg-white text-cyan-600 hover:bg-cyan-50 disabled:opacity-50' 
                : 'bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
            )}
          </button>
          
          {/* Progress bar and duration */}
          <div className="flex-1 flex flex-col gap-1 justify-center h-9">
            <div 
              className={`h-1.5 rounded-full overflow-hidden cursor-pointer ${
                msg.direction === MessageDirection.OUTGOING ? 'bg-white/30' : 'bg-slate-600'
              }`}
              onClick={(e) => {
                const audio = audioRefs.current[msg.id];
                if (!audio || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                audio.currentTime = percent * duration;
              }}
            >
              <div 
                className={`h-full rounded-full transition-all ${
                  msg.direction === MessageDirection.OUTGOING ? 'bg-white' : 'bg-cyan-400'
                }`}
                style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
              />
            </div>
            <span className={`text-[10px] font-medium ${
              msg.direction === MessageDirection.OUTGOING ? 'text-cyan-100' : 'text-slate-400'
            }`}>
              {formatAudioTime(progress)} / {formatAudioTime(duration)}
            </span>
          </div>
        </div>
      );
    }

    return <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>;
  };

  if (loading) {
    return (
      <div className="flex h-full bg-slate-950 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <p className="text-sm text-slate-500">Sincronizando conversas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-950 rounded-tl-2xl overflow-hidden border-t border-l border-slate-800/50 shadow-2xl">
      
      {/* Left Sidebar: Chat List */}
      <div className="w-80 lg:w-96 border-r border-slate-800 flex flex-col bg-slate-900/50 backdrop-blur-md z-20 flex-shrink-0">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-800/50 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-white">Chats Ativos</h2>
            <Button
              size="sm"
              onClick={handleOpenNewConversationModal}
              className="h-8 px-3 gap-1.5"
              title="Iniciar nova conversa"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none text-slate-200 placeholder:text-slate-600 transition-all"
            />
          </div>
          
          {/* Filtros */}
          <div className="space-y-2">
            {/* Linha 1: Todas/Não lidas + Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro por lidas/não lidas */}
              <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    filterType === 'all' 
                      ? 'bg-cyan-600 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setFilterType('unread')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                    filterType === 'unread' 
                      ? 'bg-cyan-600 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Inbox className="w-3 h-3" />
                  Não lidas
                </button>
              </div>
              
              {/* Filtro por status */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      statusFilter !== 'all' 
                        ? statusFilter === 'nina' 
                          ? 'bg-violet-600/20 border-violet-500/50 text-violet-400'
                          : statusFilter === 'human'
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-amber-600/20 border-amber-500/50 text-amber-400'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {statusFilter === 'nina' && <Bot className="w-3 h-3" />}
                    {statusFilter === 'human' && <User className="w-3 h-3" />}
                    {statusFilter === 'paused' && <Pause className="w-3 h-3" />}
                    {statusFilter === 'all' && <Filter className="w-3 h-3" />}
                    {statusFilter === 'all' ? 'Status' : statusFilter === 'nina' ? sdrName : statusFilter === 'human' ? 'Humano' : 'Pausado'}
                    {statusFilter !== 'all' && (
                      <X 
                        className="w-3 h-3 ml-1 hover:text-white" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusFilter('all');
                        }}
                      />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2 bg-slate-900 border-slate-700">
                  <div className="space-y-1">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      Todos os status
                    </button>
                    <button
                      onClick={() => setStatusFilter('nina')}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                        statusFilter === 'nina' ? 'bg-violet-600/20 text-violet-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Bot className="w-4 h-4" />
                      {sdrName}
                    </button>
                    <button
                      onClick={() => setStatusFilter('human')}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                        statusFilter === 'human' ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Humano
                    </button>
                    <button
                      onClick={() => setStatusFilter('paused')}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                        statusFilter === 'paused' ? 'bg-amber-600/20 text-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Pause className="w-4 h-4" />
                      Pausado
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Linha 2: Tag, Excluir Tags, Membro */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro por tag (incluir) */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      filterTag 
                        ? 'bg-violet-600/20 border-violet-500/50 text-violet-400' 
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {filterTag ? availableTags.find(t => t.key === filterTag)?.label || filterTag : 'Tag'}
                    {filterTag && (
                      <X 
                        className="w-3 h-3 ml-1 hover:text-white" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterTag(null);
                        }}
                      />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2 bg-slate-900 border-slate-700">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 px-3 py-1 font-medium">Mostrar apenas com:</p>
                    <button
                      onClick={() => setFilterTag(null)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        !filterTag ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      Todas as tags
                    </button>
                    {availableTags.filter(t => t.is_active).map(tag => (
                      <button
                        key={tag.key}
                        onClick={() => setFilterTag(tag.key)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                          filterTag === tag.key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.label}
                      </button>
                    ))}
                    {availableTags.filter(t => t.is_active).length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-2">Nenhuma tag criada</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Filtro para excluir tags */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      excludedTags.length > 0 
                        ? 'bg-red-600/20 border-red-500/50 text-red-400' 
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <X className="w-3 h-3" />
                    {excludedTags.length > 0 ? `Ocultar (${excludedTags.length})` : 'Ocultar tag'}
                    {excludedTags.length > 0 && (
                      <X 
                        className="w-3 h-3 ml-1 hover:text-white" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setExcludedTags([]);
                        }}
                      />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 bg-slate-900 border-slate-700">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 px-3 py-1 font-medium">Ocultar conversas com:</p>
                    {availableTags.filter(t => t.is_active).map(tag => {
                      const isExcluded = excludedTags.includes(tag.key);
                      return (
                        <button
                          key={tag.key}
                          onClick={() => {
                            if (isExcluded) {
                              setExcludedTags(prev => prev.filter(t => t !== tag.key));
                            } else {
                              setExcludedTags(prev => [...prev, tag.key]);
                            }
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                            isExcluded ? 'bg-red-600/20 text-red-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.label}
                          {isExcluded && <Check className="w-3 h-3 ml-auto" />}
                        </button>
                      );
                    })}
                    {availableTags.filter(t => t.is_active).length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-2">Nenhuma tag criada</p>
                    )}
                    {excludedTags.length > 0 && (
                      <button
                        onClick={() => setExcludedTags([])}
                        className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors text-red-400 hover:bg-slate-800 mt-2 border-t border-slate-700 pt-2"
                      >
                        Limpar exclusões
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Filtro por membro da equipe */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      filterAssignedUser 
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <UserPlus className="w-3 h-3" />
                    {filterAssignedUser 
                      ? teamMembers.find(m => m.id === filterAssignedUser)?.name || 'Membro' 
                      : 'Atribuído a'}
                    {filterAssignedUser && (
                      <X 
                        className="w-3 h-3 ml-1 hover:text-white" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterAssignedUser(null);
                        }}
                      />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 bg-slate-900 border-slate-700">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 px-3 py-1 font-medium">Ver conversas de:</p>
                    <button
                      onClick={() => setFilterAssignedUser(null)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        !filterAssignedUser ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      Todos os membros
                    </button>
                    {teamMembers.filter(m => m.status === 'active').map(member => (
                      <button
                        key={member.id}
                        onClick={() => setFilterAssignedUser(member.id)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                          filterAssignedUser === member.id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <img 
                          src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0ea5e9&color=fff`}
                          alt={member.name}
                          className="w-5 h-5 rounded-full"
                        />
                        {member.name}
                      </button>
                    ))}
                    {teamMembers.filter(m => m.status === 'active').length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-2">Nenhum membro na equipe</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Contador de resultados */}
          {(filterType !== 'all' || filterTag || statusFilter !== 'all' || excludedTags.length > 0 || filterAssignedUser || searchQuery) && (
            <p className="text-xs text-slate-500">
              {filteredConversations.length} conversa{filteredConversations.length !== 1 ? 's' : ''} encontrada{filteredConversations.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
              <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
              <p className="text-xs mt-1 opacity-70">As conversas aparecerão aqui quando receberem mensagens</p>
            </div>
          ) : (
            filteredConversations.map((chat) => (
              <div 
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={`flex items-center p-4 cursor-pointer transition-all duration-200 border-b border-slate-800/30 hover:bg-slate-800/50 ${
                  selectedChatId === chat.id 
                    ? 'bg-slate-800/80 border-l-2 border-l-cyan-500' 
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-slate-700 to-slate-900">
                    <img 
                      src={chat.contactAvatar} 
                      alt={chat.contactName} 
                      className="w-full h-full rounded-full object-cover border border-slate-800" 
                    />
                  </div>
                  {chat.unreadCount > 0 ? (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-cyan-500 border-2 border-slate-900 rounded-full animate-pulse"></span>
                  ) : (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-slate-600 border-2 border-slate-900 rounded-full"></span>
                  )}
                </div>
                
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className={`text-sm font-semibold truncate ${selectedChatId === chat.id ? 'text-white' : 'text-slate-300'}`}>
                      {chat.contactName}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-medium">{chat.lastMessageTime}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {chat.messages[chat.messages.length - 1]?.type === MessageType.IMAGE ? '📷 Imagem' : 
                     chat.messages[chat.messages.length - 1]?.type === MessageType.AUDIO ? '🎵 Áudio' : 
                     chat.lastMessage || 'Sem mensagens'}
                  </p>
                  
                  <div className="flex items-center mt-2 gap-1.5">
                    {renderStatusBadge(chat.status)}
                    {renderApiSourceBadge(chat.apiSource)}
                    {chat.tags.slice(0, 1).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-slate-800/80 border border-slate-700 text-slate-400 text-[10px] rounded-md font-medium">
                        {tag}
                      </span>
                    ))}
                    {chat.unreadCount > 0 && (
                      <span className="ml-auto bg-gradient-to-r from-cyan-600 to-teal-600 text-white text-[10px] font-bold px-1.5 h-4 min-w-[1rem] flex items-center justify-center rounded-full shadow-lg shadow-cyan-500/20">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Area: Chat Window & Profile */}
      {activeChat ? (
        <div className="flex-1 flex overflow-hidden bg-[#0B0E14]">
          {/* Main Chat Content */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

            {/* Chat Header */}
            <div className="h-16 px-6 flex items-center justify-between bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-10 shrink-0">
              <div 
                className="flex items-center cursor-pointer hover:bg-slate-800/50 p-1.5 -ml-1.5 rounded-lg transition-colors pr-3"
                onClick={() => setShowProfileInfo(!showProfileInfo)}
              >
                <div className="relative">
                  <img src={activeChat.contactAvatar} alt={activeChat.contactName} className="w-9 h-9 rounded-full ring-2 ring-slate-800" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
                </div>
                <div className="ml-3">
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    {activeChat.contactName}
                    {renderStatusBadge(activeChat.status)}
                    {renderApiSourceBadge(activeChat.apiSource)}
                  </h2>
                  <p className="text-xs text-cyan-500 font-medium">{activeChat.contactPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Status control buttons */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`text-slate-400 hover:text-white ${activeChat.status === 'nina' ? 'bg-violet-500/20 text-violet-400' : ''}`}
                  onClick={() => handleStatusChange('nina')}
                  title={`Ativar ${sdrName} (IA)`}
                >
                  <Bot className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`text-slate-400 hover:text-white ${activeChat.status === 'human' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}
                  onClick={() => handleStatusChange('human')}
                  title="Assumir conversa"
                >
                  <User className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`text-slate-400 hover:text-white ${activeChat.status === 'paused' ? 'bg-amber-500/20 text-amber-400' : ''}`}
                  onClick={() => handleStatusChange('paused')}
                  title="Pausar conversa"
                >
                  <Pause className="w-5 h-5" />
                </Button>
                <div className="h-6 w-px bg-slate-800 mx-1"></div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`text-slate-400 hover:text-white ${showProfileInfo ? 'bg-slate-800 text-cyan-400' : ''}`} 
                  onClick={() => setShowProfileInfo(!showProfileInfo)} 
                  title="Ver Informações"
                >
                  <Info className="w-5 h-5" />
                </Button>
                <div className="h-6 w-px bg-slate-800 mx-1"></div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      title="Mais opções"
                      className="text-slate-400 hover:text-white"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-slate-900 border-slate-700" align="end">
                    <div className="space-y-1">
                      <button
                        onClick={() => setShowFinalizeDialog(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-md transition-colors"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Finalizar Atendimento
                      </button>
                      <button
                        onClick={() => setShowDeleteDialog(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir Conversa
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-0">
              {activeChat.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-sm">Nenhuma mensagem ainda</p>
                  <p className="text-xs mt-1 opacity-70">Envie uma mensagem para iniciar a conversa</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center my-6">
                    <span className="px-4 py-1.5 bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">Hoje</span>
                  </div>

                  {activeChat.messages.map((msg) => {
                    const isOutgoing = msg.direction === MessageDirection.OUTGOING;
                    return (
                      <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`flex flex-col max-w-[75%] ${isOutgoing ? 'items-end' : 'items-start'}`}>
                          <div 
                            className={`px-5 py-3 rounded-2xl shadow-md relative text-sm leading-relaxed ${
                              isOutgoing 
                                ? msg.fromType === 'nina'
                                  ? 'bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-tr-sm shadow-violet-900/20'
                                  : 'bg-gradient-to-br from-cyan-600 to-teal-700 text-white rounded-tr-sm shadow-cyan-900/20'
                                : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50'
                            }`}
                          >
                            {renderMessageContent(msg)}
                          </div>
                          
                          <div className="flex items-center mt-1.5 gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity px-1">
                            {isOutgoing && msg.fromType === 'nina' && (
                              <Bot className="w-3 h-3 text-violet-400" />
                            )}
                            {isOutgoing && msg.fromType === 'human' && (
                              <User className="w-3 h-3 text-cyan-400" />
                            )}
                            <span className="text-[10px] text-slate-500 font-medium">{msg.timestamp}</span>
                            {isOutgoing && (
                              msg.status === 'read' ? <CheckCheck className="w-3.5 h-3.5 text-cyan-500" /> : 
                              msg.status === 'delivered' ? <CheckCheck className="w-3.5 h-3.5 text-slate-500" /> :
                              <Check className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900/90 border-t border-slate-800 backdrop-blur-sm z-10">
              <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-4xl mx-auto">
                <div className="flex items-center gap-1">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    disabled
                    title="Em breve: Emoji picker"
                    className="text-slate-500 rounded-full cursor-not-allowed opacity-50"
                  >
                    <Smile className="w-5 h-5" />
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    disabled
                    title="Em breve: Enviar anexos"
                    className="text-slate-500 rounded-full cursor-not-allowed opacity-50"
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 focus-within:ring-2 focus-within:ring-cyan-500/30 focus-within:border-cyan-500/50 transition-all shadow-inner">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={activeChat.status === 'nina' ? `${sdrName} está respondendo automaticamente...` : 'Digite sua mensagem...'}
                    className="w-full bg-transparent border-none p-3.5 max-h-32 min-h-[48px] text-sm text-slate-200 focus:ring-0 resize-none outline-none placeholder:text-slate-600"
                    rows={1}
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={!inputText.trim()}
                  className={`rounded-full w-12 h-12 p-0 transition-all ${
                    inputText.trim() 
                      ? 'shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5 ml-0.5" />
                </Button>
              </form>
            </div>
          </div>

          {/* Right Profile Sidebar (CRM View) */}
          <div 
            className={`${showProfileInfo ? 'w-80 border-l border-slate-800 opacity-100' : 'w-0 opacity-0 border-none'} transition-all duration-300 ease-in-out bg-slate-900/95 flex-shrink-0 flex flex-col overflow-hidden`}
          >
            <div className="w-80 h-full flex flex-col">
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 flex-shrink-0">
                <span className="font-semibold text-white">Informações do Lead</span>
                <button 
                  onClick={() => setShowProfileInfo(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {/* Identity */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-cyan-500 to-teal-600 shadow-xl mb-4">
                    <img src={activeChat.contactAvatar} alt={activeChat.contactName} className="w-full h-full rounded-full object-cover border-2 border-slate-900" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{activeChat.contactName}</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    {activeChat.clientMemory.lead_profile.lead_stage === 'new' ? 'Novo Lead' : 
                     activeChat.clientMemory.lead_profile.lead_stage === 'qualified' ? 'Lead Qualificado' :
                     activeChat.clientMemory.lead_profile.lead_stage}
                  </p>
                </div>

                {/* Details List */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dados de Contato</h4>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500">Telefone</span>
                      <span className="text-slate-200 font-medium">{activeChat.contactPhone}</span>
                    </div>
                  </div>

                  {activeChat.contactEmail && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-500">Email</span>
                        <span className="text-slate-200 font-medium">{activeChat.contactEmail}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-slate-800/50 w-full"></div>

                {/* AI Memory Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Memória do(a) {sdrName}
                  </h4>
                  
                  {activeChat.clientMemory.lead_profile.interests.length > 0 && (
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <span className="text-xs text-slate-400">Interesses</span>
                      <p className="text-sm text-slate-200 mt-1">
                        {activeChat.clientMemory.lead_profile.interests.join(', ')}
                      </p>
                    </div>
                  )}

                  {activeChat.clientMemory.sales_intelligence.pain_points.length > 0 && (
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <span className="text-xs text-slate-400">Dores Identificadas</span>
                      <p className="text-sm text-slate-200 mt-1">
                        {activeChat.clientMemory.sales_intelligence.pain_points.join(', ')}
                      </p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <span className="text-xs text-slate-400">Próxima Ação Sugerida</span>
                    <p className="text-sm text-slate-200 mt-1">
                      {activeChat.clientMemory.sales_intelligence.next_best_action === 'qualify' ? 'Qualificar lead' :
                       activeChat.clientMemory.sales_intelligence.next_best_action === 'demo' ? 'Agendar demonstração' :
                       activeChat.clientMemory.sales_intelligence.next_best_action}
                    </p>
                  </div>

                  <div className="text-xs text-slate-500 text-center">
                    Total de conversas: {activeChat.clientMemory.interaction_summary.total_conversations}
                  </div>
                </div>

                <div className="h-px bg-slate-800/50 w-full"></div>

                {/* Assigned User */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Responsável
                  </h4>
                  <select
                    value={activeChat.assignedUserId || ''}
                    onChange={(e) => {
                      const userId = e.target.value || null;
                      assignConversation(activeChat.id, userId);
                      toast.success('Conversa atribuída. Deal atualizado automaticamente.');
                    }}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all"
                  >
                    <option value="">Não atribuído</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="h-px bg-slate-800/50 w-full"></div>

                {/* Tags */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    Tags
                    <Popover open={isTagSelectorOpen} onOpenChange={setIsTagSelectorOpen}>
                      <PopoverTrigger asChild>
                        <button className="text-cyan-500 hover:text-cyan-400 transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0 bg-slate-900 border-slate-700" align="end">
                        <TagSelector 
                          availableTags={availableTags}
                          selectedTags={activeChat.tags || []}
                          onToggleTag={handleToggleTag}
                          onCreateTag={handleCreateTag}
                        />
                      </PopoverContent>
                    </Popover>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activeChat.tags && activeChat.tags.length > 0 ? (
                      activeChat.tags.map(tagKey => {
                        const tagDef = availableTags.find(t => t.key === tagKey);
                        return (
                          <span 
                            key={tagKey}
                            style={{ 
                              backgroundColor: tagDef?.color ? `${tagDef.color}20` : 'rgba(59, 130, 246, 0.2)',
                              borderColor: tagDef?.color || '#3b82f6'
                            }}
                            className="px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 group hover:brightness-110 transition-all"
                          >
                            <span className="text-slate-200">{tagDef?.label || tagKey}</span>
                            <button
                              onClick={() => handleToggleTag(tagKey)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3 text-slate-400 hover:text-slate-200" />
                            </button>
                          </span>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-500 italic">Nenhuma tag adicionada</p>
                    )}
                  </div>
                </div>

                {/* Notes Area */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    Notas Internas
                    {isSavingNotes && <Loader2 className="w-3 h-3 animate-spin text-cyan-500" />}
                  </h4>
                  <textarea 
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 placeholder:text-slate-600 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none resize-none transition-all"
                    rows={4}
                    placeholder="Adicione observações sobre este lead..."
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    onBlur={handleNotesBlur}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0B0E14] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 to-transparent"></div>
          <div className="relative z-10 flex flex-col items-center p-8 text-center max-w-md">
            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-slate-800 relative group">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl group-hover:bg-cyan-500/30 transition-all duration-1000"></div>
              <MessageSquare className="w-10 h-10 text-cyan-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{companyName} Workspace</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {conversations.length === 0 
                ? 'Aguardando novas conversas. Configure o webhook do WhatsApp para começar a receber mensagens.'
                : 'Selecione uma conversa ao lado para iniciar o atendimento inteligente.'}
            </p>
            <div className="mt-8 flex gap-3 text-xs text-slate-500 font-mono bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-800/50">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {sdrName} Online
              </span>
              <span className="w-px h-4 bg-slate-800"></span>
              <span>{conversations.length} conversas</span>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Finalizar Atendimento</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Tem certeza que deseja finalizar este atendimento? A conversa será arquivada e não aparecerá mais na lista de chats ativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              disabled={isProcessingAction}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalizeConversation}
              disabled={isProcessingAction}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {isProcessingAction ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir Conversa</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              <span className="text-red-400 font-semibold">Atenção!</span> Esta ação é irreversível. Todas as mensagens desta conversa serão permanentemente excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              disabled={isProcessingAction}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              disabled={isProcessingAction}
              className="bg-red-600 hover:bg-red-500"
            >
              {isProcessingAction ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Conversation Modal */}
      <Dialog open={showNewConversationModal} onOpenChange={setShowNewConversationModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-cyan-400" />
              Nova Conversa
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedContactForConv 
                ? `Configurar conversa com ${selectedContactForConv.name || selectedContactForConv.phone_number}`
                : 'Selecione um contato para iniciar'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 overflow-y-auto flex-1">
            {!selectedContactForConv ? (
              <>
                {/* Busca de contatos */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                  />
                </div>

                {/* Lista de contatos */}
                <div className="max-h-64 overflow-y-auto space-y-1 border border-slate-800 rounded-lg p-2 bg-slate-950/50">
                  {filteredContactsList.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum contato encontrado</p>
                    </div>
                  ) : (
                    filteredContactsList.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleSelectContactForConv(contact)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-left group"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400 flex-shrink-0">
                          {(contact.name || contact.phone_number).substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-200 group-hover:text-cyan-400 transition-colors truncate">
                            {contact.name || 'Sem nome'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">{contact.phone_number}</p>
                        </div>
                        <MessageSquare className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Contato selecionado */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {(selectedContactForConv.name || selectedContactForConv.phone_number).substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">
                      {selectedContactForConv.name || 'Sem nome'}
                    </p>
                    <p className="text-sm text-slate-400 font-mono">{selectedContactForConv.phone_number}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedContactForConv(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    Trocar
                  </Button>
                </div>

                {/* Seleção de API */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Conexão de Envio</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedApiSource('evolution')}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        selectedApiSource === 'evolution'
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${selectedApiSource === 'evolution' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <span className={`text-sm font-medium ${selectedApiSource === 'evolution' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        Evolution API
                      </span>
                    </button>
                    <button
                      onClick={() => setSelectedApiSource('meta')}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        selectedApiSource === 'meta'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${selectedApiSource === 'meta' ? 'bg-blue-400' : 'bg-slate-600'}`} />
                      <span className={`text-sm font-medium ${selectedApiSource === 'meta' ? 'text-blue-400' : 'text-slate-400'}`}>
                        Meta API
                      </span>
                    </button>
                  </div>
                </div>

                {/* Seleção de Tags */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Tags (opcional)
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-700 bg-slate-800/30 min-h-[60px]">
                    {availableTags.filter(t => t.is_active).length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhuma tag disponível</p>
                    ) : (
                      availableTags.filter(t => t.is_active).map(tag => (
                        <button
                          key={tag.key}
                          onClick={() => handleToggleTagForConv(tag.key)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            selectedTagsForConv.includes(tag.key)
                              ? 'ring-2 ring-offset-2 ring-offset-slate-900'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: `${tag.color}20`,
                            borderColor: `${tag.color}50`,
                            color: tag.color,
                            ...(selectedTagsForConv.includes(tag.key) ? { ringColor: tag.color } : {})
                          }}
                        >
                          {tag.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Botão de iniciar */}
                <Button
                  onClick={handleStartNewConversation}
                  disabled={isCreatingConversation}
                  className="w-full h-11 gap-2"
                >
                  {isCreatingConversation ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Iniciar Conversa
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatInterface;
