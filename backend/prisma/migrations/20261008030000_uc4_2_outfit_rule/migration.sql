-- UC4.2 (b2) - Luật PHỐI ĐỒ nhiều món (hòa sắc / phong cách / dịp / dáng)

CREATE TABLE `OutfitRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('COLOR', 'STYLE', 'OCCASION', 'BODYSHAPE') NOT NULL,
    `subjectA` VARCHAR(191) NOT NULL,
    `subjectB` VARCHAR(191) NULL,
    `score` DOUBLE NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OutfitRule_kind_idx`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
