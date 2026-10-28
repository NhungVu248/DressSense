-- AlterTable
ALTER TABLE `user` ADD COLUMN `marketingOptIn` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `voucher` ADD COLUMN `perUserLimit` INTEGER NULL,
    ADD COLUMN `scope` ENUM('ALL', 'PRODUCT', 'CATEGORY') NOT NULL DEFAULT 'ALL',
    ADD COLUMN `scopeIds` JSON NULL,
    ADD COLUMN `sellerId` INTEGER NULL,
    ADD COLUMN `status` ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'ENDED', 'STOPPED') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `VoucherUsage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucherId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    INDEX `VoucherUsage_userId_idx`(`userId`),
    UNIQUE INDEX `VoucherUsage_voucherId_userId_key`(`voucherId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FlashSale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sellerId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `variantId` INTEGER NULL,
    `salePrice` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `soldCount` INTEGER NOT NULL DEFAULT 0,
    `perUserLimit` INTEGER NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'ENDED', 'STOPPED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FlashSale_sellerId_idx`(`sellerId`),
    INDEX `FlashSale_productId_idx`(`productId`),
    INDEX `FlashSale_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FlashSaleUsage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `flashSaleId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,

    INDEX `FlashSaleUsage_userId_idx`(`userId`),
    UNIQUE INDEX `FlashSaleUsage_flashSaleId_userId_key`(`flashSaleId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Banner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `subtitle` VARCHAR(191) NULL,
    `position` ENUM('HOME_HERO', 'HOME_STRIP', 'PROMO_PAGE') NOT NULL DEFAULT 'HOME_HERO',
    `linkType` ENUM('NONE', 'PRODUCT', 'CATEGORY', 'PROMO', 'URL') NOT NULL DEFAULT 'NONE',
    `linkValue` VARCHAR(191) NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'ENDED', 'STOPPED') NOT NULL DEFAULT 'DRAFT',
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Banner_position_idx`(`position`),
    INDEX `Banner_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `link` VARCHAR(191) NULL,
    `audience` ENUM('ALL', 'SEGMENT') NOT NULL DEFAULT 'ALL',
    `segment` JSON NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `recipientCount` INTEGER NOT NULL DEFAULT 0,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Campaign_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Voucher_sellerId_idx` ON `Voucher`(`sellerId`);

-- AddForeignKey
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherUsage` ADD CONSTRAINT `VoucherUsage_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherUsage` ADD CONSTRAINT `VoucherUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlashSale` ADD CONSTRAINT `FlashSale_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlashSale` ADD CONSTRAINT `FlashSale_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlashSaleUsage` ADD CONSTRAINT `FlashSaleUsage_flashSaleId_fkey` FOREIGN KEY (`flashSaleId`) REFERENCES `FlashSale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlashSaleUsage` ADD CONSTRAINT `FlashSaleUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
