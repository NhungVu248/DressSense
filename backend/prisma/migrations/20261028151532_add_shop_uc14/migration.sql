-- CreateTable
CREATE TABLE `Shop` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `coverUrl` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `pickupName` VARCHAR(191) NULL,
    `pickupPhone` VARCHAR(191) NULL,
    `pickupProvince` VARCHAR(191) NULL,
    `pickupDistrict` VARCHAR(191) NULL,
    `pickupWard` VARCHAR(191) NULL,
    `pickupDetail` VARCHAR(191) NULL,
    `returnSameAsPickup` BOOLEAN NOT NULL DEFAULT true,
    `returnName` VARCHAR(191) NULL,
    `returnPhone` VARCHAR(191) NULL,
    `returnProvince` VARCHAR(191) NULL,
    `returnDistrict` VARCHAR(191) NULL,
    `returnWard` VARCHAR(191) NULL,
    `returnDetail` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `rejectReason` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Shop_ownerId_key`(`ownerId`),
    INDEX `Shop_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Shop` ADD CONSTRAINT `Shop_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
