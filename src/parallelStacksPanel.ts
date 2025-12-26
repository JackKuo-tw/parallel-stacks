import * as vscode from 'vscode';
import { getStackGraph, GraphNode } from './stackGraph';

export class ParallelStacksPanel {
    public static currentPanel: ParallelStacksPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (ParallelStacksPanel.currentPanel) {
            ParallelStacksPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'parallelStacks',
            'Parallel Stacks',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        ParallelStacksPanel.currentPanel = new ParallelStacksPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'refresh':
                        await this._updateGraph();
                        return;
                    case 'openFile':
                        await this._openFile(message.source, message.line, message.column);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        ParallelStacksPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _updateGraph() {
        const session = vscode.debug.activeDebugSession;
        if (!session) {
            this._panel.webview.postMessage({ command: 'error', text: 'No active debug session' });
            return;
        }
        try {
            const graphData = await getStackGraph(session);
            this._panel.webview.postMessage({ command: 'updateGraph', data: graphData });
        } catch (e: any) {
            this._panel.webview.postMessage({ command: 'error', text: e.message });
        }
    }

    private async _openFile(source: any, line: number, column: number) {
        if (!source || !source.path) {
            return;
        }
        try {
            const uri = vscode.Uri.file(source.path);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc);
            const pos = new vscode.Position(line - 1, column - 1); // standard is 1-based, API is 0-based?
            // DAP 'line' is 1-based usually. VS Code API Position is 0-based.
            // StackFrame interface has 1-based line?
            // DAP spec says 1-based.
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos));
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to open file: ${e.message}`);
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Parallel Stacks</title>
        <script src="https://d3js.org/d3.v7.min.js"></script>
        <style>
            body { font-family: sans-serif; padding: 10px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
            .error { color: var(--vscode-errorForeground); }
            #graph { width: 100%; height: 600px; border: 1px solid var(--vscode-widget-border); overflow: auto; }
            .node rect { fill: var(--vscode-editor-background); stroke: var(--vscode-foreground); stroke-width: 1.5px; }
            .node text { font: 12px sans-serif; fill: var(--vscode-editor-foreground); }
            .link { fill: none; stroke: var(--vscode-foreground); stroke-opacity: 0.4; stroke-width: 1.5px; }

            /* Tooltip */
            .tooltip { position: absolute; text-align: center; padding: 5px; font: 12px sans-serif; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); pointer-events: none; opacity: 0; }
        </style>
    </head>
    <body>
        <button id="refresh">Refresh</button>
        <div id="error" class="error"></div>
        <div id="graph"></div>
        <div class="tooltip" id="tooltip"></div>
        <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('refresh').addEventListener('click', () => {
                vscode.postMessage({ command: 'refresh' });
            });

            window.addEventListener('message', event => {
                const message = event.data;
                const errorDiv = document.getElementById('error');

                switch (message.command) {
                    case 'updateGraph':
                        errorDiv.textContent = '';
                        renderGraph(message.data);
                        break;
                    case 'error':
                        errorDiv.textContent = message.text;
                        break;
                }
            });

            function renderGraph(data) {
                const container = document.getElementById('graph');
                container.innerHTML = '';

                if (!data || data.length === 0) {
                    container.textContent = 'No stack data available.';
                    return;
                }

                // data is an array of root nodes (GraphNode[])
                // We create a dummy root to hold them all for D3 tree
                const rootData = {
                    id: 'root',
                    frame: { name: 'Root', line: 0, column: 0 },
                    children: data,
                    threadIds: []
                };

                const width = container.clientWidth || 800;
                const height = container.clientHeight || 600;

                // Margin
                const margin = {top: 20, right: 90, bottom: 30, left: 90};
                const innerWidth = width - margin.left - margin.right;
                const innerHeight = height - margin.top - margin.bottom;

                const svg = d3.select("#graph").append("svg")
                    .attr("width", width)
                    .attr("height", height);

                const g = svg.append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                // Zoom
                const zoom = d3.zoom()
                    .scaleExtent([0.1, 10])
                    .on('zoom', (event) => {
                        g.attr('transform', event.transform);
                    });
                svg.call(zoom);

                const root = d3.hierarchy(rootData);

                const treeLayout = d3.tree().size([innerWidth, innerHeight]);
                treeLayout(root);

                // Links
                g.selectAll('path.link')
                    .data(root.links())
                    .enter().append('path')
                    .attr('class', 'link')
                    .attr('d', d3.linkVertical()
                        .x(d => d.x)
                        .y(d => d.y));

                // Nodes
                const nodes = g.selectAll('g.node')
                    .data(root.descendants())
                    .enter().append('g')
                    .attr('class', 'node')
                    .attr('transform', d => "translate(" + d.x + "," + d.y + ")")
                    .style("cursor", "pointer")
                    .on("click", (event, d) => {
                         if (d.data.id !== 'root' && d.data.frame) {
                             vscode.postMessage({
                                 command: 'openFile',
                                 source: d.data.frame.source,
                                 line: d.data.frame.line,
                                 column: d.data.frame.column
                             });
                         }
                    })
                    .on("mouseover", (event, d) => {
                        const tooltip = d3.select("#tooltip");
                        tooltip.transition().duration(200).style("opacity", .9);
                        tooltip.html(d.data.frame.name)
                            .style("left", (event.pageX) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseout", (d) => {
                        d3.select("#tooltip").transition().duration(500).style("opacity", 0);
                    });

                nodes.append('circle')
                    .attr('r', 5)
                    .style('fill', d => d.data.id === 'root' ? 'none' : '#69b3a2');

                nodes.append('text')
                    .attr("dy", ".35em")
                    .attr("x", d => d.children ? -13 : 13)
                    .style("text-anchor", d => d.children ? "end" : "start")
                    .text(d => d.data.id === 'root' ? '' : (d.data.frame.name + ((d.data.threadIds && d.data.threadIds.length > 0) ? ' (' + d.data.threadIds.length + ')' : '')));
            }

            // Initial refresh
            vscode.postMessage({ command: 'refresh' });
        </script>
    </body>
    </html>`;
    }
}
