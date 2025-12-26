# Parallel Stacks

**Parallel Stacks** is a Visual Studio Code extension that visualizes call stacks from multiple threads in a single, merged graph view. It is inspired by the "Parallel Stacks" window in Visual Studio, serving as a powerful tool for debugging multi-threaded C/C++ applications.

![Parallel Stacks Overview](resources/icon.png)

## 🛠 Usage

1. **Start Debugging**: Launch your debug session (works best with C++/Native debuggers).
2. **Break Execution**: Hit a breakpoint or pause execution manually.
3. **Open View**: Launch the command **"Show Parallel Stacks"** from the Command Palette (`Ctrl/Cmd + Shift + P`).
4. **Interact**:
   - **Scroll/Pinch** to zoom.
   - **Click-and-drag** to pan.
   - **Click** on frames to open the file.
   - **Hover** to highlight branches.

## 🚀 Features

### 🔍 Unified Graph Visualization
- **Multi-thread Aggregation**: Groups threads with identical call stacks into a single branch to reduce complexity.
- **Top-Down & Bottom-Up**: View the execution flow as a tree, making it easy to identify common ancestors and execution paths.
- **Dynamic Zoom & Pan**: Fluidly explore complex multi-threaded environments with full zoom and pan support.

### ⚡ Interactive Debugging
- **Active Frame Highlight**: Instantly see which stack frame is currently active in both the graph and the editor (highlighted with a green gutter arrow).
- **Source Code Navigation**: Click on any node (stack frame) to navigate directly to the corresponding line in your source code.
- **Branch Tracing**: Hover over any node to highlight the entire path down to the root, making stack tracing effortless.
- **Thread Management**: Split out specific threads into their own branches or merge them back for custom visualization.

### 🎨 Modern UI/UX
- **VS Code Theme Integration**: Automatically uses your active editor colors for a seamless experience.
- **Thread Labels**: Displays Thread IDs and names (e.g., `1: main`) directly above leaf nodes.
- **Compact Layout**: Designed for high-density information display, similar to professional IDE tools.

## 🏗 Build and Installation

For developers looking to contribute or build from source:

1. Clone and install:
   ```bash
   git clone https://github.com/JackKuo-tw/parallel-stack.git
   npm install
   ```
2. Build:
   ```bash
   npm run compile
   ```
3. Run: Press `F5` in VS Code to launch a new window with the extension active.

## 📄 License
This project is licensed under the [MIT License](LICENSE).

---
**Maintained by [JackKuo-tw](https://github.com/JackKuo-tw)**
