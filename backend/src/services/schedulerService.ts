import { CollectionBusyError, runCollection, ScheduleAlreadyRunError } from './collectionService';
// Agenda coletas nos horários e no fuso horário definidos na configuração.
export function scheduleConfig() {
    const timeZone = process.env.SCRAPE_TIMEZONE || 'Europe/Lisbon';
    new Intl.DateTimeFormat('en-GB', { timeZone }).format();
    const times = (process.env.SCRAPE_TIMES || '08:00,20:00').split(',').map(t => t.trim());
    if (times.length !== 2 || new Set(times).size !== 2 || times.some(t => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))) {
        throw new Error('SCRAPE_TIMES deve conter dois horários distintos HH:mm, separados por vírgula.');
    }
    return { timeZone, times, enabled: process.env.SCRAPE_ENABLED !== 'false' };
}
export function scheduledKey(now: Date, config: ReturnType<typeof scheduleConfig>): string | null {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const part = (key: string) => parts.find(p => p.type === key)!.value;
    const time = `${part('hour')}:${part('minute')}`;
    return config.times.includes(time) ? `${config.timeZone}:${part('year')}-${part('month')}-${part('day')}:${time}` : null;
}
export function startScheduler() {
    const config = scheduleConfig();
    if (!config.enabled) return () => {};
    let active = false;
    let lastKey: string | null = null;
    const tick = async () => {
        const key = scheduledKey(new Date(), config);
        if (!key || key === lastKey || active) return;
        active = true;
        lastKey = key;
        try { await runCollection('agendamento', key); }
        catch (error) {
            if (!(error instanceof ScheduleAlreadyRunError)) console.error('Agendamento:', error instanceof CollectionBusyError ? error.message : error);
        } finally { active = false; }
    };
    const timer = setInterval(() => { void tick(); }, 15000);
    void tick();
    return () => clearInterval(timer);
}
