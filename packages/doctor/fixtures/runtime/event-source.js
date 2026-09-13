import euix from "euix";

export const NotificationFeed = euix`
  <uid_spec>
    <data_model>
      <state id="messages" type="array">[]</state>
    </data_model>

    <action name="subscribe">
      const source = new EventSource("/api/live/notifications");
      source.addEventListener("notification", (e) => {
        messages.push(JSON.parse(e.data));
      });
    </action>

    <button @click="subscribe">Subscribe</button>
  </uid_spec>
`;
