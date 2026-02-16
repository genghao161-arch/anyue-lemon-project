from django.db import connection
from django.db.utils import OperationalError
from django.http import JsonResponse
from django.conf import settings

from django.contrib.auth import authenticate, login, logout, get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import os
import uuid
import datetime
import urllib.parse
import urllib.request

from .qweather_api import WeatherAPI
from .models import Product, Activity, Store, CustomerConversation, CustomerMessage


_HAS_PRODUCTS_IMAGES_COL = None
_HAS_PRODUCTS_SUBTITLE_COL = None
_HAS_PRODUCTS_DETAIL_COL = None
_HAS_ACTIVITIES_POSTER_COL = None
_HAS_ACTIVITIES_CLICK_COUNT_COL = None
# 简单规格缓存：product_id -> specs（前端录入的规格结构）
_PRODUCT_SPECS_CACHE = {}


def _has_products_images_column() -> bool:
    """
    运行时探测 products 表是否已有 images 列。
    避免数据库尚未 ALTER 时直接 500。
    """
    global _HAS_PRODUCTS_IMAGES_COL
    if _HAS_PRODUCTS_IMAGES_COL is not None:
        return bool(_HAS_PRODUCTS_IMAGES_COL)
    try:
        with connection.cursor() as cur:
            cur.execute("SHOW COLUMNS FROM `products` LIKE 'images'")
            _HAS_PRODUCTS_IMAGES_COL = cur.fetchone() is not None
    except Exception:
        _HAS_PRODUCTS_IMAGES_COL = False
    return bool(_HAS_PRODUCTS_IMAGES_COL)


def _has_products_subtitle_column() -> bool:
    """
    运行时探测 products 表是否已有 subtitle 列。
    某些环境数据库表缺列时，Django 默认查询会直接 500。
    """
    global _HAS_PRODUCTS_SUBTITLE_COL
    if _HAS_PRODUCTS_SUBTITLE_COL is not None:
        return bool(_HAS_PRODUCTS_SUBTITLE_COL)
    try:
        with connection.cursor() as cur:
            cur.execute("SHOW COLUMNS FROM `products` LIKE 'subtitle'")
            _HAS_PRODUCTS_SUBTITLE_COL = cur.fetchone() is not None
    except Exception:
        _HAS_PRODUCTS_SUBTITLE_COL = False
    return bool(_HAS_PRODUCTS_SUBTITLE_COL)


def _has_products_detail_column() -> bool:
    """
    运行时探测 products 表是否已有 detail 列。
    """
    global _HAS_PRODUCTS_DETAIL_COL
    if _HAS_PRODUCTS_DETAIL_COL is not None:
        return bool(_HAS_PRODUCTS_DETAIL_COL)
    try:
        with connection.cursor() as cur:
            cur.execute("SHOW COLUMNS FROM `products` LIKE 'detail'")
            _HAS_PRODUCTS_DETAIL_COL = cur.fetchone() is not None
    except Exception:
        _HAS_PRODUCTS_DETAIL_COL = False
    return bool(_HAS_PRODUCTS_DETAIL_COL)


def _ensure_products_detail_column():
    """
    确保 products 表有 detail 列。如果不存则自动创建。
    """
    global _HAS_PRODUCTS_DETAIL_COL
    if _has_products_detail_column():
        return True
    
    try:
        with connection.cursor() as cur:
            # 双重检查
            cur.execute("SHOW COLUMNS FROM `products` LIKE 'detail'")
            if cur.fetchone():
                _HAS_PRODUCTS_DETAIL_COL = True
                return True
            
            # 添加列
            cur.execute("ALTER TABLE `products` ADD COLUMN `detail` LONGTEXT NULL COMMENT '详情JSON'")
            _HAS_PRODUCTS_DETAIL_COL = True
            return True
    except Exception as e:
        print(f"Failed to add detail column: {e}")
        return False


_HAS_ACTIVITIES_POSTER_COL = None

def _has_activities_poster_column() -> bool:
    global _HAS_ACTIVITIES_POSTER_COL
    if _HAS_ACTIVITIES_POSTER_COL is not None:
        return bool(_HAS_ACTIVITIES_POSTER_COL)
    try:
        with connection.cursor() as cur:
            cur.execute("SHOW COLUMNS FROM `activities` LIKE 'poster'")
            _HAS_ACTIVITIES_POSTER_COL = cur.fetchone() is not None
    except Exception:
        _HAS_ACTIVITIES_POSTER_COL = False
    return bool(_HAS_ACTIVITIES_POSTER_COL)

def _ensure_activities_poster_column():
    global _HAS_ACTIVITIES_POSTER_COL
    if _has_activities_poster_column():
        return True
    try:
        with connection.cursor() as cur:
            cur.execute("SHOW COLUMNS FROM `activities` LIKE 'poster'")
            if cur.fetchone():
                _HAS_ACTIVITIES_POSTER_COL = True
                return True
            cur.execute("ALTER TABLE `activities` ADD COLUMN `poster` VARCHAR(500) NULL COMMENT '海报'")
            _HAS_ACTIVITIES_POSTER_COL = True
            return True
    except Exception as e:
        print(f"Failed to add poster column: {e}")
        return False


def _has_activities_click_count_column() -> bool:
    global _HAS_ACTIVITIES_CLICK_COUNT_COL
    if _HAS_ACTIVITIES_CLICK_COUNT_COL is not None:
        return bool(_HAS_ACTIVITIES_CLICK_COUNT_COL)
    try:
        with connection.cursor() as cur:
            cur.execute("SHOW COLUMNS FROM `activities` LIKE 'click_count'")
            _HAS_ACTIVITIES_CLICK_COUNT_COL = cur.fetchone() is not None
    except Exception:
        _HAS_ACTIVITIES_CLICK_COUNT_COL = False
    return bool(_HAS_ACTIVITIES_CLICK_COUNT_COL)

