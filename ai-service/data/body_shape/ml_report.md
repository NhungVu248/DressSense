# Báo cáo huấn luyện phân loại dáng người (GĐ3)

- Dữ liệu: `body_shapes_ansur.csv` — 1986 mẫu (số đo người thật ANSUR II)
- Đặc trưng: waist_hip, waist_bust, bust_hip (tỷ lệ chuẩn hóa)
- Phân bố nhãn: HOURGLASS 372, RECTANGLE 688, PEAR 675, APPLE 244, INVERTED_TRIANGLE 7

> ⚠️ Nhãn do LUẬT sinh (không phải người gán). Điểm cao = mô hình học lại luật với độ trung thành cao, KHÔNG phải bằng chứng độ chính xác trên nhãn thật.

## So sánh mô hình

| Model | accuracy | macro-F1 | weighted-F1 | CV macro-F1 (mean±std) |
|-------|----------|----------|-------------|------------------------|
| DecisionTree **(chọn)** | 0.935 | 0.956 | 0.934 | 0.884±0.065 |
| RandomForest | 0.922 | 0.947 | 0.922 | 0.873±0.067 |
| MLP | 0.930 | 0.953 | 0.930 | 0.898±0.067 |
| XGBoost | 0.922 | 0.946 | 0.922 | 0.880±0.063 |

## Confusion matrix — DecisionTree (tập test)

| thực\dự đoán | APPLE | HOURGLASS | INVERTED_TRIANGLE | PEAR | RECTANGLE |
|---|---|---|---|---|---|
| APPLE | 49 | 0 | 0 | 0 | 0 |
| HOURGLASS | 0 | 74 | 0 | 0 | 1 |
| INVERTED_TRIANGLE | 0 | 0 | 1 | 0 | 0 |
| PEAR | 0 | 0 | 0 | 130 | 5 |
| RECTANGLE | 1 | 7 | 0 | 12 | 118 |

## classification_report — DecisionTree
```
                   precision    recall  f1-score   support

            APPLE       0.98      1.00      0.99        49
        HOURGLASS       0.91      0.99      0.95        75
INVERTED_TRIANGLE       1.00      1.00      1.00         1
             PEAR       0.92      0.96      0.94       135
        RECTANGLE       0.95      0.86      0.90       138

         accuracy                           0.93       398
        macro avg       0.95      0.96      0.96       398
     weighted avg       0.94      0.93      0.93       398

```

## Feature importance — DecisionTree

- bust_hip: 0.621
- waist_bust: 0.340
- waist_hip: 0.039
