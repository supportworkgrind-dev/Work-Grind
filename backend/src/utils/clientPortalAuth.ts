import jwt from 'jsonwebtoken';

const CLIENT_JWT_SECRET = process.env.CLIENT_JWT_SECRET || `${process.env.JWT_SECRET}_client`;

export function issueClientToken(clientUserId: string, companyId: string): string {
  return jwt.sign(
    { clientUserId, companyId, type: 'client' },
    CLIENT_JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function verifyClientToken(token: string): {
  clientUserId: string;
  companyId: string;
  type: string;
} {
  return jwt.verify(token, CLIENT_JWT_SECRET) as {
    clientUserId: string;
    companyId: string;
    type: string;
  };
}
