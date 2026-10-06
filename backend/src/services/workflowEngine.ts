/**
 * WorkGrind Workflow Engine
 *
 * Evaluates trigger events against stored workflow definitions and
 * executes the configured action chain.
 *
 * SECURITY:
 *   - companyId is always taken from the workflow record, never from caller
 *   - AI actions always check AI limits before calling Gemini
 *   - Max 10 active workflows per trigger event to prevent loops
 *   - Max 5 executions per workflow per 5 minutes (rate limiting)
 *   - Executions capped at 50 per workflow (rolling window in model)
 */

import mongoose from 'mongoose';
import Workflow, { IWorkflow, IWorkflowCondition, WorkflowActionType } from '../models/Workflow';
import Task from '../models/Task';
import Notification from '../models/Notification';
import Message from '../models/Message';
import Meeting from '../models/Meeting';
import Channel from '../models/Channel';
import { emitToChannel, emitToCompany } from '../utils/socket';
import { reserveAiRequest } from '../utils/planLimits';
import { isGeminiConfigured, getGenAI, GEMINI_MODEL } from './geminiService';
import { v4 as uuidv4 } from 'uuid';

export interface WorkflowTriggerPayload {
  type:      string;
  companyId: string;
  userId:    string;
  data:      Record<string, any>;
}

// ── Rate limit: max 5 executions per workflow per 5 minutes ──────────────────
const recentExecutions = new Map<string, number[]>(); // workflowId → timestamps

function isRateLimited(workflowId: string): boolean {
  const now   = Date.now();
  const limit = 5 * 60 * 1000; // 5 minutes
  const times = (recentExecutions.get(workflowId) ?? []).filter(t => now - t < limit);
  if (times.length >= 5) return true;
  times.push(now);
  recentExecutions.set(workflowId, times);
  return false;
}

// ── Condition evaluator ───────────────────────────────────────────────────────

function evaluateCondition(condition: IWorkflowCondition, data: Record<string, any>): boolean {
  const fieldParts = condition.field.split('.');
  let fieldValue: any = data;
  for (const part of fieldParts) {
    fieldValue = fieldValue?.[part];
    if (fieldValue === undefined) return false;
  }

  const condValue = condition.value;
  switch (condition.operator) {
    case 'equals':        return String(fieldValue) === String(condValue);
    case 'not_equals':    return String(fieldValue) !== String(condValue);
    case 'greater_than':  return Number(fieldValue) > Number(condValue);
    case 'less_than':     return Number(fieldValue) < Number(condValue);
    case 'contains':      return String(fieldValue).toLowerCase().includes(String(condValue).toLowerCase());
    default:              return true;
  }
}

function evaluateConditions(conditions: IWorkflowCondition[], data: Record<string, any>): boolean {
  return conditions.every(c => evaluateCondition(c, data));
}

// ── Action executor ───────────────────────────────────────────────────────────

