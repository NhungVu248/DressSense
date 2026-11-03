-- AlterTable: thông tin nhận tiền của gian hàng (đối soát & chi trả)
ALTER TABLE `Shop` ADD COLUMN `bankName` VARCHAR(191) NULL,
    ADD COLUMN `bankAccountNo` VARCHAR(191) NULL,
    ADD COLUMN `bankAccountName` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `CommissionPolicy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NULL,
    `commissionRate` DOUBLE NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `note` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommissionPolicy_categoryId_idx`(`categoryId`),
    INDEX `CommissionPolicy_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommissionPolicyLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `policyId` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `actorId` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommissionPolicyLog_policyId_idx`(`policyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SellerSettlement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `sellerId` INTEGER NOT NULL,
    `periodFrom` DATETIME(3) NULL,
    `periodTo` DATETIME(3) NULL,
    `grossAmount` INTEGER NOT NULL DEFAULT 0,
    `commissionAmount` INTEGER NOT NULL DEFAULT 0,
    `adjustmentAmount` INTEGER NOT NULL DEFAULT 0,
    `netAmount` INTEGER NOT NULL DEFAULT 0,
    `direction` ENUM('PAYABLE', 'RECEIVABLE') NOT NULL DEFAULT 'PAYABLE',
    `status` ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `paymentMethod` VARCHAR(191) NULL,
    `transactionReference` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdById` INTEGER NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SellerSettlement_code_key`(`code`),
    INDEX `SellerSettlement_sellerId_idx`(`sellerId`),
    INDEX `SellerSettlement_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderCommission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `orderItemId` INTEGER NULL,
    `sellerId` INTEGER NOT NULL,
    `categoryId` INTEGER NULL,
    `policyId` INTEGER NULL,
    `baseAmount` INTEGER NOT NULL,
    `commissionRate` DOUBLE NOT NULL,
    `commissionAmount` INTEGER NOT NULL,
    `method` ENUM('COD', 'VNPAY', 'VISA') NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    `settlementId` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderCommission_orderId_idx`(`orderId`),
    INDEX `OrderCommission_sellerId_idx`(`sellerId`),
    INDEX `OrderCommission_status_idx`(`status`),
    INDEX `OrderCommission_settlementId_idx`(`settlementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SellerSettlementItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `settlementId` INTEGER NOT NULL,
    `orderId` INTEGER NOT NULL,
    `orderCode` VARCHAR(191) NULL,
    `orderAmount` INTEGER NOT NULL,
    `commissionAmount` INTEGER NOT NULL,
    `netAmount` INTEGER NOT NULL,

    INDEX `SellerSettlementItem_settlementId_idx`(`settlementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrderCommission` ADD CONSTRAINT `OrderCommission_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderCommission` ADD CONSTRAINT `OrderCommission_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `SellerSettlement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SellerSettlementItem` ADD CONSTRAINT `SellerSettlementItem_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `SellerSettlement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
