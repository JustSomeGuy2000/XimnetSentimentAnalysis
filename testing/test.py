import io
import os
import asyncio
import sandbox
import selector
from typing import Literal, Any, Callable

type TestResults = dict[Literal["start"] | Literal["end"] | Literal["memory"] | Literal["rows"], Any]

PRINT_RESULT = False

INFER = False
PRODUCT_NAME = "product_name"
REVIEW = "Summary"

dirPath = os.path.dirname(os.path.realpath(__file__))

async def singleTest():
    with open(f"{dirPath}/testData.csv", encoding="utf-8") as file:
        data = file.read()
        testResults: TestResults = {}
        results = await sandbox.analyser(data, INFER, PRODUCT_NAME, REVIEW, testResults)
        print(f"Lines (excluding header): {testResults["rows"]}")
        print(f"Time: {testResults["end"] - testResults["start"]} seconds")
        print(f"Memory usage (bytes): {testResults["memory"]}")
        if PRINT_RESULT:
            print(f"Result: {results}")

# 20 to 200: ([20, 40, 60, 80, 100, 120, 140, 160, 180, 200], [0.4814567565917969, 0.8475418090820312, 1.2499427795410156, 1.4989488124847412, 2.0568318367004395, 2.354867935180664, 2.693572998046875, 3.143500566482544, 3.7564055919647217, 4.002623081207275])
INITIAL_RESULTS: tuple[list[int], list[float]] = ([], [])
ITER_START = 1
ITERATIONS = 10
streakLength: Callable[[int], int] = lambda i: i
streakCount: Callable[[int], int] = lambda _: 20
async def timeTest():
    with open(f"{dirPath}/dataset.csv", encoding="utf-8") as data:
        results = INITIAL_RESULTS
        for i in range(ITER_START, ITER_START + ITERATIONS):
            sc = streakCount(i)
            sl = streakLength(i)
            selector.select(sc, sl, oriData=data)
            testResults: TestResults = {}
            with open(f"{dirPath}/testData.csv", encoding="utf-8") as testData:
                await sandbox.analyser(testData.read(), INFER, PRODUCT_NAME, REVIEW, testResults)
            results[0].append(sc * sl)
            results[1].append(testResults["end"] - testResults["start"])
            print(f"Finished iteration {i}.")
            data.seek(0, io.SEEK_SET)
        print(f"Result: {results}")

if __name__ == "__main__":
    asyncio.run(timeTest())