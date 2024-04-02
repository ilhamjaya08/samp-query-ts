import test from 'ava';
import { SampQuery } from '../src';

const sampQuery = new SampQuery({
    ip: '51.79.212.100',
    port: 7777,
    verbose: true,
});

test('Test server info', async t => {
    const server = await sampQuery.getServerInfo();

    t.deepEqual(server.name, 'Jogjagamers Reality Project');
    t.deepEqual(server.language, 'Bahasa Indonesia');
    t.deepEqual(server.gameMode, 'MRP 3.19.0u1');
    t.is(server.players.max, 1000);
    t.deepEqual(server.usePassword, false);
});
