-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleUid" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleUid_key" ON "User"("googleUid");