def _ensure_activities_click_count_column():
    global _HAS_ACTIVITIES_CLICK_COUNT_COL
    if _has_activities_click_count_column():
        return True
    try:
        with connection.cursor() as cur:
            cur.execute("SHOW COLUMNS FROM `activities` LIKE 'click_count'")
            if cur.fetchone():
                _HAS_ACTIVITIES_CLICK_COUNT_COL = True
                return True
            cur.execute("ALTER TABLE `activities` ADD COLUMN `click_count` INT DEFAULT 0 COMMENT '点击数'")
            _HAS_ACTIVITIES_CLICK_COUNT_COL = True
            return True
    except Exception as e:
        print(f"Failed to add click_count column: {e}")
        return False


def _ensure_products_images_column():
    """
    确保 products 表有 images 列。如果不存则自动创建。
    """
    global _HAS_PRODUCTS_IMAGES_COL
    if _has_products_images_column():
        return True
    
    try:
        with connection.cursor() as cur:
            # 双重检查
            cur.execute("SHOW COLUMNS FROM `products` LIKE 'images'")
            if cur.fetchone():
                _HAS_PRODUCTS_IMAGES_COL = True
                return True
            
            # 添加列
            cur.execute("ALTER TABLE `products` ADD COLUMN `images` LONGTEXT NULL COMMENT '其他图片JSON'")
            _HAS_PRODUCTS_IMAGES_COL = True
            return True
    except Exception as e:
        print(f"Failed to add images column: {e}")
        return False


def _parse_images_field(raw):
    """
    products.images 字段兼容：
    - JSON 数组字符串：["url1","url2"]
    - 逗号/换行分隔：url1,url2 或 url1\nurl2
    """
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    s = str(raw).strip()
    if not s:
        return []
    # JSON 数组
    if s.startswith("[") and s.endswith("]"):
        try:
            arr = json.loads(s)
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if str(x).strip()]
        except Exception:
            pass
    # 逗号/换行分隔
    parts = []
    for chunk in s.replace("\r", "\n").split("\n"):
        parts.extend(chunk.split(","))
    return [p.strip() for p in parts if p.strip()]

User = get_user_model()


def db_health(request):
    """
    数据库连通性检查（Django 版）
    """
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT DATABASE()")
            db = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) "
                "FROM information_schema.tables "
                "WHERE table_schema = DATABASE()"
            )
            table_count = cur.fetchone()[0]
        return JsonResponse({"ok": True, "db": db, "table_count": table_count})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


def _require_staff(request):
    """
    简单的管理员权限检查工具
    """
    if not request.user.is_authenticated:
        return JsonResponse({"ok": False, "error": "请先登录"}, status=401)
    if not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({"ok": False, "error": "没有管理员权限"}, status=403)
    return None


@csrf_exempt
@require_http_methods(["POST"])
def admin_upload_image_view(request):
    """
    管理员上传图片
    POST /api/admin/upload-image
    form-data: file=<image>
    return: { ok: true, url: "http://host/media/uploads/products/xxx.jpg", path: "/media/..." }
    """
    perm_resp = _require_staff(request)
    if perm_resp is not None:
        return perm_resp

    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"ok": False, "error": "缺少文件字段 file"}, status=400)

    # 简单校验：只允许常见图片后缀
    name = f.name or "upload"
    ext = os.path.splitext(name)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        return JsonResponse({"ok": False, "error": "仅支持 jpg/jpeg/png/webp/gif"}, status=400)

    # 限制大小：5MB
    if getattr(f, "size", 0) and f.size > 5 * 1024 * 1024:
        return JsonResponse({"ok": False, "error": "图片大小不能超过 5MB"}, status=400)

    rel_dir = os.path.join("uploads", "products")
    abs_dir = os.path.join(str(settings.MEDIA_ROOT), rel_dir)
    os.makedirs(abs_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(abs_dir, filename)

    with open(abs_path, "wb") as out:
        for chunk in f.chunks():
            out.write(chunk)

    rel_url = f"{settings.MEDIA_URL}{rel_dir.replace(os.sep, '/')}/{filename}"
    url = request.build_absolute_uri(rel_url)
    return JsonResponse({"ok": True, "url": url, "path": rel_url})


@require_http_methods(["GET"])
def admin_geocode_view(request):
    """
    管理员：地址转经纬度（高德 Web 服务地理编码）
    GET /api/admin/geocode?address=...&city=...
    """
    perm_resp = _require_staff(request)
    if perm_resp is not None:
        return perm_resp

    address = (request.GET.get("address") or "").strip()
    city = (request.GET.get("city") or "").strip()
    if not address:
        return JsonResponse({"ok": False, "error": "缺少 address 参数"}, status=400)

    key = getattr(settings, "AMAP_WEB_SERVICE_KEY", "") or ""
    if not key:
        return JsonResponse({"ok": False, "error": "后端未配置 AMAP_WEB_SERVICE_KEY"}, status=500)

    params = {"key": key, "address": address, "output": "JSON"}
    if city:
        params["city"] = city
    url = "https://restapi.amap.com/v3/geocode/geo?" + urllib.parse.urlencode(params)

    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
        data = json.loads(raw or "{}")
    except Exception as e:
        return JsonResponse({"ok": False, "error": f"请求高德地理编码失败: {str(e)}"}, status=502)

    if str(data.get("status")) != "1":
        return JsonResponse({"ok": False, "error": f"高德返回失败: {data.get('info') or 'unknown'}"}, status=502)

    geos = data.get("geocodes") or []
    if not geos:
        return JsonResponse({"ok": False, "error": "未匹配到坐标，请检查地址"}, status=404)

    loc = (geos[0].get("location") or "").strip()
    if not loc or "," not in loc:
        return JsonResponse({"ok": False, "error": "高德返回 location 无效"}, status=502)

    lng_str, lat_str = loc.split(",", 1)
    try:
        lng = float(lng_str)
        lat = float(lat_str)
    except Exception:
        return JsonResponse({"ok": False, "error": "解析经纬度失败"}, status=502)

    return JsonResponse(
        {
            "ok": True,
            "lng": lng,
            "lat": lat,
            "location": loc,
            "formatted": geos[0].get("formatted_address") or "",
        }
    )


def _build_user_payload(user: User):
    """
    统一构造前端需要的用户信息
    目前约定：username 就是手机号
    """
    return {
        "id": user.id,
        "phone": user.username,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "is_active": user.is_active,
    }


@csrf_exempt  # 开发环境简化 CSRF 处理
@require_http_methods(["POST"])
def register_view(request):
    """
    手机号注册接口
    POST /api/auth/register
    body: { "phone": "...", "password": "..." }
    """
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "请求体必须是 JSON"}, status=400)

    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not phone or not password:
        return JsonResponse({"ok": False, "error": "手机号和密码不能为空"}, status=400)

    if len(password) < 6:
        return JsonResponse({"ok": False, "error": "密码长度至少为 6 位"}, status=400)

    if User.objects.filter(username=phone).exists():
        return JsonResponse({"ok": False, "error": "该手机号已注册"}, status=400)

    user = User(username=phone)
    user.set_password(password)
    user.is_active = True
    user.save()

    # 注册成功后直接登录
    login(request, user)

    return JsonResponse({"ok": True, "user": _build_user_payload(user)})


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    """
    手机号登录接口
    POST /api/auth/login
    body: { "phone": "...", "password": "..." }
    """
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "请求体必须是 JSON"}, status=400)

    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not phone or not password:
        return JsonResponse({"ok": False, "error": "手机号和密码不能为空"}, status=400)

    user = authenticate(request, username=phone, password=password)
    if user is None:
        return JsonResponse({"ok": False, "error": "手机号或密码错误"}, status=401)

    if not user.is_active:
        return JsonResponse({"ok": False, "error": "账号已被禁用"}, status=403)

    # 管理员账号：登录时自动赋予后台权限（避免数据库未设置 is_staff 导致 403）
    admin_phones = getattr(settings, "ADMIN_PHONES", ["admin"])
    if phone in admin_phones and (not user.is_staff or not user.is_superuser):
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])

    login(request, user)
    return JsonResponse({"ok": True, "user": _build_user_payload(user)})


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    """
    退出登录
    POST /api/auth/logout
    """
    logout(request)
    return JsonResponse({"ok": True})


