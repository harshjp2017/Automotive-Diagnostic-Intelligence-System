"""
Auto Service RAG - Torque Specification Extraction and Unit Conversion Filter
Handles OEM fastener torque specifications with bidirectional conversions (Nm, ft-lb, in-lb).
"""

import re
from typing import Dict, Any, Optional

class TorqueFilter:
    """Manages torque specifications for automotive fasteners."""

    NM_TO_FTLB = 0.737562
    NM_TO_INLB = 8.85075
    FTLB_TO_NM = 1.355818
    INLB_TO_NM = 0.1129848

    @staticmethod
    def parse_torque_value(value_str: str) -> Dict[str, Any]:
        """Parses a torque string like '15 Nm (133 lb-in)' or '21 Nm + 45 deg'."""
        angle_match = re.search(r'\+\s*([0-9]+)\s*(?:deg|°)', value_str, re.IGNORECASE)
        angle_deg = int(angle_match.group(1)) if angle_match else None

        nm_match = re.search(r'([0-9\.]+)\s*Nm', value_str, re.IGNORECASE)
        ftlb_match = re.search(r'([0-9\.]+)\s*(?:ft-lb|lb-ft)', value_str, re.IGNORECASE)
        inlb_match = re.search(r'([0-9\.]+)\s*(?:in-lb|lb-in)', value_str, re.IGNORECASE)

        nm = float(nm_match.group(1)) if nm_match else None
        ftlb = float(ftlb_match.group(1)) if ftlb_match else None
        inlb = float(inlb_match.group(1)) if inlb_match else None

        # Infer missing units if Nm is known
        if nm is not None:
            if ftlb is None and nm >= 15:
                ftlb = round(nm * TorqueFilter.NM_TO_FTLB, 1)
            if inlb is None and nm < 25:
                inlb = round(nm * TorqueFilter.NM_TO_INLB, 1)

        return {
            "raw": value_str,
            "nm": nm,
            "ft_lb": ftlb,
            "in_lb": inlb,
            "angle_degrees": angle_deg,
            "is_torque_to_yield": angle_deg is not None,
        }

    @staticmethod
    def format_torque_table(torque_dict: Dict[str, str]) -> str:
        """Formats torque specs into a markdown table for mechanical reporting."""
        if not torque_dict:
            return "No specific bolt torque values cited for this operation."

        lines = ["| Fastener / Component | Factory Torque Spec | Angle / Yield |", "|:---|:---|:---|"]
        for comp, val in torque_dict.items():
            parsed = TorqueFilter.parse_torque_value(val)
            angle = f"+{parsed['angle_degrees']}° (TTY - Replace Bolt)" if parsed['is_torque_to_yield'] else "Torque only"
            lines.append(f"| {comp} | {val} | {angle} |")

        return "\n".join(lines)
