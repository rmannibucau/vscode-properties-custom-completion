'use strict'

import { readFileSync, statSync } from 'fs';
import * as vscode from 'vscode';

const cachedKeys = {
    // [filename]: {lastModified:...,completion:[completionItems]}
};

function loadCompletions(path) {
    const text = readFileSync(path, { encoding: 'utf-8' });
    const lines = text.split('\n');

    const all = [];
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

export class PropertiesCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken):
        vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {

        const linePrefix = document.lineAt(position).text.slice(0, position.character);
        if (linePrefix.startsWith('#') || linePrefix.indexOf('=') > 0) { // value is not completed by this extension
            return [];
        }

        // load completion if present
        // todo: support more lines?
        const prolog = document.lineAt(0).text;
        if (!prolog || !prolog.startsWith('# vscode_properties_completion_proposals=')) {
            return [];
        }

        const path = prolog.substring('# vscode_properties_completion_proposals='.length).trim();

        // load data if needed
        let data = cachedKeys[path];
        const stat = statSync(path);
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
            .filter((it: vscode.CompletionItem) => it.label.toString().indexOf(linePrefix) >= 0)
            .sort((a: vscode.CompletionItem, b: vscode.CompletionItem) => a.label.toString().localeCompare(b.label.toString()));
    }
}
