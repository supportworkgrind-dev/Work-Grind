import { Response } from 'express';
import mongoose from 'mongoose';
import Document from '../models/Document';
import Project from '../models/Project';
import { AuthRequest } from '../middleware/auth';

async function validateDocumentProjectId(value: unknown, req: AuthRequest): Promise<{ id?: mongoose.Types.ObjectId; error?: string }> {
  if (value == null || value === '') return {};
  if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) return { error: 'Invalid project id.' };
  const filter: Record<string, any> = { _id: value, companyId: req.user!.companyId, isArchived: false };
  if (req.user!.role === 'employee') {
    filter.$or = [
      { 'members.userId': req.user!.userId },
      { assigneeId: req.user!.userId },
      { managerId: req.user!.userId },
    ];
  }
  const project = await Project.exists(filter);
  return project ? { id: new mongoose.Types.ObjectId(value) } : { error: 'Project not found or access denied.' };
}

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, projectId, search } = req.query;
    const filter: any = { companyId: req.user!.companyId, isArchived: false };

    if (type) filter.type = type;
    if (projectId) filter.projectId = projectId;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const documents = await Document.find(filter)
      .populate('creatorId', 'fullName avatar email')
      .populate('lastEditedBy', 'fullName avatar email')
      .populate({ path: 'projectId', select: 'name color crmCompanyId', populate: { path: 'crmCompanyId', select: 'name' } })
      .sort({ updatedAt: -1 });

    res.json({ success: true, documents });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, type, projectId, icon } = req.body;
    if (!title) {
      res.status(400).json({ success: false, message: 'Document title is required' });
      return;
    }

    const linkedProject = await validateDocumentProjectId(projectId, req);
    if (linkedProject.error) {
      res.status(400).json({ success: false, message: linkedProject.error });
      return;
    }

    const doc = await Document.create({
      companyId: req.user!.companyId,
      creatorId: req.user!.userId,
      lastEditedBy: req.user!.userId,
      title,
      content: content || '',
      type: type || 'document',
      projectId: linkedProject.id ?? null,
      icon: icon || '📝',
      versionHistory: [
        {
          version: 1,
          content: content || '',
          editedBy: req.user!.userId,
          editedAt: new Date(),
        },
      ],
    });

    const populated = await doc.populate([
      { path: 'creatorId', select: 'fullName avatar email' },
      { path: 'projectId', select: 'name color crmCompanyId', populate: { path: 'crmCompanyId', select: 'name' } },
    ]);
    res.status(201).json({ success: true, document: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDocumentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
    })
      .populate('creatorId', 'fullName avatar email')
      .populate('lastEditedBy', 'fullName avatar email')
      .populate('comments.userId', 'fullName avatar')
      .populate({ path: 'projectId', select: 'name color crmCompanyId', populate: { path: 'crmCompanyId', select: 'name' } });

    if (!doc) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    res.json({ success: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      companyId: req.user!.companyId,
    });

    if (!doc) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    const { title, content, type, icon, isPublic, projectId } = req.body;

    if (title !== undefined) doc.title = title;
    if (type !== undefined) doc.type = type;
    if (icon !== undefined) doc.icon = icon;
    if (isPublic !== undefined) doc.isPublic = isPublic;
    if (projectId !== undefined) {
      const linkedProject = await validateDocumentProjectId(projectId, req);
      if (linkedProject.error) {
        res.status(400).json({ success: false, message: linkedProject.error });
        return;
      }
      doc.projectId = linkedProject.id ?? undefined;
    }

    if (content !== undefined && content !== doc.content) {
      doc.content = content;
      const nextVersion = (doc.versionHistory?.length || 0) + 1;
      doc.versionHistory.push({
        version: nextVersion,
        content,
        editedBy: req.user!.userId as any,
        editedAt: new Date(),
      });
    }

    doc.lastEditedBy = req.user!.userId as any;
    await doc.save();

    const populated = await doc.populate([
      { path: 'creatorId', select: 'fullName avatar email' },
      { path: 'lastEditedBy', select: 'fullName avatar email' },
      { path: 'projectId', select: 'name color crmCompanyId', populate: { path: 'crmCompanyId', select: 'name' } },
    ]);

    res.json({ success: true, document: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      { isArchived: true },
      { new: true }
    );

    if (!doc) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    res.json({ success: true, message: 'Document archived' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addDocumentComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content, selection } = req.body;
    if (!content) {
      res.status(400).json({ success: false, message: 'Comment content is required' });
      return;
    }

    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user!.companyId },
      {
        $push: {
          comments: {
            userId: req.user!.userId,
            content,
            selection: selection || '',
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate('comments.userId', 'fullName avatar');

    res.json({ success: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
