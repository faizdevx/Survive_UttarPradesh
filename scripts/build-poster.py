# Cuts the poster art for the map page out of the source images.
# Usage: python scripts/build-poster.py <folder with the source images>
import sys
import cv2
import numpy as np

SRC, OUT = sys.argv[1].rstrip('/') + '/', 'public/img/poster/'

# name: file, bottom edge to keep, rough outlines traced by hand. grabCut only settles the band around each outline.
PEOPLE = {
    'yogi': ('26.jpg', 860, [[(382, 60), (455, 75), (510, 196), (522, 275), (485, 355), (500, 385), (618, 441), (686, 530), (735, 620), (735, 919), (0, 919), (0, 667), (20, 550), (78, 470), (196, 420), (275, 340), (252, 255), (265, 150)]]),
    'akhilesh': ('25.jpg', 465, [[(372, 0), (421, 8), (482, 98), (498, 176), (490, 255), (520, 333), (618, 392), (667, 588), (706, 736), (25, 736), (49, 510), (98, 382), (186, 323), (284, 294), (251, 196), (265, 98)]]),
    'mayawati': ('28.jpg', 285, [[(223, 115), (247, 133), (249, 175), (283, 193), (325, 217), (380, 247), (394, 271), (388, 301), (46, 301), (50, 253), (72, 229), (163, 193), (199, 175), (193, 150)]]),
    'modi': ('24.jpg', 736, [[(323, 66), (441, 95), (492, 186), (510, 353), (598, 402), (686, 402), (736, 490), (736, 736), (49, 736), (108, 569), (0, 539), (0, 402), (137, 372), (225, 343), (216, 255), (206, 157), (255, 98)],
                             [(20, 0), (130, 0), (150, 60), (188, 115), (130, 170), (85, 250), (0, 250), (0, 60)]]),
}

def cut(img, outlines):
    rough = np.zeros(img.shape[:2], np.uint8)
    for line in outlines:
        cv2.fillPoly(rough, [np.array(line, np.int32)], 255)
    band = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))
    mask = np.full(img.shape[:2], cv2.GC_BGD, np.uint8)
    mask[cv2.dilate(rough, band) > 0] = cv2.GC_PR_BGD
    mask[rough > 0] = cv2.GC_PR_FGD
    mask[cv2.erode(rough, band, borderType=cv2.BORDER_CONSTANT, borderValue=255) > 0] = cv2.GC_FGD
    bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(img, mask, None, bg, fg, 6, cv2.GC_INIT_WITH_MASK)
    solid = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    solid = cv2.morphologyEx(solid, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # Background scraps go, while a separate waving hand stays
    n, labels, stats, _ = cv2.connectedComponentsWithStats(solid)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 2500:
            solid[labels == i] = 0
    return cv2.GaussianBlur(solid, (5, 5), 0)

def sticker(img, alpha, edge=9):
    pad = edge + 2
    img = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    alpha = cv2.copyMakeBorder(alpha, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (edge * 2 + 1, edge * 2 + 1))
    white = cv2.GaussianBlur(cv2.dilate(alpha, kernel), (3, 3), 0)
    a = (alpha[..., None] / 255.0)
    rgb = img * a + 255 * (1 - a)
    return np.dstack([rgb.astype(np.uint8), white])

def save(name, bgra, height=None):
    if height and bgra.shape[0] > height:
        bgra = cv2.resize(bgra, (round(bgra.shape[1] * height / bgra.shape[0]), height), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}{name}.webp', bgra, [cv2.IMWRITE_WEBP_QUALITY, 82])

for name, (file, bottom, outlines) in PEOPLE.items():
    img = cv2.imread(SRC + file)
    alpha = cut(img, outlines)
    ys, xs = np.where(alpha[:bottom] > 10)
    box = (ys.min(), bottom, xs.min(), xs.max() + 1)
    save(name, sticker(img[box[0]:box[1], box[2]:box[3]], alpha[box[0]:box[1], box[2]:box[3]]), 460)

# Lettering: yellow letters with a hard dark shadow, nothing behind them
logo = cv2.imread(SRC + '22.jpg')
hsv = cv2.cvtColor(logo, cv2.COLOR_BGR2HSV)
letters = cv2.inRange(hsv, (18, 90, 150), (38, 255, 255))
letters = cv2.GaussianBlur(cv2.morphologyEx(letters, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)), (3, 3), 0)
shadow = cv2.warpAffine(letters, np.float32([[1, 0, 10], [0, 1, 10]]), letters.shape[::-1])
rgb = np.zeros_like(logo)
rgb[...] = (0, 10, 70)
a = letters[..., None] / 255.0
rgb = (np.array((58, 214, 250)) * a + rgb * (1 - a)).astype(np.uint8)
out = np.dstack([rgb, np.maximum(letters, shadow)])
ys, xs = np.where(out[..., 3] > 10)
save('rangbaazi', out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 300)

# Stamp: everything the same maroon as the corners goes
stamp = cv2.imread(SRC + '23.jpg')
light = cv2.cvtColor(stamp, cv2.COLOR_BGR2GRAY)
paper = cv2.morphologyEx(np.where(light > 95, 255, 0).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
flood = paper.copy()
holes = np.zeros((stamp.shape[0] + 2, stamp.shape[1] + 2), np.uint8)
cv2.floodFill(flood, holes, (0, 0), 128)
alpha = cv2.GaussianBlur(np.where(flood == 128, 0, 255).astype(np.uint8), (3, 3), 0)
ys, xs = np.where(alpha > 10)
save('stamp', np.dstack([stamp, alpha])[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 320)

# Plain crops
save('focus', cv2.imread(SRC + '29.jpg'), 420)
save('muse', cv2.imread(SRC + '30.jpg'), 460)

# UP-shaped wordmark: black becomes clear
word = cv2.imread(SRC + '27.jpg')
alpha = np.clip(word.max(axis=2).astype(np.float32) * 2.2, 0, 255).astype(np.uint8)
ys, xs = np.where(alpha > 30)
save('wordmark', np.dstack([word, alpha])[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 360)
