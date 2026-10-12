import type { AzureSynapseConfig } from '#types'
import type { AzureSynapseCapabilities } from '../lib/capabilities.ts'

import { strict as assert } from 'node:assert'
import { describe, it, afterEach, before, after, mock } from 'node:test'
import { Readable } from 'node:stream'
import { mkdir, rm, readFile } from 'node:fs/promises'
import { DataLakeFileSystemClient, DataLakeFileClient } from '@azure/storage-file-datalake'

import prepare from '../lib/prepare.ts'
import { list } from '../lib/imports.ts'
import { getResource } from '../lib/download.ts'
import { logFunctions } from './test-utils.ts'

const testDirectory = './test-it/data-test/'
const capabilities = [] as unknown as AzureSynapseCapabilities

// No real data, the Azure SDK calls are mocked.
const catalogConfig = (): AzureSynapseConfig => ({
  account: 'testaccount',
  fileSystemName: 'test-fs',
  connectionMethod: { key: 'storageSharedKey', accountKey: 'dGVzdC1rZXk=' }
})
const secrets = { accountKey: 'dGVzdC1rZXk=' }

const mockListPaths = (paths: any[]) => {
  const calls: any[] = []
  mock.method(DataLakeFileSystemClient.prototype, 'listPaths', (options: any) => {
    calls.push(options)
    return (async function * () { yield * paths })()
  })
  return calls
}

describe('test the Azure Synapse catalog', () => {
  afterEach(() => mock.restoreAll())

  describe('test the prepare() function', () => {
    it('moves the account key to secrets and masks it', async () => {
      mock.method(DataLakeFileSystemClient.prototype, 'getProperties', async () => ({}))
      const result = await prepare({ catalogConfig: catalogConfig(), capabilities, secrets: {} })
      assert.equal(result.secrets.accountKey, 'dGVzdC1rZXk=')
      assert.equal((result.catalogConfig.connectionMethod as any).accountKey, '***************')
    })

    it('moves the client secret to secrets and drops the account key', async () => {
      mock.method(DataLakeFileSystemClient.prototype, 'getProperties', async () => ({}))
      const config: AzureSynapseConfig = {
        account: 'testaccount',
        fileSystemName: 'test-fs',
        connectionMethod: { key: 'clientSecret', tenantId: 't', clientId: 'c', clientSecret: 'shh' }
      }
      const result = await prepare({ catalogConfig: config, capabilities, secrets: { accountKey: 'old' } })
      assert.deepEqual(result.secrets, { clientSecret: 'shh' })
      assert.equal((result.catalogConfig.connectionMethod as any).clientSecret, '***************')
    })

    it('throws if the connection fails', async () => {
      mock.method(DataLakeFileSystemClient.prototype, 'getProperties', async () => { throw new Error('Forbidden') })
      await assert.rejects(prepare({ catalogConfig: catalogConfig(), capabilities, secrets: {} }), /Connection test failed: Forbidden/)
    })
  })

  describe('test the list() function', () => {
    it('lists the root of the file system', async () => {
      const calls = mockListPaths([
        { name: 'hello-world', isDirectory: true },
        { name: 'test.xlsx', isDirectory: false, contentLength: 500 }
      ])
      const result = await list({ catalogConfig: catalogConfig(), secrets, params: {} })
      assert.equal(calls[0].path, '')
      assert.equal(result.count, 2)
      assert.deepEqual(result.results[0], { id: '/hello-world', title: 'hello-world', type: 'folder', updatedAt: undefined })
      assert.deepEqual(result.results[1], { id: '/test.xlsx', title: 'test.xlsx', type: 'resource', description: '', format: 'xlsx', mimeType: '', size: 500, updatedAt: undefined })
      assert.deepEqual(result.path, [])
    })

    it('lists a subfolder and builds the path', async () => {
      const calls = mockListPaths([{ name: 'data/sub/fichier.csv', isDirectory: false, contentLength: 10 }])
      const result = await list({ catalogConfig: catalogConfig(), secrets, params: { currentFolderId: '/data/sub' } })
      assert.equal(calls[0].path, 'data/sub')
      assert.equal(result.results[0].id, '/data/sub/fichier.csv')
      assert.deepEqual(result.path, [
        { id: '/data', title: 'data', type: 'folder' },
        { id: '/data/sub', title: 'sub', type: 'folder' }
      ])
    })

    it('throws on a listing error', async () => {
      mock.method(DataLakeFileSystemClient.prototype, 'listPaths', () => (async function * () { throw new Error('Connection refused') })())
      await assert.rejects(list({ catalogConfig: catalogConfig(), secrets, params: {} }), /Connection refused/)
    })
  })

  describe('test the getResource() function', () => {
    before(async () => { await mkdir(testDirectory, { recursive: true }) })
    after(async () => { await rm(testDirectory, { recursive: true, force: true }) })

    const update = { metadata: false, schema: false }

    it('downloads a file', async () => {
      let url = ''
      mock.method(DataLakeFileClient.prototype, 'read', async function (this: DataLakeFileClient) {
        url = this.url
        return { readableStreamBody: Readable.from('Hello, I\'m a test') }
      })
      const result = await getResource({ catalogConfig: catalogConfig(), secrets, importConfig: {}, resourceId: '/data/test.xlsx', tmpDir: testDirectory, log: logFunctions, update })
      assert.equal(url, 'https://testaccount.dfs.core.windows.net/test-fs/data/test.xlsx')
      assert.equal(result.id, '/data/test.xlsx')
      assert.equal(result.title, 'test.xlsx')
      assert.equal(result.format, 'xlsx')
      assert.equal(await readFile(result.filePath, 'utf8'), 'Hello, I\'m a test')
    })

    it('throws if the file cannot be read', async () => {
      mock.method(DataLakeFileClient.prototype, 'read', async () => { throw new Error('PathNotFound') })
      await assert.rejects(
        getResource({ catalogConfig: catalogConfig(), secrets, importConfig: {}, resourceId: '/missing.csv', tmpDir: testDirectory, log: logFunctions, update }),
        /PathNotFound/
      )
    })
  })
})
