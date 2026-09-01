"""
Converts MBDD2025's PASCAL VOC XML annotations (Annotations/ + JPEGImages/)
into the YOLO-format dataset layout Ultralytics expects, with a train/val
split.

MBDD2025's own README confirms: annotation format is PASCAL VOC XML, one
XML file per image in Annotations/, matching image files in JPEGImages/.
Class names are read directly from the XML <name> tags rather than
hardcoded, so this doesn't depend on assuming exact capitalization/spelling
of the five defect classes.

Usage:
    python voc_to_yolo.py --source /path/to/MBDD2025 --dest /path/to/output --val-split 0.1

Produces:
    <dest>/images/train/*.jpg
    <dest>/images/val/*.jpg
    <dest>/labels/train/*.txt
    <dest>/labels/val/*.txt
    <dest>/data.yaml
"""

import argparse
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path


def parse_voc_xml(xml_path: Path):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    size = root.find("size")
    width = int(size.find("width").text)
    height = int(size.find("height").text)

    objects = []
    for obj in root.findall("object"):
        name = obj.find("name").text.strip()
        bndbox = obj.find("bndbox")
        xmin = float(bndbox.find("xmin").text)
        ymin = float(bndbox.find("ymin").text)
        xmax = float(bndbox.find("xmax").text)
        ymax = float(bndbox.find("ymax").text)
        objects.append((name, xmin, ymin, xmax, ymax))

    return width, height, objects


def to_yolo_line(class_id: int, width: int, height: int, xmin, ymin, xmax, ymax) -> str:
    x_center = ((xmin + xmax) / 2) / width
    y_center = ((ymin + ymax) / 2) / height
    w = (xmax - xmin) / width
    h = (ymax - ymin) / height
    return f"{class_id} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to the unzipped MBDD2025 folder")
    parser.add_argument("--dest", required=True, help="Output folder for the YOLO-format dataset")
    parser.add_argument("--val-split", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    source = Path(args.source)
    dest = Path(args.dest)
    images_dir = source / "JPEGImages"
    annotations_dir = source / "Annotations"

    xml_files = sorted(annotations_dir.glob("*.xml"))
    if not xml_files:
        raise SystemExit(f"No XML files found in {annotations_dir}")

    # First pass: discover every class name actually used, so the class
    # index mapping is derived from the real data rather than assumed.
    class_names = set()
    parsed = []
    skipped = 0
    for xml_path in xml_files:
        width, height, objects = parse_voc_xml(xml_path)
        if not objects:
            skipped += 1
            continue
        image_path = images_dir / (xml_path.stem + ".jpg")
        if not image_path.exists():
            print(f"Skipping {xml_path.name}: no matching image at {image_path}")
            skipped += 1
            continue
        parsed.append((image_path, width, height, objects))
        for name, *_ in objects:
            class_names.add(name)

    class_names = sorted(class_names)
    class_to_id = {name: i for i, name in enumerate(class_names)}
    print(f"Discovered {len(class_names)} classes: {class_names}")
    if len(class_names) != 5:
        print(
            f"Warning: expected 5 defect classes per MBDD2025's README, found {len(class_names)} - "
            "double check the XML <name> values look right before training."
        )
    print(f"{len(parsed)} usable images, {skipped} skipped (no objects or missing image file)")

    random.seed(args.seed)
    random.shuffle(parsed)
    val_count = int(len(parsed) * args.val_split)
    val_set = parsed[:val_count]
    train_set = parsed[val_count:]

    for split_name, split_data in [("train", train_set), ("val", val_set)]:
        (dest / "images" / split_name).mkdir(parents=True, exist_ok=True)
        (dest / "labels" / split_name).mkdir(parents=True, exist_ok=True)
        for image_path, width, height, objects in split_data:
            shutil.copy(image_path, dest / "images" / split_name / image_path.name)
            label_lines = [
                to_yolo_line(class_to_id[name], width, height, xmin, ymin, xmax, ymax)
                for name, xmin, ymin, xmax, ymax in objects
            ]
            label_path = dest / "labels" / split_name / (image_path.stem + ".txt")
            label_path.write_text("\n".join(label_lines))

    names_block = "\n".join(f"  {i}: {name}" for i, name in enumerate(class_names))
    data_yaml = dest / "data.yaml"
    data_yaml.write_text(
        f"path: {dest.resolve()}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"names:\n{names_block}\n"
    )

    print(f"Wrote {len(train_set)} train / {len(val_set)} val images to {dest}")
    print(f"data.yaml written to {data_yaml}")


if __name__ == "__main__":
    main()
