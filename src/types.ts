export interface SampQueryOptions {
  ip?: string;
  port?: number;
  timeout?: number;
  verbose?: boolean;
}

export interface ServerInfo {
  name: string;
  gameMode: string;
  language: string;
  players: {
    current: number;
    max: number;
  };
  usePassword: boolean;
}

export type ServerProperty = {
  ruleCount: number;
  records: Map<string, string>;
}

export type ServerPlayers = Map<number, PlayerInfo>;
export type ServerPlayerCount = Map<string, Pick<PlayerInfo, 'name' | 'score'>>;

export interface PlayerInfo {
  name: string;
  score: number;
  ping: number;
}

// More: https://sampwiki.blast.hk/wiki/Query_Mechanism#SA-MP_Packets_in_the_real_world
export enum Opcodes {
  Rules = 'r',
  Information = 'i',
  PlayerCount = 'c',
  Players = 'd',
  RconCommand = 'x',
  PseudoRandom = 'p',
}
