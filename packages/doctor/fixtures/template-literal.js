import euix from "euix";

export const Counter = euix`
  <component name="InlineCounter">
    <state name="count" value="0" />
    <button @click="increment">{{ count }}</button>
  </component>
`;
