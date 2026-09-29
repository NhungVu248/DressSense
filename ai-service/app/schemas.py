from typing import Optional

from pydantic import BaseModel


class Measurements(BaseModel):
    bust: float
    waist: float
    hip: float
    shoulder: Optional[float] = None
    height: Optional[float] = None
    weight: Optional[float] = None


class BodyShapeRequest(BaseModel):
    # UC3.2: nhận số đo (đường chắc chắn) HOẶC landmarks (từ /pose)
    measurements: Optional[Measurements] = None
    landmarks: Optional[list] = None  # 33 điểm [{x,y,z,visibility}]
