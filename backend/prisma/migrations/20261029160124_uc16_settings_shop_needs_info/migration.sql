-- AlterTable
ALTER TABLE `shop` MODIFY `status` ENUM('DRAFT', 'PENDING', 'NEEDS_INFO', 'ACTIVE', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `SystemSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'string',
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `group` VARCHAR(191) NOT NULL DEFAULT 'Chung',
    `updatedById` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SettingChangeLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `valueBefore` VARCHAR(191) NULL,
    `valueAfter` VARCHAR(191) NOT NULL,
    `actorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SettingChangeLog_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
