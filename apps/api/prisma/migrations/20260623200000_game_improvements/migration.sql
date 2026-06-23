-- Streaks
ALTER TABLE "UserStats" ADD COLUMN IF NOT EXISTS "currentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserStats" ADD COLUMN IF NOT EXISTS "lastRunDate" TIMESTAMP(3);

-- Rivals (max enforced in app)
CREATE TABLE IF NOT EXISTS "RivalFollow" (
    "followerId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RivalFollow_pkey" PRIMARY KEY ("followerId","targetUserId")
);

ALTER TABLE "RivalFollow" DROP CONSTRAINT IF EXISTS "RivalFollow_followerId_fkey";
ALTER TABLE "RivalFollow" ADD CONSTRAINT "RivalFollow_followerId_fkey"
  FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RivalFollow" DROP CONSTRAINT IF EXISTS "RivalFollow_targetUserId_fkey";
ALTER TABLE "RivalFollow" ADD CONSTRAINT "RivalFollow_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "RivalFollow_followerId_idx" ON "RivalFollow"("followerId");

-- Cell ownership history
CREATE TABLE IF NOT EXISTS "CellHistory" (
    "id" TEXT NOT NULL,
    "h3Index" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CellHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CellHistory" DROP CONSTRAINT IF EXISTS "CellHistory_h3Index_fkey";
ALTER TABLE "CellHistory" ADD CONSTRAINT "CellHistory_h3Index_fkey"
  FOREIGN KEY ("h3Index") REFERENCES "Cell"("h3Index") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CellHistory_h3Index_changedAt_idx" ON "CellHistory"("h3Index", "changedAt" DESC);
