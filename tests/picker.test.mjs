import test from 'node:test';
import assert from 'node:assert/strict';
import { validPortal, metadataOnly, matchesMessage } from '../picker-common.mjs';

test('portal parsing accepts custom domains and rejects URL injection and malformed hosts', () => {
    for (const host of ['dam.bynder.com', 'brand.example', 'brand-assets.example.co.uk']) assert(validPortal(host));
    for (const host of ['https://brand.example', 'brand.example/path', 'brand.example:443',
        'brand.example@evil.example', 'brand..example', '-brand.example', 'brand-.example',
        'localhost', '127.0.0.1', 'brand.example; connect-src *', `${'x'.repeat(64)}.example`]) assert(!validPortal(host), host);
});

test('projection removes URLs, credentials and unused metadata while preserving literal text', () => {
    const result = metadataOnly({ name: '<asset>', tags: ['<img src=x onerror=alert(1)>'],
        access_token: 'must-not-pass', originalUrl: 'https://private.example/file', description: 'private',
        metaproperties: { nodes: [{ name: 'Campaign', options: [{ name: 'A&B', id: 'private-id' }] }] } });
    assert.deepEqual(result, { name: '<asset>', tags: ['<img src=x onerror=alert(1)>'],
        metaproperties: { nodes: [{ name: 'Campaign', options: [{ name: 'A&B' }] }] } });
});

test('projection supports legacy metadata and rejects malformed or oversized payloads', () => {
    assert.equal(metadataOnly({ metaproperties: { a: { name: 'Brand', options: ['Blue'] } }, tags: { hero: true } }).tags[0], 'hero');
    for (const asset of [null, { tags: [123] }, { name: 'a'.repeat(1001) }, { tags: Array(201).fill('tag') },
        { metaproperties: { nodes: [null] } }, { metaproperties: { nodes: [{ name: 'x', options: Array(201).fill('x') }] } }]) {
        assert.throws(() => metadataOnly(asset));
    }
});

test('messages require the exact origin, source window and current request', () => {
    const source = {};
    const event = { source, origin: 'https://linkbuilder.example', data: { channel: 'link-builder-picker', request: 'current' } };
    assert(matchesMessage(event, source, event.origin, 'current'));
    assert(!matchesMessage(event, {}, event.origin, 'current'));
    assert(!matchesMessage(event, source, 'https://attacker.example', 'current'));
    assert(!matchesMessage(event, source, event.origin, 'stale'));
    assert(!matchesMessage({ ...event, data: null }, source, event.origin, 'current'));
});
