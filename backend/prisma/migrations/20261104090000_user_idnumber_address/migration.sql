-- Hồ sơ cá nhân: CCCD/CMND + địa chỉ liên hệ
ALTER TABLE `User` ADD COLUMN `idNumber` VARCHAR(191) NULL,
    ADD COLUMN `address` TEXT NULL;
