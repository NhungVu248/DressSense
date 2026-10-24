-- AlterTable
ALTER TABLE `order` ADD COLUMN `addressDetail` VARCHAR(191) NOT NULL,
    ADD COLUMN `code` VARCHAR(191) NOT NULL,
    ADD COLUMN `discount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `district` VARCHAR(191) NOT NULL,
    ADD COLUMN `note` VARCHAR(191) NULL,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `paymentMethod` ENUM('COD', 'VNPAY', 'VISA') NOT NULL,
    ADD COLUMN `paymentStatus` ENUM('UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    ADD COLUMN `phone` VARCHAR(191) NOT NULL,
    ADD COLUMN `province` VARCHAR(191) NOT NULL,
    ADD COLUMN `recipientName` VARCHAR(191) NOT NULL,
    ADD COLUMN `shippingFee` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `shippingMethod` VARCHAR(191) NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN `subtotal` INTEGER NOT NULL,
    ADD COLUMN `voucherCode` VARCHAR(191) NULL,
    ADD COLUMN `ward` VARCHAR(191) NOT NULL,
    MODIFY `status` ENUM('PENDING', 'AWAITING_PAYMENT', 'PAID', 'SHIPPING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `name` VARCHAR(191) NULL,
    ADD COLUMN `size` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PaymentTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `orderId` INTEGER NOT NULL,
    `method` ENUM('COD', 'VNPAY', 'VISA') NOT NULL,
    `amount` INTEGER NOT NULL,
    `status` ENUM('UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `providerRef` VARCHAR(191) NULL,
    `bankCode` VARCHAR(191) NULL,
    `cardLast4` VARCHAR(191) NULL,
    `responseCode` VARCHAR(191) NULL,
    `message` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paidAt` DATETIME(3) NULL,

    UNIQUE INDEX `PaymentTransaction_code_key`(`code`),
    INDEX `PaymentTransaction_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Order_code_key` ON `Order`(`code`);

-- AddForeignKey
ALTER TABLE `PaymentTransaction` ADD CONSTRAINT `PaymentTransaction_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

