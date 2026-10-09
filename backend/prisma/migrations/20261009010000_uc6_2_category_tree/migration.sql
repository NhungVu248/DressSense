-- UC6.2 - Danh mục đa cấp (cha-con) + ẩn/thứ tự + nhật ký

ALTER TABLE `Category`
    ADD COLUMN `parentId` INTEGER NULL,
    ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `Category_parentId_idx` ON `Category`(`parentId`);

ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey`
    FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Mở rộng enum nhật ký cho CATEGORY + PRODUCT (UC6.2/UC6.5)
ALTER TABLE `KnowledgeAudit`
    MODIFY `entity` ENUM('ATTRIBUTE', 'FIT_RULE', 'PAIRING_RULE', 'CATEGORY', 'PRODUCT') NOT NULL;
