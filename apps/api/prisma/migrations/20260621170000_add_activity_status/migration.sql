-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('processing', 'completed', 'failed');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "status" "ActivityStatus" NOT NULL DEFAULT 'processing';
ALTER TABLE "Activity" ADD COLUMN "failureReason" TEXT;
