import { createServer, wireframeTools } from "staruml-controller-mcp-core"

export function createWireframeServer() {
    return createServer("staruml-controller-wireframe", "1.0.0", wireframeTools)
}
