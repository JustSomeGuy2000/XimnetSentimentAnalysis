import io
import json
import pandas as pd
import transformers as tf

PRODUCT_NAME = "productname"
REVIEW = "review"

pipeline = tf.pipeline("text-classification", device="cpu")

async def analyse(data: str) -> str:
    '''Analyse a CSV string containing product reviews according to a certain schema and return a sentiment analysis. <br />
    ## Schema
    2 fields expected, in relative order (case-sensitive until further notice): 

        1. productName (str)
        2. review (str)
    Having more than 2 fields matching these names will result in an error.

    Records with either of these empty will be ignored.

    Lines with too many fields will be ignored.

    Records delimited with a line break.

    A header is expected, a first line containing names of fields, in order.

    Delimiter is a standalone comma.

    ## Output
    JSON in format: {
        productName1: {
            "p": number of positive reviews, 
            "n": number of negative reviews
            
            }, 
        productName2: ...
    }
    {"error": error} is returned if an error occurred.'''
    try:
        readData = pd.read_csv(io.StringIO(data), sep=",", header=0, usecols=lambda c: str(c).lower() in [PRODUCT_NAME, REVIEW], dtype=pd.StringDtype(), skip_blank_lines=True, iterator=False, on_bad_lines="skip")
        readData.columns = [PRODUCT_NAME, REVIEW]
        products: dict[str, list[str]] = {}
        for _, ser in readData.iterrows():
            if ser[PRODUCT_NAME] in products:
                products[ser[PRODUCT_NAME]].append(ser[REVIEW])
            else:
                products[ser[PRODUCT_NAME]] = [ser[REVIEW]]
        sentiments: dict[str, dict[str, int]] = {} #In the value list, first item is positives and second is negatives
        for name, reviews in products.items():
            sentimentDict = {"p": 0, "n": 0}
            rawSentiments = pipeline(reviews)
            for rawSent in rawSentiments:
                if rawSent["label"] == "POSITIVE":
                    sentimentDict["p"] += 1
                else:
                    sentimentDict["n"] += 1
            sentiments[name] = sentimentDict
        return json.dumps(sentiments)
    except Exception as e:
        return '{"error": "' + str(e) + '"}'