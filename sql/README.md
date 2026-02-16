# 石刻护柠项目数据库说明

## 数据库信息

- **数据库名称**: `anyue_lemon_db`
- **字符集**: `utf8mb4`
- **排序规则**: `utf8mb4_unicode_ci`
- **数据库引擎**: `InnoDB`

## 表结构说明

### 1. 用户表 (users)
存储用户基本信息，包括登录账号、昵称、头像等。

**主要字段**:
- `id`: 用户ID（主键）
- `phone`: 手机号（唯一，用于登录）
- `name`: 昵称
- `password`: 密码（加密存储）
- `avatar`: 头像URL或base64数据

### 2. 商品表 (products)
存储商品信息。

**主要字段**:
- `id`: 商品ID（主键，字符串类型）
- `category`: 商品分类（fresh/processed/cultural）
- `tag`: 商品标签（鲜柠檬/深加工品/石窟文创）
- `title`: 商品标题
- `price`: 商品价格
- `image`: 商品图片URL
- `taobao_url`: 淘宝链接

### 3. 收藏表 (favorites)
存储用户收藏的商品关系。

**主要字段**:
- `user_id`: 用户ID（外键）
- `product_id`: 商品ID（外键）
- 唯一约束：同一用户不能重复收藏同一商品

### 4. 评论表 (comments)
存储商品评论信息。

**主要字段**:
- `id`: 评论ID（主键）
- `product_id`: 商品ID（外键）
- `user_id`: 用户ID（外键）
- `rating`: 评分（1-5星）
- `content`: 评论内容
- `likes`: 点赞数

### 5. 评论点赞表 (comment_likes)
存储评论点赞关系。

**主要字段**:
- `comment_id`: 评论ID（外键）
- `user_id`: 用户ID（外键）
- 唯一约束：同一用户不能重复点赞同一评论

### 6. 活动表 (activities)
存储活动信息。

**主要字段**:
- `id`: 活动ID（主键，字符串类型）
- `title`: 活动标题
- `subtitle`: 活动副标题
- `start_date`: 开始日期
- `end_date`: 结束日期
- `status`: 状态（active/ended/upcoming）
- `type`: 活动类型（vote/other）
- `participants`: 参与人数

### 7. 投票表 (votes)
存储用户投票记录。

**主要字段**:
- `activity_id`: 活动ID（外键）
- `user_id`: 用户ID（外键）
- `product_id`: 商品ID（外键）
- 唯一约束：同一用户在同一个活动中只能投票一次（可更新）

### 8. 门店表 (stores)
存储门店信息。

**主要字段**:
- `id`: 门店ID（主键）
- `name`: 门店名称
- `address`: 门店地址
- `city`: 所在城市
- `longitude`: 经度
- `latitude`: 纬度
- `hours`: 营业时间

### 9. 天气数据表 (weather)
存储天气记录。

**主要字段**:
- `date`: 日期（唯一）
- `temperature`: 温度
- `description`: 天气描述
- `humidity`: 湿度
- `precipitation`: 降水量
- `wind_direction`: 风向
- `wind_speed`: 风速

### 10. 商品规格表 (product_specs)
存储商品规格信息（可选扩展）。

**主要字段**:
- `product_id`: 商品ID（外键）
- `spec_name`: 规格名称
- `spec_value`: 规格值
- `price_adjust`: 价格调整

## 视图说明

### v_product_details
商品详情视图，包含收藏数、评论数、平均评分等统计信息。

### v_activity_votes
活动投票统计视图，显示每个活动下各商品的投票情况。

## 初始化数据

脚本已包含以下初始化数据：
- 6个商品示例数据
- 1个活动示例数据（最受欢迎产品投票）
- 10个门店示例数据
- 8条天气示例数据（最近7天+今天）

## 使用方法

### 1. 执行初始化脚本
```bash
mysql -u root -p < sql/init_db.sql
```

### 2. 或者使用MySQL客户端
```sql
source sql/init_db.sql;
```

### 3. 验证数据库
```sql
USE anyue_lemon_db;
SHOW TABLES;
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM stores;
```

## 注意事项

1. **密码加密**: 用户密码应使用哈希算法（如bcrypt）加密存储，不要在数据库中存储明文密码。

2. **外键约束**: 所有外键都设置了 `ON DELETE CASCADE`，删除主表记录时会自动删除关联记录。

3. **索引优化**: 已为常用查询字段创建索引，如手机号、商品分类、城市等。

4. **字符集**: 使用 `utf8mb4` 以支持完整的Unicode字符，包括emoji。

5. **时间戳**: 使用 `TIMESTAMP` 类型自动管理创建和更新时间。

6. **数据备份**: 建议定期备份数据库，可以使用 `mysqldump` 命令。

## 扩展建议

1. **订单系统**: 如需添加订单功能，可创建 `orders` 和 `order_items` 表。

2. **购物车**: 可创建 `cart` 表存储用户购物车数据。

3. **优惠券**: 可创建 `coupons` 和 `user_coupons` 表。

4. **消息通知**: 可创建 `notifications` 表存储用户通知。

5. **日志记录**: 可创建 `operation_logs` 表记录用户操作日志。
