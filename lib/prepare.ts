import type { AzureSynapseConfig } from '#types'
import type { PrepareContext } from '@data-fair/types-catalogs'
import type { AzureSynapseCapabilities } from './capabilities.ts'
import { getAzureSynapseFileSystemClient } from './client.ts'

/**
 * This allows you to verify that you can create the catalog by testing a connection to an S3 server.
 * The secret key used for the connection is also hidden.
 *
 * @param context   The context containing catalog configuration and secrets fields
 */
export default async ({ catalogConfig, secrets }: PrepareContext<AzureSynapseConfig, AzureSynapseCapabilities>) => {
  switch (catalogConfig.connectionMethod.key) {
    case 'clientSecret':
      delete secrets.accountKey
      if (catalogConfig.connectionMethod.clientSecret === '') {
        delete secrets.clientSecret
      } else if (catalogConfig.connectionMethod.clientSecret && catalogConfig.connectionMethod.clientSecret !== '***************') {
        secrets.clientSecret = catalogConfig.connectionMethod.clientSecret
        catalogConfig.connectionMethod.clientSecret = '***************'
      }
      break
    case 'storageSharedKey':
      delete secrets.clientSecret
      if (catalogConfig.connectionMethod.accountKey === '') {
        delete secrets.accountKey
      } else if (catalogConfig.connectionMethod.accountKey && catalogConfig.connectionMethod.accountKey !== '***************') {
        secrets.accountKey = catalogConfig.connectionMethod.accountKey
        catalogConfig.connectionMethod.accountKey = '***************'
      }
      break
    default: break
  }

  // try the Azure Synapse connection
  try {
    // We use a minimal command to test if everything is correct
    const fileSystemClient = await getAzureSynapseFileSystemClient(catalogConfig, secrets)
    await fileSystemClient.getProperties()
  } catch (error) {
    console.error('Connection test failed:', error)
    const err = error as Error
    throw new Error('Connection test failed: ' + err.message)
  }

  return {
    catalogConfig,
    secrets
  }
}
