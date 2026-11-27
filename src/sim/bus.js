export const EVENTS = Object.freeze(['eat','bite','hurt','evolve','dash','frenzy','counterkill','song.start','song.beat','song.release','song.break','song.cancel','song.resonate','dream.collect','dream.deliver','dream.scatter','nightmare.calm','fragment.collect','melody.collect','item.pickup','shield.break','instrument.hit','boss.enter','boss.tell','boss.attack','boss.hurt','boss.gate','boss.gate.result','boss.phase','boss.down','state.change','notify','run.finish','shortcut','fish.tell','fish.attack','fish.crack','jelly.bounce','hazard.vent','env.warn','env.fire','world.loop','current.enter','ecology.start','supply.reveal','awakening','terrain.crack','terrain.break','boss.stone','boss.yarn.bounce']);
export class EventBus {
  constructor() { this.listeners = new Map(); }
  on(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); return () => this.off(type, fn); }
  off(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, payload = {}) { for (const fn of this.listeners.get(type) ?? []) fn(payload); for (const fn of this.listeners.get('*') ?? []) fn(type, payload); }
}
export const createBus = () => new EventBus();
