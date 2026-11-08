import pdfplumber
import os

screens = [
    'customer-home.pdf',
    'customer-menu.pdf',
    'customer-product-details.pdf',
    'customer-cart.pdf',
    'customer-checkout.pdf',
    'customer-order-tracking.pdf',
    'customer-my-orders.pdf',
    'customer-feedback.pdf'
]

with open('design/screen_layouts.txt', 'w', encoding='utf-8') as out_f:
    for s in screens:
        path = os.path.join('design/extracted', s)
        out_f.write(f"\n==================== {s} ====================\n")
        with pdfplumber.open(path) as pdf:
            p = pdf.pages[0]
            words = p.extract_words()
            lines = {}
            for w in words:
                y = int(w['top'] // 12) * 12
                lines.setdefault(y, []).append(w['text'])
            for y in sorted(lines.keys()):
                line_str = " ".join(lines[y])
                out_f.write(f"{y:4d} | {line_str}\n")
print("Done writing screen_layouts.txt")

