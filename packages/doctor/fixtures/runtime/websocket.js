import euix from "euix";

export const LiveTicker = euix`
  <uid_spec>
    <data_model>
      <state id="price" type="number">0</state>
      <state id="connected" type="boolean">false</state>
    </data_model>

    <action name="connect">
      const ws = new WebSocket("wss://stream.example.com/prices");
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        price = data.price;
        connected = true;
      };
      ws.onclose = () => { connected = false; };
    </action>

    <button @click="connect">Connect</button>
    <span>{data.price}</span>
  </uid_spec>
`;
