import * as dgram from 'dgram';

interface SampQueryOptions {
    ip?: string;
    port?: number;
}

interface ServerInfo {
    serverName: string;
    gameModeName: string;
    players: number;
    maxPlayers: number;
    language: string;
    closed: boolean;
}

interface ServerProperty {
    [key: string]: string;
}

interface PlayerInfo {
    id: number;
    name: string;
    score: number;
    ping: number;
}

class SampQuery {
    private ip: string;
    private port: number;
    private timeout: number;

    constructor(options: SampQueryOptions) {
        this.ip = options.ip || '127.0.0.1';
        this.port = options.port || 7777;
        this.timeout = 1000;
    }

    async getServerInfo(): Promise<[ServerInfo, ServerProperty[], PlayerInfo[]]> {
        return await Promise.all([
            this.request<ServerInfo>('i'),
            this.request<ServerProperty[]>('r'),
            this.getServerPlayers()
        ]);
    }

    async getServerProperties(): Promise<ServerProperty[]> {
        return await this.request<ServerProperty[]>('r');
    }

    async getServerOnline(): Promise<number> {
        return (await this.request<ServerInfo>('i')).players;
    }

    async getServerMaxPlayers(): Promise<number> {
        return (await this.request<ServerInfo>('i')).maxPlayers;
    }

    async getServerName(): Promise<string> {
        return (await this.request<ServerInfo>('i')).serverName;
    }

    async getServerGamemodeName(): Promise<string> {
        return (await this.request<ServerInfo>('i')).gameModeName;
    }

    async getServerLanguage(): Promise<string> {
        return (await this.request<ServerInfo>('i')).language;
    }

    async getServerVersion(): Promise<string> {
        return (await this.request<ServerProperty>('r')).version;
    }

    async getServerWeather(): Promise<string> {
        return (await this.request<ServerProperty>('r')).weather;
    }

    async getServerWebSite(): Promise<string> {
        return (await this.request<ServerProperty>('r')).weburl;
    }

    async getServerWorldTime(): Promise<string> {
        return (await this.request<ServerProperty>('r')).worldtime;
    }

    async getServerPlayers(): Promise<PlayerInfo[]> {
        const maxPlayers = await this.getServerOnline();

        if (maxPlayers > 100) {
            throw new Error(`More than 100 players on the server`);
        }

        return await this.request<PlayerInfo[]>('c');
    }

    async getServerPlayersDetailed(): Promise<PlayerInfo[]> {
        const maxPlayers = await this.getServerOnline();

        if (maxPlayers > 100) {
            throw new Error(`More than 100 players on the server`);
        }

        return await this.request<PlayerInfo[]>('d');
    }

    async getServerPing(): Promise<number> {
        const startTime = new Date().getTime();
        await this.request<ServerInfo>('i');
        return new Date().getTime() - startTime;
    }

    private request<T>(opcode: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const socket = dgram.createSocket("udp4");
            let packet = Buffer.alloc(10 + opcode.length);

            packet.write('SAMP');
            packet[4] = parseInt(this.ip.split('.')[0], 10);
            packet[5] = parseInt(this.ip.split('.')[1], 10);
            packet[6] = parseInt(this.ip.split('.')[2], 10);
            packet[7] = parseInt(this.ip.split('.')[3], 10);
            packet[8] = this.port & 0xFF;
            packet[9] = this.port >> 8 & 0xFF;
            packet[10] = opcode.charCodeAt(0);

            try {
                socket.send(packet, 0, packet.length, this.port, this.ip);
            } catch (e) {
                console.log(e);
                reject(e);
            }

            let controller = setTimeout(() => {
                socket.close();
                reject(`[error] host unavailable - ${this.ip}:${this.port}`);
            }, 2000);

            socket.on('message', (message) => {
                if (controller) clearTimeout(controller);

                if (message.length < 11) {
                    reject(`[error] invalid socket on message - ${message}`);
                } else {
                    socket.close();
                    message = message.slice(11);

                    let offset = 0;

                    if (opcode === 'i') {
                        const closed = !!message.readUInt8(offset);
                        const players = message.readUInt16LE(offset += 1);
                        const maxPlayers = message.readUInt16LE(offset += 2);

                        let serverName = message.readUInt16LE(offset += 2);
                        serverName = message.slice(offset += 4, offset += serverName).toString();

                        let gameModeName = message.readUInt16LE(offset);
                        gameModeName = message.slice(offset += 4, offset += gameModeName).toString();

                        let language = message.readUInt16LE(offset);
                        language = message.slice(offset += 4, offset += language).toString();

                        resolve({ serverName, gameModeName, players, maxPlayers, language, closed });
                    } else if (opcode === 'r') {
                        offset += 2;

                        const object = [
                            ...new Array(message.readUInt16LE(offset - 2))
                                .fill({})
                        ].map(() => {
                            let property = message.readUInt8(offset);
                            property = message.slice(++offset, offset += property).toString();

                            let propertyvalue = message.readUInt8(offset);
                            propertyvalue = message.slice(++offset, offset += propertyvalue).toString();

                            return { [property]: propertyvalue };
                        });

                        resolve(object);
                    } else if (opcode === 'd') {
                        offset += 2;

                        const object = [
                            ...new Array(Math.floor(message.readUInt16LE(offset - 2)))
                                .fill({})
                        ].map(() => {
                            const id = message.readUInt8(offset);

                            let name = message.readUInt8(++offset);
                            name = message.slice(++offset, offset += name).toString();

                            const score = message.readUInt16LE(offset);
                            const ping = message.readUInt16LE(offset += 4);

                            offset += 4;

                            return { id, name, score, ping };
                        });

                        resolve(object);
                    } else if (opcode === 'c') {
                        offset += 2;

                        const object = [
                            ...new Array(Math.floor(message.readUInt16LE(offset - 2)))
                                .fill({})
                        ].map(() => {
                            let name = message.readUInt8(offset);
                            name = message.slice(++offset, offset += name).toString();

                            const score = message.readUInt16LE(offset);

                            offset += 4;

                            return { name, score };
                        });

                        resolve(object);
                    }
                }
            });
        });
    }
}

export = SampQuery;
