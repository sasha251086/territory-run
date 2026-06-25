-- AlterTable
ALTER TABLE "Cell" ADD COLUMN "centerLat" DOUBLE PRECISION,
ADD COLUMN "centerLng" DOUBLE PRECISION;

-- Backfill coordinates from JSON center field
UPDATE "Cell"
SET
  "centerLat" = ("center"->>'lat')::double precision,
  "centerLng" = ("center"->>'lng')::double precision
WHERE "center" IS NOT NULL
  AND "center"->>'lat' IS NOT NULL
  AND "center"->>'lng' IS NOT NULL;

-- CreateIndex
CREATE INDEX "Cell_centerLat_centerLng_idx" ON "Cell"("centerLat", "centerLng");

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
