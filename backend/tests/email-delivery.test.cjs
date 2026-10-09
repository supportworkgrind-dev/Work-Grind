const assert = require('node:assert/strict');
const test = require('node:test');
const nodemailer = require('nodemailer');
const email = require('../dist/utils/email');

const originalCreateTransport = nodemailer.createTransport;
const savedEnv = {};
const mailEnvKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_USER', 'EMAIL_PASS', 'FROM_EMAIL', 'FROM_NAME'];

function setMailEnv() {
  Object.assign(process.env, {
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_USER: 'sender@example.test',
    SMTP_PASS: 'not-a-real-password',
    FROM_EMAIL: 'sender@example.test',
    FROM_NAME: 'WorkGrind',
  });
}

function makeTransport(sendMail) {
  return {
    sendMail,
    close() {},
  };
}

function captureLogs() {
  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args.map(String).join(' '));
  return {
    lines,
    restore() { console.error = original; },
  };
}

test.before(() => {
  for (const key of mailEnvKeys) savedEnv[key] = process.env[key];
});

test.afterEach(() => {
  email.closeEmailTransporter();
  nodemailer.createTransport = originalCreateTransport;
  for (const key of mailEnvKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

test('SMTP setup requires real credentials and does not create a test or JSON transport', () => {
  assert.throws(
    () => email.createSmtpTransporter({}),
    (error) => error.name === 'EmailProviderConfigurationError' &&
      error.missingVariables.includes('SMTP_HOST') &&
      error.missingVariables.includes('SMTP_PORT'),
  );
});

test('SMTP config uses STARTTLS on 587 and implicit TLS on 465', () => {
  const transports = [];
  nodemailer.createTransport = (options) => {
    transports.push(options);
    return makeTransport(async () => ({ accepted: ['sender@example.test'] }));
  };
  const config = {
    SMTP_HOST: 'smtp.example.test',
    SMTP_USER: 'sender@example.test',
    SMTP_PASS: 'not-a-real-password',
    FROM_EMAIL: 'sender@example.test',
  };
  email.createSmtpTransporter({ ...config, SMTP_PORT: '587' });
  email.createSmtpTransporter({ ...config, SMTP_PORT: '465' });
  assert.equal(transports[0].secure, false);
  assert.equal(transports[0].requireTLS, true);
  assert.equal(transports[1].secure, true);
  assert.equal(transports[1].requireTLS, false);
});

test('verification email succeeds only after SMTP accepts the recipient', async () => {
  setMailEnv();
  let sentMessage;
  nodemailer.createTransport = () => makeTransport(async (message) => {
    sentMessage = message;
    return { accepted: ['person@example.test'], rejected: [], messageId: 'smtp-message-1' };
  });
  const result = await email.sendVerificationCodeEmail('person@example.test', 'Test User', '123456');
  assert.deepEqual(result, { success: true, messageId: 'smtp-message-1' });
  assert.equal(sentMessage.to, 'person@example.test');
  assert.match(sentMessage.html, /123456/);
});

test('rejected recipient is a delivery failure, not a success result', async () => {
  setMailEnv();
  nodemailer.createTransport = () => makeTransport(async () => ({
    accepted: [],
    rejected: ['person@example.test'],
    messageId: 'rejected-message',
  }));
  const result = await email.sendVerificationCodeEmail('person@example.test', 'Test User', '123456');
  assert.equal(result.success, false);
  assert.equal(result.messageId, undefined);
});

test('SMTP authentication errors are safely logged without credentials or recipient data', async () => {
  setMailEnv();
  const secretMarker = 'private-smtp-password-marker';
  process.env.SMTP_PASS = secretMarker;
  nodemailer.createTransport = () => makeTransport(async () => {
    const error = new Error(`Invalid login ${secretMarker}`);
    error.code = 'EAUTH';
    error.responseCode = 535;
    error.command = 'AUTH PLAIN';
    throw error;
  });
  const captured = captureLogs();
  try {
    const result = await email.sendVerificationCodeEmail('private-recipient@example.test', 'Test User', '987654');
    assert.equal(result.success, false);
    const logs = captured.lines.join('\n');
    assert.match(logs, /EAUTH/);
    assert.match(logs, /535/);
    assert.doesNotMatch(logs, new RegExp(secretMarker));
    assert.doesNotMatch(logs, /private-recipient@example\.test/);
    assert.doesNotMatch(logs, /987654/);
  } finally {
    captured.restore();
  }
});
