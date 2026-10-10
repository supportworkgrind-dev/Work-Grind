import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AcademicClass from '../models/AcademicClass';
import AcademicEnrollment from '../models/AcademicEnrollment';
import AcademicGuardianLink from '../models/AcademicGuardianLink';
import AcademicPerson from '../models/AcademicPerson';
import AcademicSchedule from '../models/AcademicSchedule';
import AcademicAssignment from '../models/AcademicAssignment';
import AcademicAssessment from '../models/AcademicAssessment';
import AcademicAttendance from '../models/AcademicAttendance';
import AcademicResult from '../models/AcademicResult';
import AcademicFeeCharge from '../models/AcademicFeeCharge';
import AcademicTeachingAssignment from '../models/AcademicTeachingAssignment';

export const getAcademicPortal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
    const person = await AcademicPerson.findOne({
      companyId,
      userId: new mongoose.Types.ObjectId(req.user!.userId),
      status: 'active',
    }).select('_id type firstName lastName email');
    if (!person) {
      res.status(404).json({ success: false, message: 'No active academic profile is linked to this account.' });
      return;
    }

    let studentIds: mongoose.Types.ObjectId[];
    let classIds: mongoose.Types.ObjectId[] = [];
    let teachingAssignments: Array<Record<string, unknown>> = [];
    let students: Array<Record<string, unknown>> = [];
    if (person.type === 'student') {
      studentIds = [person._id];
    } else if (person.type === 'parent') {
      const links = await AcademicGuardianLink.find({ companyId, guardianId: person._id }).select('studentId');
      studentIds = links.map((link) => link.studentId);
      students = await AcademicPerson.find({ _id: { $in: studentIds }, companyId, type: 'student', status: 'active' })
        .select('_id firstName lastName externalId')
        .lean();
    } else {
      const assignments = await AcademicTeachingAssignment.find({ companyId, teacherId: person._id })
        .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
        .lean();
      teachingAssignments = assignments.filter((assignment) => assignment.classId) as Array<Record<string, unknown>>;
      classIds = assignments
        .map((assignment) => assignment.classId)
        .filter((classItem): classItem is mongoose.Types.ObjectId => !!classItem)
        .map((classItem) => (classItem as unknown as { _id: mongoose.Types.ObjectId })._id);
      const classEnrollments = classIds.length
        ? await AcademicEnrollment.find({ companyId, classId: { $in: classIds }, status: 'active' }).select('studentId')
        : [];
      studentIds = classEnrollments.map((enrollment) => enrollment.studentId);
      students = studentIds.length
        ? await AcademicPerson.find({ _id: { $in: studentIds }, companyId, type: 'student', status: 'active' })
            .select('_id firstName lastName externalId')
            .lean()
        : [];
    }

    const enrollmentFilter = person.type === 'teacher'
      ? { companyId, classId: { $in: classIds }, status: 'active' as const }
      : { companyId, studentId: { $in: studentIds }, status: 'active' as const };
    const enrollments = await AcademicEnrollment.find(enrollmentFilter)
      .populate({
        path: 'classId',
        match: { companyId },
        select: 'name academicYear departmentId courseIds',
        populate: { path: 'departmentId', match: { companyId }, select: 'name code' },
      })
      .lean();
    if (person.type !== 'teacher') {
      classIds = enrollments
        .map((enrollment) => enrollment.classId)
        .filter((classItem): classItem is mongoose.Types.ObjectId => !!classItem)
        .map((classItem) => (classItem as unknown as { _id: mongoose.Types.ObjectId })._id);
    }
    const [schedules, assignments, assessments, attendance, results, feeCharges] = await Promise.all([
      classIds.length
        ? AcademicSchedule.find({ companyId, classId: { $in: classIds } })
            .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
            .populate({ path: 'courseId', match: { companyId }, select: 'name code' })
            .lean()
        : [],
      classIds.length
        ? AcademicAssignment.find({ companyId, classId: { $in: classIds } })
            .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
            .populate({ path: 'courseId', match: { companyId }, select: 'name code' })
            .lean()
        : [],
      classIds.length
        ? AcademicAssessment.find({ companyId, classId: { $in: classIds } })
            .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
            .populate({ path: 'courseId', match: { companyId }, select: 'name code' })
            .lean()
        : [],
      studentIds.length
        ? AcademicAttendance.find({ companyId, studentId: { $in: studentIds } })
            .sort({ date: -1 })
            .limit(100)
            .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
            .lean()
        : [],
      studentIds.length
        ? AcademicResult.find({ companyId, studentId: { $in: studentIds } })
            .sort({ gradedAt: -1 })
            .limit(100)
            .populate({ path: 'assessmentId', match: { companyId }, select: 'title type pointsPossible classId' })
            .populate({ path: 'studentId', match: { companyId, type: 'student' }, select: 'firstName lastName' })
            .lean()
        : [],
      person.type !== 'teacher' && studentIds.length
        ? AcademicFeeCharge.find({ companyId, studentId: { $in: studentIds }, isVoided: false })
            .sort({ dueAt: 1 })
            .limit(100)
            .select('invoiceNumber description amountMinor paidAmountMinor currency dueAt isVoided studentId')
            .lean()
        : [],
    ]);
    if (person.type === 'student') {
      students = [{ _id: person._id, firstName: person.firstName, lastName: person.lastName, externalId: undefined }];
    }

    res.json({
      success: true,
      profile: person,
      students,
      teachingAssignments,
      enrollments: enrollments.filter((enrollment) => enrollment.classId),
      schedules: schedules.filter((schedule) => schedule.classId),
      assignments: assignments.filter((assignment) => assignment.classId),
      assessments: assessments.filter((assessment) => assessment.classId),
      attendance: attendance.filter((entry) => entry.classId),
      results: results.filter((result) => result.assessmentId && result.studentId),
      feeCharges: feeCharges.map((charge) => ({
        _id: charge._id,
        studentId: charge.studentId,
        invoiceNumber: charge.invoiceNumber,
        description: charge.description,
        amountMinor: charge.amountMinor,
        paidAmountMinor: charge.paidAmountMinor,
        currency: charge.currency,
        dueAt: charge.dueAt,
      })),
    });
  } catch (error) {
    console.error('[Academic] Portal lookup failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'Unable to load the academic portal.' });
  }
};
