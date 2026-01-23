import os
import asyncio
import sandbox
from typing import Literal, Any

type TestResults = dict[Literal["start"] | Literal["end"] | Literal["memory"] | Literal["rows"], Any]

INFER = False
PRODUCT_NAME = "product_name"
REVIEW = "Summary"

dirPath = os.path.dirname(os.path.realpath(__file__))

with open(f"{dirPath}/testData.csv", encoding="utf-8") as file:
    data = file.read()
    testResults: TestResults = {}
    results = asyncio.run(sandbox.analyser(data, INFER, PRODUCT_NAME, REVIEW, testResults))
    print(f"Lines (excluding header): {testResults["rows"]}")
    print(f"Time: {testResults["end"] - testResults["start"]} seconds")
    print(f"Memory usage (bytes): {testResults["memory"]}")
    print(f"Result: {results}")