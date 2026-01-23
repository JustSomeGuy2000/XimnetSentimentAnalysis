import io
import json
import pandas as pd
import functools as ft
import transformers as tf
from typing import Literal

type SentimentsJson = dict[str, dict[str, list[Literal["p"] | Literal["n"] | Literal["e"]] | list[str]]]

class NamesInfo:
    def __init__(self):
        self.prod: str | None = None
        self.rev: str | None = None
        self.count: int = 0

POTENTIAL_REV = ["review", "reviews"]
POTENTIAL_PROD = ["productname", "product_name", "product name"]

def colTest(info: NamesInfo, c: object):
    name = str(c).lower()
    ret = False
    if name in POTENTIAL_PROD and name != info.prod:
        if info.prod == None:
            ret = True
        info.prod = name
        info.count += 1
    elif name in POTENTIAL_REV and name != info.rev:
        if info.rev == None:
            ret = True
        info.rev = name
        info.count += 1
    return ret

MODEL = "tabularisai/multilingual-sentiment-analysis"
pipeline = tf.pipeline("text-classification", model=MODEL, device="cpu")

async def analyse(data: str, infer: bool, prodName: str, revName: str) -> str:
    '''Analyse a CSV string containing product reviews according to a certain schema and return a sentiment analysis. <br />
    ## Schema
    Exactly 2 fields matching the provided product field and review field names expected (case-sensitive).

    Having more or less than 2 fields matching these names will result in an error.

    Records with either of these empty will be ignored.

    Lines with too many fields will be ignored.

    Records delimited with a line break.

    A header is expected, a first line containing names of fields, in order.

    Delimiter is a standalone comma.

    ## Output

    JSON: {
        [index: string]: {
            sentiments: ("p" | "n" | "e")[],
            reviews: string[]
        }
    }
    Each index string is a product name, and the list of characters indicates the sentiments of each review, in input order.

    "p" = positive, "n" = negative, "e" = neutral

    {"error": error description} is returned if an error occurred.'''
    try:
        if infer:
            info = NamesInfo()
            readData = pd.read_csv(io.StringIO(data), sep=",", header=0, usecols=ft.partial(colTest, info), dtype=pd.StringDtype(), skip_blank_lines=True, iterator=False, on_bad_lines="skip", keep_default_na=False)
            cols = info.count
            if cols < 2:
                return json.dumps({"error": "Inference failure: too few matches. Please specify column names.", "inferFailure": True})
            elif cols > 2:
                return json.dumps({"error": f"Inference failure: too many matches({info.count}). Please specify column names.", "inferFailure": True})
            prodName = str(info.prod)
            revName = str(info.rev)
        else:
            readData = pd.read_csv(io.StringIO(data), sep=",", header=0, usecols=(lambda c: str(c) in [prodName, revName]), dtype=pd.StringDtype(), skip_blank_lines=True, iterator=False, on_bad_lines="skip", keep_default_na=False)
            cols = len(readData.columns)
            if cols < 2:
                return json.dumps({"error": "Provided names not found.", "inferFailure": False})
            elif cols > 2:
                return json.dumps({"error": f"Too many columns ({cols}) match provided names", "inferFailure": False})
        
        products: dict[str, list[str]] = {}
        for _, ser in readData.iterrows():
            if ser[prodName] in products:
                products[ser[prodName]].append(ser[revName])
            else:
                products[ser[prodName]] = [ser[revName]]
                
        sentiments: SentimentsJson = {} #In the value list, first item is positives and second is negatives
        for name, reviews in products.items():
            sentimentList: list[Literal["p"] | Literal["n"] | Literal["e"]] = []
            rawSentiments = pipeline(reviews)
            for rawSent in rawSentiments:
                if rawSent["label"] == "Positive" or rawSent["label"] == "Very Positive":
                    sentimentList.append("p")
                elif rawSent["label"] == "Negative" or rawSent["label"] == "Very Negative":
                    sentimentList.append("n")
                elif rawSent["label"] == "Neutral":
                    sentimentList.append("e")
                else:
                    print(f"Unknown value received from model: {rawSent}")
            sentiments[name] = {"sentiments": sentimentList, "reviews": reviews}
        return json.dumps(sentiments)
    except Exception as e:
        return json.dumps({"error": str(e), "inferFailure": False})