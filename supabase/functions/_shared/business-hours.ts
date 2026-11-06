// Mesma lógica de horário comercial já usada (corretamente, com timezone)
// em recurring-campaign-processor/index.ts — extraída aqui pra ser
// reaproveitada por quem mais precisar (ex: followup-processor), sem
// duplicar a conta de minutos/dia da semana.
export interface BusinessHoursConfig {
  business_hours_start?: string | null; // "HH:MM" ou "HH:MM:SS"
  business_hours_end?: string | null;
  business_days?: number[] | null; // 0=domingo..6=sábado (Date.getDay())
  timezone?: string | null;
}

export function isWithinBusinessHours(config: BusinessHoursConfig | null | undefined): boolean {
  // Sem horário configurado (start/end nulos) — não restringe, comportamento
  // igual ao de antes de existir essa checagem.
  if (!config || !config.business_hours_start || !config.business_hours_end) {
    return true;
  }

  const timezone = config.timezone || "America/Sao_Paulo";
  const localTimeStr = new Date().toLocaleString("en-US", { timeZone: timezone });
  const localDate = new Date(localTimeStr);

  const [startHour, startMin] = config.business_hours_start.split(":").map(Number);
  const [endHour, endMin] = config.business_hours_end.split(":").map(Number);
  const currentTimeMinutes = localDate.getHours() * 60 + localDate.getMinutes();
  const startTimeMinutes = startHour * 60 + startMin;
  const endTimeMinutes = endHour * 60 + endMin;
  const businessDays = config.business_days && config.business_days.length > 0 ? config.business_days : [1, 2, 3, 4, 5];

  if (currentTimeMinutes < startTimeMinutes || currentTimeMinutes > endTimeMinutes) return false;
  if (!businessDays.includes(localDate.getDay())) return false;
  return true;
}
