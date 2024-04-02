import { Opcodes, PlayerInfo, ServerInfo } from "./types";

// Following https://sampwiki.blast.hk/wiki/Query_Mechanism#SA-MP_Packets_in_the_real_world
export class PacketSent {
    public buffer = Buffer.alloc(0);

    constructor() {
        this.write('SAMP') // Telling a server it's a SAMP Packet
    }

    write(string: string, offset?: number): PacketSent {
        if (offset && this.buffer.length > offset) {
            this.buffer.write(string, offset);
        } else {
            this.buffer = Buffer.concat([
                this.buffer,
                Buffer.from(new TextEncoder().encode(string)),
            ]);
        }

        return this;
    }

    writePort(port: number, offset?: number): PacketSent {
        if (offset && this.buffer.length > offset) {
            this.buffer.writeUint8(
                port & 0xFF,
                offset++,
            );
            this.buffer.writeUint8(
                port >> 8 & 0xFF,
                offset++,
            );
        } else {
            this.buffer = Buffer.concat([
                this.buffer,
                Buffer.from([port & 0xFF]),
                Buffer.from([port >> 8 & 0xFF]),
            ]);
        }

        return this;
    }

    writeIp(ip: string, offset?: number): PacketSent {
        const nets = ip.split('.');
        nets.forEach(net => {
            const netNum = parseInt(net, 10);
            if (offset && this.buffer.length > offset) {
                this.buffer.writeUint8(netNum, offset++);
            } else {
                this.buffer = Buffer.concat([
                    this.buffer,
                    Buffer.from([netNum]),
                ]);
            }
        });

        return this;
    }

    writeOpcode(opcode: Opcodes) {
        if (this.buffer.byteLength >= 11) {
            this.buffer = this.buffer.subarray(0, -1);
            this.write(opcode);
        } else {
            this.write(opcode);
        }
    }
    
    getOpcode(): Opcodes {
        if (this.buffer.byteLength >= 11) {
            return String.fromCharCode(this.buffer.at(-1)!) as Opcodes;
        }

        throw new Error('This packet doesn\'t contain opcode.');
    }
}

export class PacketReceive {
    constructor(public buffer: Buffer) {
        this.buffer = this.buffer.subarray(11); // Skip SAMP + IP + Port + Opcode
    }

    dropPseudo() {
        return [
            this.buffer.readUint8(0), // number 1
            this.buffer.readUint8(1), // number 2
            this.buffer.readUint8(2), // number 3
            this.buffer.readUint8(3), // number 4
        ];
    }

    dropClientList() {
        let offset = 2;

        const clientCount = Math.floor(this.buffer.readUint8(0));
        const records = new Map<string, {
            name: string;
            score: number;
        }>();

        for (let i = 0; i < clientCount; i++) {
            const nameLength = this.buffer.readUint8(offset);
            const name = new TextDecoder().decode(
                this.buffer.subarray(
                    ++offset,
                    offset += nameLength,
                ),
            );

            const score = this.buffer.readUint16LE(offset);
            offset += 4;

            records.set(name, {
                name,
                score,
            });
        }

        return records;
    }

    dropPlayers() {
        let offset = 2;

        const playersCount = this.buffer.readUint16LE(0); // Index 11-12 players count, 2 bytes
        const records = new Map<number, PlayerInfo>();

        for (let i = 0; i < playersCount; i++) {
            const id = this.buffer.readUint8(offset);

            const nameLength = this.buffer.readUint8(++offset);
            const name = new TextDecoder().decode(
                this.buffer.subarray(++offset, offset += nameLength),
            );

            const score = this.buffer.readUint16LE(offset);
            const ping = this.buffer.readUint16LE(offset += 4);
            offset += 4;

            records.set(id, {
                name,
                score,
                ping,
            });
        }

        return records;
    }

    dropRule() {
        let offset = 2; // start from 2

        const ruleCount = this.buffer.readUint16LE(0); // Index 11-12 rule count, 2 bytes
        const records = new Map<string, string>();

        for (let i = 0; i < ruleCount; i++) {
            const propertyLength = this.buffer.readUint8(offset); // Property length, index 13, 1 byte
            const property = new TextDecoder().decode(
                this.buffer.subarray(++offset, offset += propertyLength),
            ); // Property string, index 14 + propertyLength, offset = 3

            const valueLength = this.buffer.readUint8(offset); // Value length, index 14 + propertyLength, 1 byte
            const value = new TextDecoder().decode(
                this.buffer.subarray(++offset, offset += valueLength),
            ); // Value string, index 15 + propertyLength + valueLength, offset = 4

            records.set(property, value);
        }

        return {
            ruleCount,
            records,
        }
    }

    dropInformation(): ServerInfo {
        let offset = 0;

        const usePassword = Boolean(this.buffer.readUint8(offset)); // Password, index 11, 0 = false 1 = true, offset = 0
        const currentPlayersCount = this.buffer.readUint16LE(offset += 1); // Players count, index 12-13 (read 2 bytes), offset = 0
        const maxPlayersCount = this.buffer.readUint16LE(offset += 2); // Max players count, index 14-15 (read 2 bytes), offset = 1

        const serverNameLength = this.buffer.readUint16LE(offset += 2); // Server name length, index 15-18 (read 4 bytes), offset = 2
        const serverName = new TextDecoder().decode(this.buffer.subarray(
            offset += 4, // offset = 4
            offset += serverNameLength, // server name string = index 19 + serverNameLength, offset = 8
        ));
        // offset = 8 + serverNameLength

        const gameModeLength = this.buffer.readUint16LE(offset); // assume, offset = 20
        const gameMode = new TextDecoder().decode(this.buffer.subarray(
            offset += 4, // offset = 24
            offset += gameModeLength, // game mode string = index 25 + gameModeLength, offset = 24 + gameModeLength
        ));

        const languageLength = this.buffer.readUint16LE(offset); // assume, offset = 26 + gameModeLength
        const language = new TextDecoder().decode(this.buffer.subarray(
            offset += 4, // offset = 30 + gameModeLength
            offset += languageLength, // language string = index 31 + languageLength, offset = 30 + languageLength
        ));


        return {
            usePassword,
            name: serverName,
            gameMode,
            language,
            players: {
                current: currentPlayersCount,
                max: maxPlayersCount,
            },
        };
    }
}
