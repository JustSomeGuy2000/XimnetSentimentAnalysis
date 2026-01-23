# About
XiMnet internship assignment 1: sentiment analysis

# Running
1. Download repository.
2. Have Python 13.3 available.
3. Install dependencies (found in requirements.txt).
4. Run server.py or enter "fastapi dev server.py" in the command line.
5. Navigate to localhost://8000 on a web browser after the server starts.

# Usage
1. Upload a CSV file.
2. Enter the names of the columns meant to be product name and reviews.
3. Press submit and wait.
4. Pie charts showing the amount of positive and negative reviews for each product will be shown.
5. If an error message occurs, try to fix it.

# Testing
- The default full testing dataset is ./testing/dataset.csv. Note that it has 205,000 rows.
- ./testing/selector.py can be used to obtain a randomly extracted sample of dataset.csv.
- To use it, run it and a file called testData.csv will appear in its directory containing the output.
- By default, it selects 20 points from dataset.csv and extracts a series of 20 rows starting from each point, for 20*20 = 400 rows in total, along with 1 header row
- Several settings are configurable by modifying variables in the file:
  - PRODUCT_NAME is the name of the product name column.
  - REVIEW is the name of the reviews column.
  - STREAK_COUNT is how many points to take from.
  - STREAK_LENGTH is how many rows to take starting from each point.
  - SELECTOR is a rule for choosing which columns appear in the output. The two options already available are allSelector (all columns) and onlyRequiredSelector (only the product name and review columns). Ant function taking one string and returning a boolean will do. Column names are fed in, and a returned True value indicates that colum should be included.
- Running ./testing/test.py will input testData.csv into the analyser function from ./testing/sandbox.py. It is the same as in ./src/process.py but with a few extra testing capabilities.
  - The PRODUCT_NAME and REVIEW variables fulfill the same function as in selector.py.
  - When complete, it will output the amount of rows, time taken, and result.
  - Note that files are opened assuming a UTF-8 encoding.
  - Also note that dataset.csv contains many strange code points (already present in the source). \u escape sequences or unrecognised character marks in the output are to be expected.

# Model Notes
- Model [tabularisai/multilingual-sentiment-analysis](https://huggingface.co/tabularisai/multilingual-sentiment-analysis) from HuggingFace is used.
  - Out of all the sentiment analysis models I found with multilingual capabilities and 3 or more classification cases, this one had the most monthly downloads.
- Has 5 classification cases (Very Positive, Positive, Neutral, Negative, Very Negative), but "Positive" and "Very Positive" are consolidated into one final category, as are "Negative" and "Very Negative".
- Easily tripped up by spelling errors and nonstandard spellings, especially of important sentiment-indicating words, like:
  - "awesome" -> "aasome"
  - "good" -> "gud"
  - "thank you" -> "thankyou"
- Also has trouble with bad grammar and reviews with multiple sentiments (regarding, for example, different aspects of the product).
  - Unfortunately, longer reviews in the test dataset tend to also have terrible grammar, compounding the problem.
- Neutral classification tends to be less accurate than positive or negative.
- Not that positive or negative classifications are completely accurate either.