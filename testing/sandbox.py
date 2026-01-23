import io
import json
import time as t
import pandas as pd
import transformers as tf
from typing import Literal, Callable, Coroutine, Any

type SentimentsJson = dict[str, dict[str, list[Literal["p"] | Literal["n"] | Literal["e"]] | list[str]]]
type TestResults = dict[Literal["start"] | Literal["end"] | Literal["memory"] | Literal["rows"], object]

#MODEL = "distilbert/distilbert-base-uncased-finetuned-sst-2-english"
MODEL = "tabularisai/multilingual-sentiment-analysis"
pipeline = tf.pipeline("text-classification", model=MODEL, device="cpu")

async def analyse(data: str, prodName: str, revName: str, testResults: TestResults = {}) -> str:
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
        testResults["start"] = t.time()
        readData = pd.read_csv(io.StringIO(data), sep=",", header=0, usecols=lambda c: str(c) in [prodName, revName], dtype=pd.StringDtype(), skip_blank_lines=True, iterator=False, on_bad_lines="skip", keep_default_na=False)
        cols = len(readData.columns)
        if cols < 2:
            return json.dumps({"error": "Provided names not found."})
        elif cols > 2:
            return json.dumps({"error": f"Too many columns ({cols}) match provided names"})
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
        testResults["end"] = t.time()
        testResults["memory"] = readData.memory_usage(deep=True)
        testResults["rows"] = readData.shape[0]
        return json.dumps(sentiments)
    except Exception as e:
        return json.dumps({"error": str(e)})
    
analyser: Callable[[str, str, str, TestResults], Coroutine[None, None, str]] = analyse