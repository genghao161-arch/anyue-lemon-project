-- 石刻护柠项目数据库初始化脚本
-- 数据库名称: anyue_lemon
-- 字符集: utf8mb4
-- 排序规则: utf8mb4_unicode_ci

-- 创建数据库
CREATE DATABASE IF NOT EXISTS anyue_lemon CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `anyue_lemon`;

-- 删除所有表（如果存在），确保表结构是最新的
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `comment_likes`;
DROP TABLE IF EXISTS `votes`;
DROP TABLE IF EXISTS `comments`;
DROP TABLE IF EXISTS `favorites`;
DROP TABLE IF EXISTS `product_specs`;
DROP TABLE IF EXISTS `product_sku_values`;
DROP TABLE IF EXISTS `product_skus`;
DROP TABLE IF EXISTS `attribute_values`;
DROP TABLE IF EXISTS `attribute_groups`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `activities`;
DROP TABLE IF EXISTS `stores`;
DROP TABLE IF EXISTS `weather`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 1. 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
  `phone` VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号（登录账号）',
  `name` VARCHAR(50) DEFAULT NULL COMMENT '昵称',
  `nickname` VARCHAR(50) DEFAULT NULL COMMENT '显示名称',
  `password` VARCHAR(255) NOT NULL COMMENT '密码（加密存储）',
  `avatar` TEXT DEFAULT NULL COMMENT '头像URL或base64',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_phone` (`phone`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================
-- 2. 商品表 (products)
-- ============================================
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(50) PRIMARY KEY COMMENT '商品ID',
  `category` VARCHAR(20) NOT NULL COMMENT '商品分类：fresh/processed/cultural',
  `tag` VARCHAR(50) NOT NULL COMMENT '商品标签：鲜柠檬/深加工品/石窟文创',
  `title` VARCHAR(200) NOT NULL COMMENT '商品标题',
  `subtitle` VARCHAR(200) DEFAULT NULL COMMENT '商品副标题',
  `description` TEXT DEFAULT NULL COMMENT '商品描述（简要）',
  `detail` MEDIUMTEXT DEFAULT NULL COMMENT '商品详情描述（图文/多段）',
  `price` DECIMAL(10, 2) NOT NULL COMMENT '商品价格',
  `image` VARCHAR(500) DEFAULT NULL COMMENT '商品图片URL',
  `images` TEXT DEFAULT NULL COMMENT '其他图片（JSON数组或逗号分隔URL）',
  `taobao_url` VARCHAR(500) DEFAULT NULL COMMENT '淘宝链接',
  `stock` INT DEFAULT 0 COMMENT '库存数量（可选：若使用SKU库存，可忽略）',
  `sales` INT DEFAULT 0 COMMENT '销量（可选：若使用SKU销量，可忽略）',
  `status` TINYINT DEFAULT 1 COMMENT '状态：1-上架，0-下架',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_category` (`category`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

-- ============================================
-- 3. 收藏表 (favorites)
-- ============================================
CREATE TABLE IF NOT EXISTS `favorites` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '收藏ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `product_id` VARCHAR(50) NOT NULL COMMENT '商品ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  UNIQUE KEY `uk_user_product` (`user_id`, `product_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';

-- ============================================
-- 4. 评论表 (comments)
-- ============================================
CREATE TABLE IF NOT EXISTS `comments` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '评论ID',
  `product_id` VARCHAR(50) NOT NULL COMMENT '商品ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名（冗余字段，便于查询）',
  `rating` TINYINT NOT NULL COMMENT '评分：1-5星',
  `content` TEXT NOT NULL COMMENT '评论内容',
  `likes` INT DEFAULT 0 COMMENT '点赞数',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '评论时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- ============================================
-- 5. 评论点赞表 (comment_likes)
-- ============================================
CREATE TABLE IF NOT EXISTS `comment_likes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '点赞ID',
  `comment_id` BIGINT NOT NULL COMMENT '评论ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  UNIQUE KEY `uk_comment_user` (`comment_id`, `user_id`),
  INDEX `idx_comment_id` (`comment_id`),
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论点赞表';

-- ============================================
-- 6. 活动表 (activities)
-- ============================================
CREATE TABLE IF NOT EXISTS `activities` (
  `id` VARCHAR(50) PRIMARY KEY COMMENT '活动ID',
  `title` VARCHAR(200) NOT NULL COMMENT '活动标题',
  `subtitle` VARCHAR(200) DEFAULT NULL COMMENT '活动副标题',
  `description` TEXT DEFAULT NULL COMMENT '活动描述',
  `cover_image` VARCHAR(500) DEFAULT NULL COMMENT '封面图片URL',
  `start_date` DATE NOT NULL COMMENT '开始日期',
  `end_date` DATE NOT NULL COMMENT '结束日期',
  `status` VARCHAR(20) DEFAULT 'active' COMMENT '状态：active/ended/upcoming',
  `type` VARCHAR(20) DEFAULT NULL COMMENT '活动类型：vote/other',
  `participants` INT DEFAULT 0 COMMENT '参与人数',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_status` (`status`),
  INDEX `idx_start_date` (`start_date`),
  INDEX `idx_end_date` (`end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活动表';

-- ============================================
-- 8. 门店表 (stores)
-- ============================================
CREATE TABLE IF NOT EXISTS `stores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '门店ID',
  `name` VARCHAR(200) NOT NULL COMMENT '门店名称',
  `address` VARCHAR(500) NOT NULL COMMENT '门店地址',
  `city` VARCHAR(50) NOT NULL COMMENT '所在城市',
  `longitude` DECIMAL(10, 6) DEFAULT NULL COMMENT '经度',
  `latitude` DECIMAL(10, 6) DEFAULT NULL COMMENT '纬度',
  `hours` VARCHAR(50) DEFAULT NULL COMMENT '营业时间',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
  `status` TINYINT DEFAULT 1 COMMENT '状态：1-营业，0-关闭',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_city` (`city`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店表';

-- ============================================
-- 9. 天气数据表 (weather)
-- ============================================
CREATE TABLE IF NOT EXISTS `weather` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '天气ID',
  `date` DATE NOT NULL COMMENT '日期',
  `temperature` DECIMAL(5, 2) DEFAULT NULL COMMENT '温度（摄氏度）',
  `description` VARCHAR(50) DEFAULT NULL COMMENT '天气描述',
  `humidity` INT DEFAULT NULL COMMENT '湿度（百分比）',
  `precipitation` DECIMAL(5, 2) DEFAULT NULL COMMENT '降水量（mm）',
  `wind_direction` VARCHAR(20) DEFAULT NULL COMMENT '风向',
  `wind_speed` DECIMAL(5, 2) DEFAULT NULL COMMENT '风速（km/h）',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  UNIQUE KEY `uk_date` (`date`),
  INDEX `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='天气数据表';

-- ============================================
-- 10. 属性组表 (attribute_groups)
-- 统一管理属性类别：颜色/尺寸/包装/材质等
-- ============================================
CREATE TABLE IF NOT EXISTS `attribute_groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '属性组ID',
  `name` VARCHAR(50) NOT NULL COMMENT '属性组名称（如：颜色、尺寸、包装）',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_group_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='属性组表';

-- ============================================
-- 11. 属性值表 (attribute_values)
-- 绑定属性组，存具体属性值：简装/礼盒装、绿色/蓝色 等
-- ============================================
CREATE TABLE IF NOT EXISTS `attribute_values` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '属性值ID',
  `group_id` INT NOT NULL COMMENT '所属属性组ID',
  `value` VARCHAR(100) NOT NULL COMMENT '属性值（如：礼盒装、绿色、10×10）',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_group_value` (`group_id`, `value`),
  INDEX `idx_group_id` (`group_id`),
  FOREIGN KEY (`group_id`) REFERENCES `attribute_groups`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='属性值表';

-- ============================================
-- 12. 商品SKU表 (product_skus)
-- 一个属性组合对应一条SKU，控制价格/库存/销量/图片
-- ============================================
CREATE TABLE IF NOT EXISTS `product_skus` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'SKU ID',
  `product_id` VARCHAR(50) NOT NULL COMMENT '商品ID',
  `sku_name` VARCHAR(120) DEFAULT NULL COMMENT 'SKU名称（如：礼盒装-标准款）',
  `price` DECIMAL(10, 2) NOT NULL COMMENT '实际售价',
  `stock` INT DEFAULT 0 COMMENT '库存',
  `sales` INT DEFAULT 0 COMMENT '销量',
  `image` VARCHAR(500) DEFAULT NULL COMMENT 'SKU专属图片（可选）',
  `status` TINYINT DEFAULT 1 COMMENT '状态：1-启用，0-禁用',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品SKU表';

-- ============================================
-- 13. SKU-属性值关联表 (product_sku_values)
-- 一条SKU可关联多个属性值（颜色+包装+规格...）
-- ============================================
CREATE TABLE IF NOT EXISTS `product_sku_values` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '关联ID',
  `sku_id` INT NOT NULL COMMENT 'SKU ID',
  `value_id` INT NOT NULL COMMENT '属性值ID',
  UNIQUE KEY `uk_sku_value` (`sku_id`, `value_id`),
  INDEX `idx_sku_id` (`sku_id`),
  INDEX `idx_value_id` (`value_id`),
  FOREIGN KEY (`sku_id`) REFERENCES `product_skus`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`value_id`) REFERENCES `attribute_values`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SKU属性值关联表';

-- ============================================
-- 初始化数据
-- ============================================

-- 插入商品数据
INSERT INTO `products` (`id`, `category`, `tag`, `title`, `description`, `price`, `image`, `taobao_url`, `stock`, `sales`, `status`) VALUES
('fresh-1', 'fresh', '鲜柠檬', '安岳鲜柠檬 · 精选大果', '果皮细腻、汁水充足，适合日常泡水与烹饪。', 39.90, 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=1400&q=70', 'https://s.taobao.com/search?q=安岳柠檬精选大果', 100, 0, 1),
('processed-1', 'processed', '深加工品', '柠檬蜂蜜 · 冷泡更香', '酸甜平衡，冷泡/热饮皆宜，解腻清爽。', 29.90, 'https://images.unsplash.com/photo-1542444459-db47a4a3fdc0?auto=format&fit=crop&w=1400&q=70', 'https://s.taobao.com/search?q=柠檬蜂蜜', 100, 0, 1),
('cultural-1', 'cultural', '石窟文创', '石窟纹样 · 帆布袋', '将安岳石刻元素融入日常，简洁耐用。', 49.00, 'https://images.unsplash.com/photo-1520975958225-72ac0c67a955?auto=format&fit=crop&w=1400&q=70', 'https://s.taobao.com/search?q=石窟纹样帆布袋', 100, 0, 1),
('fresh-2', 'fresh', '鲜柠檬', '安岳鲜柠檬 · 家庭装', '日常囤货更划算，适合榨汁、烘焙与调味。', 59.90, 'https://images.unsplash.com/photo-1513612254504-6b9732b0f1a8?auto=format&fit=crop&w=1400&q=70', 'https://s.taobao.com/search?q=安岳柠檬家庭装', 100, 0, 1),
('processed-2', 'processed', '深加工品', '柠檬片 · 低温烘焙', '保留香气与口感，冷热泡皆可。', 19.90, 'https://images.unsplash.com/photo-1528826194825-1f87545a4c74?auto=format&fit=crop&w=1400&q=70', 'https://s.taobao.com/search?q=柠檬片低温烘焙', 100, 0, 1),
('cultural-2', 'cultural', '石窟文创', '佛光纹样 · 书签套装', '纸感温润，礼赠与自用皆宜。', 18.80, 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1400&q=70', 'https://s.taobao.com/search?q=书签套装文创', 100, 0, 1);

-- 插入活动数据
-- INSERT INTO `activities` (`id`, `title`, `subtitle`, `description`, `cover_image`, `start_date`, `end_date`, `status`, `type`, `participants`) VALUES
-- ('vote-popular-product', '最受欢迎产品投票', '为你喜爱的柠檬产品投上一票', '参与投票，选出你心中最受欢迎的柠檬产品，投票结果将影响我们的产品推荐和优惠活动。', 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=800&q=70', '2024-01-01', '2024-12-31', 'active', 'vote', 0);


-- 插入门店数据
INSERT INTO `stores` (`name`, `address`, `city`, `longitude`, `latitude`, `hours`, `status`) VALUES
('石刻护柠 · 北京朝阳店', '北京市朝阳区建国路88号SOHO现代城A座1层', '北京', 116.468, 39.908, '09:00-22:00', 1),
('石刻护柠 · 北京西城店', '北京市西城区太平桥大街18号丰融国际203号', '北京', 116.365, 39.897, '08:30-21:30', 1),
('石刻护柠 · 北京海淀店', '北京市海淀区中关村大街1号海龙大厦2层', '北京', 116.315, 39.983, '09:00-22:00', 1),
('石刻护柠 · 上海黄浦店', '上海市黄浦区南京东路100号', '上海', 121.475, 31.230, '09:00-22:00', 1),
('石刻护柠 · 上海徐汇店', '上海市徐汇区淮海中路999号', '上海', 121.445, 31.200, '08:30-21:30', 1),
('石刻护柠 · 广州天河店', '广州市天河区天河路208号天河城购物中心1层', '广州', 113.331, 23.141, '09:00-22:00', 1),
('石刻护柠 · 深圳南山店', '深圳市南山区深南大道9678号大冲商务中心A座', '深圳', 113.952, 22.540, '09:00-22:00', 1),
('石刻护柠 · 成都锦江店', '成都市锦江区春熙路123号', '成都', 104.081, 30.662, '09:00-22:00', 1),
('石刻护柠 · 杭州西湖店', '杭州市西湖区文三路259号昌地火炬大厦1层', '杭州', 120.130, 30.274, '08:30-21:30', 1),
('石刻护柠 · 安岳总店', '四川省资阳市安岳县柠都大道88号', '安岳', 105.336, 30.097, '08:00-20:00', 1);

-- 插入示例天气数据
INSERT INTO `weather` (`date`, `temperature`, `description`, `humidity`, `precipitation`, `wind_direction`, `wind_speed`) VALUES
(CURDATE(), 5.0, '雾', 97, 0.0, '南风', 4.0),
(DATE_SUB(CURDATE(), INTERVAL 1 DAY), 25.0, '晴天', 60, 0.0, '东风', 3.0),
(DATE_SUB(CURDATE(), INTERVAL 2 DAY), 23.0, '雾天', 85, 0.0, '南风', 2.5),
(DATE_SUB(CURDATE(), INTERVAL 3 DAY), 26.0, '雾天', 80, 0.0, '西南风', 3.5),
(DATE_SUB(CURDATE(), INTERVAL 4 DAY), 18.0, '雾天', 90, 0.0, '北风', 2.0),
(DATE_SUB(CURDATE(), INTERVAL 5 DAY), 27.0, '阴天', 70, 0.0, '东南风', 4.0),
(DATE_SUB(CURDATE(), INTERVAL 6 DAY), 15.0, '雾天', 88, 0.0, '西北风', 2.5),
(DATE_SUB(CURDATE(), INTERVAL 7 DAY), 28.0, '雨天', 95, 5.2, '东风', 5.0);

-- ============================================
-- 创建视图（可选，便于查询）
-- ============================================

-- 商品详情视图（包含收藏数、评论数、平均评分）
CREATE OR REPLACE VIEW `v_product_details` AS
SELECT 
  p.*,
  COUNT(DISTINCT f.id) AS favorite_count,
  COUNT(DISTINCT c.id) AS comment_count,
  AVG(c.rating) AS avg_rating
FROM `products` p
LEFT JOIN `favorites` f ON p.id = f.product_id
LEFT JOIN `comments` c ON p.id = c.product_id
GROUP BY p.id;