@require_http_methods(["GET"])
def current_user_view(request):
    """
    获取当前登录用户信息
    GET /api/auth/me
    """
    if not request.user.is_authenticated:
        return JsonResponse({"ok": False, "user": None})

    return JsonResponse({"ok": True, "user": _build_user_payload(request.user)})


@require_http_methods(["GET"])
def weather_now_view(request):
    """
    和风天气 · 安岳实时天气 + 简单小时预报
    GET /api/weather/now
    """
    api = WeatherAPI()
    now_data = api.get_an_yue_weather()
    if not now_data or now_data.get("code") != "200":
        code = now_data.get("code") if isinstance(now_data, dict) else "unknown"
        return JsonResponse({"ok": False, "error": f"获取实时天气失败: {code}"}, status=502)

    hourly_data = api.get_an_yue_hourly_forecast("24h")

    now = now_data.get("now", {})
    payload = {
        "temp": now.get("temp"),
        "desc": now.get("text"),
        "humidity": f"{now.get('humidity')}%",
        "precip": f"{now.get('precip')}mm",
        "windDir": now.get("windDir"),
        "windSpeed": f"{now.get('windSpeed')}km/h",
        "updateTime": now_data.get("updateTime"),
        "hourly": [],
    }

    if hourly_data and hourly_data.get("code") == "200":
        payload["hourly"] = [
            {
                "fxTime": h.get("fxTime"),
                "temp": h.get("temp"),
                "icon": h.get("icon"),
                "text": h.get("text"),
            }
            for h in (hourly_data.get("hourly") or [])[:8]
        ]

    return JsonResponse({"ok": True, "data": payload})


@require_http_methods(["GET"])
def weather_daily_view(request):
    """
    和风天气 · 安岳未来 7 天天气预报
    GET /api/weather/7d
    """
    api = WeatherAPI()
    daily_data = api.get_an_yue_daily_forecast("7d")
    if not daily_data or daily_data.get("code") != "200":
        code = daily_data.get("code") if isinstance(daily_data, dict) else "unknown"
        return JsonResponse({"ok": False, "error": f"获取7天天气预报失败: {code}"}, status=502)

    days = []
    for d in daily_data.get("daily", [])[:7]:
        days.append(
            {
                "date": d.get("fxDate"),
                "tempMax": d.get("tempMax"),
                "tempMin": d.get("tempMin"),
                "textDay": d.get("textDay"),
                "textNight": d.get("textNight"),
                "iconDay": d.get("iconDay"),
                "iconNight": d.get("iconNight"),
                "windDirDay": d.get("windDirDay"),
                "windScaleDay": d.get("windScaleDay"),
                "windDirNight": d.get("windDirNight"),
                "windScaleNight": d.get("windScaleNight"),
                "humidity": d.get("humidity"),
                "precip": d.get("precip"),
                "uvIndex": d.get("uvIndex"),
            }
        )

    payload = {
        "updateTime": daily_data.get("updateTime"),
        "days": days,
    }

    return JsonResponse({"ok": True, "data": payload})


@require_http_methods(["GET"])
def activities_list_view(request):
    """
    活动列表接口
    GET /api/activities
    """
    try:
        _ensure_activities_click_count_column()
        qs = Activity.objects.all().order_by("-start_date")
        if hasattr(Activity, "poster") and not _has_activities_poster_column():
            qs = qs.defer("poster")
            
        items = []
        has_poster = _has_activities_poster_column()
        has_click_count = _has_activities_click_count_column()
        
        for a in qs:
            items.append({
                "id": a.id,
                "title": a.title,
                "subtitle": a.subtitle or "",
                "description": a.description or "",
                "coverImage": a.cover_image or "",
                "poster": (a.poster or "") if has_poster else "",
                "startDate": a.start_date.isoformat(),
                "endDate": a.end_date.isoformat(),
                "status": a.status,
                "type": a.type or "",
                "participants": a.participants,
                "clickCount": getattr(a, "click_count", 0) if has_click_count else 0,
            })
        return JsonResponse({"ok": True, "items": items})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@require_http_methods(["GET"])
