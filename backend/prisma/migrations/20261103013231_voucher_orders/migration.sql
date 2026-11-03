-- CreateTable
CREATE TABLE `VoucherOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `sellerId` INTEGER NOT NULL,
    `packageType` VARCHAR(191) NOT NULL,
    `fee` INTEGER NOT NULL,
    `desiredCode` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `discountType` ENUM('PERCENT', 'FIXED') NOT NULL,
    `value` INTEGER NOT NULL,
    `minOrder` INTEGER NOT NULL DEFAULT 0,
    `maxDiscount` INTEGER NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `usageLimit` INTEGER NULL,
    `perUserLimit` INTEGER NULL,
    `paymentMethod` VARCHAR(191) NOT NULL DEFAULT 'VNPAY',
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'UNPAID',
    `paymentRef` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_PAYMENT',
    `reviewReason` TEXT NULL,
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `voucherId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VoucherOrder_code_key`(`code`),
    INDEX `VoucherOrder_sellerId_idx`(`sellerId`),
    INDEX `VoucherOrder_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VoucherOrder` ADD CONSTRAINT `VoucherOrder_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
