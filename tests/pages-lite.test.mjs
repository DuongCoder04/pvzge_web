import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildPagesLite } from '../scripts/build-pages-lite.mjs';

test('Pages uses a revision namespace without changing the complete game input', async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pages-lite-test-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const input = path.join(root, 'docs'), output = path.join(root, 'pages');
    const revision = 'a'.repeat(40);
    const files = {
        'index.html': '<html><head></head><body><script>System.import(\'./index.js\')</script></body></html>',
        'assets/resources/config.json': '{"paths":{},"packs":{},"uuids":[],"types":[]}',
        'game-audio.js': 'export function initializeGameAudio() {}',
        'audio/manifest.json': '{}',
        'CNAME': 'play.pvzge.com', '.nojekyll': '', 'ads.txt': 'ads',
    };
    await mkdir(path.join(input, 'assets/resources/native'), { recursive: true });
    for (const [name, content] of Object.entries(files)) {
        await mkdir(path.dirname(path.join(input, name)), { recursive: true });
        await writeFile(path.join(input, name), content);
    }
    await buildPagesLite({ input, output, revision });
    const html = await readFile(path.join(output, 'index.html'), 'utf8');
    assert.ok(html.indexOf('<base href=') > html.indexOf('<head>'));
    assert.ok(html.includes(`/releases/${revision}/`));
    const info = JSON.parse(await readFile(path.join(output, 'build-info.json'), 'utf8'));
    assert.deepEqual(info, { edition: 'lite', revision, assetBase: `/releases/${revision}/` });
    assert.equal(new URL('audio/manifest.json', `https://play.pvzge.com${info.assetBase}`).pathname, `/releases/${revision}/audio/manifest.json`);
    for (const [name, content] of Object.entries(files)) {
        assert.equal(await readFile(path.join(input, name), 'utf8'), content);
        assert.equal(await readFile(path.join(output, 'releases', revision, name), 'utf8'), content);
    }
    assert.equal(await readFile(path.join(output, 'ads.txt'), 'utf8'), 'ads');
    await assert.rejects(buildPagesLite({ input, output, revision }), /already exists/);
    await assert.rejects(buildPagesLite({ input, output: path.join(root, 'bad'), revision: 'master' }), /full Git commit/);
    await writeFile(path.join(input, 'index.html'), '<script>System.import(\'./index.js\')</script>');
    await assert.rejects(buildPagesLite({ input, output: path.join(root, 'failed'), revision }), /Expected a Web index/);
    assert.deepEqual((await readdir(root)).sort(), ['docs', 'pages']);
});
