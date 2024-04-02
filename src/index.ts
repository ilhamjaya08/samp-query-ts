import * as dgram from "node:dgram";
import { Opcodes, SampQueryOptions, ServerInfo, ServerPlayerCount, ServerPlayers, ServerProperty } from "./types";
import { PacketReceive, PacketSent } from "./packet";

class SampQuery {
  private ip!: string;
  private port!: number;
  private timeout!: number;
  private verbose!: boolean;

  #socket!: dgram.Socket;

  constructor(options: SampQueryOptions) {
    this.ip = options.ip || "127.0.0.1";
    this.port = options.port || 7777;
    this.timeout = this.timeout ?? 5000;
    this.verbose = options.verbose ?? false;

    this.#reconnect();
  }

  async getServerInfo(): Promise<ServerInfo> {
    const serverInformation = await this.request<ServerInfo>(Opcodes.Information);
    return serverInformation;
  }

  async getServerRules(): Promise<ServerProperty> {
    const serverRules = await this.request<ServerProperty>(Opcodes.Rules);
    return serverRules;
  }

  async getServerPlayers(): Promise<ServerPlayers> {
    const players = await this.request<ServerPlayers>(Opcodes.Players);
    return players;
  }

  async getServerPlayerCount(): Promise<ServerPlayerCount> {
    const playerCount = await this.request<ServerPlayerCount>(Opcodes.PlayerCount);
    return playerCount;
  }

  async getPseudoNumbers(): Promise<number[]> {
    const pseudoNumbers = await this.request<number[]>(Opcodes.PseudoRandom);
    return pseudoNumbers;
  }

  #reconnect(): this {
    if (this.#socket) {
      this.#socket.close();
      this.#socket.removeAllListeners();
    }

    this.#socket = dgram.createSocket('udp4');
    this.#socket.on('connect', () => {
      if (this.verbose) {
        console.log(`[${this.ip}:${this.port}] Socket connect`);
      }
    }).on('error', error => {
      if (this.verbose) {
        console.log(`[${this.ip}:${this.port}] Socket error: ${error}`);
      }
    }).on('close', () => {
      if (this.verbose) {
        console.log(`[${this.ip}:${this.port}] Socket close`);
      }

      this.#reconnect();
    });

    this.#socket.connect(this.port, this.ip, () => {
      if (this.verbose) {
        console.log(`[${this.ip}:${this.port}] Connect method`);
      }
    });

    return this;
  }

  async request<T>(opcode: Opcodes): Promise<T> {
    return await new Promise((resolve, reject) => {
      const packetSent = new PacketSent();

      packetSent.writeIp(this.ip);
      packetSent.writePort(this.port);
      packetSent.write(opcode);

      const timeoutController = setTimeout(() => {
        this.#socket.off('message', listenMessage);
        return reject(new Error('Timeout'));
      }, this.timeout);

      const listenMessage = (message: Buffer) => {
        if (timeoutController) {
          clearTimeout(timeoutController);
        }

        const packetReceive = new PacketReceive(message);

        if (this.verbose) {
          console.log(`[${this.ip}:${this.port}] Received packet:`, message.toJSON());
        }

        this.#socket.off('message', listenMessage);
        const opcodePacket = String.fromCharCode(message.subarray(10)[0]);

        if (opcodePacket != packetSent.getOpcode()) {
          return reject(new Error(`Invalid opcode receive: ${opcodePacket}, requested: ${opcode}`));
        }

        try {
          switch(opcode) {
            case Opcodes.Information:
              return resolve(packetReceive.dropInformation() as T);
            case Opcodes.Rules:
              return resolve(packetReceive.dropRule() as T);
            case Opcodes.PlayerCount:
              return resolve(packetReceive.dropClientList() as T);
            case Opcodes.Players:
              return resolve(packetReceive.dropPlayers() as T);
            case Opcodes.PseudoRandom:
              return resolve(packetReceive.dropPseudo() as T);
            default:
              return resolve(packetReceive as T);
          }
        } catch (err) {
          if (this.verbose) {
            console.error(`[${this.ip}:${this.port}] Error:`, err);
            console.log('Packet:', message.toJSON());
          }
          reject(err);
        }
      }

      this.#socket.on('message', listenMessage);
      this.#socket.send(packetSent.buffer, this.port, this.ip);
    });
  }
}

export { SampQuery };

export default SampQuery;
