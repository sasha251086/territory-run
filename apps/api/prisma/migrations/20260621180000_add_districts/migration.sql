-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "polygon" JSONB NOT NULL,
    "kingUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictCell" (
    "districtId" TEXT NOT NULL,
    "h3Index" TEXT NOT NULL,

    CONSTRAINT "DistrictCell_pkey" PRIMARY KEY ("districtId","h3Index")
);

-- CreateIndex
CREATE INDEX "DistrictCell_h3Index_idx" ON "DistrictCell"("h3Index");

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_kingUserId_fkey" FOREIGN KEY ("kingUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistrictCell" ADD CONSTRAINT "DistrictCell_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistrictCell" ADD CONSTRAINT "DistrictCell_h3Index_fkey" FOREIGN KEY ("h3Index") REFERENCES "Cell"("h3Index") ON DELETE CASCADE ON UPDATE CASCADE;
