from django.db import models


class Product(models.Model):
    """映射 MySQL products 表"""

    id = models.CharField(primary_key=True, max_length=50, verbose_name="商品ID")
    category = models.CharField(max_length=20, verbose_name="分类")
    tag = models.CharField(max_length=50, verbose_name="标签")
    title = models.CharField(max_length=200, verbose_name="标题")
    subtitle = models.CharField(max_length=200, null=True, blank=True, verbose_name="副标题")
    description = models.TextField(null=True, blank=True, verbose_name="描述")
    detail = models.TextField(null=True, blank=True, verbose_name="详情")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="价格")
    image = models.CharField(max_length=500, null=True, blank=True, verbose_name="图片URL")
    images = models.TextField(null=True, blank=True, verbose_name="其他图片（JSON数组或逗号分隔URL）")
    taobao_url = models.CharField(max_length=500, null=True, blank=True, verbose_name="淘宝链接")
    stock = models.IntegerField(default=0, verbose_name="库存")
    sales = models.IntegerField(default=0, verbose_name="销量")
    status = models.SmallIntegerField(default=1, verbose_name="状态：1-上架，0-下架")
    created_at = models.DateTimeField(verbose_name="创建时间")
    updated_at = models.DateTimeField(verbose_name="更新时间")

    class Meta:
        db_table = "products"
        managed = False
        verbose_name = "商品"
        verbose_name_plural = "商品"

    def __str__(self):
        return self.title


class Favorite(models.Model):
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField(verbose_name="用户ID")
    product = models.ForeignKey(Product, db_column="product_id", on_delete=models.CASCADE)
    created_at = models.DateTimeField(verbose_name="收藏时间")

    class Meta:
        db_table = "favorites"
        managed = False
        verbose_name = "收藏"
        verbose_name_plural = "收藏"


class Comment(models.Model):
    id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(Product, db_column="product_id", on_delete=models.CASCADE)
    user_id = models.IntegerField(verbose_name="用户ID")
    username = models.CharField(max_length=50, verbose_name="用户名")
    rating = models.SmallIntegerField(verbose_name="评分")
    content = models.TextField(verbose_name="内容")
    likes = models.IntegerField(default=0, verbose_name="点赞数")
    created_at = models.DateTimeField(verbose_name="评论时间")
    updated_at = models.DateTimeField(verbose_name="更新时间")

    class Meta:
        db_table = "comments"
        managed = False
        verbose_name = "评论"
        verbose_name_plural = "评论"


class CommentLike(models.Model):
    id = models.AutoField(primary_key=True)
    comment = models.ForeignKey(Comment, db_column="comment_id", on_delete=models.CASCADE)
    user_id = models.IntegerField(verbose_name="用户ID")
    created_at = models.DateTimeField(verbose_name="点赞时间")

    class Meta:
        db_table = "comment_likes"
        managed = False
        verbose_name = "评论点赞"
        verbose_name_plural = "评论点赞"


class Activity(models.Model):
    id = models.CharField(primary_key=True, max_length=50, verbose_name="活动ID")
    title = models.CharField(max_length=200, verbose_name="标题")
    subtitle = models.CharField(max_length=200, null=True, blank=True, verbose_name="副标题")
    description = models.TextField(null=True, blank=True, verbose_name="描述")
    cover_image = models.CharField(max_length=500, null=True, blank=True, verbose_name="封面")
    poster = models.CharField(max_length=500, null=True, blank=True, verbose_name="海报")
    click_count = models.IntegerField(default=0, verbose_name="点击数")
    start_date = models.DateField(verbose_name="开始日期")
    end_date = models.DateField(verbose_name="结束日期")
    status = models.CharField(max_length=20, default="active", verbose_name="状态")
    type = models.CharField(max_length=20, null=True, blank=True, verbose_name="类型")
    participants = models.IntegerField(default=0, verbose_name="参与人数")
    created_at = models.DateTimeField(verbose_name="创建时间")
    updated_at = models.DateTimeField(verbose_name="更新时间")

    class Meta:
        db_table = "activities"
        managed = False
        verbose_name = "活动"
        verbose_name_plural = "活动"

    def __str__(self):
        return self.title


