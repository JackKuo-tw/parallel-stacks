# Parallel Stacks

Parallel Stacks is a Visual Studio Code extension that visualizes call stacks from multiple threads in a single, merged graph view. It is inspired by the "Parallel Stacks" window in Visual Studio, serving as a powerful tool for debugging multi-threaded C/C++ applications.

## Features

- **Unified Graph View**: Visualizes threads and their stack frames in a tree/graph layout.
- **Thread Grouping**: Automatically groups threads with common stack frames to reduce clutter.
- **Interactive Navigation**: Click on any node (stack frame) to navigate directly to the corresponding source code.
- **Zoom & Pan**: Easily explore large stack graphs with zoom and pan controls.
- **Cross-Platform**: Supports Windows, macOS, and Linux.

## Usage

1. Start a debugging session (e.g., using C++ extension).
2. Pause the execution (hit a breakpoint or pause manually).
3. Open the **Command Palette** (`Ctrl+Shift+P` or `Cmd+Shift+P`).
4. Run the command **"Show Parallel Stacks"**.

## Build and Installation

### Prerequisites
- Node.js installed.
- VS Code installed.

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/JackKuo-tw/parallel-stack.git
   cd parallel-stack
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

### Packaging

To create a `.vsix` file for installation:

1. Install `vsce` globally:
   ```bash
   npm install -g @vscode/vsce
   ```

2. Package the extension:
   ```bash
   vsce package
   ```

3. This will generate a file named `parallel-stacks-0.0.1.vsix`. You can install it in VS Code via "Extensions: Install from VSIX...".
