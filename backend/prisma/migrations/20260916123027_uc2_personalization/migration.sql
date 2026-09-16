/*
  Warnings:

  - You are about to drop the column `budgetMax` on the `customerprofile` table. All the data in the column will be lost.
  - You are about to drop the column `budgetMin` on the `customerprofile` table. All the data in the column will be lost.
  - You are about to drop the column `colorPreference` on the `customerprofile` table. All the data in the column will be lost.
  - You are about to drop the column `occasion` on the `customerprofile` table. All the data in the column will be lost.
  - You are about to drop the column `sizePreference` on the `customerprofile` table. All the data in the column will be lost.
  - You are about to drop the column `stylePreference` on the `customerprofile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `customerprofile` DROP COLUMN `budgetMax`,
    DROP COLUMN `budgetMin`,
    DROP COLUMN `colorPreference`,
    DROP COLUMN `occasion`,
    DROP COLUMN `sizePreference`,
    DROP COLUMN `stylePreference`,
    ADD COLUMN `avoidColors` JSON NULL,
    ADD COLUMN `avoidGarments` JSON NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `preferredBrands` JSON NULL,
    ADD COLUMN `preferredColors` JSON NULL,
    ADD COLUMN `preferredGarments` JSON NULL,
    ADD COLUMN `preferredMaterials` JSON NULL,
    ADD COLUMN `preferredStyles` JSON NULL,
    ADD COLUMN `styleDeclaredAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `ProfileBudget` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `minPrice` INTEGER NOT NULL,
    `maxPrice` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProfileBudget_profileId_idx`(`profileId`),
    UNIQUE INDEX `ProfileBudget_profileId_categoryId_key`(`profileId`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfileOccasion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` INTEGER NOT NULL,
    `occasion` ENUM('WORK', 'SCHOOL', 'STREET', 'PARTY', 'SPORT', 'TRAVEL', 'CUSTOM') NOT NULL,
    `customLabel` VARCHAR(191) NULL,
    `frequency` ENUM('RARELY', 'SOMETIMES', 'OFTEN') NOT NULL DEFAULT 'SOMETIMES',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProfileOccasion_profileId_idx`(`profileId`),
    UNIQUE INDEX `ProfileOccasion_profileId_occasion_customLabel_key`(`profileId`, `occasion`, `customLabel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerSize` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `sizeSystem` ENUM('STANDARD', 'NUMERIC', 'MEASUREMENT') NOT NULL DEFAULT 'STANDARD',
    `sizeValue` VARCHAR(191) NOT NULL,
    `measurements` JSON NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerSize_profileId_idx`(`profileId`),
    UNIQUE INDEX `CustomerSize_profileId_categoryId_key`(`profileId`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProfileBudget` ADD CONSTRAINT `ProfileBudget_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `CustomerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileBudget` ADD CONSTRAINT `ProfileBudget_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileOccasion` ADD CONSTRAINT `ProfileOccasion_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `CustomerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerSize` ADD CONSTRAINT `CustomerSize_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `CustomerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerSize` ADD CONSTRAINT `CustomerSize_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
