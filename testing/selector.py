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

with open(f"{dirPath}/dataset.csv", encoding="utf-8") as data:
    readData = pd.read_csv(data, sep=",", header=0, usecols=SELECTOR, dtype=pd.StringDtype(), skip_blank_lines=True, iterator=False, on_bad_lines="skip", encoding="utf-8")
    cols = len(readData.index) - STREAK_LENGTH
    outList: list[pd.DataFrame] = []
    used: list[tuple[int, int]] = []
    for i in range(STREAK_COUNT):
        ind = r.randrange(0, cols)
        while (ind, ind + STREAK_LENGTH) in used:
            ind = r.randrange(0, cols)
        used.append((ind, ind + STREAK_LENGTH))
        outList.append(readData[ind:ind + STREAK_LENGTH])
    outData = pd.concat(outList)
    print("Noot noot!")
    outData.to_csv(f"{dirPath}/testData.csv", index=False)