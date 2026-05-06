import type { AzureSynapseConfig } from '#types'
import { DataLakeServiceClient, StorageSharedKeyCredential } from '@azure/storage-file-datalake'
import { ClientSecretCredential } from '@azure/identity'
import type { LogFunctions } from '@data-fair/types-catalogs'

/**
 * Allows you to obtain the Azure Synapse Client instance to connect
 *
 * @param catalogConfig   The S3 configuration object
 * @param secrets         Secret elements for configuration (such as the login key)
 * @returns   The S3 Client instance
 */
export const getAzureSynapseClient = (
  catalogConfig: AzureSynapseConfig,
  secrets: Record<string, string>,
  log?: LogFunctions
): DataLakeServiceClient => {
  if (catalogConfig.connectionMethod.key === 'storageSharedKey') {
    return new DataLakeServiceClient(
      `https://${catalogConfig.account}.dfs.core.windows.net`,
      new StorageSharedKeyCredential(catalogConfig.account, secrets.accountKey)
    )
  } else if (catalogConfig.connectionMethod.key === 'clientSecret') {
    return new DataLakeServiceClient(
      `https://${catalogConfig.account}.dfs.core.windows.net`,
      new ClientSecretCredential(catalogConfig.connectionMethod.tenantId, catalogConfig.connectionMethod.clientId, secrets.clientSecret)
    )
  } else {
    console.error('Connection impossible, no connection mode exists')
    log?.error('Connection impossible, no connection mode exists')
    throw new Error('Connection impossible, no connection mode exists')
  }
}
