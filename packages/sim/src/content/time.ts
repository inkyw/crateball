/** Sabit simülasyon adımı (spec §4.2). Sim içi modüller buradan alır (index.ts döngüsü olmasın). */
export const SIM_TICK_HZ = 20;
export const DT = 1 / SIM_TICK_HZ;
export const secondsToTicks = (s: number): number => Math.round(s * SIM_TICK_HZ);
export const DAY_S = 90;
export const NIGHT_S = 75;
