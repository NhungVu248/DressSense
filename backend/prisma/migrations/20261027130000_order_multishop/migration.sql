-- AlterTable
ALTER TABLE `order` ADD COLUMN `checkoutCode` VARCHAR(191) NULL,
    ADD COLUMN `sellerId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Order_sellerId_idx` ON `Order`(`sellerId`);

-- CreateIndex
CREATE INDEX `Order_checkoutCode_idx` ON `Order`(`checkoutCode`);