def public_activity_detail_view(request, activity_id):
    """
    活动详情接口（公开），增加点击数
    GET /api/activities/<id>
    """
    try:
        _ensure_activities_click_count_column()
        qs = Activity.objects
        if hasattr(Activity, "poster") and not _has_activities_poster_column():
            qs = qs.defer("poster")
            
        activity = qs.get(pk=activity_id)
        
        # Increment click count
        if hasattr(activity, 'click_count'):
            with connection.cursor() as cursor:
                cursor.execute("UPDATE activities SET click_count = COALESCE(click_count, 0) + 1 WHERE id = %s", [activity_id])
            activity.refresh_from_db()
        
        has_poster = _has_activities_poster_column()
        has_click_count = _has_activities_click_count_column()
        
        data = {
            "id": activity.id,
            "title": activity.title,
            "subtitle": activity.subtitle or "",
            "description": activity.description or "",
            "coverImage": activity.cover_image or "",
            "poster": (activity.poster or "") if has_poster else "",
            "startDate": activity.start_date.isoformat(),
            "endDate": activity.end_date.isoformat(),
            "status": activity.status,
            "type": activity.type or "",
            "participants": activity.participants,
            "clickCount": getattr(activity, "click_count", 0) if has_click_count else 0
        }
        return JsonResponse({"ok": True, "item": data})
    except Activity.DoesNotExist:
        return JsonResponse({"ok": False, "error": "活动不存在"}, status=404)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


def _parse_product_details(p):
    """
    解析商品详情 JSON，返回 (detailAttributes, detailImages, specs, skus)
    """
    if not hasattr(p, "detail") or not p.detail:
        return [], [], [], []
    
    # 尝试解析 JSON
    try:
        data = json.loads(p.detail)
        if isinstance(data, dict):
             return (
                 data.get("attributes", []),
                 data.get("images", []),
                 data.get("specs", []),
                 data.get("skus", [])
             )
    except Exception:
        pass
    
    return [], [], [], []


@require_http_methods(["GET"])
def product_list_view(request):
    """
    商品列表接口
    GET /api/products
    返回所有上架商品（status = 1）
    """
    try:
        qs = Product.objects.filter(status=1).order_by("created_at")
        # 若数据库缺列，先 defer 避免 Unknown column 500
        if hasattr(Product, "images") and not _has_products_images_column():
            qs = qs.defer("images")
        if hasattr(Product, "subtitle") and not _has_products_subtitle_column():
            qs = qs.defer("subtitle")
        if hasattr(Product, "detail") and not _has_products_detail_column():
            qs = qs.defer("detail")

        has_images = _has_products_images_column()
        items = [
            {
                "id": p.id,
                "category": p.category,
                "tag": p.tag,
                "title": p.title,
                "desc": p.description or "",
                "price": float(p.price),
                "img": p.image or "",
                "images": _parse_images_field(getattr(p, "images", None)) if has_images else [],
                "taobaoUrl": p.taobao_url or "",
            }
            for p in qs
        ]
        return JsonResponse({"ok": True, "items": items})
    except OperationalError as e:
        return JsonResponse({"ok": False, "error": f"商品列表查询失败: {str(e)}"}, status=500)


