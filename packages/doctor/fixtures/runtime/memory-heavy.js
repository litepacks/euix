import euix from "euix";

export const DataGrid = euix`
  <uid_spec>
    <data_model>
      <state id="rows" type="array">[]</state>
      <state id="cache" type="object">{}</state>
    </data_model>

    <action name="loadAll">
      const response = await fetch("/api/large-dataset");
      const data = await response.json();
      rows = data.items;
      for (const item of data.items) {
        cache[item.id] = { ...item, meta: new Array(100).fill(item) };
      }
    </action>

    <watch path="rows">
      localStorage.setItem("grid-cache", JSON.stringify(cache));
    </watch>
  </uid_spec>
`;
