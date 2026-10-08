-- UC4.1 - Kết quả phân tích thuộc tính sản phẩm (đề xuất + xác nhận)

CREATE TABLE `ProductAnalysis` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'UNCONFIRMED', 'CONFIRMED', 'FAILED') NOT NULL DEFAULT 'UNCONFIRMED',
    `engine` VARCHAR(191) NOT NULL DEFAULT 'rule',
    `attributes` JSON NULL,
    `confidence` JSON NULL,
    `occasion` VARCHAR(191) NULL,
    `bodyShapes` JSON NULL,
    `lowConfidence` JSON NULL,
    `note` VARCHAR(191) NULL,
    `analyzedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,
    `confirmedBy` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductAnalysis_productId_key`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductAnalysis` ADD CONSTRAINT `ProductAnalysis_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
