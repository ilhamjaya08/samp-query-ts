export interface SampQueryOptions {
  ip?: string;
  port?: number;
  maxServerHitDiffTime?: number;
}

export interface ServerInfo {
  serverName: string;
  gameModeName: string;
  players: number;
  maxPlayers: number;
  language: string;
  closed: boolean;
}

export type ServerProperty = Record<string, string>;

export interface PlayerInfo {
  id: number;
  name: string;
  score: number;
  ping: number;
}
