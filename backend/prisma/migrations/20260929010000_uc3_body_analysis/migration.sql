-- UC3 - Phân tích dáng người bằng AI
-- Bổ sung phần schema của nhóm UC3 (consent, hoàn thiện BodyProfile, log xóa dữ liệu cơ thể)
-- so với bản BodyProfile sơ khai đã tạo ở migration init.

-- UC3.1 - Mốc thời gian khách hàng đồng ý xử lý dữ liệu cơ thể (informed consent)
ALTER TABLE `User` ADD COLUMN `bodyDataConsentAt` DATETIME(3) NULL;

-- UC3.2/UC3.3 - Hoàn thiện các cột của Body Profile
ALTER TABLE `BodyProfile`
    ADD COLUMN `source` ENUM('MANUAL', 'PHOTO') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN `weight` DOUBLE NULL,
    ADD COLUMN `bust` DOUBLE NULL,
    ADD COLUMN `confidence` DOUBLE NOT NULL DEFAULT 1,
    ADD COLUMN `isPreliminary` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `photoUrl` VARCHAR(191) NULL,
    ADD COLUMN `recommendations` JSON NULL,
    ADD COLUMN `suggestedSizes` JSON NULL;

-- UC3.4 - Ghi nhận tối thiểu thao tác xóa dữ liệu cơ thể
CREATE TABLE `BodyDataDeletionLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `scope` ENUM('PHOTO_ONLY', 'PROFILE', 'ALL') NOT NULL,
    `deletedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BodyDataDeletionLog_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BodyDataDeletionLog` ADD CONSTRAINT `BodyDataDeletionLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
