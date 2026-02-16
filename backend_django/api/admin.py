from django.contrib import admin

from .models import (
    Product,
    Favorite,
    Comment,
    CommentLike,
    Activity,
    Store,
    WeatherRecord,
    ProductSpec,
)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "category", "tag", "price", "stock", "status")
    list_filter = ("category", "status")
    search_fields = ("id", "title", "tag")
    ordering = ("-created_at",)


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "type", "start_date", "end_date")
    list_filter = ("status", "type")
    search_fields = ("id", "title")


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "city", "status")
    list_filter = ("city", "status")
    search_fields = ("name", "address", "city")


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "user_id", "username", "rating", "likes", "created_at")
    list_filter = ("rating",)
    search_fields = ("username", "content")


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "product", "created_at")
    list_filter = ("user_id",)


@admin.register(CommentLike)
class CommentLikeAdmin(admin.ModelAdmin):
    list_display = ("id", "comment", "user_id", "created_at")


@admin.register(WeatherRecord)
class WeatherRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "temperature", "description", "humidity")
    list_filter = ("date",)


@admin.register(ProductSpec)
class ProductSpecAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "spec_name", "spec_value", "price_adjust", "stock")
    list_filter = ("product",)

