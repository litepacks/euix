import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXStreamPlugin } from "../src/plugins/EUIXStreamPlugin.js";
import { JSDOM } from "jsdom";

class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;

    constructor(url, protocols) {
        this.url = url;
        this.protocols = protocols;
        this.readyState = MockWebSocket.OPEN;
        this.sentMessages = [];

        setTimeout(() => {
            if (this.onopen) this.onopen({ type: "open" });
        }, 10);
    }

    send(data) {
        this.sentMessages.push(data);
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose({ type: "close" });
    }

    simulateMessage(data) {
        if (this.onmessage) {
            this.onmessage({ data: typeof data === "object" ? JSON.stringify(data) : String(data) });
        }
    }
}

class MockEventSource {
    constructor(url, options) {
        this.url = url;
        this.options = options;
        this.listeners = new Map();

        setTimeout(() => {
            if (this.onopen) this.onopen({ type: "open" });
        }, 10);
    }

    addEventListener(event, handler) {
        this.listeners.set(event, handler);
    }

    close() {
        // closed
    }

    simulateEvent(eventName, data) {
        const handler = this.listeners.get(eventName) || (eventName === "message" ? this.onmessage : null);
        if (handler) {
            handler({ data: typeof data === "object" ? JSON.stringify(data) : String(data) });
        }
    }
}

describe("Declarative WebSocket & SSE Streaming Suite (EUIXStreamPlugin)", () => {
    let dom;
    let container;

    beforeEach(() => {
        dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"app\"></div></body></html>");
        global.document = dom.window.document;
        global.window = dom.window;
        global.DOMParser = dom.window.DOMParser;
        global.WebSocket = MockWebSocket;
        global.EventSource = MockEventSource;
        container = document.getElementById("app");

        EUIXEngineCore.use(EUIXStreamPlugin);
    });

    afterEach(() => {
        if (container) container.innerHTML = "";
    });

    it("should parse <api_stream type=\"websocket\">, auto-connect, and update target state on message", async () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="ticker" type="object">{"price": 0}</state>
          </data_model>

          <api_config base_url="wss://stream.example.com">
            <api_stream 
              id="crypto" 
              type="websocket" 
              url="/btc" 
              target="ticker" 
              auto_connect="true" 
            />
          </api_config>

          <flex direction="column">
            <span class="status">{stream.crypto.status}</span>
            <span class="price">{data.ticker.price}</span>
          </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine.getStreamStatus("crypto")).toBeDefined();

        await new Promise((resolve) => setTimeout(resolve, 30));

        const status = engine.getStreamStatus("crypto");
        expect(status.connected).toBe(true);
        expect(status.status).toBe("connected");

        // Simulate incoming message
        const activeStream = engine._activeStreams.get("crypto");
        expect(activeStream).toBeDefined();
        activeStream.socket.simulateMessage({ price: 95000 });

        expect(engine.getState("ticker.price")).toBe(95000);
        expect(container.querySelector(".price").textContent).toBe("95000");

        // Test sending message via STREAM_SEND
        const sent = engine.sendStreamMessage("crypto", { action: "ping" });
        expect(sent).toBe(true);
        expect(activeStream.socket.sentMessages.length).toBe(1);
        expect(JSON.parse(activeStream.socket.sentMessages[0])).toEqual({ action: "ping" });
    });

    it("should parse SSE stream with operation=\"PUSH\" to array target", async () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="notifications" type="array">[]</state>
          </data_model>

          <api_stream 
            id="notifs" 
            type="sse" 
            url="https://api.example.com/events" 
            target="notifications" 
            operation="PUSH" 
            auto_connect="false" 
          />

          <for_each items="{data.notifications}" var="n">
            <div class="notif-item">{n.text}</div>
          </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine.getStreamStatus("notifs").status).toBe("disconnected");

        // Connect stream programmatically
        engine.connectStream("notifs");
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(engine.getStreamStatus("notifs").connected).toBe(true);

        const activeStream = engine._activeStreams.get("notifs");
        activeStream.socket.simulateEvent("message", { id: 1, text: "System updated" });

        expect(engine.getState("notifications").length).toBe(1);
        expect(engine.getState("notifications")[0].text).toBe("System updated");
        expect(container.querySelectorAll(".notif-item").length).toBe(1);
        expect(container.querySelector(".notif-item").textContent).toBe("System updated");

        // Disconnect stream
        engine.disconnectStream("notifs");
        expect(engine.getStreamStatus("notifs").status).toBe("disconnected");
    });
});
