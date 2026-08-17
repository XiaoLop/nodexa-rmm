from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


DESIGN_DIR = Path(__file__).parent.parent / "ui-designs"
GROUPS = [
    ("ui-main-pages.png", ["home", "devices", "events", "account"]),
    (
        "ui-extra-pages.png",
        ["device-detail", "login", "group-editor", "batch-operations", "add-device"],
    ),
]
LABELS = {
    "home": "HOME",
    "devices": "DEVICES",
    "events": "EVENTS",
    "account": "ACCOUNT",
    "device-detail": "DEVICE DETAIL",
    "login": "LOGIN",
    "group-editor": "GROUP EDITOR",
    "batch-operations": "BATCH OPERATIONS",
    "add-device": "ADD DEVICE",
}


def main() -> None:
    font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 22)
    background = (235, 241, 245)
    width, height, gap, label_height = 390, 844, 34, 66

    for output_name, screen_names in GROUPS:
        columns = 2 if len(screen_names) == 4 else 3
        rows = (len(screen_names) + columns - 1) // columns
        canvas = Image.new(
            "RGB",
            (
                columns * width + (columns + 1) * gap,
                rows * (height + label_height) + (rows + 1) * gap,
            ),
            background,
        )
        draw = ImageDraw.Draw(canvas)

        for index, name in enumerate(screen_names):
            x = gap + (index % columns) * (width + gap)
            y = gap + (index // columns) * (height + label_height + gap)
            draw.rounded_rectangle(
                (x - 6, y + label_height - 6, x + width + 6, y + label_height + height + 6),
                22,
                fill=(205, 216, 223),
            )
            draw.text((x, y + 17), LABELS[name], font=font, fill=(16, 42, 67))
            screenshot = Image.open(DESIGN_DIR / f"{name}.png").convert("RGB")
            canvas.paste(screenshot, (x, y + label_height))

        canvas.save(DESIGN_DIR / output_name, quality=95)


if __name__ == "__main__":
    main()
