-- UC4 (GĐ4) - Điểm tương thích sản phẩm ↔ dáng người
CREATE TABLE `ProductBodyFit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `bodyShape` ENUM('HOURGLASS', 'RECTANGLE', 'PEAR', 'APPLE', 'INVERTED_TRIANGLE') NOT NULL,
    `score` DOUBLE NOT NULL,
    `reasons` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductBodyFit_productId_idx`(`productId`),
    UNIQUE INDEX `ProductBodyFit_productId_bodyShape_key`(`productId`, `bodyShape`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductBodyFit` ADD CONSTRAINT `ProductBodyFit_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
