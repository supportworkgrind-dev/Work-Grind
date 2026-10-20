const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const express = require('express');
const test = require('node:test');
const { NodeStreamableHTTPServerTransport } = require('@modelcontextprotocol/node');

process.env.JWT_SECRET = 'mcp-test-secret-for-invalid-token-check';

const { createWorkgrindMcpServer } = require('../dist/routes/mcp');
const mcpRoutes = require('../dist/routes/mcp').default;
const Task = require('../dist/models/Task').default;
const AuditLog = require('../dist/models/AuditLog').default;
const planLimits = require('../dist/utils/planLimits');
AuditLog.create = async () => ({});
planLimits.reserveAiRequest = async () => ({ allowed: true });

const context = (overrides = {}) => ({
  companyId: '65a000000000000000000001',
  userId: '65a000000000000000000002',
  userRole: 'owner',
  accountType: 'company',
  organizationType: 'business',
  enabledFeatures: ['aiAssistant', 'tasksProjects', 'meetingsCalendar', 'crm'],
  ...overrides,
});

async function withMcpServer(userContext, run) {
  const app = express();
  app.use(express.json());
  app.post('/mcp', async (req, res) => {
    const mcp = createWorkgrindMcpServer(userContext, 'test-correlation-id');
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
    await transport.close();
    await mcp.close();
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}/mcp`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function mcpRequest(url, id, method, params = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const body = await response.text();
  const json = response.headers.get('content-type')?.includes('text/event-stream')
    ? JSON.parse(body.split('\n').find((line) => line.startsWith('data: ')).slice(6))
    : JSON.parse(body);
  return { response, json };
}

async function initialize(url) {
  const initialized = await mcpRequest(url, 1, 'initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'workgrind-mcp-test', version: '1.0.0' },
  });
  assert.equal(initialized.response.status, 200);
  assert.equal(initialized.json.result.serverInfo.name, 'workgrind');
  const notification = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });
  assert.equal(notification.status, 202);
}

test('MCP initializes and only lists tools permitted by the user workspace context', async () => {
  await withMcpServer(context({ userRole: 'employee' }), async (url) => {
    await initialize(url);
    const { json } = await mcpRequest(url, 2, 'tools/list');
    const names = json.result.tools.map((tool) => tool.name);
    assert.ok(names.includes('searchTasks'));
    assert.ok(names.includes('getTaskDetails'));
    assert.ok(names.includes('createTask'));
    assert.ok(names.includes('searchCalendarEvents'));
    assert.ok(names.includes('getWorkspaceSummary'));
    assert.ok(names.includes('getWorkgrindCapabilities'));
    assert.ok(!names.includes('searchContacts'));
    assert.ok(!names.includes('getContactDetails'));
    assert.ok(!names.includes('listWorkflows'));
  });
});

test('MCP tool calls validate arguments and execute workspace-scoped registry logic', async () => {
  const originalFind = Task.find;
  let taskFilter;
  Task.find = (filter) => {
    taskFilter = filter;
    return {
      populate() { return this; },
      sort() { return this; },
      limit() { return this; },
      lean: async () => [],
    };
  };

  try {
    await withMcpServer(context(), async (url) => {
      await initialize(url);
      const invalid = await mcpRequest(url, 2, 'tools/call', {
        name: 'createTask',
        arguments: {},
      });
      assert.ok(invalid.json.error || invalid.json.result?.isError);

      const identityAttempt = await mcpRequest(url, 3, 'tools/call', {
        name: 'searchTasks',
        arguments: { companyId: '65a000000000000000000099', userId: '65a000000000000000000099', query: 'test', limit: 5 },
      });
      assert.ok(identityAttempt.json.error || identityAttempt.json.result?.isError);

      const successful = await mcpRequest(url, 4, 'tools/call', {
        name: 'searchTasks',
        arguments: { query: 'test', limit: 5 },
      });
      assert.equal(successful.json.result.isError, false);
      assert.equal(successful.json.result.structuredContent.success, true);
      assert.equal(taskFilter.companyId, '65a000000000000000000001');

      const unknown = await mcpRequest(url, 5, 'tools/call', {
        name: 'notAWorkgrindTool',
        arguments: {},
      });
      assert.ok(unknown.json.error);

      Task.find = () => {
        throw new Error('database URI must not be returned');
      };
      const failed = await mcpRequest(url, 6, 'tools/call', {
        name: 'searchTasks',
        arguments: {},
      });
      assert.equal(failed.json.result.isError, true);
      assert.doesNotMatch(JSON.stringify(failed.json), /database URI/);
    });
  } finally {
    Task.find = originalFind;
  }
});

test('task detail lookup cannot escape the authenticated workspace or task membership scope', async () => {
  const originalFindOne = Task.findOne;
  let taskFilter;
  Task.findOne = (filter) => {
    taskFilter = filter;
    return {
      populate() { return this; },
      lean: async () => null,
    };
  };

  try {
    await withMcpServer(context({ userRole: 'employee' }), async (url) => {
      await initialize(url);
      const result = await mcpRequest(url, 2, 'tools/call', {
        name: 'getTaskDetails',
        arguments: { taskId: '65a000000000000000000099' },
      });
      assert.equal(result.json.result.isError, true);
      assert.equal(taskFilter.companyId, '65a000000000000000000001');
      assert.equal(taskFilter.$or.length, 2);
      assert.deepEqual(taskFilter.$or[0].assigneeId.toString(), context().userId);
      assert.deepEqual(taskFilter.$or[1].creatorId.toString(), context().userId);
    });
  } finally {
    Task.findOne = originalFindOne;
  }
});

test('MCP tool calls respect the existing AI monthly usage limit', async () => {
  const reserveAiRequest = planLimits.reserveAiRequest;
  const originalFind = Task.find;
  let toolExecuted = false;
  planLimits.reserveAiRequest = async () => ({ allowed: false });
  Task.find = () => {
    toolExecuted = true;
    throw new Error('A quota-rejected tool must not execute.');
  };

  try {
    await withMcpServer(context(), async (url) => {
      await initialize(url);
      const result = await mcpRequest(url, 2, 'tools/call', {
        name: 'searchTasks',
        arguments: {},
      });
      assert.equal(result.json.result.isError, true);
      assert.match(result.json.result.structuredContent.error, /usage limit/);
      assert.equal(toolExecuted, false);
    });
  } finally {
    planLimits.reserveAiRequest = reserveAiRequest;
    Task.find = originalFind;
  }
});

test('MCP task writes reuse the authenticated workspace identity and existing handlers', async () => {
  const originalCreate = Task.create;
  const originalFindOne = Task.findOne;
  const mongoose = require('mongoose');
  let created;
  let updateFilter;
  let taskSaved = false;
  const updatedTask = {
    _id: new mongoose.Types.ObjectId('65a000000000000000000003'),
    companyId: new mongoose.Types.ObjectId(context().companyId),
    creatorId: new mongoose.Types.ObjectId(context().userId),
    assigneeId: new mongoose.Types.ObjectId(context().userId),
    title: 'Old title',
    priority: 'medium',
    status: 'todo',
    save: async () => { taskSaved = true; },
    toObject() {
      return {
        _id: this._id,
        companyId: this.companyId,
        creatorId: this.creatorId,
        assigneeId: this.assigneeId,
        title: this.title,
        priority: this.priority,
        status: this.status,
      };
    },
  };
  Task.create = async (payload) => {
    created = payload;
    return { toObject: () => ({ _id: new mongoose.Types.ObjectId(), ...payload }) };
  };
  Task.findOne = async (filter) => {
    updateFilter = filter;
    return updatedTask;
  };

  try {
    await withMcpServer(context(), async (url) => {
      await initialize(url);
      const createResult = await mcpRequest(url, 2, 'tools/call', {
        name: 'createTask',
        arguments: { title: 'MCP-created task' },
      });
      assert.equal(createResult.json.result.structuredContent.success, true);
      assert.equal(created.companyId.toString(), context().companyId);
      assert.equal(created.creatorId.toString(), context().userId);
      assert.equal(created.assigneeId.toString(), context().userId);

      const updateResult = await mcpRequest(url, 3, 'tools/call', {
        name: 'updateTask',
        arguments: { taskId: '65a000000000000000000003', title: 'Updated task' },
      });
      assert.equal(updateResult.json.result.structuredContent.success, true);
      assert.equal(updateFilter.companyId, context().companyId);
      assert.equal(updatedTask.title, 'Updated task');
      assert.equal(taskSaved, true);
    });
  } finally {
    Task.create = originalCreate;
    Task.findOne = originalFindOne;
  }
});

test('the production MCP router rejects missing and invalid WorkGrind bearer tokens', async () => {
  const app = express();
  app.use(express.json());
  app.use('/mcp', mcpRoutes);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    const url = `http://127.0.0.1:${address.port}/mcp`;
    for (const authorization of [undefined, 'Bearer not-a-valid-token']) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });
      assert.equal(response.status, 401);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('MCP is routed to the existing Vercel backend handler before the generic API route', () => {
  const config = JSON.parse(fs.readFileSync(require.resolve('../vercel.json'), 'utf8'));
  const mcpRouteIndex = config.routes.findIndex((route) => route.src === '/mcp(?:/.*)?');
  const apiRouteIndex = config.routes.findIndex((route) => route.src === '/api/(.*)');
  assert.ok(mcpRouteIndex >= 0);
  assert.ok(apiRouteIndex >= 0);
  assert.ok(mcpRouteIndex < apiRouteIndex);
  assert.equal(config.routes[mcpRouteIndex].dest, '/api/index.ts');
});
