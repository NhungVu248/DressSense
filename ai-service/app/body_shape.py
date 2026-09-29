"""
Phân loại dáng người theo tỷ lệ ngực-eo-hông (rule-based baseline).
Port từ backend/src/constants/body-analysis.ts - GIỮ NGUYÊN ngưỡng để nhất quán
giữa Node và AI service. GĐ3 sẽ bổ sung nhánh ML dùng cùng bộ đặc trưng tỷ lệ.
"""
from typing import Optional, TypedDict

BALANCE_THRESHOLD = 5       # |bust-hip| <= 5 -> cân đối
DEFINED_WAIST_THRESHOLD = 9  # eo thu nhỏ rõ rệt
DOMINANT_THRESHOLD = 9       # ngực/hông trội rõ rệt
CONFIDENCE_THRESHOLD = 0.6   # dưới ngưỡng -> ước lượng sơ bộ (isPreliminary)


def _margin_confidence(value: float, threshold: float, base: float = 0.65) -> float:
    return min(0.95, base + abs(value - threshold) / 40.0)


def classify_body_shape(bust: float, waist: float, hip: float):
    """Trả (shape, confidence, note)."""
    bust_hip = bust - hip
    waist_bust_gap = bust - waist
    waist_hip_gap = hip - waist

    if waist >= bust - 2 or waist >= hip - 2:
        return "APPLE", round(_margin_confidence(waist, min(bust, hip), 0.6), 3), \
            "Vòng eo gần bằng hoặc lớn hơn vòng ngực/hông."

    if abs(bust_hip) <= BALANCE_THRESHOLD:
        if waist_bust_gap >= DEFINED_WAIST_THRESHOLD and waist_hip_gap >= DEFINED_WAIST_THRESHOLD:
            return "HOURGLASS", round(_margin_confidence(min(waist_bust_gap, waist_hip_gap), DEFINED_WAIST_THRESHOLD), 3), \
                "Ngực và hông cân đối, vòng eo thu nhỏ rõ rệt."
        return "RECTANGLE", round(_margin_confidence(BALANCE_THRESHOLD, abs(bust_hip), 0.6), 3), \
            "Ngực, eo và hông không chênh lệch nhiều."

    if bust_hip <= -DOMINANT_THRESHOLD:
        return "PEAR", round(_margin_confidence(-bust_hip, DOMINANT_THRESHOLD), 3), \
            "Vòng hông lớn hơn vòng ngực rõ rệt."
    if bust_hip >= DOMINANT_THRESHOLD:
        return "INVERTED_TRIANGLE", round(_margin_confidence(bust_hip, DOMINANT_THRESHOLD), 3), \
            "Vòng ngực/vai lớn hơn vòng hông rõ rệt."

    return "RECTANGLE", 0.5, "Tỷ lệ cơ thể không rõ rệt, kết quả mang tính tham khảo."


class Ratios(TypedDict):
    waist_hip: float
    waist_bust: float
    bust_hip: float
    shoulder_hip: Optional[float]


def compute_ratios(bust: float, waist: float, hip: float, shoulder: Optional[float] = None) -> Ratios:
    return {
        "waist_hip": round(waist / hip, 3),
        "waist_bust": round(waist / bust, 3),
        "bust_hip": round(bust / hip, 3),
        "shoulder_hip": round(shoulder / hip, 3) if shoulder and shoulder > 0 else None,
    }