@require_http_methods(["GET"])
def product_detail_view(request, product_id: str):
    """
    商品详情接口
    GET /api/products/<id>
    """
    try:
        qs = Product.objects
        if hasattr(Product, "images") and not _has_products_images_column():
            qs = qs.defer("images")
        if hasattr(Product, "subtitle") and not _has_products_subtitle_column():
            qs = qs.defer("subtitle")
        if hasattr(Product, "detail") and not _has_products_detail_column():
            qs = qs.defer("detail")
        p = qs.get(pk=product_id)
    except Product.DoesNotExist:
        return JsonResponse({"ok": False, "error": "商品不存在"}, status=404)
    except OperationalError as e:
        # 兼容数据库缺列导致的查询失败
        return JsonResponse({"ok": False, "error": f"商品数据异常: {str(e)}"}, status=500)

    detail_attrs, detail_imgs, specs, skus = _parse_product_details(p)
    data = {
        "id": p.id,
        "category": p.category,
        "tag": p.tag,
        "title": p.title,
        "desc": p.description or "",
        "price": float(p.price),
        "img": p.image or "",
        "images": _parse_images_field(getattr(p, "images", None))
        if _has_products_images_column()
        else [],
        "detailAttributes": detail_attrs,
        "detailImages": detail_imgs,
        "taobaoUrl": p.taobao_url or "",
        "stock": p.stock,
        "sales": p.sales,
        "status": p.status,
        "specs": specs if specs else _PRODUCT_SPECS_CACHE.get(str(p.id), []),
        "skus": skus,
    }
    return JsonResponse({"ok": True, "item": data})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_activity_list_create_view(request):
    """
    活动管理列表 / 新增接口
    GET /api/admin/activities
    POST /api/admin/activities
    """
    perm_resp = _require_staff(request)
    if perm_resp is not None:
        return perm_resp

    if request.method == "GET":
        try:
            qs = Activity.objects.all().order_by("-start_date")
            if hasattr(Activity, "poster") and not _has_activities_poster_column():
                qs = qs.defer("poster")
            if hasattr(Activity, "click_count") and not _has_activities_click_count_column():
                qs = qs.defer("click_count")
            
            items = []
            has_poster = _has_activities_poster_column()
            has_click_count = _has_activities_click_count_column()
            for a in qs:
                items.append({
                    "id": a.id,
                    "title": a.title,
                    "subtitle": a.subtitle or "",
                    "description": a.description or "",
                    "coverImage": a.cover_image or "",
                    "poster": (a.poster or "") if has_poster else "",
                    "startDate": a.start_date.isoformat(),
                    "endDate": a.end_date.isoformat(),
                    "status": a.status,
                    "type": a.type or "",
                    "participants": a.participants,
                    "clickCount": getattr(a, "click_count", 0) if has_click_count else 0,
                })
            return JsonResponse({"ok": True, "items": items})
        except Exception as e:
            return JsonResponse({"ok": False, "error": f"活动列表查询失败: {str(e)}"}, status=500)

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            _ensure_activities_poster_column()
            
            if not data.get("title") or not data.get("startDate") or not data.get("endDate"):
                return JsonResponse({"ok": False, "error": "缺少必填字段"}, status=400)
                
            activity_id = str(uuid.uuid4())
            activity = Activity(
                id=activity_id,
                title=data["title"],
                subtitle=data.get("subtitle", ""),
                description=data.get("description", ""),
                cover_image=data.get("coverImage", ""),
                poster=data.get("poster", ""),
                start_date=data["startDate"],
                end_date=data["endDate"],
                status=data.get("status", "active"),
                type=data.get("type", "normal"),
                participants=0,
                created_at=datetime.datetime.now(),
                updated_at=datetime.datetime.now(),
            )
            activity.save()
            return JsonResponse({"ok": True, "id": activity_id})
        except Exception as e:
            return JsonResponse({"ok": False, "error": f"创建活动失败: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def admin_activity_detail_view(request, activity_id):
    """
    活动详情 / 更新 / 删除
    GET /api/admin/activities/<id>
    PUT /api/admin/activities/<id>
    DELETE /api/admin/activities/<id>
    """
    perm_resp = _require_staff(request)
    if perm_resp is not None:
        return perm_resp

    try:
        qs = Activity.objects
        if hasattr(Activity, "poster") and not _has_activities_poster_column():
            qs = qs.defer("poster")
        activity = qs.get(pk=activity_id)
    except Activity.DoesNotExist:
        return JsonResponse({"ok": False, "error": "活动不存在"}, status=404)
    except OperationalError as e:
        return JsonResponse({"ok": False, "error": f"数据库异常: {str(e)}"}, status=500)
        
    if request.method == "DELETE":
        activity.delete()
        return JsonResponse({"ok": True})

    if request.method == "PUT":
        try:
            data = json.loads(request.body)
            _ensure_activities_poster_column()
            
            activity.title = data.get("title", activity.title)
            activity.subtitle = data.get("subtitle", activity.subtitle)
            activity.description = data.get("description", activity.description)
            activity.cover_image = data.get("coverImage", activity.cover_image)
            activity.poster = data.get("poster", activity.poster)
            if "startDate" in data:
                activity.start_date = data["startDate"]
            if "endDate" in data:
                activity.end_date = data["endDate"]
            activity.status = data.get("status", activity.status)
            activity.type = data.get("type", activity.type)
            activity.updated_at = datetime.datetime.now()
            
            activity.save()
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"ok": False, "error": f"更新活动失败: {str(e)}"}, status=500)

    has_poster = _has_activities_poster_column()
    return JsonResponse({
        "ok": True,
        "item": {
            "id": activity.id,
            "title": activity.title,
            "subtitle": activity.subtitle,
            "description": activity.description,
            "coverImage": activity.cover_image,
            "poster": getattr(activity, "poster", "") if has_poster else "",
            "startDate": activity.start_date.isoformat(),
            "endDate": activity.end_date.isoformat(),
            "status": activity.status,
            "type": activity.type,
            "participants": activity.participants,
        }
    })


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_product_list_create_view(request):
    """
    商品管理列表 / 新增接口（管理员）
    GET /api/admin/products
    POST /api/admin/products
    """
    perm_resp = _require_staff(request)
    if perm_resp is not None:
        return perm_resp

    if request.method == "GET":
        try:
            qs = Product.objects.all().order_by("-created_at")
            if hasattr(Product, "images") and not _has_products_images_column():
                qs = qs.defer("images")
            if hasattr(Product, "subtitle") and not _has_products_subtitle_column():
                qs = qs.defer("subtitle")
            if hasattr(Product, "detail") and not _has_products_detail_column():
                qs = qs.defer("detail")
            has_images = _has_products_images_column()
            items = []
            for p in qs:
                detail_attrs, detail_imgs, specs, skus = _parse_product_details(p)
                items.append(
                    {
                        "id": p.id,
                        "category": p.category,
                        "tag": p.tag,
                        "title": p.title,
                        "desc": p.description or "",
                        "price": float(p.price),
                        "img": p.image or "",
                        "images": _parse_images_field(getattr(p, "images", None)) if has_images else [],
                        "detailAttributes": detail_attrs,
                        "detailImages": detail_imgs,
                        "taobaoUrl": p.taobao_url or "",
                        "stock": p.stock,
                        "sales": p.sales,
                        "status": p.status,
                        "specs": specs if specs else _PRODUCT_SPECS_CACHE.get(str(p.id), []),
                        "skus": skus,
                    }
                )
            return JsonResponse({"ok": True, "items": items})
        except OperationalError as e:
            return JsonResponse({"ok": False, "error": f"商品管理列表查询失败: {str(e)}"}, status=500)

    # POST - 创建商品
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "请求体必须是 JSON"}, status=400)

    product_id = (data.get("id") or "").strip()
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip() or "fresh"
    price = data.get("price")

    if not product_id or not title or price is None:
        return JsonResponse({"ok": False, "error": "id、标题和价格为必填"}, status=400)

    if Product.objects.filter(pk=product_id).exists():
        return JsonResponse({"ok": False, "error": "该商品 ID 已存在"}, status=400)

    # 构造 detail 字段 JSON (Section 5 + Section 3 Specs)
    detail_data = {
        "attributes": data.get("detailTable") or [],
        "images": data.get("detailImages") or [],
        "specs": data.get("specs") or [],
        "skus": data.get("skus") or []
    }
    # 只有当有内容时才存 JSON，否则存空字符串或 None
    has_detail_content = (detail_data["attributes"] or detail_data["images"] or detail_data["specs"] or detail_data["skus"])
    detail_json_str = json.dumps(detail_data, ensure_ascii=False) if has_detail_content else ""

    # 确保数据库列存在（因为 Product 模型包含这些字段，新建时必须保证列存在，否则 INSERT 会失败）
    _ensure_products_detail_column()
    _ensure_products_images_column()

    p = Product(
        id=product_id,
        title=title,
        category=category,
        tag=(data.get("tag") or "").strip(),
        description=data.get("desc") or "",
        detail=detail_json_str if _has_products_detail_column() else None,
        price=price,
        image=data.get("img") or "",
        # 若数据库已加 images 列才写入，避免 Unknown column
        images=(
            json.dumps(data.get("images"), ensure_ascii=False)
            if isinstance(data.get("images"), list)
            else (data.get("images") or "")
        )
        if _has_products_images_column()
        else None,
        taobao_url=data.get("taobaoUrl") or "",
        stock=data.get("stock") or 0,
        sales=data.get("sales") or 0,
        status=data.get("status") if data.get("status") is not None else 1,
    )
    # created_at / updated_at 由数据库默认值处理
    try:
        p.save(force_insert=True)
    except Exception as e:
        return JsonResponse({"ok": False, "error": f"创建失败(DB): {str(e)}"}, status=500)

    # 缓存前端录入的简单规格结构（不改数据库，仅进程内保存）
    specs = data.get("specs")
    if isinstance(specs, list):
        _PRODUCT_SPECS_CACHE[str(product_id)] = specs

    detail_attrs, detail_imgs, specs_saved, skus_saved = _parse_product_details(p)

    return JsonResponse(
        {
            "ok": True,
            "item": {
                "id": p.id,
                "category": p.category,
                "tag": p.tag,
                "title": p.title,
                "desc": p.description or "",
                "price": float(p.price),
                "img": p.image or "",
                "images": _parse_images_field(getattr(p, "images", None))
                if _has_products_images_column()
                else [],
                "detailAttributes": detail_attrs,
                "detailImages": detail_imgs,
                "taobaoUrl": p.taobao_url or "",
                "stock": p.stock,
                "sales": p.sales,
                "status": p.status,
                "specs": specs_saved if specs_saved else _PRODUCT_SPECS_CACHE.get(str(p.id), []),
                "skus": skus_saved,
            },
        }
    )


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def admin_product_detail_view(request, product_id: str):
    """
    商品管理详情 / 修改 / 删除（管理员）
    GET /api/admin/products/<id>
    PUT /api/admin/products/<id>
    DELETE /api/admin/products/<id>
    """
    perm_resp = _require_staff(request)
    if perm_resp is not None:
        return perm_resp

    try:
        qs = Product.objects
        if hasattr(Product, "images") and not _has_products_images_column():
            qs = qs.defer("images")
        if hasattr(Product, "subtitle") and not _has_products_subtitle_column():
            qs = qs.defer("subtitle")
        if hasattr(Product, "detail") and not _has_products_detail_column():
            qs = qs.defer("detail")
        p = qs.get(pk=product_id)
    except Product.DoesNotExist:
        return JsonResponse({"ok": False, "error": "商品不存在"}, status=404)

    if request.method == "GET":
        d_attrs, d_imgs, d_specs, d_skus = _parse_product_details(p)
        final_specs = d_specs if d_specs else _PRODUCT_SPECS_CACHE.get(str(p.id), [])
        
        data = {
            "id": p.id,
            "category": p.category,
            "tag": p.tag,
            "title": p.title,
            "desc": p.description or "",
            "price": float(p.price),
            "img": p.image or "",
            "images": _parse_images_field(getattr(p, "images", None))
            if _has_products_images_column()
            else [],
            "taobaoUrl": p.taobao_url or "",
            "stock": p.stock,
            "sales": p.sales,
            "status": p.status,
            "specs": final_specs,
            "skus": d_skus,
            "detailAttributes": d_attrs,
            "detailImages": d_imgs,
        }
        return JsonResponse({"ok": True, "item": data})

    if request.method == "DELETE":
        p.delete()
        return JsonResponse({"ok": True})

    # PUT - 局部更新
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "请求体必须是 JSON"}, status=400)

    for field, attr in [
        ("title", "title"),
        ("category", "category"),
        ("tag", "tag"),
        ("desc", "description"),
        ("price", "price"),
        ("img", "image"),
        ("images", "images"),
        ("taobaoUrl", "taobao_url"),
        ("stock", "stock"),
        ("sales", "sales"),
        ("status", "status"),
    ]:
        if field in data and data[field] is not None:
            if field == "images":
                if data[field]: # Only create column if we actually have data
                    _ensure_products_images_column()
                
                if not _has_products_images_column():
                    continue
                v = data[field]
                if isinstance(v, list):
                    setattr(p, attr, json.dumps(v, ensure_ascii=False))
                else:
                    setattr(p, attr, v)
            else:
                setattr(p, attr, data[field])

    # 更新简单规格缓存
    if "specs" in data and isinstance(data.get("specs"), list):
        _PRODUCT_SPECS_CACHE[str(product_id)] = data.get("specs")

    # 更新详情字段 (Section 5 + Section 3 Specs + Skus)
    should_update_detail = ("detailTable" in data or "detailImages" in data or "specs" in data or "skus" in data)
    
    if should_update_detail:
        _ensure_products_detail_column()
        
        if _has_products_detail_column():
            current_detail = {}
            try:
                 # 安全读取: 只有列存在时才读取
                 if p.detail:
                     current_detail = json.loads(p.detail)
            except Exception:
                 pass
            
            if "detailTable" in data:
                current_detail["attributes"] = data["detailTable"]
            if "detailImages" in data:
                current_detail["images"] = data["detailImages"]
            if "specs" in data:
                current_detail["specs"] = data["specs"]
            if "skus" in data:
                current_detail["skus"] = data["skus"]
                
            p.detail = json.dumps(current_detail, ensure_ascii=False)

    try:
        p.save()
    except Exception as e:
        return JsonResponse({"ok": False, "error": f"更新失败(DB): {str(e)}"}, status=500)

    return JsonResponse({"ok": True})


