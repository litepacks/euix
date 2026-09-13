import euix from "euix";

export const BrokenCounter = euix`
  <uid_spec>
    <data_model>
      <state id="count" type="number">0</state>
    </data_model>

    <computed id="double">{data.count * 2}</computed>

    <watch path="count">
      count = double;
    </watch>
  </uid_spec>
`;
