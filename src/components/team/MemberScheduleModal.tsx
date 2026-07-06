import React, { useEffect, useState } from 'react';
import { X, Clock, Loader2 } from 'lucide-react';
import { Button } from '../Button';
import { useTeamMemberSchedules, useUpsertTeamMemberSchedule, type TeamMemberSchedule } from '@/hooks/useTeamMemberSchedules';

interface MemberScheduleModalProps {
  teamMemberId: string;
  memberName: string;
  onClose: () => void;
}

const DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

type DayForm = { startTime: string; endTime: string; isAvailable: boolean };

export function MemberScheduleModal({ teamMemberId, memberName, onClose }: MemberScheduleModalProps) {
  const { data: schedules, isLoading } = useTeamMemberSchedules(teamMemberId);
  const upsertMutation = useUpsertTeamMemberSchedule();
  const [form, setForm] = useState<Record<number, DayForm>>({});

  useEffect(() => {
    const next: Record<number, DayForm> = {};
    DAYS.forEach((d) => {
      const existing = schedules?.find((s: TeamMemberSchedule) => s.day_of_week === d.value);
      next[d.value] = existing
        ? { startTime: existing.start_time.slice(0, 5), endTime: existing.end_time.slice(0, 5), isAvailable: existing.is_available }
        : { startTime: '09:00', endTime: '18:00', isAvailable: d.value >= 1 && d.value <= 5 };
    });
    setForm(next);
  }, [schedules]);

  const handleSaveDay = (dayOfWeek: number) => {
    const day = form[dayOfWeek];
    upsertMutation.mutate({ teamMemberId, dayOfWeek, startTime: day.startTime, endTime: day.endTime, isAvailable: day.isAvailable });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Horário de {memberName}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
            </div>
          ) : (
            DAYS.map((day) => {
              const dayForm = form[day.value] || { startTime: '09:00', endTime: '18:00', isAvailable: false };
              return (
                <div key={day.value} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
                  <label className="flex items-center gap-2 w-28 flex-shrink-0 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={dayForm.isAvailable}
                      onChange={(e) => setForm((prev) => ({ ...prev, [day.value]: { ...dayForm, isAvailable: e.target.checked } }))}
                      className="rounded border-slate-700"
                    />
                    {day.label}
                  </label>
                  <input
                    type="time"
                    value={dayForm.startTime}
                    disabled={!dayForm.isAvailable}
                    onChange={(e) => setForm((prev) => ({ ...prev, [day.value]: { ...dayForm, startTime: e.target.value } }))}
                    className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-xs text-slate-200 disabled:opacity-40"
                  />
                  <span className="text-slate-500 text-xs">até</span>
                  <input
                    type="time"
                    value={dayForm.endTime}
                    disabled={!dayForm.isAvailable}
                    onChange={(e) => setForm((prev) => ({ ...prev, [day.value]: { ...dayForm, endTime: e.target.value } }))}
                    className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-xs text-slate-200 disabled:opacity-40"
                  />
                  <button
                    onClick={() => handleSaveDay(day.value)}
                    disabled={upsertMutation.isPending}
                    className="ml-auto text-xs px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              );
            })
          )}
          <p className="text-xs text-slate-500 pt-2">
            Sem nenhum horário configurado, o membro é considerado sempre disponível para a distribuição automática de leads.
          </p>
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end">
          <Button onClick={onClose} variant="ghost">Fechar</Button>
        </div>
      </div>
    </div>
  );
}
