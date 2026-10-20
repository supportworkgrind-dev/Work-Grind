import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { z } from 'zod';
import { getAvailableTools, getTool, MCP_TOOL_NAMES, type ToolContext } from '../ai/tools';
import { executeWorkspaceTool } from '../ai/agentRuntime';
import { authenticate, requireCompany, type AuthRequest } from '../middleware/auth';
import { requireOrganizationFeature } from '../middleware/organizationAccess';
import { rateLimiter } from '../middleware/rateLimiter';
import { getEffectiveSubscription } from '../services/companySubscription';
import { reserveAiRequest } from '../utils/planLimits';

const identifier = z.string().regex(/^[a-f\d]{24}$/i, 'A WorkGrind record ID must be a 24-character ObjectId.');
const searchQuery = z.string().trim().max(120).optional();
const resultLimit = z.number().int().min(1).max(50).optional();
const dateString = z.string().max(64).refine((value) => !Number.isNaN(Date.parse(value)), 'A valid date is required.');

const toolSchemas = {
  searchTasks: z.object({
    query: searchQuery,
    status: z.enum(['todo', 'in_progress', 'review', 'completed', 'blocked']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    overdue: z.boolean().optional(),
    assignedToMe: z.boolean().optional(),
    limit: resultLimit,
  }).strict(),
  getTaskDetails: z.object({ taskId: identifier }).strict(),
  createTask: z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(4000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: dateString.optional(),
    assigneeEmail: z.string().email().max(254).optional(),
    projectName: z.string().trim().max(200).optional(),
  }).strict(),
  updateTask: z.object({
    taskId: identifier,
    title: z.string().trim().min(1).max(200).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'completed', 'blocked']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: dateString.optional(),
    description: z.string().max(4000).optional(),
  }).strict().refine(({ taskId: _taskId, ...updates }) => Object.values(updates).some((value) => value !== undefined), {
    message: 'At least one task field must be provided.',
  }),
  searchProjects: z.object({
    query: searchQuery,
    status: z.enum(['planning', 'active', 'on_hold', 'completed']).optional(),
    behindSchedule: z.boolean().optional(),
    limit: resultLimit,
  }).strict(),
  searchContacts: z.object({
    query: searchQuery,
    status: z.enum(['lead', 'prospect', 'customer', 'churned', 'inactive']).optional(),
    limit: resultLimit,
  }).strict(),
  getContactDetails: z.object({ contactId: identifier }).strict(),
  searchCalendarEvents: z.object({
    query: searchQuery,
    type: z.enum(['meeting', 'task', 'deadline', 'event', 'reminder']).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    limit: resultLimit,
  }).strict().refine(({ from, to }) => !from || !to || Date.parse(from) <= Date.parse(to), {
    message: 'The calendar range start must be on or before its end.',
  }),
  listWorkflows: z.object({ limit: resultLimit }).strict(),
  getWorkspaceSummary: z.object({}).strict(),
  getWorkgrindCapabilities: z.object({}).strict(),
};

function createToolContext(req: AuthRequest): Promise<ToolContext> {
  const user = req.user;
  if (!user?.userId || !user.companyId) {
    throw new Error('Authenticated workspace context is unavailable.');
  }
  return getEffectiveSubscription(user.userId).then((subscription) => ({
    companyId: user.companyId,
    userId: user.userId,
    userRole: user.role,
    accountType: user.accountType,
    organizationType: user.organizationType,
    planName: subscription.planConfig.name,
    planId: subscription.plan,
    enabledFeatures: Object.entries(subscription.planConfig.entitlements)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => feature),
  }));
}

export function createWorkgrindMcpServer(context: ToolContext, correlationId: string): McpServer {
  const server = new McpServer({ name: 'workgrind', version: '1.0.0' });
  const available = new Set(getAvailableTools(context).map((tool) => tool.name));

  for (const name of MCP_TOOL_NAMES) {
    const registeredTool = getTool(name);
    if (!registeredTool || !available.has(name)) continue;

    server.registerTool(name, {
      title: registeredTool.name,
      description: registeredTool.description,
      inputSchema: toolSchemas[name],
      annotations: {
        readOnlyHint: registeredTool.readOnly === true,
        destructiveHint: false,
      },
    }, async (args: Record<string, unknown>) => {
      const startedAt = Date.now();
      try {
        const usage = await reserveAiRequest(context.userId);
        if (!usage.allowed) {
          console.info('[MCP] Tool rejected by AI usage limit.', {
            correlationId,
            tool: name,
            durationMs: Date.now() - startedAt,
          });
          return {
            content: [{ type: 'text' as const, text: 'The WorkGrind AI usage limit has been reached for this workspace.' }],
            structuredContent: { success: false, error: 'The WorkGrind AI usage limit has been reached for this workspace.' },
            isError: true,
          };
        }
        const result = await executeWorkspaceTool(name, args, context);
        const output = result.success
          ? { success: true, data: result.data ?? null }
          : { success: false, error: 'The requested WorkGrind operation was not completed. Verify access and input, then retry.' };
        console.info('[MCP] Tool completed.', {
          correlationId,
          tool: name,
          success: result.success,
          durationMs: Date.now() - startedAt,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
          isError: !result.success,
        };
      } catch (error) {
        console.error('[MCP] Tool failed.', {
          correlationId,
          tool: name,
          errorName: error instanceof Error ? error.name : 'UnknownError',
          durationMs: Date.now() - startedAt,
        });
        return {
          content: [{ type: 'text' as const, text: 'The WorkGrind tool is temporarily unavailable. Please retry.' }],
          structuredContent: { success: false, error: 'The WorkGrind tool is temporarily unavailable. Please retry.' },
          isError: true,
        };
      }
    });
  }

  return server;
}

const router = Router();
router.use(
  authenticate,
  requireOrganizationFeature('educationAi'),
  requireCompany,
  rateLimiter(15, 120),
);

router.all('/', async (req: AuthRequest, res) => {
  const correlationId = randomUUID();
  let server: McpServer | undefined;
  let transport: NodeStreamableHTTPServerTransport | undefined;
  try {
    const context = await createToolContext(req);
    server = createWorkgrindMcpServer(context, correlationId);
    transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    console.info('[MCP] Request accepted.', { correlationId, method: req.method });
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[MCP] Request failed.', {
      correlationId,
      method: req.method,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'The WorkGrind MCP request could not be completed.' });
    } else if (!res.writableEnded) {
      res.end();
    }
  } finally {
    for (const [resource, close] of [
      ['transport', () => transport?.close()],
      ['server', () => server?.close()],
    ] as const) {
      try {
        await close();
      } catch (error) {
        console.error('[MCP] Resource cleanup failed.', {
          correlationId,
          resource,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
  }
});

export default router;
