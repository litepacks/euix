import { EUIXEngine, EUIXEngineCore } from "../../types/index";

interface Todo {
    id: number;
    title: string;
    completed: boolean;
}

interface MyDashboardState {
    counter: number;
    userName: string;
    isOnline: boolean;
    todos: Todo[];
}

const xml = "<uid_spec></uid_spec>";
const container = document.createElement("div");

// 1. Full bundle mount<TState>()
const engine = EUIXEngine.mount<MyDashboardState>(xml, container);

// Inferred state reads
const count: number = engine.getState("counter");
const user: string = engine.getState("userName");
const online: boolean = engine.getState("isOnline");
const list: Todo[] = engine.getState("todos");

// Typed state updates
engine.setState("counter", 42);
engine.setState("userName", "Bob");
engine.setState("isOnline", true);
engine.setState({ counter: 50, isOnline: false });

// Array mutation
engine.mutateState("todos", "PUSH", { id: 1, title: "Buy Milk", completed: false });

// Error boundary controls
engine.resetErrorBoundary("MyBoundary");
const boundary = engine.getErrorBoundary("MyBoundary");
if (boundary) {
    boundary.retry();
}

// 2. Core bundle mount<TState>()
const coreEngine = EUIXEngineCore.mount<MyDashboardState>(xml, container);
const coreCount: number = coreEngine.getState("counter");
