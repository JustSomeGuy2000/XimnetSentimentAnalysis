import os
import sys
import asyncio
import time as t
sys.path.insert(1, os.path.join(sys.path[0], '..'))
from src.process import analyse

PRODUCT_NAME = "product_name"
REVIEW = "Summary"

dirPath = os.path.dirname(os.path.realpath(__file__))

with open(f"{dirPath}/testData.csv", encoding="utf-8") as file:
    lines = file.readlines()
    start = t.time()
    results = asyncio.run(analyse("\n".join(lines), PRODUCT_NAME, REVIEW))
    print(f"Lines (excluding header): {len(lines) - 1}")
    print(f"Time: {t.time() - start} seconds")
    print(f"Result: {results}")