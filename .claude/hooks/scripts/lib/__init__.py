"""Thư viện dùng chung cho mọi gate script trong .agent/hooks/scripts.

Cung cấp contract stdin/stdout (hook_contract), wide-event logger (logger),
loader cấu hình (config) và các check logic độc lập event (checks).
"""

__all__ = ["hook_contract", "logger", "config", "checks"]
