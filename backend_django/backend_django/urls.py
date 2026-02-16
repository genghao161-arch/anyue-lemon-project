from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, re_path
from django.views.static import serve

from api.views import (
    db_health,
    register_view,
    login_view,
    logout_view,
    current_user_view,
    weather_now_view,
    weather_daily_view,
    activities_list_view,
    public_activity_detail_view,
    product_list_view,
    product_detail_view,
    stores_list_view,
    admin_activity_list_create_view,
    admin_activity_detail_view,
    admin_product_list_create_view,
    admin_product_detail_view,
    admin_store_list_create_view,
    admin_store_detail_view,
    admin_upload_image_view,
    admin_geocode_view,
    admin_customer_conversations_view,
    admin_customer_messages_view,
    admin_user_list_create_view,
    admin_user_detail_view,
    customer_conversation_view,
    customer_messages_view,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/db/health", db_health),
    path("api/auth/register", register_view),
    path("api/auth/login", login_view),
    path("api/auth/logout", logout_view),
    path("api/auth/me", current_user_view),
    path("api/weather/now", weather_now_view),
    path("api/weather/7d", weather_daily_view),
    path("api/activities", activities_list_view),
    path("api/activities/<str:activity_id>", public_activity_detail_view),
    path("api/products", product_list_view),
    path("api/products/<str:product_id>", product_detail_view),
    path("api/stores", stores_list_view),
    path("api/admin/activities", admin_activity_list_create_view),
    path("api/admin/activities/<str:activity_id>", admin_activity_detail_view),
    path("api/admin/products", admin_product_list_create_view),
    path("api/admin/products/<str:product_id>", admin_product_detail_view),
    path("api/admin/stores", admin_store_list_create_view),
    path("api/admin/stores/<int:store_id>", admin_store_detail_view),
    path("api/admin/upload-image", admin_upload_image_view),
    path("api/admin/geocode", admin_geocode_view),
    path("api/admin/customer/conversations", admin_customer_conversations_view),
    path("api/admin/customer/messages/<int:conv_id>", admin_customer_messages_view),
    path("api/admin/users", admin_user_list_create_view),
    path("api/admin/users/<int:user_id>", admin_user_detail_view),
    path("api/customer/conversation", customer_conversation_view),
    path("api/customer/messages", customer_messages_view),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # 临时映射 frontend 目录，方便外网直接访问静态页面
urlpatterns += [
    re_path(r'^frontend/(?P<path>.*)$', serve, {
        'document_root': str(settings.BASE_DIR.parent / 'frontend'),
    }),
]