class Store(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200, verbose_name="门店名称")
    address = models.CharField(max_length=500, verbose_name="门店地址")
    city = models.CharField(max_length=50, verbose_name="城市")
    longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    hours = models.CharField(max_length=50, null=True, blank=True, verbose_name="营业时间")
    phone = models.CharField(max_length=20, null=True, blank=True, verbose_name="联系电话")
    status = models.SmallIntegerField(default=1, verbose_name="状态")
    created_at = models.DateTimeField(verbose_name="创建时间")
    updated_at = models.DateTimeField(verbose_name="更新时间")

    class Meta:
        db_table = "stores"
        managed = False
        verbose_name = "门店"
        verbose_name_plural = "门店"

    def __str__(self):
        return self.name


class WeatherRecord(models.Model):
    id = models.AutoField(primary_key=True)
    date = models.DateField(verbose_name="日期")
    temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    description = models.CharField(max_length=50, null=True, blank=True)
    humidity = models.IntegerField(null=True, blank=True)
    precipitation = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    wind_direction = models.CharField(max_length=20, null=True, blank=True)
    wind_speed = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(verbose_name="记录时间")

    class Meta:
        db_table = "weather"
        managed = False
        verbose_name = "天气记录"
        verbose_name_plural = "天气记录"


class ProductSpec(models.Model):
    id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, db_column="product_id", on_delete=models.CASCADE)
    spec_name = models.CharField(max_length=50, verbose_name="规格名称")
    spec_value = models.CharField(max_length=100, null=True, blank=True, verbose_name="规格值")
    price_adjust = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="价格调整")
    stock = models.IntegerField(default=0, verbose_name="库存")
    sort_order = models.IntegerField(default=0, verbose_name="排序")
    created_at = models.DateTimeField(verbose_name="创建时间")

    class Meta:
        db_table = "product_specs"
        managed = False
        verbose_name = "商品规格"
        verbose_name_plural = "商品规格"


class ProductAttribute(models.Model):
    """商品属性表（如：大小、颜色）"""
    id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, db_column="product_id", on_delete=models.CASCADE)
    attribute_name = models.CharField(max_length=50, verbose_name="属性名称")
    sort_order = models.IntegerField(default=0, verbose_name="排序")
    created_at = models.DateTimeField(verbose_name="创建时间")

    class Meta:
        db_table = "product_attributes"
        managed = False
        verbose_name = "商品属性"
        verbose_name_plural = "商品属性"

    def __str__(self):
        return f"{self.product_id} - {self.attribute_name}"


class ProductAttributeValue(models.Model):
    """商品属性值表（如：10*10、绿色）"""
    id = models.AutoField(primary_key=True)
    attribute = models.ForeignKey(ProductAttribute, db_column="attribute_id", on_delete=models.CASCADE)
    value = models.CharField(max_length=100, verbose_name="属性值")
    price_adjust = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="价格调整")
    stock = models.IntegerField(default=0, verbose_name="库存")
    sort_order = models.IntegerField(default=0, verbose_name="排序")
    created_at = models.DateTimeField(verbose_name="创建时间")

    class Meta:
        db_table = "product_attribute_values"
        managed = False
        verbose_name = "商品属性值"
        verbose_name_plural = "商品属性值"

    def __str__(self):
        return f"{self.attribute.attribute_name} - {self.value}"


class ProductVariant(models.Model):
    """
    商品属性组合价格（不同属性组合可设置不同价格）
    key: 由所选 attribute_value 的 id 组成（排序后用逗号连接），例如 "12,15"
    """

    id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, db_column="product_id", on_delete=models.CASCADE)
    key = models.CharField(max_length=255, verbose_name="组合Key")
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="组合价格")
    created_at = models.DateTimeField(verbose_name="创建时间")

    class Meta:
        db_table = "product_variants"
        managed = False
        verbose_name = "商品组合价格"
        verbose_name_plural = "商品组合价格"


