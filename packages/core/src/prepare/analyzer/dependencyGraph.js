/**
 * packages/core/src/prepare/analyzer/dependencyGraph.js
 * Lightweight State/Action/View dependency graph for EUIX.
 * Derived from the SymbolTable and AST.
 * Powers impact analysis, unused symbol detection, and minimal AI repair context.
 */

export class DependencyGraph {
    constructor() {
        /** @type {Map<string, { id: string, type: "state"|"action"|"computed"|"view", metadata: any }>} */
        this.nodes = new Map();

        /** @type {Map<string, Set<{ target: string, relation: "reads"|"writes"|"triggers"|"dependsOn" }>>} */
        this.edges = new Map();

        /** @type {Map<string, Set<{ source: string, relation: "reads"|"writes"|"triggers"|"dependsOn" }>>} */
        this.reverseEdges = new Map();
    }

    /**
     * Adds a node to the graph if it doesn't already exist.
     * @param {string} id
     * @param {"state"|"action"|"computed"|"view"} type
     * @param {any} [metadata={}]
     */
    addNode(id, type, metadata = {}) {
        if (!this.nodes.has(id)) {
            this.nodes.set(id, { id, type, metadata });
            this.edges.set(id, new Set());
            this.reverseEdges.set(id, new Set());
        }
    }

    /**
     * Adds a directed edge between two nodes.
     * @param {string} sourceId
     * @param {string} targetId
     * @param {"reads"|"writes"|"triggers"|"dependsOn"} relation
     */
    addEdge(sourceId, targetId, relation) {
        if (!this.edges.has(sourceId)) this.edges.set(sourceId, new Set());
        if (!this.reverseEdges.has(targetId)) this.reverseEdges.set(targetId, new Set());

        this.edges.get(sourceId).add({ target: targetId, relation });
        this.reverseEdges.get(targetId).add({ source: sourceId, relation });
    }

    /**
     * Returns all nodes directly dependent on `targetId`.
     * @param {string} targetId
     * @returns {Array<{ id: string, type: string, relation: string }>}
     */
    getDependents(targetId) {
        const rev = this.reverseEdges.get(targetId);
        if (!rev) return [];
        return Array.from(rev).map((e) => ({
            id: e.source,
            type: this.nodes.get(e.source)?.type || "unknown",
            relation: e.relation,
        }));
    }

    /**
     * Returns all dependencies of `sourceId`.
     * @param {string} sourceId
     * @returns {Array<{ id: string, type: string, relation: string }>}
     */
    getDependencies(sourceId) {
        const fwd = this.edges.get(sourceId);
        if (!fwd) return [];
        return Array.from(fwd).map((e) => ({
            id: e.target,
            type: this.nodes.get(e.target)?.type || "unknown",
            relation: e.relation,
        }));
    }

    /**
     * Performs transitive impact analysis for a symbol.
     * Returns all affected nodes if this symbol changes.
     * @param {string} symbolId
     * @returns {Set<string>}
     */
    getImpactAnalysis(symbolId) {
        const visited = new Set();
        const queue = [symbolId];

        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);

            const dependents = this.getDependents(current);
            for (const dep of dependents) {
                if (!visited.has(dep.id)) {
                    queue.push(dep.id);
                }
            }
        }

        visited.delete(symbolId); // Exclude the symbol itself
        return visited;
    }

    /**
     * Extracts a targeted minimal context subgraph around a symbol or diagnostic path.
     * Used to construct small AI repair prompts instead of sending the whole file.
     *
     * @param {string} symbolId
     * @returns {{ nodes: object[], edges: object[] }}
     */
    getMinimalContext(symbolId) {
        const relevantNodeIds = new Set([symbolId]);

        // Add 1-hop dependencies
        for (const dep of this.getDependencies(symbolId)) {
            relevantNodeIds.add(dep.id);
        }

        // Add 1-hop dependents
        for (const dep of this.getDependents(symbolId)) {
            relevantNodeIds.add(dep.id);
        }

        const nodes = [];
        const edges = [];

        for (const id of relevantNodeIds) {
            const node = this.nodes.get(id);
            if (node) nodes.push(node);

            const nodeEdges = this.edges.get(id);
            if (nodeEdges) {
                for (const e of nodeEdges) {
                    if (relevantNodeIds.has(e.target)) {
                        edges.push({ source: id, target: e.target, relation: e.relation });
                    }
                }
            }
        }

        return { nodes, edges };
    }
}

/**
 * Builds a DependencyGraph from a SymbolTable and source.
 *
 * @param {import('./symbolTable.js').SymbolTable} symbolTable
 * @param {object} [source=null]
 * @returns {DependencyGraph}
 */
export function buildDependencyGraph(symbolTable, source = null) {
    const graph = new DependencyGraph();

    // 1. Add State Nodes
    for (const [stName, st] of symbolTable.states.entries()) {
        graph.addNode(`state:${stName}`, "state", { name: stName, type: st.type, default: st.default });
    }

    // 2. Add Computed Nodes & Edges
    for (const [cName, comp] of symbolTable.computed.entries()) {
        const cId = `computed:${cName}`;
        graph.addNode(cId, "computed", { name: cName, expr: comp.expr });

        for (const dep of comp.deps) {
            const targetId = symbolTable.states.has(dep) ? `state:${dep}` : `computed:${dep}`;
            graph.addNode(targetId, symbolTable.states.has(dep) ? "state" : "computed", { name: dep });
            graph.addEdge(cId, targetId, "dependsOn");
        }
    }

    // 3. Add Action Nodes & Edges (Reads & Writes)
    for (const [aName, act] of symbolTable.actions.entries()) {
        const aId = `action:${aName}`;
        graph.addNode(aId, "action", { name: aName });

        for (const r of act.reads) {
            const targetId = symbolTable.states.has(r) ? `state:${r}` : `computed:${r}`;
            graph.addNode(targetId, symbolTable.states.has(r) ? "state" : "computed", { name: r });
            graph.addEdge(aId, targetId, "reads");
        }

        for (const w of act.writes) {
            const targetId = `state:${w}`;
            graph.addNode(targetId, "state", { name: w });
            graph.addEdge(aId, targetId, "writes");
        }
    }

    // 4. Add Bindings & View Nodes
    symbolTable.bindings.forEach((binding, idx) => {
        const vId = binding.nodeId ? `view:${binding.nodeId}` : `view:${binding.path || idx}`;
        graph.addNode(vId, "view", { path: binding.path, property: binding.property });

        if (binding.type === "event") {
            const aId = `action:${binding.target}`;
            graph.addNode(aId, "action", { name: binding.target });
            graph.addEdge(vId, aId, "triggers");
        } else {
            const sId = symbolTable.states.has(binding.target) ? `state:${binding.target}` : `computed:${binding.target}`;
            graph.addNode(sId, symbolTable.states.has(binding.target) ? "state" : "computed", { name: binding.target });
            graph.addEdge(vId, sId, "reads");
        }
    });

    return graph;
}
