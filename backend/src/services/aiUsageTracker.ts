import mongoose from 'mongoose';
import AiUsage from '../models/AiUsage';

export interface AiUsageRecordInput {
  companyId: string;
  userId: string;
  feature: string;
  provider: 'local' | 'gemini' | 'openai' | 'cloudflare' | 'fallback';
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
  success?: boolean;
  errorMessage?: string;
  durationMs?: number;
  cached?: boolean;
}

export async function recordUsage(input: AiUsageRecordInput): Promise<void> {
  try {
    const companyOid = new mongoose.Types.ObjectId(input.companyId);
    const userOid = new mongoose.Types.ObjectId(input.userId);
    const doc = new AiUsage({
      companyId: companyOid,
      userId: userOid,
      feature: input.feature,
      provider: input.provider,
      modelName: input.modelName,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      success: input.success !== undefined ? input.success : true,
      errorMessage: input.errorMessage,
      durationMs: input.durationMs,
      cached: input.cached !== undefined ? input.cached : false,
    });
    await doc.save();
  } catch (e) {
    console.error('aiUsageTracker.recordUsage failed:', e);
  }
}

export async function getUsageForCompany(
  companyId: string,
  opts?: { from?: Date; to?: Date; feature?: string; provider?: string }
): Promise<Array<any>> {
  try {
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const match: any = { companyId: companyOid };
    if (opts?.from || opts?.to) {
      match.timestamp = {};
      if (opts.from) match.timestamp.$gte = opts.from;
      if (opts.to) match.timestamp.$lte = opts.to;
    }
    if (opts?.feature) match.feature = opts.feature;
    if (opts?.provider) match.provider = opts.provider;
    const result = await AiUsage.aggregate([
      { $match: match },
      { $sort: { timestamp: -1 } },
      { $limit: 500 },
    ]);
    return result;
  } catch (e) {
    console.error('aiUsageTracker.getUsageForCompany failed:', e);
    return [];
  }
}

export async function getUsageSummaryForCompany(
  companyId: string,
  from?: Date,
  to?: Date
): Promise<{
  total: number; byProvider: Record<string, number>; byFeature: Record<string, number>; successCount: number; errorCount: number; estimatedGeminiCostSavedByLocal: number; }> {
  try {
    const companyOid = new mongoose.Types.ObjectId(companyId);
    const match: any = { companyId: companyOid };
    if (from || to) {
      match.timestamp = {};
      if (from) match.timestamp.$gte = from;
      if (to) match.timestamp.$lte = to;
    }
    const result = await AiUsage.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] } },
          errorCount: { $sum: { $cond: [{ $eq: ['$success', true] }, 0, 1] } },
          byProvider: { $push: '$provider' },
          byFeature: { $push: '$feature' },
        },
      },
    ]);
    const byProvider: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    let total = 0;
    let successCount = 0;
    let errorCount = 0;
    let localCount = 0;
    if (result.length > 0) {
      const r = result[0];
      total = r.total;
      successCount = r.successCount;
      errorCount = r.errorCount;
      for (const p of r.byProvider) {
        byProvider[p] = (byProvider[p] || 0) + 1;
        if (p === 'local') localCount++;
      }
      for (const f of r.byFeature) {
        byFeature[f] = (byFeature[f] || 0) + 1;
      }
    }
    const estimatedGeminiCostSavedByLocal = localCount * 0.0012;
    return { total, byProvider, byFeature, successCount, errorCount, estimatedGeminiCostSavedByLocal };
  } catch (e) {
    console.error('aiUsageTracker.getUsageSummaryForCompany failed:', e);
    return { total: 0, byProvider: {}, byFeature: {}, successCount: 0, errorCount: 0, estimatedGeminiCostSavedByLocal: 0 };
  }
}

export async function getUsageSummaryForUser(
  userId: string,
  from?: Date,
  to?: Date
): Promise<{ total: number; byProvider: Record<string, number>; byFeature: Record<string, number>; successCount: number; errorCount: number; }> {
  try {
    const userOid = new mongoose.Types.ObjectId(userId);
    const match: any = { userId: userOid };
    if (from || to) {
      match.timestamp = {};
      if (from) match.timestamp.$gte = from;
      if (to) match.timestamp.$lte = to;
    }
    const result = await AiUsage.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] } },
          errorCount: { $sum: { $cond: [{ $eq: ['$success', true] }, 0, 1] } },
          byProvider: { $push: '$provider' },
          byFeature: { $push: '$feature' },
        },
      },
    ]);
    const byProvider: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    let total = 0;
    let successCount = 0;
    let errorCount = 0;
    if (result.length > 0) {
      const r = result[0];
      total = r.total;
      successCount = r.successCount;
      errorCount = r.errorCount;
      for (const p of r.byProvider) {
        byProvider[p] = (byProvider[p] || 0) + 1;
      }
      for (const f of r.byFeature) {
        byFeature[f] = (byFeature[f] || 0) + 1;
      }
    }
    return { total, byProvider, byFeature, successCount, errorCount };
  } catch (e) {
    console.error('aiUsageTracker.getUsageSummaryForUser failed:', e);
    return { total: 0, byProvider: {}, byFeature: {}, successCount: 0, errorCount: 0 };
  }
}

export async function getPlatformAiUsage(
  limitDays?: number
): Promise<{ total: number; byProvider: Record<string, number>; byFeature: Record<string, number>; perCompanyTop10: Array<{ companyId: string; count: number }>; totalErrors: number; }> {
  try {
    const match: any = {};
    if (limitDays && limitDays > 0) {
      const from = new Date();
      from.setDate(from.getDate() - limitDays);
      match.timestamp = { $gte: from };
    }
    const [summaryResult, topCompaniesResult] = await Promise.all([
      AiUsage.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalErrors: { $sum: { $cond: [{ $eq: ['$success', true] }, 0, 1] } },
            byProvider: { $push: '$provider' },
            byFeature: { $push: '$feature' },
          },
        },
      ]),
      AiUsage.aggregate([
        { $match: match },
        { $group: { _id: '$companyId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);
    const byProvider: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    let total = 0;
    let totalErrors = 0;
    if (summaryResult.length > 0) {
      const r = summaryResult[0];
      total = r.total;
      totalErrors = r.totalErrors;
      for (const p of r.byProvider) {
        byProvider[p] = (byProvider[p] || 0) + 1;
      }
      for (const f of r.byFeature) {
        byFeature[f] = (byFeature[f] || 0) + 1;
      }
    }
    const perCompanyTop10 = topCompaniesResult.map((c) => ({
      companyId: c._id.toString(),
      count: c.count,
    }));
    return { total, byProvider, byFeature, perCompanyTop10, totalErrors };
  } catch (e) {
    console.error('aiUsageTracker.getPlatformAiUsage failed:', e);
    return { total: 0, byProvider: {}, byFeature: {}, perCompanyTop10: [], totalErrors: 0 };
  }
}