class AttributeGroup(models.Model):
    """属性组（颜色/尺寸/包装/材质）"""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50, verbose_name="属性组名称")
    sort_order = models.IntegerField(default=0, verbose_name="排序")
    created_at = models.DateTimeField(verbose_name="创建时间")

    class Meta:
        db_table = "attribute_groups"
        managed = False
        verbose_name = "属性组"
        verbose_name_plural = "属性组"

    def __str__(self):
        return self.name


class AttributeValue(models.Model):
    """属性值（归属属性组，比如：包装=礼盒装）"""

    id = models.AutoField(primary_key=True)
    group = models.ForeignKey(AttributeGroup, db_column="group_id", on_delete=models.CASCADE)
    value = models.CharField(max_length=100, verbose_name="属性值")
    sort_order = models.IntegerField(default=0, verbose_name="排序")
    created_at = models.DateTimeField(verbose_name="创建时间")

    class Meta:
        db_table = "attribute_values"
        managed = False
        verbose_name = "属性值"
        verbose_name_plural = "属性值"

    def __str__(self):
        return f"{self.group.name}-{self.value}"


class ProductSku(models.Model):
    """商品SKU（价格/库存/销量/图片）"""

    id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, db_column="product_id", on_delete=models.CASCADE)
    sku_name = models.CharField(max_length=120, null=True, blank=True, verbose_name="SKU名称")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="售价")
    stock = models.IntegerField(default=0, verbose_name="库存")
    sales = models.IntegerField(default=0, verbose_name="销量")
    image = models.CharField(max_length=500, null=True, blank=True, verbose_name="SKU图片")
    status = models.SmallIntegerField(default=1, verbose_name="状态：1-启用，0-禁用")
    created_at = models.DateTimeField(verbose_name="创建时间")
    updated_at = models.DateTimeField(verbose_name="更新时间")

    class Meta:
        db_table = "product_skus"
        managed = False
        verbose_name = "商品SKU"
        verbose_name_plural = "商品SKU"


class ProductSkuValue(models.Model):
    """SKU-属性值关联（一个SKU多属性值）"""

    id = models.AutoField(primary_key=True)
    sku = models.ForeignKey(ProductSku, db_column="sku_id", on_delete=models.CASCADE)
    value = models.ForeignKey(AttributeValue, db_column="value_id", on_delete=models.CASCADE)

    class Meta:
        db_table = "product_sku_values"
        managed = False
        verbose_name = "SKU属性值"
        verbose_name_plural = "SKU属性值"


# ---------- 客服会话（Django 建表，managed=True） ----------


class CustomerConversation(models.Model):
    """客服会话：一个用户一条会话"""

    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField(verbose_name="用户ID", db_index=True)
    customer_name = models.CharField(max_length=100, default="客户", verbose_name="客户显示名")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customer_conversations"
        managed = True
        verbose_name = "客服会话"
        verbose_name_plural = "客服会话"


class CustomerMessage(models.Model):
    """客服消息"""

    SENDER_CUSTOMER = "customer"
    SENDER_STAFF = "staff"

    id = models.AutoField(primary_key=True)
    conversation = models.ForeignKey(
        CustomerConversation,
        on_delete=models.CASCADE,
        related_name="messages",
        db_column="conversation_id",
    )
    sender_type = models.CharField(
        max_length=20,
        choices=[(SENDER_CUSTOMER, "客户"), (SENDER_STAFF, "客服")],
    )
    content = models.TextField(blank=True, default="", verbose_name="内容")
    image = models.CharField(max_length=500, null=True, blank=True, verbose_name="图片URL")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "customer_messages"
        managed = True
        verbose_name = "客服消息"
        verbose_name_plural = "客服消息"
        ordering = ["created_at"]

