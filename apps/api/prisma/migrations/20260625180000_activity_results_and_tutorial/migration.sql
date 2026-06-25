-- Idempotent: columns may already exist if a prior deploy attempt partially applied schema.
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "cellsCaptured" INTEGER;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "cellsTouched" INTEGER;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "newCellsCaptured" INTEGER;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "pvpCaptures" INTEGER;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "influenceAdded" DOUBLE PRECISION;

ALTER TABLE "UserStats" ADD COLUMN IF NOT EXISTS "gameTutorialShownAt" TIMESTAMP(3);
