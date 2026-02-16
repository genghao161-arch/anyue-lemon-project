import json
import time

import jwt
import requests

API_HOST = "nu6r6xjvr7.re.qweatherapi.com"
# 和风给你的私钥是裸 base64，需要按 EdDSA 要求包成 PKCS8 PEM 格式
PRIVATE_KEY = (
    "-----BEGIN PRIVATE KEY-----\n"
    "MC4CAQAwBQYDK2VwBCIEIAb23+HGsJAbSDYHRN27MYU+4WwB9qe7RY8bfrhb4lMG\n"
    "-----END PRIVATE KEY-----"
)
PROJECT_ID = "2K85Y4C4UV"
CREDENTIAL_ID = "KKPM9Q55NY"

AN_YUE_LOCATION = "101271302"


class WeatherAPI:
    """和风天气 API 客户端（给 Django 用）"""

    def __init__(self):
        self.api_host = API_HOST
        self._cached_token = None
        self._cached_exp = 0

    def _get_jwt_token(self) -> str:
        """按和风要求动态生成 EdDSA JWT，并做简单缓存。"""
        now = int(time.time())
        if self._cached_token and now < self._cached_exp - 60:
            return self._cached_token

        payload = {
            "iat": now - 30,
            "exp": now + 900,
            "sub": PROJECT_ID,
        }
        headers = {"kid": CREDENTIAL_ID}

        token = jwt.encode(payload, PRIVATE_KEY, algorithm="EdDSA", headers=headers)
        self._cached_token = token
        self._cached_exp = payload["exp"]
        return token

    def _request(self, path: str, params: dict | None = None) -> dict | None:
        url = f"https://{self.api_host}{path}"
        headers = {
            "Authorization": f"Bearer {self._get_jwt_token()}",
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
        }
        try:
            resp = requests.get(url, params=params or {}, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "200":
                return data
            print(f"QWeather API error code={data.get('code')}")
            return data
        except Exception as e:  # 网络 / JSON / 其他异常
            print(f"QWeather request error: {e}")
            return None

    def get_an_yue_weather(self):
        return self._request("/v7/weather/now", {"location": AN_YUE_LOCATION})

    def get_an_yue_hourly_forecast(self, hours: str = "24h"):
        path = f"/v7/weather/{hours}"
        return self._request(path, {"location": AN_YUE_LOCATION})

    def get_an_yue_daily_forecast(self, days: str = "7d"):
        """
        获取安岳未来 N 天预报，默认 7 天。
        对应文档: https://dev.qweather.com/docs/api/weather/weather-daily-forecast/
        """
        path = f"/v7/weather/{days}"
        return self._request(path, {"location": AN_YUE_LOCATION})

