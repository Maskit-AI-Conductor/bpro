#!/usr/bin/env node

/**
 * Fugue MCP Server — using official @modelcontextprotocol/sdk.
 * Exposes fugue commands as tools for AI coding assistants.
 *
 * Does NOT call any LLM. All analysis is done by the host AI session.
 * This server only handles file I/O (read/write .fugue/ directory).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleRequest } from './tools.js';

const server = new McpServer({
  name: 'fugue',
  version: '0.7.0',
});

// Helper: call handleRequest and return SDK-compatible result
async function call(name: string, args: Record<string, unknown>) {
  const result = await handleRequest(name, args);
  return {
    content: result.content as Array<{ type: 'text'; text: string }>,
    isError: result.isError,
  };
}

// Register tools with zod schemas
server.tool('fugue_init', 'Initialize .fugue/ in a project directory', { path: z.string().optional(), force: z.boolean().optional() }, async (args) => call('fugue_init', args));

server.tool('fugue_get_plan', 'Get the imported planning document content', { path: z.string().optional() }, async (args) => call('fugue_get_plan', args));

server.tool('fugue_save_reqs', 'Save requirements to .fugue/specs/', { reqs: z.array(z.object({ id: z.string(), title: z.string(), priority: z.string(), description: z.string(), source_section: z.string().optional() })), path: z.string().optional() }, async (args) => call('fugue_save_reqs', args));

server.tool('fugue_get_specs', 'Get current requirements list', { path: z.string().optional(), status: z.string().optional(), domain: z.string().optional() }, async (args) => call('fugue_get_specs', args));

server.tool('fugue_status', 'Get project status summary', { path: z.string().optional(), deliverables: z.boolean().optional() }, async (args) => call('fugue_status', args));

server.tool('fugue_audit', 'Run audit and get results', { path: z.string().optional(), gate: z.boolean().optional() }, async (args) => call('fugue_audit', args));

server.tool('fugue_feedback', 'Add feedback to a REQ', { reqId: z.string(), action: z.enum(['accept', 'reject', 'comment']), message: z.string().optional(), from: z.string().optional(), path: z.string().optional() }, async (args) => call('fugue_feedback', args));

server.tool('fugue_confirm', 'Confirm accepted REQs, deprecate rejected ones', { path: z.string().optional() }, async (args) => call('fugue_confirm', args));

server.tool('fugue_task_new', 'Create a new task', { title: z.string(), requester: z.string().optional(), path: z.string().optional() }, async (args) => call('fugue_task_new', args));

server.tool('fugue_task_list', 'List all tasks', { path: z.string().optional(), status: z.string().optional() }, async (args) => call('fugue_task_list', args));

server.tool('fugue_diagnose', 'Diagnose project size and methodology', { path: z.string().optional() }, async (args) => call('fugue_diagnose', args));

server.tool('fugue_gate', 'Phase gate scoring', { path: z.string().optional(), phase: z.number().optional() }, async (args) => call('fugue_gate', args));

server.tool('fugue_report', 'Generate HTML progress report', { path: z.string().optional() }, async (args) => call('fugue_report', args));

server.tool('fugue_snapshot_scan', 'Scan project files for snapshot', { path: z.string().optional() }, async (args) => call('fugue_snapshot_scan', args));

server.tool('fugue_snapshot_save', 'Save snapshot results to staging', { reqs: z.array(z.object({ id: z.string(), title: z.string(), priority: z.string(), description: z.string(), code_refs: z.array(z.string()).optional(), domain: z.string().optional() })), agents: z.array(z.object({ name: z.string(), type: z.string(), scope: z.string() })).optional(), path: z.string().optional() }, async (args) => call('fugue_snapshot_save', args));

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
