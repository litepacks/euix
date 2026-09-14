export function createAppController(engine) {
  const set = (path, value) => engine.setState(path, value);
  return {
    loadRows() {
      set("tableLoading", true);
      set("tableRows", [{ id: 1 }]);
      set("tableLoading", false);
    },
  };
}
