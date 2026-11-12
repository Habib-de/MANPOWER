# diagnostic.py
import pandas as pd
from collections import Counter

# Load data
comments_df = pd.read_csv('../data/member_comments_ml_training.csv')

print("🔍 DATA PATTERN ANALYSIS")
print("=" * 50)

# Check if messages are unique or repeated
message_counts = comments_df['message_content'].value_counts()
print(f"Total unique messages: {len(message_counts)}")
print(f"Total comments: {len(comments_df)}")
print(f"Unique ratio: {len(message_counts)/len(comments_df):.3f}")

# Check message-label mapping
print(f"\n🎯 MESSAGE-LABEL MAPPING ANALYSIS:")
sample_messages = comments_df['message_content'].value_counts().head(10)
for message, count in sample_messages.items():
    labels = comments_df[comments_df['message_content'] == message]['type'].unique()
    print(f"'{message[:40]}...' → Always: {list(labels)} (Count: {count})")

# Check if same text always has same label
print(f"\n🔎 CHECKING FOR PERFECT MAPPINGS:")
problematic_messages = []
for message in comments_df['message_content'].unique():
    labels = comments_df[comments_df['message_content'] == message]['type'].unique()
    if len(labels) > 1:
        problematic_messages.append((message, labels))

if problematic_messages:
    print(f"✅ Found {len(problematic_messages)} messages with multiple labels (GOOD!)")
    for msg, labels in problematic_messages[:3]:
        print(f"   '{msg[:50]}...' → Labels: {list(labels)}")
else:
    print(f"🚨 PROBLEM: Every unique message maps to exactly one label!")
    print(f"   This means the model can just memorize phrases!")