@require_http_methods(["GET"])
def stores_list_view(request):
    """
    门店列表接口（前台使用，只返回营业门店）
    GET /api/stores
    """
    qs = Store.objects.filter(status=1).order_by("id")
    items = [
        {
            "id": s.id,
            "name": s.name,
            "address": s.address,
            "city": s.city,
            "lng": float(s.longitude) if s.longitude is not None else None,
            "lat": float(s.latitude) if s.latitude is not None else None,
            "hours": s.hours or "",
        }
        for s in qs
    ]
    return JsonResponse({"ok": True, "items": items})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_store_list_create_view(request):
    """
    门店管理列表 / 新增接口（管理员）
    GET /api/admin/stores
    POST /api/admin/stores
    """
    perm_resp = _require_staff(request)
    if perm_resp is not None:
        return perm_resp

    if request.method == "GET":
        qs = Store.objects.all().order_by("id")
        items = [
            {
                "id": s.id,
                "name": s.name,
                "address": s.address,
                "city": s.city,
                "lng": float(s.longitude) if s.longitude is not None else None,
                "lat": float(s.latitude) if s.latitude is not None else None,
                "hours": s.hours or "",
                "phone": s.phone or "",
                "status": s.status,
            }
            for s in qs
        ]
        return JsonResponse({"ok": True, "items": items})

    # POST - 新增门店
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "请求体必须是 JSON"}, status=400)

    name = (data.get("name") or "").strip()
    address = (data.get("address") or "").strip()
    city = (data.get("city") or "").strip()
    lng = data.get("lng")
    lat = data.get("lat")

    if not name or not address or not city:
        return JsonResponse({"ok": False, "error": "门店名称、地址、城市为必填"}, status=400)

    # 可选坐标：前端传入字符串/数字都可
    try:
        lng_val = float(lng) if lng not in (None, "") else None
    except Exception:
        return JsonResponse({"ok": False, "error": "经度 lng 必须是数字"}, status=400)
    try:
        lat_val = float(lat) if lat not in (None, "") else None
    except Exception:
        return JsonResponse({"ok": False, "error": "纬度 lat 必须是数字"}, status=400)

    s = Store(
        name=name,
        address=address,
        city=city,
        longitude=lng_val,
        latitude=lat_val,
        hours=data.get("hours") or "",
        phone=data.get("phone") or "",
        status=data.get("status") if data.get("status") is not None else 1,
    )
    s.save(force_insert=True)

    return JsonResponse({"ok": True, "item": {"id": s.id}})


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def admin_store_detail_view(request, store_id: int):
    """
    门店详情 / 修改 / 删除（管理员）
    GET /api/admin/stores/<id>
    PUT /api/admin/stores/<id>
    DELETE /api/admin/stores/<id>
    """
    perm_resp = _require_staff(request)
    if perm_resp is not None:
        return perm_resp

    try:
        s = Store.objects.get(pk=store_id)
    except Store.DoesNotExist:
        return JsonResponse({"ok": False, "error": "门店不存在"}, status=404)

    if request.method == "GET":
        data = {
            "id": s.id,
            "name": s.name,
            "address": s.address,
            "city": s.city,
            "lng": float(s.longitude) if s.longitude is not None else None,
            "lat": float(s.latitude) if s.latitude is not None else None,
            "hours": s.hours or "",
            "phone": s.phone or "",
            "status": s.status,
        }
        return JsonResponse({"ok": True, "item": data})

    if request.method == "DELETE":
        s.delete()
        return JsonResponse({"ok": True})

    # PUT - 更新门店
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "请求体必须是 JSON"}, status=400)

    for field, attr in [
        ("name", "name"),
        ("address", "address"),
        ("city", "city"),
        ("lng", "longitude"),
        ("lat", "latitude"),
        ("hours", "hours"),
        ("phone", "phone"),
        ("status", "status"),
    ]:
        if field in data and data[field] is not None:
            if field in ("lng", "lat"):
                v = data[field]
                if v in ("", None):
                    setattr(s, attr, None)
                else:
                    try:
                        setattr(s, attr, float(v))
                    except Exception:
                        return JsonResponse({"ok": False, "error": f"{field} 必须是数字"}, status=400)
            else:
                setattr(s, attr, data[field])

    s.save()
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_user_list_create_view(request):
    """
    管理员：用户管理列表 / 新增用户
    GET /api/admin/users
    POST /api/admin/users
    """
    perm = _require_staff(request)
    if perm is not None:
        return perm

    if request.method == "GET":
        try:
            users = User.objects.all().order_by("-date_joined")
            items = []
            for u in users:
                items.append({
                    "id": u.id,
                    "phone": u.username,
                    "is_staff": u.is_staff,
                    "is_active": u.is_active,
                    "date_joined": u.date_joined.isoformat() if u.date_joined else "",
                    "last_login": u.last_login.isoformat() if u.last_login else "",
                })
            return JsonResponse({"ok": True, "items": items})
        except Exception as e:
            return JsonResponse({"ok": False, "error": f"用户列表获取失败: {str(e)}"}, status=500)

    # POST - 创建用户
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
        phone = (data.get("phone") or "").strip()
        password = (data.get("password") or "").strip()
        is_staff = bool(data.get("is_staff"))
        
        if not phone or not password:
            return JsonResponse({"ok": False, "error": "手机号和密码不能为空"}, status=400)
            
        if User.objects.filter(username=phone).exists():
            return JsonResponse({"ok": False, "error": "该手机号已存在"}, status=400)
            
        user = User.objects.create_user(username=phone, password=password)
        user.is_staff = is_staff
        user.save()
        
        return JsonResponse({"ok": True, "id": user.id})
    except Exception as e:
        return JsonResponse({"ok": False, "error": f"创建用户失败: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def admin_user_detail_view(request, user_id):
    """
    管理员：更新 / 删除用户
    PUT /api/admin/users/<id>
    DELETE /api/admin/users/<id>
    """
    perm = _require_staff(request)
    if perm is not None:
        return perm
        
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"ok": False, "error": "用户不存在"}, status=404)
        
    if request.method == "DELETE":
        # 不允许删除自己
        if user.id == request.user.id:
            return JsonResponse({"ok": False, "error": "不能删除当前登录账号"}, status=400)
        user.delete()
        return JsonResponse({"ok": True})
        
    if request.method == "PUT":
        try:
            data = json.loads(request.body.decode("utf-8") or "{}")
            
            # 修改手机号 (用户名)
            phone = (data.get("phone") or "").strip()
            if phone and phone != user.username:
                if User.objects.filter(username=phone).exists():
                    return JsonResponse({"ok": False, "error": "该手机号已存在"}, status=400)
                user.username = phone

            # 修改密码
            password = data.get("password")
            if password:
                user.set_password(password)
                
            # 修改状态
            if "is_staff" in data:
                # 防止取消自己的管理员权限
                if user.id == request.user.id and not data["is_staff"]:
                     return JsonResponse({"ok": False, "error": "不能取消自己的管理员权限"}, status=400)
                user.is_staff = bool(data["is_staff"])
                
            if "is_active" in data:
                # 防止禁用自己
                if user.id == request.user.id and not data["is_active"]:
                     return JsonResponse({"ok": False, "error": "不能禁用当前登录账号"}, status=400)
                user.is_active = bool(data["is_active"])
                
            user.save()
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"ok": False, "error": f"更新用户失败: {str(e)}"}, status=500)


