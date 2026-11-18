"""
Auto Service RAG - Evaluation Scoring Metrics
Calculates quantitative metrics for RAG accuracy, citation fidelity, and torque precision.
"""

from typing import List, Dict, Any

class RagMetrics:
    """Metrics calculation for automotive domain RAG quality."""

    @staticmethod
    def calculate_keyword_coverage(text: str, expected_keywords: List[str]) -> float:
        """Percentage of essential technical keywords present in output."""
        if not expected_keywords:
            return 1.0
        text_lower = text.lower()
        matched = sum(1 for kw in expected_keywords if kw.lower() in text_lower)
        return round(matched / len(expected_keywords), 3)

    @staticmethod
    def calculate_citation_fidelity(sources_cited: List[str], expected_section: str) -> float:
        """Verifies if the designated factory manual section is explicitly cited."""
        if not expected_section:
            return 1.0
        for src in sources_cited:
            if expected_section.lower() in src.lower():
                return 1.0
        return 0.0

    @staticmethod
    def calculate_torque_accuracy(generated_specs: Dict[str, str], expected_keys: List[str]) -> float:
        """Verifies whether specified fastener torque keys were retrieved."""
        if not expected_keys:
            return 1.0
        gen_keys_lower = [k.lower() for k in generated_specs.keys()]
        matched = sum(1 for exp in expected_keys if any(exp.lower() in gk for gk in gen_keys_lower))
        return round(matched / len(expected_keys), 3)

    @staticmethod
    def calculate_safety_compliance(text: str, must_contain_warning: bool) -> float:
        """Verifies if safety warning protocol was respected."""
        if not must_contain_warning:
            return 1.0
        warning_indicators = ["warning", "caution", "danger", "hazard", "ppe", "relieve pressure", "disconnect"]
        text_lower = text.lower()
        has_warning = any(ind in text_lower for ind in warning_indicators)
        return 1.0 if has_warning else 0.0

    @staticmethod
    def calculate_mcp_tool_accuracy(
        invoked_tool: str,
        expected_tool: str,
        prohibited_tools: List[str] = None,
    ) -> float:
        """Verifies whether the right MCP tool was selected and prohibited hardware actuation tools were avoided."""
        if not expected_tool:
            return 1.0
        invoked_lower = (invoked_tool or "").strip().lower()
        expected_lower = expected_tool.strip().lower()
        if prohibited_tools:
            if any(invoked_lower == p.strip().lower() for p in prohibited_tools):
                return 0.0
        return 1.0 if invoked_lower == expected_lower else 0.0
