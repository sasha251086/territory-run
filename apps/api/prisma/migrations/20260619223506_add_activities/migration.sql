-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "processedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ActivityTrack" (
    "activityId" TEXT NOT NULL,
    "route" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityTrack_pkey" PRIMARY KEY ("activityId")
);

-- AddForeignKey
ALTER TABLE "ActivityTrack" ADD CONSTRAINT "ActivityTrack_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
