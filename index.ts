import type { CatalogPlugin } from '@data-fair/types-catalogs'
import { type AzureSynapseConfig, configSchema, assertConfigValid } from '#types'
import capabilities, { type AzureSynapseCapabilities } from './lib/capabilities.ts'

// Since the plugin is very frequently imported, each function is imported on demand,
// instead of loading the entire plugin.
// This file should not contain any code, but only constants and dynamic imports of functions.

const plugin: CatalogPlugin<AzureSynapseConfig, AzureSynapseCapabilities> = {
  async prepare (context) {
    const prepare = (await import('./lib/prepare.ts')).default
    return prepare(context)
  },

  async list (context) {
    const { list } = await import('./lib/imports.ts')
    return list(context)
  },

  async getResource (context) {
    const { getResource } = await import('./lib/download.ts')
    return getResource(context)
  },

  metadata: {
    title: 'Catalog Azure Synapse',
    description: 'Azure Synapse plugin for Data Fair Catalog',
    capabilities
  },
  configSchema,
  assertConfigValid
}
export default plugin
