'use strict';

import * as vscode from 'vscode';
import { PropertiesCompletionItemProvider } from './completion';

export function activate(context: vscode.ExtensionContext) {
    vscode.languages.registerCompletionItemProvider('properties', new PropertiesCompletionItemProvider());
    vscode.languages.getLanguages().then((langs: string[]) => {
        if (langs.some(it => it === 'java-properties')) {
            vscode.languages.registerCompletionItemProvider('java-properties', new PropertiesCompletionItemProvider());
        }
    });
}
