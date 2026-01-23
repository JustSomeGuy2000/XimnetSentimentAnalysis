import io
import os
import random as r
import pandas as pd

PRODUCT_NAME = "product_name"
REVIEW = "Summary"

STREAK_LENGTH = 20
STREAK_COUNT = 20

def allSelector(_):
    return True

def onlyRequiredSelector(c):
    return str(c) in [PRODUCT_NAME, REVIEW]

SELECTOR = onlyRequiredSelector

dirPath = os.path.dirname(os.path.realpath(__file__))

def select(streakCount = STREAK_COUNT, streakLength = STREAK_LENGTH, selector = SELECTOR, oriData: io.TextIOWrapper | None = None):
    if oriData == None:
        data = open(f"{dirPath}/dataset.csv", encoding="utf-8")
    else:
        data = oriData
        
    try:
        readData = pd.read_csv(data, sep=",", header=0, usecols=selector, dtype=pd.StringDtype(), skip_blank_lines=True, iterator=False, on_bad_lines="skip", encoding="utf-8")
        cols = len(readData.index) - streakLength
        outList: list[pd.DataFrame] = []
        used: list[tuple[int, int]] = []
        for _ in range(streakCount):
            ind = r.randrange(0, cols)
            while (ind, ind + streakLength) in used:
                ind = r.randrange(0, cols)
            used.append((ind, ind + streakLength))
            outList.append(readData[ind:ind + streakLength])
        outData = pd.concat(outList)
        print("Noot noot!")
        outData.to_csv(f"{dirPath}/testData.csv", index=False)
    finally:
        if oriData == None:
            data.close()

if __name__ == "__main__":
    select()