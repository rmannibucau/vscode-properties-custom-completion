# VSCode Properties Custom Completion

An extension which enables you to set as first line of a `.properties` file the following directive: `# vscode_properties_completion_proposals=/path/to/completion.properties`.

The `completion.properties` file contains `key=desc` where `key` is a valid property for this file and `desc` an inline description of the key.

This will then be used to fill the VSCode completion for keys.
