/** @type {import('docboot').DocbootConfig} */
export default {
  title: "EUIX Engine",
  description: "Lightweight declarative UI runtime for building interactive interfaces directly from markup, without a virtual DOM or mandatory build pipeline.",
  docs: "./docs",
  out: "./dist-docs",
  repo: "https://github.com/litepacks/euix",
  theme: {
    preset: "zinc",
    defaultMode: "system"
  },
  editLink: {
    pattern: "https://github.com/litepacks/euix/edit/main/docs/:path"
  },
  sourceLink: {
    pattern: "https://github.com/litepacks/euix/blob/main/:path"
  },
  search: {
    fuzzy: 0.2,
    prefix: true,
    maxResults: 10
  }
};
