import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { generateImageSchema, generateImage } from './tools/generate.js';
import { listAccounts } from './tools/list-accounts.js';
import { getJobsSchema, getJobs } from './tools/get-jobs.js';
import { upscaleImageSchema, upscaleImage } from './tools/upscale.js';
import { uploadAssetSchema, uploadAsset } from './tools/upload-asset.js';
import { registerAccountSchema, registerAccount } from './tools/register-account.js';
import { deleteAccountSchema, deleteAccount } from './tools/delete-account.js';
import { viewImageSchema, viewImage } from './tools/view-image.js';

const server = new McpServer({
  name: 'image-gen',
  version: '1.0.0',
});

server.tool(
  'generate_image',
  'Generate images using Google Imagen/Gemini models via useapi.net.',
  generateImageSchema,
  async (args) => generateImage(args)
);

server.tool(
  'list_accounts',
  'List all connected Google accounts and their health/status.',
  {},
  async () => listAccounts()
);

server.tool(
  'get_jobs',
  'Get image generation job stats and history.',
  getJobsSchema,
  async (args) => getJobs(args)
);

server.tool(
  'upscale_image',
  'Upscale a previously generated image to 2k or 4k resolution.',
  upscaleImageSchema,
  async (args) => upscaleImage(args)
);

server.tool(
  'upload_asset',
  'Upload a local reference image for use in generation.',
  uploadAssetSchema,
  async (args) => uploadAsset(args)
);

server.tool(
  'register_account',
  'Register a Google account using session cookies.',
  registerAccountSchema,
  async (args) => registerAccount(args)
);

server.tool(
  'delete_account',
  'Remove a connected Google account.',
  deleteAccountSchema,
  async (args) => deleteAccount(args)
);

server.tool(
  'view_image',
  'View/read a local image file. Returns the image so you can see it.',
  viewImageSchema,
  async (args) => viewImage(args)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Image Gen MCP Server failed to start:', error);
  process.exit(1);
});
