import { defineImpactConfig } from 'impactest'

export default defineImpactConfig({
  runner: 'vitest',
  base: 'main',
  mode: 'safe'
})
