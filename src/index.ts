import * as dgram from "dgram";
import { PlayerInfo, SampQueryOptions, ServerInfo, ServerProperty } from "./types";

class SampQuery {
  private ip!: string;
  private port!: number;
  private serverInfo!: ServerInfo;
  private serverProperties!: ServerProperty;
  private maxServerHitDiffTime!: number;

  #serverInfoHitTime!: number;
  #latency: number = 0;

  constructor(options: SampQueryOptions) {
    this.ip = options.ip || "127.0.0.1";
    this.port = options.port || 7777;
    this.maxServerHitDiffTime = options.maxServerHitDiffTime || 10_000; // 10 seconds
  }

  async getServerInfo(): Promise<[ServerInfo, ServerProperty, PlayerInfo[]]> {
    return Promise.all([
      this.request<ServerInfo>("i"),
      this.request<ServerProperty>("r"),
      this.getServerPlayers(),
    ]);
  }

  async #readServerInfo(): Promise<ServerInfo> {
    if ((Date.now()-this.#serverInfoHitTime >= this.maxServerHitDiffTime) || !this.serverInfo) {
        const serverInfo = await this.getServerInfo();
        this.#serverInfoHitTime = Date.now();
        this.serverInfo = serverInfo[0];
        this.serverProperties = serverInfo[1];
    }

    return this.serverInfo;
  }

  async #readServerProperty(): Promise<ServerProperty> {
    await this.#readServerInfo();
    return this.serverProperties;
  }

  async getServerProperties(): Promise<ServerProperty> {
    return this.#readServerProperty();
  }

  async getServerOnline(): Promise<number> {
    const server = await this.#readServerInfo();
    return server.players;
  }

  async getServerMaxPlayers(): Promise<number> {
    const server = await this.#readServerInfo();
    return server.maxPlayers;
  }

  async getServerName(): Promise<string> {
    const server = await this.#readServerInfo();
    return server.serverName;
  }

  async getServerGamemodeName(): Promise<string> {
    const server = await this.#readServerInfo();
    return server.gameModeName;
  }

  async getServerLanguage(): Promise<string> {
    const server = await this.#readServerInfo();
    return server.language;
  }

  async getServerVersion(): Promise<string> {
    const serverProperty = await this.#readServerProperty();
    return serverProperty.version;
  }

  async getServerWeather(): Promise<string> {
    const serverProperty = await this.#readServerProperty();
    return serverProperty.weather;
  }

  async getServerWebSite(): Promise<string> {
    const serverProperty = await this.#readServerProperty();
    return serverProperty.weburl;
  }

  async getServerWorldTime(): Promise<string> {
    const serverProperty = await this.#readServerProperty();
    return serverProperty.worldtime;
  }

  async getServerPlayers(): Promise<PlayerInfo[]> {
    const maxPlayers = await this.getServerOnline();

    if (maxPlayers > 100) {
      throw new Error(`More than 100 players on the server`);
    }

    return await this.request<PlayerInfo[]>("c");
  }

  async getServerPlayersDetailed(): Promise<PlayerInfo[]> {
    const maxPlayers = await this.getServerOnline();

    if (maxPlayers > 100) {
      throw new Error(`More than 100 players on the server`);
    }

    return await this.request<PlayerInfo[]>("d");
  }

  async getServerPing(): Promise<number> {
    const startTime = new Date().getTime();
    await this.request<ServerInfo>("i");

    return new Date().getTime() - startTime;
  }

  private request<T>(opcode: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const socket = dgram.createSocket("udp4");
      const startTime = Date.now();
      const packet = Buffer.alloc(10 + opcode.length);

      packet.write("SAMP");
      packet[4] = parseInt(this.ip.split(".")[0], 10);
      packet[5] = parseInt(this.ip.split(".")[1], 10);
      packet[6] = parseInt(this.ip.split(".")[2], 10);
      packet[7] = parseInt(this.ip.split(".")[3], 10);
      packet[8] = this.port & 0xff;
      packet[9] = (this.port >> 8) & 0xff;
      packet[10] = opcode.charCodeAt(0);

      try {
        socket.send(packet, 0, packet.length, this.port, this.ip);
      } catch (e) {
        console.log(e);
        reject(e);
      }

      const controller = setTimeout(() => {
        socket.close();
        reject(`[error] host unavailable - ${this.ip}:${this.port}`);
      }, 2000);

      socket.on("message", (message) => {
        if (controller) clearTimeout(controller);

        if (message.length < 11) {
          reject(`[error] invalid socket on message - ${message}`);
        } else {
          socket.close();
          message = message.subarray(11);

          let offset = 0;

          if (opcode === "i") {
            const closed = !!message.readUInt8(offset);
            const players = message.readUInt16LE((offset += 1));
            const maxPlayers = message.readUInt16LE((offset += 2));

            const serverName = message
              .subarray((offset += 4), (offset += message.readUInt16LE((offset += 2))))
              .toString();

            const gameModeName = message
              .subarray((offset += 4), (offset += message.readUInt16LE(offset)))
              .toString();

            const language = message
              .subarray((offset += 4), (offset += message.readUInt16LE(offset)))
              .toString();

            resolve({
              serverName,
              gameModeName,
              players,
              maxPlayers,
              language,
              closed,
            } as T);
          } else if (opcode === "r") {
            offset += 2;

            const object = [
              ...new Array(message.readUInt16LE(offset - 2)).fill({}),
            ].map(() => {
              const property = message
                .subarray(++offset, (offset += message.readUInt8(offset)))
                .toString();

              const propertyvalue = message
                .subarray(++offset, (offset += message.readUInt8(offset)))
                .toString();

              return { [property]: propertyvalue };
            });

            resolve(object as T);
          } else if (opcode === "d") {
            offset += 2;

            const object = [
              ...new Array(Math.floor(message.readUInt16LE(offset - 2))).fill(
                {},
              ),
            ].map(() => {
              const id = message.readUInt8(offset);

              const name = message.subarray(++offset, (offset += message.readUInt8(++offset))).toString();

              const score = message.readUInt16LE(offset);
              const ping = message.readUInt16LE((offset += 4));

              offset += 4;

              return { id, name, score, ping };
            });

            resolve(object as T);
          } else if (opcode === "c") {
            offset += 2;

            const object = [
              ...new Array(Math.floor(message.readUInt16LE(offset - 2))).fill(
                {},
              ),
            ].map(() => {
              const name = message.subarray(++offset, (offset += message.readUInt8(offset))).toString();
              const score = message.readUInt16LE(offset);

              offset += 4;

              return { name, score };
            });

            resolve(object as T);
          }
        }
      });
    });
  }
}

export { SampQuery };

export default SampQuery;
