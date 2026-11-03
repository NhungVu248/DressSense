-- AlterTable
ALTER TABLE `product` ADD COLUMN `careInstructions` TEXT NULL,
    ADD COLUMN `origin` VARCHAR(191) NULL,
    ADD COLUMN `sku` VARCHAR(191) NULL,
    ADD COLUMN `warranty` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `dateOfBirth` DATETIME(3) NULL,
    ADD COLUMN `gender` VARCHAR(191) NULL;
