import React, { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { api } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';

interface Announcement {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
  created_at: string;
}

const NotificationBell: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadUnreadCount = useCallback(() => {
    api.fetchUnreadAnnouncementsCount().then(setUnreadCount).catch(() => {});
  }, []);

  useEffect(() => {
    loadUnreadCount();

    const channel = supabase
      .channel('announcements-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, loadUnreadCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reads' }, loadUnreadCount)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadUnreadCount]);

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;

    setLoading(true);
    try {
      const data = await api.fetchAnnouncements();
      const active = (data as Announcement[]).filter(a => a.is_active);
      setAnnouncements(active);
      await Promise.all(active.map(a => api.markAnnouncementRead(a.id)));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error loading announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          title="Avisos"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-cyan-500 text-white text-[10px] font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-slate-900 border-slate-700 max-h-96 overflow-y-auto">
        <div className="p-3 border-b border-slate-800">
          <h4 className="text-sm font-semibold text-white">Avisos</h4>
        </div>
        {loading ? (
          <p className="text-xs text-slate-500 text-center py-6">Carregando...</p>
        ) : announcements.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">Nenhum aviso no momento.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {announcements.map((a) => (
              <div key={a.id} className="p-3">
                <p className="text-sm font-medium text-white">{a.title}</p>
                <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{a.body}</p>
                <p className="text-[10px] text-slate-500 mt-2">
                  {new Date(a.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
