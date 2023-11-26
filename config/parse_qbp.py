import pandas as pd

filename = 'qbp_catalog.csv'
df = pd.read_csv(filename, low_memory=False)

unique_categories = df["QBP_Category"]
unique_categories = unique_categories.dropna()
unique_categories = sorted(unique_categories.unique())

for cat in unique_categories:
    print(cat)

