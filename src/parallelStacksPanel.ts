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
            const pos = new vscode.Position(line - 1, column - 1);
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; script-src 'unsafe-inline' https:;">
        <title>Parallel Stacks</title>
        <script src="https://d3js.org/d3.v7.min.js"></script>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                padding: 0;
                margin: 0;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                overflow: hidden;
            }
            .error { color: var(--vscode-errorForeground); padding: 20px; }
            .error:empty { padding: 0; }
            #graph { width: 100vw; height: 100vh; overflow: visible; }

            /* Nodes */
            .node rect {
                fill: var(--vscode-sideBar-background);
                stroke: var(--vscode-widget-border);
                stroke-width: 1px;
                rx: 4px; /* Rounded corners */
            }
            .node:hover rect {
                stroke: var(--vscode-focusBorder);
                stroke-width: 2px;
            }
            .node text.name {
                font-weight: bold;
                fill: var(--vscode-editor-foreground);
                pointer-events: none;
            }
            .node text.details {
                font-size: 0.9em;
                fill: var(--vscode-descriptionForeground);
                pointer-events: none;
            }
            .node-thread-count {
                font-size: 0.8em;
                fill: var(--vscode-badge-foreground);
            }
            .node-thread-badge {
                fill: var(--vscode-badge-background);
            }

            /* Links */
            .link {
                fill: none;
                stroke: var(--vscode-editor-foreground);
                stroke-opacity: 0.2;
                stroke-width: 2px;
            }

            /* Tooltip */
            .tooltip {
                position: absolute;
                text-align: left;
                padding: 8px;
                font-size: 12px;
                background: var(--vscode-editor-hoverHighlightBackground);
                border: 1px solid var(--vscode-widget-border);
                border-radius: 4px;
                pointer-events: none;
                opacity: 0;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                color: var(--vscode-editor-foreground);
                z-index: 10;
            }
        </style>
    </head>
    <body>
        <div id="error" class="error"></div>
        <div id="graph"></div>
        <div class="tooltip" id="tooltip"></div>
        <script>
            const vscode = acquireVsCodeApi();

            // Handle window resize
            window.addEventListener('resize', () => {
                 if (lastData) renderGraph(lastData);
            });

            window.addEventListener('message', event => {
                const message = event.data;
                const errorDiv = document.getElementById('error');

                switch (message.command) {
                    case 'updateGraph':
                        errorDiv.textContent = '';
                        lastData = message.data;
                        renderGraph(message.data);
                        break;
                    case 'error':
                        errorDiv.textContent = message.text;
                        break;
                }
            });

            let lastData = null;

            function renderGraph(data) {
                const container = document.getElementById('graph');

                // Fix rendering lag on tab switch (0 size)
                const width = container.clientWidth;
                const height = container.clientHeight;
                if (width === 0 || height === 0) {
                    requestAnimationFrame(() => renderGraph(data));
                    return;
                }

                container.innerHTML = '';

                if (!data || data.length === 0) {
                    container.innerHTML = '<div style="padding: 20px;">No stack data available. Start a debug session.</div>';
                    return;
                }

                // Prepare data for D3
                const rootData = {
                    id: 'root',
                    frame: { name: 'Root', line: 0, column: 0 },
                    children: data,
                    threadIds: []
                };

                const root = d3.hierarchy(rootData);

                // Calculate dynamic node width based on longest name
                let maxNameLen = 0;
                root.descendants().forEach(d => {
                   if (d.data.id !== 'root' && d.data.frame && d.data.frame.name) {
                       maxNameLen = Math.max(maxNameLen, d.data.frame.name.length);
                   }
                });

                // Estimate: 8px per char + padding
                const minNodeWidth = 200;
                const nodeWidth = Math.max(minNodeWidth, maxNameLen * 8 + 40);
                const nodeHeight = 60;
                const horizontalSpacing = 40;
                const verticalSpacing = 80;

                const treeLayout = d3.tree()
                    .nodeSize([nodeWidth + horizontalSpacing, nodeHeight + verticalSpacing]);

                treeLayout(root);

                // Define zoom behavior
                const zoom = d3.zoom()
                    .on("zoom", (event) => {
                       g.attr("transform", event.transform);
                    });

                // Create SVG
                const svgSelection = d3.select("#graph").append("svg")
                    .attr("width", width)
                    .attr("height", height)
                    .call(zoom)
                    .on("dblclick.zoom", null); // Enable standard zoom, disable double-click zoom

                const g = svgSelection.append("g");

                // Calculate bounds to center the tree initially
                let x0 = Infinity;
                let x1 = -Infinity;
                let y0 = Infinity;
                let y1 = -Infinity;
                root.each(d => {
                    // Ignore root for bounding box if we hide it
                    if (d.data.id === 'root') return;
                    if (d.x < x0) x0 = d.x;
                    if (d.x > x1) x1 = d.x;
                    if (d.y < y0) y0 = d.y;
                    if (d.y > y1) y1 = d.y;
                });

                if (x0 === Infinity) { // Fallback if only root
                     x0 = 0; x1 = 0; y0 = 0; y1 = 0;
                }

                // Bottom-Up Transformation

                const graphWidth = x1 - x0 + nodeWidth;
                const graphHeight = y1 - y0 + nodeHeight;

                const initialScale = Math.min(
                    1,
                    (width - 100) / graphWidth,
                    (height - 100) / graphHeight
                );

                const centerX = (x0 + x1) / 2;
                const centerY = (y0 + y1) / 2; // Center of the visual tree (excluding root)

                const initialTranslateX = (width / 2) - (centerX * initialScale);
                const initialTranslateY = (height / 2) - (-centerY * initialScale);

                // Apply initial zoom
                svgSelection.call(zoom.transform,
                    d3.zoomIdentity.translate(initialTranslateX, initialTranslateY).scale(initialScale)
                );

                // Filter out link to virtual root
                const links = root.links().filter(d => d.source.data.id !== 'root');

                // Draw Links
                g.selectAll('path.link')
                    .data(links)
                    .enter().append('path')
                    .attr('class', 'link')
                    .attr('d', d => {
                        const sx = d.source.x;
                        const sy = -d.source.y;
                        const tx = d.target.x;
                        const ty = -d.target.y;

                        return 'M' + sx + ',' + sy + 'C' + sx + ',' + ((sy + ty) / 2) + ' ' + tx + ',' + ((sy + ty) / 2) + ' ' + tx + ',' + ty;
                    });

                // Filter out virtual root node
                const nodesData = root.descendants().filter(d => d.data.id !== 'root');

                // Draw Nodes
                const nodes = g.selectAll('g.node')
                    .data(nodesData)
                    .enter().append('g')
                    .attr('class', 'node')
                    .attr('transform', d => 'translate(' + d.x + ',' + (-d.y) + ')')
                    .style("cursor", "pointer")
                    .on("click", (event, d) => {
                         if (d.data.frame) {
                             vscode.postMessage({
                                 command: 'openFile',
                                 source: d.data.frame.source,
                                 line: d.data.frame.line,
                                 column: d.data.frame.column
                             });
                         }
                    });

                // Node Rect/Card
                nodes.append('rect')
                    .attr('x', -nodeWidth / 2)
                    .attr('y', -nodeHeight / 2)
                    .attr('width', nodeWidth)
                    .attr('height', nodeHeight)
                    .attr('rx', 5);

                // Text: Function Name (truncated if long - though we resized to fit)
                nodes.append('text')
                    .attr('class', 'name')
                    .attr('dy', '-0.5em')
                    .attr('text-anchor', 'middle')
                    .text(d => d.data.frame.name);

                // Text: Source/Line
                nodes.append('text')
                    .attr('class', 'details')
                    .attr('dy', '1.2em')
                    .attr('text-anchor', 'middle')
                    .text(d => {
                         const src = d.data.frame.source ? d.data.frame.source.name : '';
                         const line = d.data.frame.line > 0 ? ':' + d.data.frame.line : '';
                         return src + line;
                    });

                // Thread Count Badge (if > 1)
                const badges = nodes.filter(d => d.data.threadIds && d.data.threadIds.length > 1);

                badges.append('circle')
                    .attr('class', 'node-thread-badge')
                    .attr('cx', nodeWidth/2)
                    .attr('cy', -nodeHeight/2)
                    .attr('r', 12);

                badges.append('text')
                    .attr('class', 'node-thread-count')
                    .attr('cx', nodeWidth/2)
                    .attr('cy', -nodeHeight/2)
                    .attr('dy', '0.35em')
                    .attr('text-anchor', 'middle')
                    .text(d => d.data.threadIds.length);
            }

            // Initial refresh
            vscode.postMessage({ command: 'refresh' });
        </script>
    </body>
    </html>`;
    }
}
