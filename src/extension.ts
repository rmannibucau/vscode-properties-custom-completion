'use strict';

import * as vscode from 'vscode';
import { PropertiesCompletionItemProvider } from './completion';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('properties', new PropertiesCompletionItemProvider())
    );
}
