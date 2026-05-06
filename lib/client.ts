import type { AzureSynapseConfig } from '#types'
import { DataLakeFileSystemClient, DataLakeServiceClient, StorageSharedKeyCredential } from '@azure/storage-file-datalake'
import { ClientSecretCredential } from '@azure/identity'
import type { LogFunctions } from '@data-fair/types-catalogs'

/**
 * Allows you to obtain the Azure Synapse File System Client instance to connect
 *
 * @param catalogConfig   The S3 configuration object
 * @param secrets         Secret elements for configuration (such as the login key)
 * @returns   The Azure Synapse File System Client instance
 */
export const getAzureSynapseFileSystemClient = async (
  catalogConfig: AzureSynapseConfig,
  secrets: Record<string, string>,
  log?: LogFunctions
): Promise<DataLakeFileSystemClient> => {
  const url = `https://${catalogConfig.account}.dfs.core.windows.net`
  let client

  if (catalogConfig.connectionMethod.key === 'storageSharedKey') {
    client = new DataLakeServiceClient(
      url,
      new StorageSharedKeyCredential(catalogConfig.account, secrets.accountKey)
    )
  } else if (catalogConfig.connectionMethod.key === 'clientSecret') {
    client = new DataLakeServiceClient(
      url,
      new ClientSecretCredential(catalogConfig.connectionMethod.tenantId, catalogConfig.connectionMethod.clientId, secrets.clientSecret)
    )
  } else {
    console.error('Connection impossible, no connection mode exists')
    await log?.error('Connection impossible, no connection mode exists')
    throw new Error('Connection impossible, no connection mode exists')
  }

  return client.getFileSystemClient(catalogConfig.fileSystemName)
}