# ---------- 客服会话与消息（管理员 + 用户端） ----------


def _require_customer_auth(request):
    """用户端客服接口：需登录"""
    if not request.user.is_authenticated:
        return JsonResponse({"ok": False, "error": "请先登录"}, status=401)
    return None


@require_http_methods(["GET"])
def admin_customer_conversations_view(request):
    """
    管理员：会话列表
    GET /api/admin/customer/conversations
    """
    perm = _require_staff(request)
    if perm is not None:
        return perm
    convs = (
        CustomerConversation.objects.all()
        .order_by("-updated_at")
        .prefetch_related("messages")
    )
    items = []
    for c in convs:
        last_msg = c.messages.order_by("-created_at").first()
        content = (last_msg.content or "") if last_msg else ""
        items.append({
            "id": c.id,
            "customerName": c.customer_name,
            "lastMessage": (content[:80] if len(content) > 80 else content),
            "lastMessageTime": last_msg.created_at.isoformat() if last_msg else c.updated_at.isoformat(),
            "hasNewMessage": last_msg.sender_type == CustomerMessage.SENDER_CUSTOMER if last_msg else False,
        })
    return JsonResponse({"ok": True, "items": items})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_customer_messages_view(request, conv_id):
    """
    管理员：某会话的消息列表（GET）或发送消息（POST）
    GET /api/admin/customer/messages/<conv_id>
    POST /api/admin/customer/messages/<conv_id>  body: { "content": "..." }
    """
    perm = _require_staff(request)
    if perm is not None:
        return perm
    try:
        conv = CustomerConversation.objects.get(pk=conv_id)
    except CustomerConversation.DoesNotExist:
        return JsonResponse({"ok": False, "error": "会话不存在"}, status=404)
    if request.method == "GET":
        msgs = conv.messages.order_by("created_at")
        items = []
        for m in msgs:
            st = (m.sender_type or "").strip()
            # 确保只返回 staff / customer，避免显示名等导致前端左对齐
            sender_type = "staff" if st == CustomerMessage.SENDER_STAFF else "customer"
            items.append({
                "id": m.id,
                "senderType": sender_type,
                "content": m.content or "",
                "image": m.image or "",
                "createdAt": m.created_at.isoformat(),
            })
        return JsonResponse({"ok": True, "items": items})
    # POST
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "请求体必须是 JSON"}, status=400)
    content = (data.get("content") or "").strip()
    image = (data.get("image") or "").strip() or None
    if not content and not image:
        return JsonResponse({"ok": False, "error": "内容或图片不能为空"}, status=400)
    msg = CustomerMessage.objects.create(
        conversation=conv,
        sender_type=CustomerMessage.SENDER_STAFF,
        content=content,
        image=image,
    )
    conv.updated_at = msg.created_at
    conv.save(update_fields=["updated_at"])
    return JsonResponse({"ok": True, "item": {"id": msg.id, "createdAt": msg.created_at.isoformat()}})


