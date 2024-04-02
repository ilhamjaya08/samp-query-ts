import test from 'ava';

import {SampQuery} from '../src';

test('Import SampQuery class perfectly', t => {
    t.not(SampQuery, undefined);
    t.is(typeof SampQuery, 'function');
});
