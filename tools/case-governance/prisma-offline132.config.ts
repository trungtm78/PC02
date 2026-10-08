// Offline schema validation/generation only; no dotenv import or DB connection.
export default {
  schema: '../../backend/prisma/schema.prisma',
  migrations: { path: '../../backend/prisma/migrations' },
  datasource: { url: 'postgresql://synthetic:synthetic@127.0.0.1:55441/pc02_case_governance_uat' },
};
