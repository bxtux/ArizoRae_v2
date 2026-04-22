import * as PrismaPkg from '@prisma/client';

const PrismaClient = PrismaPkg.PrismaClient;
type PrismaClientInstance = InstanceType<typeof PrismaPkg.PrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientInstance };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