async function executeAction(
  actionType:  WorkflowActionType,
  config:      Record<string, any>,
  workflow:    IWorkflow,
  triggerData: Record<string, any>,
  userId:      string,
): Promise<{ success: boolean; result?: any; error?: string }> {
  const companyId = workflow.companyId.toString();

  try {
    switch (actionType) {

      case 'create_task': {
        const task = await Task.create({
          companyId:   workflow.companyId,
          creatorId:   new mongoose.Types.ObjectId(userId),
          assigneeId:  config.assigneeId
            ? new mongoose.Types.ObjectId(config.assigneeId)
            : new mongoose.Types.ObjectId(userId),
          title:       config.title || `Workflow: ${workflow.name}`,
          description: config.description,
          priority:    config.priority || 'medium',
          status:      'todo',
          dueDate:     config.dueDays
            ? new Date(Date.now() + Number(config.dueDays) * 86400000)
            : undefined,
        });
        emitToCompany(companyId, 'task:created', { task });
        return { success: true, result: { taskId: task._id, title: task.title } };
      }

      case 'send_notification': {
        const note = await Notification.create({
          companyId:   workflow.companyId,
          userId:      config.recipientId
            ? new mongoose.Types.ObjectId(config.recipientId)
            : new mongoose.Types.ObjectId(userId),
          type:        'system',
          title:       config.title || workflow.name,
          body:        config.body || `Workflow "${workflow.name}" triggered.`,
          actionUrl:   config.actionUrl,
        });
        emitToCompany(companyId, 'notification:new', note);
        return { success: true, result: { notificationId: note._id } };
      }

      case 'send_channel_message': {
        if (!config.channelId) return { success: false, error: 'channelId required for send_channel_message' };
        const channel = await Channel.findOne({
          _id: config.channelId,
          companyId: workflow.companyId,
        });
        if (!channel) return { success: false, error: 'Channel not found' };

        const msg = await Message.create({
          companyId: workflow.companyId,
          channelId: channel._id,
          senderId:  new mongoose.Types.ObjectId(userId),
          content:   config.message || `Workflow "${workflow.name}" triggered.`,
          type:      'system',
        });
        const populatedMessage = await msg.populate([
          { path: 'senderId', select: 'fullName avatar status' },
          {
            path: 'parentId',
            select: 'content senderId createdAt attachments',
            populate: { path: 'senderId', select: 'fullName avatar' },
          },
        ]);
        emitToChannel(channel._id.toString(), 'message:new', populatedMessage);
        return { success: true, result: { messageId: msg._id } };
      }

      case 'ai_analysis': {
        if (!isGeminiConfigured()) {
          return { success: false, error: 'Gemini not configured' };
        }
        const limitCheck = await reserveAiRequest(userId);
        if (!limitCheck.allowed) {
          return { success: false, error: limitCheck.reason ?? 'AI limit reached' };
        }

        const prompt = config.prompt
          || `Analyze the following event data and provide a brief business insight:\n\n${JSON.stringify(triggerData, null, 2)}`;

        const genai = getGenAI();
        const resp  = await genai.models.generateContent({
          model:    GEMINI_MODEL,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const text = resp.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return { success: true, result: { analysis: text.slice(0, 2000) } };
      }

      case 'ai_summary': {
        if (!isGeminiConfigured()) {
          return { success: false, error: 'Gemini not configured' };
        }
        const limitCheck = await reserveAiRequest(userId);
        if (!limitCheck.allowed) {
          return { success: false, error: limitCheck.reason ?? 'AI limit reached' };
        }

        const summary = `Summarize: ${JSON.stringify(triggerData).slice(0, 2000)}`;
        const genai = getGenAI();
        const resp  = await genai.models.generateContent({
          model:    GEMINI_MODEL,
          contents: [{ role: 'user', parts: [{ text: summary }] }],
        });

        const text = resp.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return { success: true, result: { summary: text.slice(0, 2000) } };
      }

      default:
        return { success: false, error: `Unknown action type: ${actionType}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Action failed' };
  }
}

// ── Main trigger function (called by controllers after mutations) ─────────────

export async function triggerWorkflows(payload: WorkflowTriggerPayload): Promise<void> {
  try {
    const workflows = await Workflow.find({
      companyId: new mongoose.Types.ObjectId(payload.companyId),
      isEnabled: true,
      'trigger.type': payload.type,
    }).limit(10); // hard cap — no runaway loops

    for (const wf of workflows) {
      if (isRateLimited(wf._id.toString())) continue;

      // Evaluate conditions
      if (wf.conditions.length > 0 && !evaluateConditions(wf.conditions, payload.data)) {
        continue;
      }

      const actionsRun: IWorkflow['executions'][0]['actionsRun'] = [];
      let overallSuccess = true;

      for (const action of wf.actions) {
        const result = await executeAction(
          action.type as WorkflowActionType,
          action.config,
          wf,
          payload.data,
          payload.userId,
        );
        actionsRun.push({ type: action.type, ...result });
        if (!result.success) overallSuccess = false;
      }

      // Record execution
      wf.executions.push({
        triggeredAt: new Date(),
        triggerData: payload.data,
        success:     overallSuccess,
        actionsRun,
      });
      wf.lastRunAt = new Date();
      wf.runCount  = (wf.runCount ?? 0) + 1;
      if (!overallSuccess) wf.failCount = (wf.failCount ?? 0) + 1;

      await wf.save();

      // Emit real-time event so the UI can show execution results
      emitToCompany(payload.companyId, 'workflow:executed', {
        workflowId:   wf._id,
        workflowName: wf.name,
        success:      overallSuccess,
        actionsRun:   actionsRun.length,
      });
    }
  } catch (err) {
    // Workflow engine failures must never crash the calling controller
    console.error('[WorkflowEngine] Error:', err);
  }
}
