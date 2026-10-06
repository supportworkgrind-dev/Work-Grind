/**
 * Workflow Automation Controller
 * SECURITY: companyId always from req.user — never from body or params.
 */

import { Response } from 'express';
import mongoose from 'mongoose';
import Workflow from '../models/Workflow';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';

function requireOwnerAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

// GET /api/workflows
export const getWorkflows = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workflows = await Workflow.find({ companyId: req.user!.companyId })
      .populate('creatorId', 'fullName avatar')
      .sort({ updatedAt: -1 })
      .select('-executions') // don't send full execution history in list
      .lean();

    res.json({ success: true, workflows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/workflows/:id
export const getWorkflow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wf = await Workflow.findOne({ _id: req.params.id, companyId: req.user!.companyId })
      .populate('creatorId', 'fullName avatar')
      .lean();

    if (!wf) { res.status(404).json({ success: false, message: 'Workflow not found' }); return; }
    res.json({ success: true, workflow: wf });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/workflows
export const createWorkflow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireOwnerAdmin(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Manager or higher role required' });
      return;
    }

    const { name, description, trigger, conditions = [], actions = [] } = req.body;
    if (!name?.trim()) { res.status(400).json({ success: false, message: 'Name required' }); return; }
    if (!trigger?.type) { res.status(400).json({ success: false, message: 'Trigger type required' }); return; }
    if (!Array.isArray(actions) || actions.length === 0) {
      res.status(400).json({ success: false, message: 'At least one action required' });
      return;
    }

    // Validate action count
    if (actions.length > 10) {
      res.status(400).json({ success: false, message: 'Maximum 10 actions per workflow' });
      return;
    }

    const wf = await Workflow.create({
      companyId:   new mongoose.Types.ObjectId(req.user!.companyId),
      creatorId:   new mongoose.Types.ObjectId(req.user!.userId),
      name:        name.trim(),
      description: description?.trim(),
      isEnabled:   true,
      trigger,
      conditions,
      actions,
    });

    await AuditLog.create({
      companyId:  new mongoose.Types.ObjectId(req.user!.companyId),
      userId:     new mongoose.Types.ObjectId(req.user!.userId),
      action:     'WORKFLOW_CREATED',
      resource:   'Workflow',
      resourceId: wf._id.toString(),
      details:    { name: wf.name, triggerType: wf.trigger.type },
    });

    res.status(201).json({ success: true, workflow: wf });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/workflows/:id
export const updateWorkflow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireOwnerAdmin(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Manager or higher role required' });
      return;
    }

    const wf = await Workflow.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!wf) { res.status(404).json({ success: false, message: 'Workflow not found' }); return; }

    const ALLOWED = ['name','description','isEnabled','trigger','conditions','actions'];
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) (wf as any)[key] = req.body[key];
    }

    await wf.save();
    res.json({ success: true, workflow: wf });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/workflows/:id
export const deleteWorkflow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireOwnerAdmin(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Manager or higher role required' });
      return;
    }

    const wf = await Workflow.findOneAndDelete({ _id: req.params.id, companyId: req.user!.companyId });
    if (!wf) { res.status(404).json({ success: false, message: 'Workflow not found' }); return; }

    await AuditLog.create({
      companyId:  new mongoose.Types.ObjectId(req.user!.companyId),
      userId:     new mongoose.Types.ObjectId(req.user!.userId),
      action:     'WORKFLOW_DELETED',
      resource:   'Workflow',
      resourceId: req.params.id,
      details:    { name: wf.name },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/workflows/:id/executions
export const getWorkflowExecutions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wf = await Workflow.findOne({ _id: req.params.id, companyId: req.user!.companyId })
      .select('name executions lastRunAt runCount failCount')
      .lean();

    if (!wf) { res.status(404).json({ success: false, message: 'Workflow not found' }); return; }

    // Return most recent executions first
    const executions = [...(wf as any).executions].reverse().slice(0, 50);
    res.json({ success: true, executions, runCount: (wf as any).runCount, failCount: (wf as any).failCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/workflows/:id/test — manually trigger for testing
export const testWorkflow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireOwnerAdmin(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Manager or higher role required' });
      return;
    }

    const wf = await Workflow.findOne({ _id: req.params.id, companyId: req.user!.companyId });
    if (!wf) { res.status(404).json({ success: false, message: 'Workflow not found' }); return; }

    const { triggerWorkflows } = await import('../services/workflowEngine');
    await triggerWorkflows({
      type:      wf.trigger.type,
      companyId: req.user!.companyId,
      userId:    req.user!.userId,
      data:      req.body.testData ?? { test: true },
    });

    res.json({ success: true, message: 'Test trigger sent' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
