import type { AzureSynapseConfig } from '#types'
import { DataLakeFileSystemClient, DataLakeServiceClient, StorageSharedKeyCredential } from '@azure/storage-file-datalake'
import { ClientSecretCredential } from '@azure/identity'
import type { LogFunctions } from '@data-fair/types-catalogs'

/**
 * Allows you to obtain the Azure Synapse File System Client instance to connect
 *
 * @param catalogConfig   The Azure Synapse configuration object
 * @param secrets         Secret elements for configuration (such as the login key)
 * @returns   The Azure Synapse File System Client instance
 */
export const getAzureSynapseFileSystemClient = async (
  catalogConfig: AzureSynapseConfig,
  secrets: Record<string, string>,
  log?: LogFunctions
): Promise<DataLakeFileSystemClient> => {
  // the account is interpolated in the host name: without this check a value like
  // "evil.example/x?" or "127.0.0.1:8080/#" sends the signed requests anywhere (SSRF)
  // Azure storage account names are 3 to 24 lowercase letters and digits
  if (!/^[a-z0-9]{3,24}$/.test(catalogConfig.account)) {
    throw new Error('Invalid account name: it must contain 3 to 24 lowercase letters and digits')
  }
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
    console.error('Connection failed: no connection mode exists')
    await log?.error('Connection failed: no connection mode exists')
    throw new Error('Connection failed: no connection mode exists')
  }

  return client.getFileSystemClient(catalogConfig.fileSystemName)
}
