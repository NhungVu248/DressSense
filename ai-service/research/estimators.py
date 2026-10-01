"""
Khung ƯỚC LƯỢNG SỐ ĐO TỪ ẢNH - interface pluggable.

Cho phép thay phương pháp mà KHÔNG đổi phần gọi: hiện có baseline hình học (chạy được
Windows/CPU); điểm cắm sẵn cho SHAPY/SMPL-X (bản nâng cấp SOTA, cần Linux+GPU - xem README).

Dùng:
    from estimators import get_estimator
    est = get_estimator("geometric")           # hoặc "shapy" khi có môi trường phù hợp
    circ = est.estimate("front.jpg", "side.jpg", height_cm=165)   # -> {bust, waist, hip}
"""
from abc import ABC, abstractmethod
from typing import Optional


class MeasurementEstimator(ABC):
    """Chuẩn chung: ảnh (+chiều cao) -> chu vi ngực/eo/hông (cm)."""
    name = "base"

    @abstractmethod
    def estimate(self, front_image: str, side_image: Optional[str] = None,
                 height_cm: Optional[float] = None) -> Optional[dict]:
        """Trả {'bust': cm, 'waist': cm, 'hip': cm} hoặc None nếu không ước lượng được."""
        raise NotImplementedError


class GeometricEstimator(MeasurementEstimator):
    """Baseline hình học: MediaPipe pose + mask, loại cánh tay, chu vi xấp xỉ elip.
    Chạy được trên Windows/CPU. Cần ảnh TRƯỚC + (nên có) ảnh NGHIÊNG + chiều cao."""
    name = "geometric"

    def __init__(self):
        from estimate_measurements import make_landmarker
        self._lmk = make_landmarker()

    def estimate(self, front_image, side_image=None, height_cm=None):
        from estimate_measurements import run, extract
        if height_cm is None:
            raise ValueError("GeometricEstimator cần height_cm để quy tỉ lệ cm/pixel.")
        front = run(self._lmk, front_image)
        if not front:
            return None
        side = run(self._lmk, side_image) if side_image else None
        ex = extract(front, side, float(height_cm))
        return {k: round(float(v), 1) for k, v in ex["circ"].items()} if ex else None


class ShapyEstimator(MeasurementEstimator):
    """Bản nâng cấp SOTA: SHAPY (SMPL-X) ảnh đơn -> số đo 3D.

    CHƯA hiện thực ở đây: cần Linux + GPU + đăng ký SMPL-X/HBW (phi thương mại) - xem
    research/README.md mục "Benchmark & hướng phát triển". Đây là ĐIỂM CẮM sẵn: khi có môi
    trường phù hợp, hiện thực estimate() bằng cách gọi model SHAPY (image -> SMPL-X betas ->
    đo chu vi trên mesh) và trả về cùng cấu trúc {bust, waist, hip}.
    """
    name = "shapy"

    def estimate(self, front_image, side_image=None, height_cm=None):
        raise NotImplementedError(
            "ShapyEstimator cần Linux+GPU + model SHAPY/SMPL-X (xem research/README.md). "
            "Trên Windows/CPU hãy dùng get_estimator('geometric')."
        )


_REGISTRY = {"geometric": GeometricEstimator, "shapy": ShapyEstimator}


def get_estimator(name: str = "geometric") -> MeasurementEstimator:
    if name not in _REGISTRY:
        raise ValueError(f"Không có estimator '{name}'. Có: {list(_REGISTRY)}")
    return _REGISTRY[name]()


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--method", default="geometric", choices=list(_REGISTRY))
    ap.add_argument("--front", required=True)
    ap.add_argument("--side")
    ap.add_argument("--height", type=float, required=True)
    a = ap.parse_args()
    print(get_estimator(a.method).estimate(a.front, a.side, a.height))
