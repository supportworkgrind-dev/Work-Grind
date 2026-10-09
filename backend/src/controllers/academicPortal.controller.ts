import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AcademicClass from '../models/AcademicClass';
import AcademicEnrollment from '../models/AcademicEnrollment';
import AcademicGuardianLink from '../models/AcademicGuardianLink';
import AcademicPerson from '../models/AcademicPerson';
import AcademicSchedule from '../models/AcademicSchedule';
import AcademicAssignment from '../models/AcademicAssignment';
import AcademicAttendance from '../models/AcademicAttendance';

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
    if (person.type === 'student') {
      studentIds = [person._id];
    } else if (person.type === 'parent') {
      const links = await AcademicGuardianLink.find({ companyId, guardianId: person._id }).select('studentId');
      studentIds = links.map((link) => link.studentId);
    } else {
      res.status(403).json({ success: false, message: 'The teacher portal is not available until teaching assignments are configured.' });
      return;
    }

    const [students, enrollments] = await Promise.all([
      person.type === 'parent'
        ? AcademicPerson.find({ _id: { $in: studentIds }, companyId, type: 'student', status: 'active' })
            .select('_id firstName lastName externalId')
            .lean()
        : Promise.resolve([{ _id: person._id, firstName: person.firstName, lastName: person.lastName, externalId: undefined }]),
      AcademicEnrollment.find({ companyId, studentId: { $in: studentIds }, status: 'active' })
        .populate({
          path: 'classId',
          match: { companyId },
          select: 'name academicYear departmentId courseIds',
          populate: { path: 'departmentId', match: { companyId }, select: 'name code' },
        })
        .lean(),
    ]);

    const classIds = enrollments
      .map((enrollment) => enrollment.classId)
      .filter((classItem): classItem is mongoose.Types.ObjectId => !!classItem)
      .map((classItem) => classItem._id);
    const [schedules, assignments, attendance] = classIds.length
      ? await Promise.all([
          AcademicSchedule.find({ companyId, classId: { $in: classIds } })
            .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
            .populate({ path: 'courseId', match: { companyId }, select: 'name code' })
            .lean(),
          AcademicAssignment.find({ companyId, classId: { $in: classIds } })
            .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
            .populate({ path: 'courseId', match: { companyId }, select: 'name code' })
            .lean(),
          AcademicAttendance.find({ companyId, studentId: { $in: studentIds } })
            .sort({ date: -1 })
            .limit(100)
            .populate({ path: 'classId', match: { companyId }, select: 'name academicYear' })
            .lean(),
        ])
      : [[], [], []];

    res.json({
      success: true,
      profile: person,
      students,
      enrollments: enrollments.filter((enrollment) => enrollment.classId),
      schedules: schedules.filter((schedule) => schedule.classId),
      assignments: assignments.filter((assignment) => assignment.classId),
      attendance: attendance.filter((entry) => entry.classId),
    });
  } catch (error) {
    console.error('[Academic] Portal lookup failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    res.status(500).json({ success: false, message: 'Unable to load the academic portal.' });
  }
};
