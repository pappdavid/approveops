import { prisma } from "./db";

export interface ClerkUserInfo {
  id: string;
  email: string;
}

export async function upsertUserFromClerk(user: ClerkUserInfo) {
  return prisma.user.upsert({
    where: { clerkId: user.id },
    update: { email: user.email },
    create: { clerkId: user.id, email: user.email },
  });
}

