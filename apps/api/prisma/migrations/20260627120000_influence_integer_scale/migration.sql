-- Integer influence scale (×100) + activity lifespan field
-- Run once on existing databases with old 0–100 influence values.

UPDATE "CellOwnership"
SET influence = ROUND(influence * 100)
WHERE influence > 0 AND influence <= 150;

UPDATE "UserStats"
SET "totalInfluence" = ROUND("totalInfluence" * 100)
WHERE "totalInfluence" > 0 AND "totalInfluence" <= 15000;

UPDATE "UserStats"
SET "seasonInfluence" = ROUND("seasonInfluence" * 100)
WHERE "seasonInfluence" > 0 AND "seasonInfluence" <= 15000;

UPDATE "Activity"
SET "influenceAdded" = ROUND("influenceAdded" * 100)
WHERE "influenceAdded" IS NOT NULL AND "influenceAdded" > 0 AND "influenceAdded" <= 1500;

ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "cellsStillAtRisk" INTEGER;
