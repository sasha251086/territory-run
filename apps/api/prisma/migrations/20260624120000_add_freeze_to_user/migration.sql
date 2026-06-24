-- AlterTable
ALTER TABLE "User" ADD COLUMN "freezeActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "freezeActivatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "freezeLastUsedAt" TIMESTAMP(3);
