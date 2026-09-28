"""Мост модуля нагрузок ЭС-Нефтегаз → eldraw (ГОСТ 2.702 / ЕСКД)."""

from .generate_sld import build_sld_from_loads, generate_files

__all__ = ["build_sld_from_loads", "generate_files"]
