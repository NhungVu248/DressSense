-- AlterTable
ALTER TABLE `order` ADD COLUMN `taxAmount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `taxRate` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `priceBeforeTax` INTEGER NULL;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `buyerName` VARCHAR(191) NOT NULL,
    `buyerTaxCode` VARCHAR(191) NULL,
    `buyerAddress` VARCHAR(191) NOT NULL,
    `buyerEmail` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `issueCount` INTEGER NOT NULL DEFAULT 1,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
