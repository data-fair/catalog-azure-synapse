import type { AzureSynapseConfig } from '#types'
import type { CatalogPlugin, GetResourceContext, Resource } from '@data-fair/types-catalogs'
import { getAzureSynapseFileSystemClient } from './client.ts'
import { pipeline } from 'stream/promises'
import fs from 'fs-extra'

/**
 * Downloads a specific resource locally from an Azure Synapse server and retrieves metadata from the downloaded file path.
 *
 * @param catalogConfig   The S3 configuration object
 * @returns   A `Resource` object representing the file
 */
export const getResource = async (context: GetResourceContext<AzureSynapseConfig>): ReturnType<CatalogPlugin['getResource']> => {
  const resource = await getMetaData(context)
  resource.filePath = await downloadResource(context)
  return resource
}

/**
 * Allows you to retrieve the metadata of the resource to be downloaded
 *
 * @param resourceId  The identifier (path) of the resource.
 * @returns  An object containing the identifier, title (name), format and file path (empty).
 */
export const getMetaData = async ({ resourceId }: GetResourceContext<AzureSynapseConfig>): Promise<Resource> => {
  const name = resourceId.substring(resourceId.lastIndexOf('/') + 1)
  const pointPos = name.lastIndexOf('.')
  return {
    id: resourceId,
    title: name,
    format: (pointPos === -1) ? '' : (name.substring(pointPos + 1)),
    filePath: ''
  }
}

/**
 * Downloads a resource (file) from the Azure Synapse server to a temporary directory.
 *
 * @param context   The context containing catalog configuration, resource ID, import configuration, temporary directory path and log instance
 * @returns   The local path to the downloaded file, or `undefined` if the download fails
 */
const downloadResource = async ({ catalogConfig, resourceId, secrets, tmpDir, log }:GetResourceContext<AzureSynapseConfig>) => {
  const filename = resourceId.substring(resourceId.lastIndexOf('/') + 1)
  const destinationPath = tmpDir + '/' + filename

  const fileSystemClient = await getAzureSynapseFileSystemClient(catalogConfig, secrets)

  const file = fileSystemClient.getFileClient(resourceId)
  const downloadResponse = await file.read()
  if (downloadResponse.readableStreamBody) {
    await pipeline(
      downloadResponse.readableStreamBody,
      fs.createWriteStream(destinationPath)
    )
  } else {
    await log.error('The file cannot be downloaded')
    throw new Error('The file cannot be downloaded')
  }

  return destinationPath
}
