import { prisma } from '../db.js';
import type {
  AnthropometryCreate,
  LabTestCreate,
  MoodLogCreate,
  TrainingLogCreate,
} from './schemas.js';

/**
 * scr-import-health: создание + чтение записей здоровья (4 вида, append-only).
 * Дата по умолчанию = now() при отсутствии. Decimal-поля принимают number (Prisma конвертит).
 */

export async function createAnthropometry(input: AnthropometryCreate) {
  const { measuredAt, ...rest } = input;
  return prisma.anthropometry.create({ data: { ...rest, measuredAt: measuredAt ?? new Date() } });
}
export async function listAnthropometry(userId: string, limit = 50) {
  return prisma.anthropometry.findMany({
    where: { userId },
    orderBy: { measuredAt: 'desc' },
    take: limit,
  });
}

export async function createLabTest(input: LabTestCreate) {
  const { measuredAt, ...rest } = input;
  return prisma.labTest.create({ data: { ...rest, measuredAt: measuredAt ?? new Date() } });
}
export async function listLabTests(userId: string, limit = 50) {
  return prisma.labTest.findMany({
    where: { userId },
    orderBy: { measuredAt: 'desc' },
    take: limit,
  });
}

export async function createTrainingLog(input: TrainingLogCreate) {
  const { performedAt, ...rest } = input;
  return prisma.trainingLog.create({ data: { ...rest, performedAt: performedAt ?? new Date() } });
}
export async function listTrainingLogs(userId: string, limit = 50) {
  return prisma.trainingLog.findMany({
    where: { userId },
    orderBy: { performedAt: 'desc' },
    take: limit,
  });
}

export async function createMoodLog(input: MoodLogCreate) {
  const { loggedAt, ...rest } = input;
  return prisma.moodLog.create({ data: { ...rest, loggedAt: loggedAt ?? new Date() } });
}
export async function listMoodLogs(userId: string, limit = 50) {
  return prisma.moodLog.findMany({
    where: { userId },
    orderBy: { loggedAt: 'desc' },
    take: limit,
  });
}
