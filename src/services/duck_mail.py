"""
DuckMail 邮箱服务实现
基于 mail.tm 兼容 API（自部署 Cloudflare Worker 临时邮箱）
"""

import re
import time
import json
import logging
import random
import string
from typing import Optional, Dict, Any, List

from .base import BaseEmailService, EmailServiceError, EmailServiceType
from ..core.http_client import HTTPClient, RequestConfig
from ..config.constants import OTP_CODE_PATTERN


logger = logging.getLogger(__name__)


class DuckMailService(BaseEmailService):
    """
    DuckMail 邮箱服务
    基于 mail.tm 兼容 API 的自部署 Cloudflare Worker 临时邮箱
    """

    def __init__(self, config: Dict[str, Any] = None, name: str = None):
        """
        初始化 DuckMail 服务

        Args:
            config: 配置字典，支持以下键:
                - mode: 连接模式 "direct"(默认) 或 "proxied"
                直连模式 (direct):
                  - base_url: Worker 域名地址，如 https://mail.example.com (必需)
                代理模式 (proxied):
                  - proxy_url: Netlify 代理服务地址 (必需)
                  - worker_url: 可选，覆盖代理服务默认的 Worker 地址
                通用:
                  - domain: 邮箱域名，如 example.com (必需)
                  - password: 账户默认密码 (可选，默认自动生成)
                  - timeout: 请求超时时间，默认 30
                  - max_retries: 最大重试次数，默认 3
            name: 服务名称
        """
        super().__init__(EmailServiceType.DUCK_MAIL, name)

        config = config or {}
        mode = config.get("mode", "direct")

        if mode == "proxied":
            required_keys = ["proxy_url", "domain"]
        else:
            required_keys = ["base_url", "domain"]

        missing_keys = [key for key in required_keys if not config.get(key)]
        if missing_keys:
            raise ValueError(f"缺少必需配置: {missing_keys}")

        default_config = {
            "mode": "direct",
            "password": "",
            "timeout": 30,
            "max_retries": 3,
            "proxy_url": "",
            "worker_url": "",
        }
        self.config = {**default_config, **config}

        http_config = RequestConfig(
            timeout=self.config["timeout"],
            max_retries=self.config["max_retries"],
        )
        self.http_client = HTTPClient(proxy_url=None, config=http_config)

        # 邮箱缓存: email -> {address, password, jwt, id, created_at}
        self._email_cache: Dict[str, Dict[str, Any]] = {}

    def _get_password(self) -> str:
        """获取或生成账户密码"""
        pw = self.config.get("password")
        if pw:
            return pw
        return ''.join(random.choices(string.ascii_letters + string.digits, k=16))

    def _make_request(
        self, method: str, path: str, auth_token: str = None, **kwargs
    ) -> Any:
        mode = self.config.get("mode", "direct")

        if mode == "proxied":
            proxy_url = self.config["proxy_url"].rstrip("/")
            url = f"{proxy_url}/api/mail?endpoint={path}"
        else:
            base_url = self.config["base_url"].rstrip("/")
            url = f"{base_url}{path}"

        kwargs.setdefault("headers", {})
        kwargs["headers"].setdefault("Content-Type", "application/json")
        kwargs["headers"].setdefault("Accept", "application/json")

        if mode == "proxied":
            worker_url = self.config.get("worker_url", "")
            if worker_url:
                kwargs["headers"]["X-API-Provider-Base-URL"] = worker_url

        if auth_token:
            kwargs["headers"]["Authorization"] = f"Bearer {auth_token}"

        try:
            response = self.http_client.request(method, url, **kwargs)

            if response.status_code >= 400:
                error_msg = f"请求失败: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg = f"{error_msg} - {error_data}"
                except Exception:
                    error_msg = f"{error_msg} - {response.text[:200]}"
                self.update_status(False, EmailServiceError(error_msg))
                raise EmailServiceError(error_msg)

            try:
                return response.json()
            except json.JSONDecodeError:
                return {"raw_response": response.text}

        except Exception as e:
            self.update_status(False, e)
            if isinstance(e, EmailServiceError):
                raise
            raise EmailServiceError(f"请求失败: {method} {path} - {e}")

    def create_email(self, config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        通过 mail.tm 兼容 API 创建临时邮箱

        Returns:
            包含邮箱信息的字典:
            - email: 邮箱地址
            - jwt: Bearer token
            - service_id: 同 email
        """
        letters = ''.join(random.choices(string.ascii_lowercase, k=5))
        digits = ''.join(random.choices(string.digits, k=random.randint(1, 3)))
        suffix = ''.join(random.choices(string.ascii_lowercase, k=random.randint(1, 3)))
        username = letters + digits + suffix

        domain = self.config["domain"]
        address = f"{username}@{domain}"
        password = self._get_password()

        try:
            self._make_request(
                "POST", "/accounts",
                json={"address": address, "password": password},
            )

            token_resp = self._make_request(
                "POST", "/token",
                json={"address": address, "password": password},
            )
            jwt = token_resp.get("token", "").strip()

            if not jwt:
                raise EmailServiceError(f"获取 token 失败: {token_resp}")

            email_info = {
                "email": address,
                "jwt": jwt,
                "password": password,
                "service_id": address,
                "id": address,
                "created_at": time.time(),
            }
            self._email_cache[address] = email_info

            logger.info(f"成功创建 DuckMail 邮箱: {address}")
            self.update_status(True)
            return email_info

        except Exception as e:
            self.update_status(False, e)
            if isinstance(e, EmailServiceError):
                raise
            raise EmailServiceError(f"创建邮箱失败: {e}")

    def get_verification_code(
        self,
        email: str,
        email_id: str = None,
        timeout: int = 120,
        pattern: str = OTP_CODE_PATTERN,
        otp_sent_at: Optional[float] = None,
    ) -> Optional[str]:
        """
        从 DuckMail 邮箱获取验证码

        Args:
            email: 邮箱地址
            email_id: 未使用，保留接口兼容
            timeout: 超时时间（秒）
            pattern: 验证码正则
            otp_sent_at: OTP 发送时间戳（暂未使用）

        Returns:
            验证码字符串，超时返回 None
        """
        logger.info(f"正在从 DuckMail 邮箱 {email} 获取验证码...")

        cached = self._email_cache.get(email, {})
        jwt = cached.get("jwt")

        if not jwt:
            logger.warning(f"未找到邮箱 {email} 的 JWT，无法获取验证码")
            return None

        start_time = time.time()
        seen_msg_ids: set = set()

        while time.time() - start_time < timeout:
            try:
                response = self._make_request(
                    "GET", "/messages",
                    auth_token=jwt,
                    params={"page": 1},
                )

                messages = response.get("hydra:member", [])
                if not isinstance(messages, list):
                    time.sleep(3)
                    continue

                for msg in messages:
                    msg_id = msg.get("id")
                    if not msg_id or msg_id in seen_msg_ids:
                        continue

                    seen_msg_ids.add(msg_id)

                    sender = str(msg.get("from", {}).get("address", "")).lower()
                    subject = str(msg.get("subject", ""))
                    intro = str(msg.get("intro", ""))

                    quick_content = f"{sender}\n{subject}\n{intro}".strip()
                    if "openai" not in sender and "openai" not in quick_content.lower():
                        continue

                    detail = self._make_request(
                        "GET", f"/messages/{msg_id}",
                        auth_token=jwt,
                    )

                    text_parts = detail.get("text", [])
                    html_parts = detail.get("html", [])

                    body = ""
                    if isinstance(text_parts, list) and text_parts:
                        body = "\n".join(text_parts)
                    elif isinstance(text_parts, str):
                        body = text_parts

                    if not body and isinstance(html_parts, list) and html_parts:
                        raw_html = "\n".join(html_parts)
                        body = re.sub(r"<[^>]+>", " ", raw_html)
                    elif not body and isinstance(html_parts, str):
                        body = re.sub(r"<[^>]+>", " ", html_parts)

                    content = f"{sender}\n{subject}\n{body}".strip()
                    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
                    match = re.search(pattern, re.sub(email_pattern, "", content))
                    if match:
                        code = match.group(1)
                        logger.info(f"从 DuckMail 邮箱 {email} 找到验证码: {code}")
                        self.update_status(True)
                        return code

            except Exception as e:
                logger.debug(f"检查 DuckMail 邮件时出错: {e}")

            time.sleep(3)

        logger.warning(f"等待 DuckMail 验证码超时: {email}")
        return None

    def list_emails(self, **kwargs) -> List[Dict[str, Any]]:
        """返回缓存中的邮箱列表（Worker 无 list-all-accounts 端点）"""
        self.update_status(True)
        return list(self._email_cache.values())

    def delete_email(self, email_id: str) -> bool:
        """从本地缓存移除邮箱（Worker 不支持账户删除）"""
        removed = False
        to_delete = []

        for address, info in self._email_cache.items():
            if email_id in {address, info.get("id"), info.get("service_id")}:
                to_delete.append(address)

        for address in to_delete:
            self._email_cache.pop(address, None)
            removed = True

        if removed:
            logger.info(f"已从 DuckMail 缓存移除邮箱: {email_id}")
            self.update_status(True)
        else:
            logger.info(f"DuckMail 缓存中未找到邮箱: {email_id}")

        return removed

    def check_health(self) -> bool:
        """检查服务健康状态：GET /domains 并验证已配置域名"""
        try:
            response = self._make_request("GET", "/domains")

            members = response.get("hydra:member", [])
            if not isinstance(members, list):
                self.update_status(False, EmailServiceError("无法获取域名列表"))
                return False

            configured_domain = self.config["domain"]
            found = any(
                d.get("domain") == configured_domain or d.get("id") == configured_domain
                for d in members
            )

            if found:
                self.update_status(True)
                return True
            else:
                err = EmailServiceError(f"域名 {configured_domain} 不在 Worker 支持列表中")
                logger.warning(str(err))
                self.update_status(False, err)
                return False

        except Exception as e:
            logger.warning(f"DuckMail 健康检查失败: {e}")
            self.update_status(False, e)
            return False

    def get_service_info(self) -> Dict[str, Any]:
        """获取服务信息"""
        mode = self.config.get("mode", "direct")
        info = {
            "service_type": self.service_type.value,
            "name": self.name,
            "mode": mode,
            "domain": self.config["domain"],
            "cached_emails_count": len(self._email_cache),
            "status": self.status.value,
        }
        if mode == "proxied":
            info["proxy_url"] = self.config.get("proxy_url", "")
            info["worker_url"] = self.config.get("worker_url", "")
        else:
            info["base_url"] = self.config.get("base_url", "")
        return info
