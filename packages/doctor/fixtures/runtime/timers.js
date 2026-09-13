import euix from "euix";

export const AutoRefresh = euix`
  <uid_spec>
    <data_model>
      <state id="tick" type="number">0</state>
      <state id="lastSync" type="string"></state>
    </data_model>

    <action name="startPolling">
      setInterval(async () => {
        tick++;
        const res = await fetch("/api/status");
        lastSync = await res.text();
      }, 5000);
    </action>

    <action name="debouncedSearch">
      clearTimeout(window.__searchTimer);
      window.__searchTimer = setTimeout(() => {
        fetch("/api/search?q=" + query);
      }, 300);
    </action>

    <button @click="startPolling">Start Polling</button>
  </uid_spec>
`;
