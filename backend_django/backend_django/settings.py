from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', "dev-only-change-me")

# 在生产环境中，DEBUG 必须为 False。我们通过环境变量来控制。
# 在本地运行时，由于没有设置 DJANGO_DEBUG，它会是 True。
# 在 Railway 上，我们会将 DJANGO_DEBUG 设置为 'False'。
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
]

# 从 Railway 环境变量中动态添加允许的域名
RAILWAY_STATIC_URL = os.environ.get('RAILWAY_STATIC_URL')
if RAILWAY_STATIC_URL:
    # The URL is like https://my-app.up.railway.app, we need the hostname
    from urllib.parse import urlparse
    # Ensure the hostname is not None before appending
    hostname = urlparse(RAILWAY_STATIC_URL).hostname
    if hostname:
        ALLOWED_HOSTS.append(hostname)
SECURE_CROSS_ORIGIN_OPENER_POLICY = None

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "api",
    # 开发环境：允许跨域访问
    "corsheaders",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend_django.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "backend_django.wsgi.application"

import dj_database_url

# MySQL 配置：连接你现在的 anyue_lemon 库
# DATABASES = {
#     "default": {
#         "ENGINE": "django.db.backends.mysql",
#         "NAME": "anyue_lemon",
#         "USER": "root",
#         "PASSWORD": "linjiamin2006",
#         "HOST": "localhost",
#         "PORT": "3306",
#         "OPTIONS": {"charset": "utf8mb4"},
#     }
# }

# 生产环境从 DATABASE_URL 环境变量读取数据库配置
# 本地开发时，如果没有设置 DATABASE_URL，则回退到使用本地的 MySQL 数据库
DATABASES = {
    'default': dj_database_url.config(
        default='mysql://root:linjiamin2006@localhost:3306/anyue_lemon?charset=utf8mb4',
        conn_max_age=600
    )
}

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = False

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# 上传文件（商品图片等）
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS 配置（仅开发环境，方便前端本地调试）
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# ============================================================
# 和风天气（QWeather）配置
# ============================================================
# 说明：
# - 推荐把 JWT 放到环境变量里；这里提供默认值为空，避免误提交真实 token
# - location 默认安岳：101271302
QWEATHER_API_HOST = "nu6r6xjvr7.re.qweatherapi.com"
QWEATHER_JWT_TOKEN = ""  # 形如：eyJhbGciOiJFZERTQSIs...
QWEATHER_LOCATION_ID = "101271302"
QWEATHER_TIMEOUT_SECONDS = 8
QWEATHER_CACHE_SECONDS = 600  # 10分钟缓存（减轻调用频率）

# ============================================================
# 高德 Web 服务 Key（用于地理编码/逆地理编码等 restapi.amap.com 接口）
# ============================================================
# 说明：建议放到环境变量 AMAP_WEB_SERVICE_KEY；本地开发可先使用默认值
AMAP_WEB_SERVICE_KEY = os.environ.get(
    "AMAP_WEB_SERVICE_KEY",
    "ec8f38aa92cb32349b2a7bd1fa693f9d",
)

