-- CreateTable
CREATE TABLE "Cell" (
    "h3Index" TEXT NOT NULL,
    "center" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cell_pkey" PRIMARY KEY ("h3Index")
);

-- CreateTable
CREATE TABLE "CellOwnership" (
    "h3Index" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "influence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellOwnership_pkey" PRIMARY KEY ("h3Index","userId")
);

-- CreateIndex
CREATE INDEX "CellOwnership_userId_idx" ON "CellOwnership"("userId");

-- CreateIndex
CREATE INDEX "CellOwnership_h3Index_idx" ON "CellOwnership"("h3Index");

-- AddForeignKey
ALTER TABLE "CellOwnership" ADD CONSTRAINT "CellOwnership_h3Index_fkey" FOREIGN KEY ("h3Index") REFERENCES "Cell"("h3Index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CellOwnership" ADD CONSTRAINT "CellOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
