-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "favorite" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductArtifact" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductArtifact_productId_idx" ON "ProductArtifact"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductArtifact_productId_type_key" ON "ProductArtifact"("productId", "type");

-- CreateIndex
CREATE INDEX "Product_favorite_idx" ON "Product"("favorite");

-- AddForeignKey
ALTER TABLE "ProductArtifact" ADD CONSTRAINT "ProductArtifact_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
