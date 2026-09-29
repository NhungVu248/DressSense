-- UC2.3 - Đồng bộ Body Profile vào hồ sơ cá nhân hóa
ALTER TABLE `CustomerProfile`
    ADD COLUMN `bodyProfileId` INTEGER NULL,
    ADD COLUMN `bodyProfileSyncedAt` DATETIME(3) NULL,
    ADD COLUMN `bodyProfileAutoSync` BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX `CustomerProfile_bodyProfileId_key` ON `CustomerProfile`(`bodyProfileId`);

-- onDelete SetNull -> tự hủy liên kết khi Body Profile bị xóa (UC3.4)
ALTER TABLE `CustomerProfile`
    ADD CONSTRAINT `CustomerProfile_bodyProfileId_fkey`
    FOREIGN KEY (`bodyProfileId`) REFERENCES `BodyProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
