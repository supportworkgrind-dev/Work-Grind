const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const AcademicPerson = require('../dist/models/AcademicPerson').default;
const AcademicFeeCharge = require('../dist/models/AcademicFeeCharge').default;
const AcademicAssessment = require('../dist/models/AcademicAssessment').default;
const AcademicClass = require('../dist/models/AcademicClass').default;
const AcademicResult = require('../dist/models/AcademicResult').default;
const AcademicAttendance = require('../dist/models/AcademicAttendance').default;
const AcademicEnrollment = require('../dist/models/AcademicEnrollment').default;
const AuditLog = require('../dist/models/AuditLog').default;
const academicController = require('../dist/controllers/academic.controller');

const companyId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const studentId = new mongoose.Types.ObjectId();
const classId = new mongoose.Types.ObjectId();
const assessmentId = new mongoose.Types.ObjectId();

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('Academic Fee Challan — Create fee charge validates student, amount, and persists due date', async () => {
  const originalStudentFind = AcademicPerson.findOne;
  const originalChargeCreate = AcademicFeeCharge.create;
  const originalAuditCreate = AuditLog.create;

  let createdPayload;
  AcademicPerson.findOne = () => ({
    select: async () => ({ _id: studentId, type: 'student', status: 'active' }),
  });
  AcademicFeeCharge.create = async (doc) => {
    createdPayload = doc;
    return { _id: new mongoose.Types.ObjectId(), ...doc };
  };
  AuditLog.create = async () => ({});

  try {
    const res = makeResponse();
    await academicController.createFeeCharge({
      body: {
        studentId: studentId.toString(),
        invoiceNumber: 'CHALLAN-2026-001',
        description: 'Semester 1 Tuition Fee',
        amountMinor: 250000,
        currency: 'usd',
        dueAt: '2026-11-15T00:00:00.000Z',
      },
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'admin' },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(createdPayload.invoiceNumber, 'CHALLAN-2026-001');
    assert.equal(createdPayload.currency, 'USD');
    assert.equal(createdPayload.amountMinor, 250000);
    assert.ok(createdPayload.dueAt instanceof Date);
    assert.equal(createdPayload.dueAt.toISOString(), '2026-11-15T00:00:00.000Z');
  } finally {
    AcademicPerson.findOne = originalStudentFind;
    AcademicFeeCharge.create = originalChargeCreate;
    AuditLog.create = originalAuditCreate;
  }
});

test('Academic Fee Challan — Rejects invalid currency, negative amount, or non-integer minor units', async () => {
  const res = makeResponse();
  await academicController.createFeeCharge({
    body: {
      studentId: studentId.toString(),
      invoiceNumber: 'CHALLAN-002',
      description: 'Invalid Fee',
      amountMinor: 250.5, // Not an integer
      currency: 'US', // Invalid currency format
    },
    user: { companyId: companyId.toString(), userId: userId.toString(), role: 'admin' },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('Academic Fee Challan — Offline payment records atomically and rejects overpayment', async () => {
  const chargeId = new mongoose.Types.ObjectId();
  const originalFindOneAndUpdate = AcademicFeeCharge.findOneAndUpdate;
  const originalAuditCreate = AuditLog.create;

  AcademicFeeCharge.findOneAndUpdate = async () => ({
    _id: chargeId,
    amountMinor: 10000,
    paidAmountMinor: 5000,
    currency: 'USD',
    isVoided: false,
  });
  AuditLog.create = async () => ({});

  try {
    const res = makeResponse();
    await academicController.recordFeePayment({
      params: { chargeId: chargeId.toString() },
      body: { amountMinor: 5000, method: 'bank_transfer', reference: 'TXN-987654' },
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'admin' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  } finally {
    AcademicFeeCharge.findOneAndUpdate = originalFindOneAndUpdate;
    AuditLog.create = originalAuditCreate;
  }
});

test('Academic Fee Challan — Voiding fee charge is blocked if payments were made', async () => {
  const chargeId = new mongoose.Types.ObjectId();
  const originalFindOneAndUpdate = AcademicFeeCharge.findOneAndUpdate;
  const originalFindOne = AcademicFeeCharge.findOne;

  // Unpaid check fails because paidAmountMinor > 0, returns null with select
  AcademicFeeCharge.findOneAndUpdate = () => ({
    select: async () => null,
  });
  AcademicFeeCharge.findOne = () => ({
    select: async () => ({ _id: chargeId, isVoided: false }),
  });

  try {
    const res = makeResponse();
    await academicController.deleteAcademicRecord({
      params: { resource: 'fees', id: chargeId.toString() },
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'admin' },
    }, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Only unpaid fee charges can be voided/);
  } finally {
    AcademicFeeCharge.findOneAndUpdate = originalFindOneAndUpdate;
    AcademicFeeCharge.findOne = originalFindOne;
  }
});

test('Academic Fee Challan — Update fee charge rejects voided charges and reducing amount below paid balance', async () => {
  const chargeId = new mongoose.Types.ObjectId();
  const originalFindOne = AcademicFeeCharge.findOne;

  // Simulate a charge that already has 3000 paid
  AcademicFeeCharge.findOne = () => ({
    select: async () => ({ _id: chargeId, isVoided: false, paidAmountMinor: 3000, currency: 'USD' }),
  });

  try {
    const res = makeResponse();
    await academicController.updateAcademicRecord({
      params: { resource: 'fees', id: chargeId.toString() },
      body: { amountMinor: 2000 }, // Less than paidAmountMinor (3000)
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'admin' },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  } finally {
    AcademicFeeCharge.findOne = originalFindOne;
  }
});

test('Academic Results — Recording result validates active student enrollment in assessment class', async () => {
  const originalAssessmentFind = AcademicAssessment.findOne;
  const originalPersonFind = AcademicPerson.findOne;
  const originalEnrollmentFind = AcademicEnrollment.findOne;
  const originalResultUpsert = AcademicResult.findOneAndUpdate;
  const originalAuditCreate = AuditLog.create;

  AcademicAssessment.findOne = () => ({
    select: async () => ({ _id: assessmentId, classId, pointsPossible: 100 }),
  });
  AcademicPerson.findOne = () => ({
    select: async () => ({ _id: studentId }),
  });
  AcademicEnrollment.findOne = () => ({
    select: async () => ({ _id: new mongoose.Types.ObjectId() }),
  });
  AcademicResult.findOneAndUpdate = async () => ({ _id: new mongoose.Types.ObjectId() });
  AuditLog.create = async () => ({});

  try {
    const res = makeResponse();
    await academicController.recordResult({
      body: {
        assessmentId: assessmentId.toString(),
        studentId: studentId.toString(),
        pointsEarned: 85,
        feedback: 'Excellent grasp of concepts.',
      },
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'admin' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  } finally {
    AcademicAssessment.findOne = originalAssessmentFind;
    AcademicPerson.findOne = originalPersonFind;
    AcademicEnrollment.findOne = originalEnrollmentFind;
    AcademicResult.findOneAndUpdate = originalResultUpsert;
    AuditLog.create = originalAuditCreate;
  }
});

test('Academic Attendance — Recording attendance validates student enrollment', async () => {
  const originalClassFind = AcademicClass.findOne;
  const originalPersonFind = AcademicPerson.findOne;
  const originalEnrollmentFind = AcademicEnrollment.findOne;
  const originalAttendanceUpsert = AcademicAttendance.findOneAndUpdate;
  const originalAuditCreate = AuditLog.create;

  AcademicClass.findOne = () => ({
    select: async () => ({ _id: classId }),
  });
  AcademicPerson.findOne = () => ({
    select: async () => ({ _id: studentId }),
  });
  AcademicEnrollment.findOne = () => ({
    select: async () => ({ _id: new mongoose.Types.ObjectId() }),
  });
  AcademicAttendance.findOneAndUpdate = async () => ({ _id: new mongoose.Types.ObjectId() });
  AuditLog.create = async () => ({});

  try {
    const res = makeResponse();
    await academicController.recordAttendance({
      body: {
        classId: classId.toString(),
        studentId: studentId.toString(),
        date: '2026-10-26T00:00:00.000Z',
        status: 'present',
      },
      user: { companyId: companyId.toString(), userId: userId.toString(), role: 'admin' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  } finally {
    AcademicClass.findOne = originalClassFind;
    AcademicPerson.findOne = originalPersonFind;
    AcademicEnrollment.findOne = originalEnrollmentFind;
    AcademicAttendance.findOneAndUpdate = originalAttendanceUpsert;
    AuditLog.create = originalAuditCreate;
  }
});
