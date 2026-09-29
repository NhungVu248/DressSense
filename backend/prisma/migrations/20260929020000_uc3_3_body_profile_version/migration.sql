-- UC3.3 - Sinh Body Profile: thêm số phiên bản để truy vết (mỗi lần sinh tạo bản mới - 5a)
ALTER TABLE `BodyProfile` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