@require_http_methods(["GET"])
def customer_conversation_view(request):
    """
    用户端：获取或创建我的会话
    GET /api/customer/conversation
    """
    auth = _require_customer_auth(request)
    if auth is not None:
        return auth
    user_id = request.user.id
    conv, created = CustomerConversation.objects.get_or_create(
        user_id=user_id,
        defaults={"customer_name": getattr(request.user, "username", "") or "客户"},
    )
    if not created and not conv.customer_name:
        conv.customer_name = getattr(request.user, "username", "") or "客户"
        conv.save(update_fields=["customer_name"])
    return JsonResponse({
        "ok": True,
        "conversation": {"id": conv.id},
    })


@csrf_exempt
@require_http_methods(["GET", "POST"])
def customer_messages_view(request):
    """
    用户端：获取当前用户会话的消息列表（GET）或发送消息（POST）
    GET /api/customer/messages
    POST /api/customer/messages  body: { "content": "...", "image": "...", "productId": "..." }
    """
    auth = _require_customer_auth(request)
    if auth is not None:
        return auth
    user_id = request.user.id
    if request.method == "GET":
        try:
            conv = CustomerConversation.objects.get(user_id=user_id)
        except CustomerConversation.DoesNotExist:
            return JsonResponse({"ok": True, "items": []})
        msgs = conv.messages.order_by("created_at")
        items = [
            {
                "id": m.id,
                "senderType": m.sender_type,
                "content": m.content or "",
                "image": m.image or "",
                "createdAt": m.created_at.isoformat(),
            }
            for m in msgs
        ]
        return JsonResponse({"ok": True, "items": items})
    # POST
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "请求体必须是 JSON"}, status=400)
    content = (data.get("content") or "").strip()
    image = (data.get("image") or "").strip() or None
    conv, _ = CustomerConversation.objects.get_or_create(
        user_id=user_id,
        defaults={"customer_name": getattr(request.user, "username", "") or "客户"},
    )
    msg = CustomerMessage.objects.create(
        conversation=conv,
        sender_type=CustomerMessage.SENDER_CUSTOMER,
        content=content,
        image=image,
    )
    conv.updated_at = msg.created_at
    conv.save(update_fields=["updated_at"])
    return JsonResponse({"ok": True, "item": {"id": msg.id, "createdAt": msg.created_at.isoformat()}})

