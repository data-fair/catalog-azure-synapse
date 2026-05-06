import type { AzureSynapseConfig } from '#types'
import type capabilities from './capabilities.ts'
import type { ListContext, Folder, CatalogPlugin } from '@data-fair/types-catalogs'
import { getAzureSynapseFileSystemClient } from './client.ts'

type ResourceList = Awaited<ReturnType<CatalogPlugin['list']>>['results']

/**
 * Lists the contents of a folder on an Azure Synapse server.
 *
 * @param context   The context containing catalog configuration and parameters
 * @returns   An object containing the count of items, the list of results (folders and resources), and the path as an array of folders
 */
export const list = async ({ catalogConfig, secrets, params }: ListContext<AzureSynapseConfig, typeof capabilities>): ReturnType<CatalogPlugin['list']> => {
  const fileSystemClient = await getAzureSynapseFileSystemClient(catalogConfig, secrets)

  const results: (Folder | ResourceList[number])[] = []
  const paths = fileSystemClient.listPaths({
    recursive: false,
    path: params.currentFolderId ? params.currentFolderId.substring(1) : '',
  })
  try {
    for await (const path of paths) {
      if (path.isDirectory) {
        const name = path.name ? path.name.split('/').pop()! : 'unnamed'
        const folder: Folder = {
          id: (params.currentFolderId ?? '') + '/' + name,
          title: name,
          type: 'folder',
          updatedAt: path.lastModified ? path.lastModified.toISOString() : undefined
        }
        results.push(folder)
      } else {
        const name = path.name ? path.name.split('/').pop()! : 'unnamed'
        const pointPos = name.lastIndexOf('.')
        const resourceList: ResourceList[number] = {
          id: (params.currentFolderId ?? '') + '/' + name,
          title: name,
          type: 'resource',
          description: '',
          format: (pointPos === -1) ? '' : (name.substring(pointPos + 1)),
          mimeType: '',
          size: path.contentLength ?? 0,
          updatedAt: path.lastModified ? path.lastModified.toISOString() : undefined
        }
        results.push(resourceList)
      }
    }
  } catch (error: any) {
    throw new Error('List of paths : ' + error.message)
  }

  // Get the path location
  const pathFolder: Folder[] = []
  let parentId: string | undefined = params.currentFolderId
  while (parentId && parentId !== '') {
    pathFolder.unshift({
      id: parentId,
      title: parentId.substring(parentId.lastIndexOf('/') + 1),
      type: 'folder'
    })
    parentId = parentId.substring(0, parentId.lastIndexOf('/'))
  }

  return {
    count: results.length,
    results,
    path: pathFolder
  }
}
