import { prisma } from './db';

export type EconomicSessionStatus = {
  connected: boolean;
  expired: boolean;
  expiresAt: string | null;
};

export async function getEconomicSessionStatus(userId: string): Promise<EconomicSessionStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      economicOpenaiSessionEncrypted: true,
      economicOpenaiExpiresAt: true,
    },
  });

  const expiresAt = user?.economicOpenaiExpiresAt ?? null;
  const connected = !!user?.economicOpenaiSessionEncrypted;
  const expired = !!expiresAt && expiresAt.getTime() <= Date.now();

  return {
    connected: connected && !expired,
    expired,
    expiresAt: expiresAt?.toISOString() ?? null,
  };
}
