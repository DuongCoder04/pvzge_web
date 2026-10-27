import { copyFile, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildWebLite, parseWebLiteArguments, validateWebLitePaths } from './build-web-lite.mjs';

export async function buildPagesLite({ input, output, revision }) {
    if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('A full Git commit SHA is required for the Pages asset namespace');
    input = await realpath(input);
    output = path.join(await realpath(path.dirname(path.resolve(output))), path.basename(output));
    validateWebLitePaths(input, output);
    try {
        await lstat(output);
        throw new Error(`Output already exists: ${output}`);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    await mkdir(output);
    try {
        const assetBase = `/releases/${revision}/`;
        const releases = path.join(output, 'releases');
        await mkdir(releases);
        const payload = path.join(releases, revision);
        const summary = await buildWebLite({ input, output: payload });
        const html = await readFile(path.join(payload, 'index.html'), 'utf8');
        if (!html.includes('<head>') || /<base\b/i.test(html)) throw new Error('Expected a Web index with one head and no existing base URL');
        await writeFile(path.join(output, 'index.html'), html.replace('<head>', `<head>\n  <base href="${assetBase}">`));
        for (const name of ['CNAME', '.nojekyll', 'ads.txt']) {
            await copyFile(path.join(payload, name), path.join(output, name));
        }
        await writeFile(path.join(output, 'build-info.json'), `${JSON.stringify({ edition: 'lite', revision, assetBase }, null, 2)}\n`);
        return summary;
    } catch (error) {
        await rm(output, { recursive: true, force: true });
        throw error;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    buildPagesLite({ ...parseWebLiteArguments(process.argv.slice(2)), revision: process.env.GITHUB_SHA }).catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
