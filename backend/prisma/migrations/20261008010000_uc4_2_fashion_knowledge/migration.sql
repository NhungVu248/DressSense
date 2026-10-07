-- UC4.2 - Tri thức thời trang: danh mục thuộc tính chuẩn + luật hợp dáng + nhật ký/phiên bản

CREATE TABLE `FashionAttribute` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('GARMENT', 'COLOR', 'MATERIAL', 'FIT', 'NECKLINE', 'SLEEVE', 'LENGTH', 'STYLE', 'OCCASION', 'PATTERN', 'BODY_SHAPE') NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `aliases` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FashionAttribute_type_idx`(`type`),
    UNIQUE INDEX `FashionAttribute_type_code_key`(`type`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ShapeFitRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bodyShape` ENUM('HOURGLASS', 'RECTANGLE', 'PEAR', 'APPLE', 'INVERTED_TRIANGLE') NOT NULL,
    `attr` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `kind` ENUM('PREFER', 'AVOID') NOT NULL,
    `weight` DOUBLE NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShapeFitRule_bodyShape_idx`(`bodyShape`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KnowledgeAudit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entity` ENUM('ATTRIBUTE', 'FIT_RULE', 'PAIRING_RULE') NOT NULL,
    `entityId` INTEGER NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'DEACTIVATE', 'IMPORT') NOT NULL,
    `actorId` INTEGER NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KnowledgeAudit_entity_idx`(`entity`),
    INDEX `KnowledgeAudit_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
