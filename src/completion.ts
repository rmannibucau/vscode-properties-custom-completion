'use strict'

import { statSync } from 'fs';
import { readFile } from 'fs/promises';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as vscode from 'vscode';

const NO_MODIFICATION = new Date(0);

const cachedKeys = {
    // [filename]: {lastModified:...,completion:[completionItems]}
};

function GET(url: string): Promise<string> {
    const parsedUrl = new URL(url);
    return new Promise((ok, ko) => {
        const req = (parsedUrl.protocol.toLowerCase() === 'https' ? https : http).request(
            { method: 'GET', hostname: parsedUrl.hostname, path: parsedUrl.pathname, port: parsedUrl.port },
            res => {
                var str = '';
                res.on('data', chunk => { str += chunk });
                res.on('err', err => {
                    str = undefined;
                    ko(err);
                });
                res.on('end', () => {
                    if (str) {
                        ok(str);
                    }
                });
            });
        req.on('error', err => {
            ko(err);
        });
        req.end();
    });
}

function isUrl(path: string) {
    return path.startsWith('https://') || path.startsWith('http://');
}

function parseContent(content: string): vscode.CompletionItem[] {
    const lines = content.split('\n');

    const all: vscode.CompletionItem[] = [];
    let currentKey = '';
    let currentDesc = '';

    function flush() {
        const key = currentKey.trim();
        if (key.length > 0) {
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Keyword);
            item.detail = currentDesc.trim();
            all.push(item);
        }
        currentKey = '';
        currentDesc = '';
    }


    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.trim().length == 0) {
            if (currentKey) {
                flush();
            }
        } else if (currentKey) {
            currentDesc += ' ';
            const appended = line.trim();
            if (appended.endsWith('\\')) {
                currentDesc += appended.substring(0, appended.length - 1).trim();
            } else {
                currentDesc += appended;
                flush();
            }
        } else {
            const sep = line.indexOf('=');
            if (sep > 0) {
                currentKey = line.substring(0, sep).trim();
                const desc = line.substring(sep + 1);
                if (desc.endsWith('\\')) {
                    currentDesc += desc.substring(0, desc.length - 1).trim();
                } else {
                    currentDesc += desc;
                    flush();
                }
            }
        }
    }
    flush();

    return all;
}

async function loadCompletions(path: string): Promise<vscode.CompletionItem[]> {
    const content = isUrl(path) ?
        await GET(path) :
        await readFile(path, { encoding: 'utf-8' });
    return parseContent(content);
}

export class PropertiesCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
        if (position.line === 0 && position.character === 0) {
            return [ // avoid to remind it so if at the beginning propose the magic prefix
                new vscode.CompletionItem('# vscode_properties_completion_proposals=', vscode.CompletionItemKind.Text),
            ];
        }

        const linePrefix = document.lineAt(position).text.slice(0, position.character);
        if (linePrefix.startsWith('#') || linePrefix.indexOf('=') > 0) { // value is not completed by this extension
            return [];
        }

        // load completion if present
        // todo: support more lines?
        const directive = document.lineAt(0).text;
        if (!directive || !directive.startsWith('# vscode_properties_completion_proposals=')) {
            return [];
        }

        const path = directive.substring('# vscode_properties_completion_proposals='.length).trim();

        // load data if needed
        let data = cachedKeys[path];
        const stat = isUrl(path) ? { mtime: NO_MODIFICATION } : statSync(path);
        if (!data || data.lastModified != stat.mtime.getTime()) {
            data = {
                lastModified: stat.mtime.getTime(),
                completion: loadCompletions(path),
            };
            cachedKeys[path] = data;
        }

        // compute completion
        return data
            .completion
            .then((items: vscode.CompletionItem[]) => items
                .filter((it: vscode.CompletionItem) => it.label.toString().indexOf(linePrefix) >= 0)
                .sort((a: vscode.CompletionItem, b: vscode.CompletionItem) => a.label.toString().localeCompare(b.label.toString())));
    }
}
